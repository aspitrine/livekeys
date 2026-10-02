import AVFoundation
import QuartzCore

struct MidiEvent {
  let type: String
  let channel: UInt8
  let data1: Int
  let data2: Int
}

/// Owns the AVAudioEngine graph and routes incoming MIDI to the layers.
/// Thread model: config changes come from the JS thread, MIDI from the CoreMIDI thread.
/// `lock` guards `layers`, `order`, `activeNotes` and each layer's instrument reference.
/// Graph mutations (attach / connect / detach) are serialized on `graph`. Nothing here runs on the render thread.
final class MixerEngine {
  /// Shared so the plugin editor view can reach the loaded Audio Units.
  static let shared = MixerEngine()

  var onMidiEvent: ((MidiEvent) -> Void)?
  var onLevel: ((Float) -> Void)?
  /// The engine came back after an interruption or a route change (JS restarts what it drives, e.g. pads).
  var onRestarted: (() -> Void)?

  private let engine = AVAudioEngine()
  private let lock = NSLock()
  private let graph = DispatchQueue(label: "livekeys.engine.graph")
  private var layers: [String: Layer] = [:]
  private var order: [String] = []
  /// Notes currently held, keyed by input (channel << 7 | note): which layers got which played note.
  /// Note-offs follow this map so transposition/range changes mid-note never leave hanging notes.
  private var activeNotes: [Int: [(Layer, UInt8, UInt8)]] = [:]
  private var runningRequested = false
  private var pedalInput = SustainState()
  /// Wheels / expression as last heard from the hardware (restored on layers that come back).
  private var controllerInput = ControllerState()
  private var duplicates = NoteDeduplicator()
  /// Layers of the current patch: only they receive new notes and controllers.
  /// Other loaded layers are preloaded neighbours or a previous patch whose notes are still ringing.
  /// nil = every layer is active.
  private var activeIds: Set<String>?
  private let limiter = AVAudioUnitEffect(audioComponentDescription: AudioComponentDescription(
    componentType: kAudioUnitType_Effect,
    componentSubType: kAudioUnitSubType_PeakLimiter,
    componentManufacturer: kAudioUnitManufacturer_Apple,
    componentFlags: 0,
    componentFlagsMask: 0
  ))
  private var observers: [NSObjectProtocol] = []
  private var lastLevelTime: CFTimeInterval = 0

  // MARK: - Lifecycle

  func start(options: EngineOptions) throws -> [String: Any] {
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playback, mode: .default, options: [])
    try session.setPreferredSampleRate(options.sampleRate)
    try session.setPreferredIOBufferDuration(Double(options.bufferFrames) / options.sampleRate)
    try session.setActive(true)

    try graph.sync {
      installLimiter()
      try resumeEngine()
    }
    lock.withLock { runningRequested = true }
    observeSystemEvents()
    return info()
  }

  func stop() {
    lock.withLock { runningRequested = false }
    panic()
    graph.sync {
      engine.mainMixerNode.removeTap(onBus: 0)
      masterMeter.detach()
      engine.stop()
    }
    observers.forEach(NotificationCenter.default.removeObserver)
    observers.removeAll()
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }

  func info() -> [String: Any] {
    let session = AVAudioSession.sharedInstance()
    return [
      "running": engine.isRunning,
      "sampleRate": session.sampleRate,
      "bufferFrames": Int((session.ioBufferDuration * session.sampleRate).rounded()),
      "ioBufferMs": session.ioBufferDuration * 1000,
      "outputLatencyMs": session.outputLatency * 1000,
      "outputRoute": session.currentRoute.outputs.first?.portName ?? "",
    ]
  }

  /// Master safety limiter (Apple AUPeakLimiter) between the main mixer and the output.
  var limiterEnabled: Bool {
    get { !limiter.bypass }
    set { limiter.bypass = !newValue }
  }

  /// mainMixer → limiter → output. Done once, before the engine starts.
  private func installLimiter() {
    guard limiter.engine == nil else { return }
    let mixer = engine.mainMixerNode
    let format = mixer.outputFormat(forBus: 0)
    engine.attach(limiter)
    engine.disconnectNodeOutput(mixer)
    engine.connect(mixer, to: limiter, format: format)
    engine.connect(limiter, to: engine.outputNode, format: format)
  }

  var masterVolume: Float {
    get { engine.mainMixerNode.outputVolume }
    set { engine.mainMixerNode.outputVolume = min(max(newValue, 0), 1) }
  }

  // MARK: - Layers

  func addLayer(id: String, config patch: LayerConfigRecord) {
    let layer = Layer(id: id)
    layer.config.apply(patch)
    _ = layer.sustain.configure(enabled: layer.config.sustainEnabled, channel: layer.config.midiChannel)
    if !layer.config.keyboard { layer.padVoices = PadVoices() }

    graph.sync {
      engine.attach(layer.instrument)
      if let pv = layer.padVoices {
        engine.attach(pv.second)
        engine.attach(pv.mixer)
      }
      engine.attach(layer.strip)
      // Initial sampler has no configured preset yet and stays silent.
      try? wire(layer)
      engine.connect(layer.strip, to: engine.mainMixerNode, format: nil)
      layer.midiBlock = layer.instrument.auAudioUnit.scheduleMIDIEventBlock

      let old: Layer? = lock.withLock {
        let old = layers[id]
        layers[id] = layer
        _ = layer.sustain.synchronize(from: pedalInput)
        if !order.contains(id) { order.append(id) }
        return old
      }
      if let old { detach(old) }
    }
    applyMix()
  }

  /// Routes new notes / controllers to these layers only. Others keep ringing until their notes are released.
  func setActiveLayers(_ ids: [String]) {
    lock.withLock {
      let next = Set(ids)
      let previous = activeIds ?? []
      activeIds = next
      // Wheels moved while these layers were away: bring them in line before they get new notes.
      for id in next.subtracting(previous) {
        if let layer = layers[id], layer.audioReady { restoreControllers(layer) }
      }
    }
    applyMix()
  }

  /// Call under `lock`.
  private func restoreControllers(_ layer: Layer) {
    guard layer.config.keyboard else { return }
    for m in controllerInput.snapshot(listening: { layer.config.listens(on: $0) }) {
      layer.send(m[0], m[1], m[2], length: m[0] == 0xD0 ? 2 : 3)
    }
  }

  func updateLayer(id: String, config patch: LayerConfigRecord) {
    lock.withLock {
      guard let layer = layers[id] else { return }
      layer.config.apply(patch)
      if let value = layer.sustain.configure(enabled: layer.config.sustainEnabled, channel: layer.config.midiChannel) {
        layer.send(0xB0, 64, value)
      }
      if let value = layer.sustain.synchronize(from: pedalInput), layer.config.keyboard, layer.audioReady {
        layer.send(0xB0, 64, value)
      }
    }
    applyMix()
  }

  /// A key still down on the layer, or the sustain pedal down on a keyboard layer.
  func isLayerHeld(id: String) -> Bool {
    lock.withLock {
      guard let layer = layers[id] else { return false }
      let keyDown = activeNotes.values.contains { targets in targets.contains { $0.0 === layer } }
      // A pad still fading out (slow transitions last up to 8 s, longer than the unload delay).
      let padSounding = layer.padVoices.map { pv in pv.fade != nil || pv.notes.contains { !$0.isEmpty } }
        ?? !layer.padNotes.isEmpty
      return keyDown || padSounding || (layer.config.keyboard && layer.sustain.restoredValue >= 64)
    }
  }

  func removeLayer(id: String) {
    guard let layer = lock.withLock({ () -> Layer? in
      guard let layer = layers[id] else { return nil }
      layer.audioReady = false
      return layer
    }) else { return }
    // Cutting a ringing tail (reverb, release) clicks: fade the strip out first.
    fadeOut(layer)
    let removed: Layer? = lock.withLock {
      guard layers[id] === layer else { return nil }
      order.removeAll { $0 == id }
      layers.removeValue(forKey: id)
      layer.audioReady = false
      layer.send(0xB0, 123, 0)
      return layer
    }
    guard let removed else { return }
    graph.sync { detach(removed) }
    applyMix()
  }

  /// Loads a SoundFont preset; swaps the layer back to the built-in sampler if it hosted a plugin.
  /// `bank` is the SF2 bank number: 128 = percussion, anything else = melodic bank (GS variation).
  func loadSoundFont(layerId: String, path: String, program: Int, bank: Int) throws {
    let layer = try self.layer(layerId)
    let url = path.hasPrefix("file://") ? URL(string: path)! : URL(fileURLWithPath: path)
    let isDrums = bank == 128
    let preset = SamplerPreset(
      url: url,
      program: UInt8(min(max(program, 0), 127)),
      bankMSB: UInt8(isDrums ? kAUSampler_DefaultPercussionBankMSB : kAUSampler_DefaultMelodicBankMSB),
      bankLSB: UInt8(isDrums ? kAUSampler_DefaultBankLSB : min(max(bank, 0), 127))
    )
    try graph.sync {
      try withMutedLayer(layer) {
        layer.samplerPreset = preset
        if layer.sampler == nil { try replaceInstrument(of: layer, with: AVAudioUnitSampler()) }
        else { try layer.reloadSamplerPreset(); retriggerPad(layer); retriggerHeldNotes(layer) }
      }
    }
  }

  // MARK: - Plugins

  /// Replaces the layer's instrument by an AUv3 instrument, optionally restoring a saved state.
  func loadPlugin(layerId: String, componentId: String, state: String?) async throws {
    let layer = try self.layer(layerId)
    let unit = try await PluginHost.instantiate(componentId: componentId)
    if let state { PluginHost.restore(state, into: unit) }
    try graph.sync { try withMutedLayer(layer) { try replaceInstrument(of: layer, with: unit) } }
  }

  func addEffect(layerId: String, effectId: String, componentId: String, state: String?, bypass: Bool) async throws {
    let layer = try self.layer(layerId)
    let unit = try await PluginHost.instantiate(componentId: componentId)
    if let state { PluginHost.restore(state, into: unit) }
    unit.auAudioUnit.shouldBypassEffect = bypass
    try graph.sync {
      try withMutedLayer(layer) {
        engine.attach(unit)
        unwire(layer)
        let replaced = lock.withLock { () -> [EffectSlot] in
          let previous = layer.effects.filter { $0.id == effectId }
          layer.effects.removeAll { $0.id == effectId }
          layer.effects.append(EffectSlot(id: effectId, unit: unit))
          return previous
        }
        replaced.forEach { engine.detach($0.unit) }
        try wire(layer)
      }
    }
  }

  func removeEffect(layerId: String, effectId: String) throws {
    let layer = try self.layer(layerId)
    try graph.sync {
      guard let slot = layer.effects.first(where: { $0.id == effectId }) else { return }
      try withMutedLayer(layer) {
        unwire(layer)
        lock.withLock { layer.effects.removeAll { $0.id == effectId } }
        engine.detach(slot.unit)
        try wire(layer)
      }
    }
  }

  /// Reorders the insert effects of a layer (ids in signal order; unknown ids are ignored).
  func setEffectOrder(layerId: String, ids: [String]) throws {
    let layer = try self.layer(layerId)
    try graph.sync {
      let ordered = ids.compactMap { id in layer.effects.first { $0.id == id } }
      guard ordered.count == layer.effects.count, ordered.map(\.id) != layer.effects.map(\.id) else { return }
      try withMutedLayer(layer) {
        unwire(layer)
        lock.withLock { layer.effects = ordered }
        try wire(layer)
      }
    }
  }

  func setEffectBypass(layerId: String, effectId: String, bypass: Bool) throws {
    try unit(layerId: layerId, slot: effectId).auAudioUnit.shouldBypassEffect = bypass
  }

  /// `slot` = "instrument" or an effect id.
  func unit(layerId: String, slot: String) throws -> AVAudioUnit {
    try lock.withLock {
      guard let layer = layers[layerId] else { throw EngineError.unknownLayer(layerId) }
      guard let unit = layer.unit(slot: slot) else { throw PluginError.unknownSlot(slot) }
      return unit
    }
  }

  private func layer(_ id: String) throws -> Layer {
    guard let layer = lock.withLock({ layers[id] }) else { throw EngineError.unknownLayer(id) }
    return layer
  }

  // MARK: - Graph (call on `graph` only)

  /// Ramps a layer's strip to silence over ~50 ms. Leaves `fading` set: the caller clears it
  /// (or removes the layer) and reapplies the mix. Not on the audio thread: it sleeps.
  private func fadeOut(_ layer: Layer) {
    let start: Float = lock.withLock {
      layer.fading = true
      return layer.strip.outputVolume
    }
    guard start > 0.001 else { return }
    for step in 1...10 {
      layer.strip.outputVolume = start * Float(10 - step) / 10
      Thread.sleep(forTimeInterval: 0.005)
    }
  }

  /// Prevent MIDI and concurrent mix updates from exposing a partially loaded instrument.
  /// On failure the layer stays silent until a subsequent successful load.
  private func withMutedLayer(_ layer: Layer, _ change: () throws -> Void) throws {
    // A layer that is playing (e.g. editing a pad's effects mid-song) fades instead of clicking.
    fadeOut(layer)
    defer {
      lock.withLock { layer.fading = false }
      applyMix()
    }
    try lock.withLock {
      guard layers[layer.id] === layer else { throw EngineError.unknownLayer(layer.id) }
      layer.audioReady = false
      layer.strip.outputVolume = 0
    }
    try change()
    lock.withLock { layer.audioReady = layer.sampler == nil || layer.samplerPreset != nil }
  }

  /// Call on graph. Start with every strip silent: samplers may reset during start.
  private func resumeEngine() throws {
    guard !engine.isRunning else { return }
    let restoring = lock.withLock { () -> [Layer] in
      // The current patch first: reloading preloaded neighbours (big banks) can take seconds.
      let values = layers.values.sorted { isActive($0.id) && !isActive($1.id) }
      for layer in values { layer.audioReady = false; layer.strip.outputVolume = 0 }
      return values
    }
    engine.prepare()
    try engine.start()
    for layer in restoring {
      do {
        try withMutedLayer(layer) {
          try layer.reloadSamplerPreset()
          retriggerPad(layer)
          retriggerHeldNotes(layer)
        }
      } catch {
        NSLog("[LiveKeys audio] Layer %@ remains silent after restore failure: %@", layer.id, String(describing: error))
      }
    }
    installMeter()
    attachMasterMeter()
  }

  /// Connects instrument → effects → strip with one stereo float format at the hardware rate.
  private func wire(_ layer: Layer) throws {
    let rate = engine.outputNode.outputFormat(forBus: 0).sampleRate
    let format = AVAudioFormat(standardFormatWithSampleRate: rate > 0 ? rate : 48_000, channels: 2)
    if let pv = layer.padVoices, let format {
      engine.connect(layer.instrument, to: pv.mixer, fromBus: 0, toBus: 0, format: format)
      engine.connect(pv.second, to: pv.mixer, fromBus: 0, toBus: 1, format: format)
    }
    let nodes = layer.chain + [layer.strip]
    for (from, to) in zip(nodes, nodes.dropFirst()) {
      engine.connect(from, to: to, format: format)
    }
    // Reconnecting resets AVAudioUnitSampler to its default sound.
    try layer.reloadSamplerPreset()
    retriggerPad(layer)
    retriggerHeldNotes(layer)
    // The last unit pulls the whole chain when it renders: timing it gives the layer's cost.
    if let last = layer.chain.last as? AVAudioUnit {
      layer.meter.attach(last.audioUnit, sampleRate: format?.sampleRate ?? 48_000)
    }
  }

  /// A chord pad's notes stop when its instrument is reloaded or replaced: start them again.
  private func retriggerPad(_ layer: Layer) {
    lock.withLock {
      if let pv = layer.padVoices {
        for i in 0...1 { for note in pv.notes[i] { Layer.send(to: layer.padVoice(i), 0x90, note, layer.padVelocity) } }
      } else {
        for note in layer.padNotes { layer.send(0x90, note, layer.padVelocity) }
      }
    }
  }

  private func retriggerHeldNotes(_ layer: Layer) {
    lock.withLock {
      if layer.config.keyboard { layer.send(0xB0, 64, layer.sustain.restoredValue) }
      // A reloaded instrument starts with its wheels at rest.
      restoreControllers(layer)
      for targets in activeNotes.values {
        for (heldLayer, note, velocity) in targets where heldLayer === layer {
          layer.send(0x90, note, velocity)
        }
      }
    }
  }

  private func unwire(_ layer: Layer) {
    layer.chain.forEach(engine.disconnectNodeOutput)
    if let pv = layer.padVoices {
      engine.disconnectNodeOutput(layer.instrument)
      engine.disconnectNodeOutput(pv.second)
    }
  }

  private func replaceInstrument(of layer: Layer, with unit: AVAudioUnit) throws {
    engine.attach(unit)
    unwire(layer)
    let oldPads = layer.padVoices
    let old: AVAudioUnit = lock.withLock {
      layer.send(0xB0, 123, 0)
      let old = layer.instrument
      layer.instrument = unit
      layer.midiBlock = nil
      if let oldPads {
        oldPads.fade?.cancel()
        oldPads.fade = nil
        oldPads.generation += 1
        AudioSafety.panicPadVoices([old, oldPads.second])
      }
      // AUv3 pads play on a single instrument; never keep the previous sampler
      // voice connected underneath the replacement plugin.
      if !layer.config.keyboard, unit is AVAudioUnitSampler {
        let pv = PadVoices(restoring: layer.padNotes)
        layer.padVoices = pv
      } else { layer.padVoices = nil }
      return old
    }
    if let oldPads { engine.detach(oldPads.second); engine.detach(oldPads.mixer) }
    if let pv = layer.padVoices { engine.attach(pv.second); engine.attach(pv.mixer) }
    defer { engine.detach(old) }
    try wire(layer)
    lock.withLock { layer.midiBlock = unit.auAudioUnit.scheduleMIDIEventBlock }
  }

  private func detach(_ layer: Layer) {
    layer.meter.detach()
    unwire(layer)
    engine.disconnectNodeOutput(layer.strip)
    layer.chain.forEach(engine.detach)
    if let pv = layer.padVoices {
      pv.fade?.cancel()
      engine.detach(layer.instrument)
      engine.detach(pv.second)
    }
    engine.detach(layer.strip)
  }

  /// Volume, pan, mute and solo → strip node. Muted / non-soloed layers go silent.
  private func applyMix() {
    lock.withLock {
      let anySolo = soloActive()
      for layer in layers.values where !layer.fading {
        let audible = isActive(layer.id) ? isAudible(layer, anySolo: anySolo) : !layer.config.mute
        layer.strip.outputVolume = audible && layer.audioReady ? layer.config.volume : 0
        layer.strip.pan = layer.config.pan
      }
    }
  }

  /// Call under `lock`.
  private func isActive(_ id: String) -> Bool { activeIds?.contains(id) ?? true }

  /// Solo only applies within the current patch. Call under `lock`.
  private func soloActive() -> Bool { layers.values.contains { isActive($0.id) && $0.config.solo } }

  private func isAudible(_ layer: Layer, anySolo: Bool) -> Bool {
    !layer.config.mute && (!anySolo || layer.config.solo)
  }

  // MARK: - MIDI routing

  func handle(_ message: MidiMessage) {
    switch message {
    case let .noteOn(ch, note, vel):
      noteOn(note: note, velocity: vel, channel: ch)
    case let .noteOff(ch, note):
      noteOff(note: note, channel: ch)
    case let .controlChange(ch, cc, value):
      controlChange(cc, value: value, channel: ch)
    case let .pitchBend(ch, value):
      lock.withLock { controllerInput.receive(channel: ch, status: 0xE0, data1: UInt8(value & 0x7F), data2: UInt8(value >> 7)) }
      forEachListening(ch) { $0.send(0xE0, UInt8(value & 0x7F), UInt8(value >> 7)) }
      emit("pitchBend", ch, Int(value), 0)
    case let .channelPressure(ch, value):
      lock.withLock { controllerInput.receive(channel: ch, status: 0xD0, data1: value, data2: 0) }
      forEachListening(ch) { $0.send(0xD0, value, 0, length: 2) }
    case let .programChange(ch, program):
      // Not forwarded: program changes will drive patch switching (Phase 3).
      emit("programChange", ch, Int(program), 0)
    }
  }

  func noteOn(note: UInt8, velocity: UInt8, channel: UInt8) {
    let key = Int(channel) << 7 | Int(note)
    let accepted = lock.withLock { () -> Bool in
      // Same keyboard on USB and Bluetooth: drop the doubled note-on instead of re-attacking.
      guard duplicates.accept(key: key, held: activeNotes[key] != nil, now: CACurrentMediaTime()) else { return false }
      // Retrigger of a held note: release it first.
      activeNotes.removeValue(forKey: key)?.forEach { $0.0.send(0x80, $0.1, 0) }

      let anySolo = soloActive()
      var targets: [(Layer, UInt8, UInt8)] = []
      for id in order {
        guard let layer = layers[id], layer.audioReady, isActive(id), isAudible(layer, anySolo: anySolo),
              layer.config.accepts(note: note, velocity: velocity, channel: channel) else { continue }
        let played = Int(note) + layer.config.transpose
        guard (0...127).contains(played) else { continue }
        layer.send(0x90, UInt8(played), velocity)
        targets.append((layer, UInt8(played), velocity))
      }
      if !targets.isEmpty { activeNotes[key] = targets }
      return true
    }
    guard accepted else { return }
    emit("noteOn", channel, Int(note), Int(velocity))
  }

  func noteOff(note: UInt8, channel: UInt8) {
    let key = Int(channel) << 7 | Int(note)
    lock.withLock {
      activeNotes.removeValue(forKey: key)?.forEach { $0.0.send(0x80, $0.1, 0) }
    }
    emit("noteOff", channel, Int(note), 0)
  }

  private func controlChange(_ cc: UInt8, value: UInt8, channel: UInt8) {
    switch cc {
    case 64:
      // Also to inactive layers: releasing the pedal after a patch change must free their notes.
      lock.withLock {
        _ = pedalInput.receive(channel: channel, value: value)
        for layer in layers.values where layer.config.keyboard {
          // Keep pedal position even while the sampler is temporarily muted/loading.
          if let output = layer.sustain.receive(channel: channel, value: value), layer.audioReady {
            layer.send(0xB0, 64, output)
          }
        }
      }
    case 120, 123:
      panic()
    default:
      lock.withLock { controllerInput.receive(channel: channel, status: 0xB0, data1: cc, data2: value) }
      forEachListening(channel) { $0.send(0xB0, cc, value) }
    }
    emit("cc", channel, Int(cc), Int(value))
  }

  /// Chord pads: makes the layer hold exactly `notes`. Common tones keep sounding, others are released / started.
  /// Chord pads: makes the layer hold exactly `notes`. With the built-in sampler the change
  /// crossfades over `fade` seconds between two voices; otherwise only changed notes are re-triggered.
  func setLayerNotes(layerId: String, notes: [Int], velocity: Int, fade: Double) {
    let wanted = Set(notes.compactMap { (0...127).contains($0) ? UInt8($0) : nil })
    let vel = UInt8(min(max(velocity, 1), 127))
    lock.withLock {
      guard let layer = layers[layerId] else { return }
      layer.padVelocity = vel
      guard let pv = layer.padVoices, layer.sampler != nil else {
        for note in layer.padNotes.subtracting(wanted) { layer.send(0x80, note, 0) }
        for note in wanted.subtracting(layer.padNotes) { layer.send(0x90, note, vel) }
        layer.padNotes = wanted
        return
      }
      crossfade(layer, pv, to: wanted, velocity: vel, seconds: max(fade, 0.05))
      layer.padNotes = wanted
    }
  }

  private let fadeQueue = DispatchQueue(label: "livekeys.pad-fade", qos: .userInteractive)

  /// Call under `lock`.
  private func crossfade(_ layer: Layer, _ pv: PadVoices, to wanted: Set<UInt8>, velocity: UInt8, seconds: Double) {
    guard let plan = pv.prepare(first: layer.instrument, wanted: wanted, velocity: velocity, fadeSeconds: seconds) else { return }
    let generation = pv.generation
    let steps = max(Int(seconds / 0.02), 1)
    var step = 0

    let timer = DispatchSource.makeTimerSource(queue: fadeQueue)
    timer.schedule(deadline: .now(), repeating: .milliseconds(20))
    timer.setEventHandler { [weak self, weak layer] in
      guard let self, let layer else { timer.cancel(); return }
      self.lock.withLock {
        // Cancellation alone does not stop a handler already dispatched. Check
        // identity and generation under the same lock as Panic / chord changes.
        guard self.layers[layer.id] === layer,
              pv.generation == generation else { timer.cancel(); return }
        step += 1
        let t = min(Double(step) / Double(steps), 1)
        guard pv.tick(plan, first: layer.instrument, progress: t) else { return }
        timer.cancel()
        pv.fade = nil
      }
    }
    pv.fade = timer
    timer.resume()
  }

  /// A MIDI source disappeared while keys or the pedal may be down: release what only it could have
  /// released. Pads keep playing; they do not depend on held keys.
  func releaseKeyboard() {
    let released: [Int] = lock.withLock {
      for targets in activeNotes.values { for (layer, note, _) in targets { layer.send(0x80, note, 0) } }
      let keys = Array(activeNotes.keys)
      activeNotes.removeAll()
      pedalInput.reset()
      for layer in layers.values where layer.config.keyboard {
        layer.sustain.reset()
        layer.send(0xB0, 64, 0)
      }
      return keys
    }
    // Tell JS too (held-key display, chord detection), as if the keys had been released.
    for key in released { emit("noteOff", UInt8(key >> 7), key & 0x7F, 0) }
  }

  func panic() {
    lock.withLock {
      activeNotes.removeAll()
      pedalInput.reset()
      for layer in layers.values {
        layer.sustain.reset()
        layer.padNotes.removeAll()
        if let pv = layer.padVoices {
          pv.panic(first: layer.instrument)
        }
        layer.send(0xB0, 64, 0)
        layer.send(0xB0, 123, 0)
        layer.send(0xB0, 120, 0)
      }
    }
  }

  private func forEachListening(_ channel: UInt8, includeInactive: Bool = false, _ body: (Layer) -> Void) {
    lock.withLock {
      for id in order {
        guard let l = layers[id], l.audioReady, l.config.listens(on: channel), includeInactive || isActive(id) else { continue }
        body(l)
      }
    }
  }

  private func emit(_ type: String, _ channel: UInt8, _ d1: Int, _ d2: Int) {
    onMidiEvent?(MidiEvent(type: type, channel: channel, data1: d1, data2: d2))
  }

  // MARK: - Metering & system events

  // MARK: - Performance

  private let masterMeter = RenderMeter()

  /// Times the whole graph: the output unit pulls everything once per buffer.
  private func attachMasterMeter() {
    if let output = engine.outputNode.audioUnit {
      masterMeter.attach(output, sampleRate: AVAudioSession.sharedInstance().sampleRate)
    }
  }

  /// DSP load (whole graph and per layer, % of the buffer time), app CPU and memory.
  func performance() -> [String: Any] {
    let master = masterMeter.read()
    let perLayer: [[String: Any]] = lock.withLock {
      order.compactMap { id in
        guard let layer = layers[id] else { return nil }
        let r = layer.meter.read()
        return ["id": id, "load": r.average * 100, "peak": r.peak * 100]
      }
    }
    return [
      "load": master.average * 100,
      "peak": master.peak * 100,
      "overloads": master.overloads,
      "layers": perLayer,
      "cpu": SystemStats.cpuPercent(),
      "memoryMB": SystemStats.memoryMB(),
      "availableMemoryMB": SystemStats.availableMemoryMB(),
    ]
  }

  private func installMeter() {
    let mixer = engine.mainMixerNode
    mixer.removeTap(onBus: 0)
    mixer.installTap(onBus: 0, bufferSize: 1024, format: nil) { [weak self] buffer, _ in
      guard let self, let onLevel = self.onLevel else { return }
      let now = CACurrentMediaTime()
      guard now - self.lastLevelTime >= 1.0 / 30 else { return }
      self.lastLevelTime = now

      var peak: Float = 0
      if let data = buffer.floatChannelData {
        for ch in 0..<Int(buffer.format.channelCount) {
          for i in 0..<Int(buffer.frameLength) { peak = max(peak, abs(data[ch][i])) }
        }
      }
      onLevel(peak)
    }
  }

  private func observeSystemEvents() {
    guard observers.isEmpty else { return }
    let center = NotificationCenter.default

    // Phone call / Siri: restart once the interruption ends.
    observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
      guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
            AVAudioSession.InterruptionType(rawValue: raw) == .ended else {
        self?.panic()
        return
      }
      self?.restart()
    })

    // Audio interface plugged/unplugged, sample rate change: engine stops itself, restart it.
    observers.append(center.addObserver(forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main) { [weak self] _ in
      self?.restart()
    })
  }

  private func restart() {
    graph.async { [self] in
      guard lock.withLock({ runningRequested }) else { return }
      do {
        try AVAudioSession.sharedInstance().setActive(true)
        try resumeEngine()
        onRestarted?()
      } catch {
        NSLog("[LiveKeys audio] Restart failed: %@", String(describing: error))
      }
    }
  }
}

enum EngineError: Error, CustomStringConvertible {
  case unknownLayer(String)
  var description: String {
    switch self {
    case .unknownLayer(let id): return "Unknown layer '\(id)'"
    }
  }
}
