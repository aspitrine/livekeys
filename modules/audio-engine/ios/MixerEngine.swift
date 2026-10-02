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

  private let engine = AVAudioEngine()
  private let lock = NSLock()
  private let graph = DispatchQueue(label: "livekeys.engine.graph")
  private var layers: [String: Layer] = [:]
  private var order: [String] = []
  /// Notes currently held, keyed by input (channel << 7 | note): which layers got which played note.
  /// Note-offs follow this map so transposition/range changes mid-note never leave hanging notes.
  private var activeNotes: [Int: [(Layer, UInt8)]] = [:]
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

    graph.sync { installLimiter() }
    if !engine.isRunning {
      engine.prepare()
      try engine.start()
    }
    installMeter()
    attachMasterMeter()
    observeSystemEvents()
    return info()
  }

  func stop() {
    panic()
    engine.mainMixerNode.removeTap(onBus: 0)
    engine.stop()
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
    if !layer.config.keyboard { layer.padVoices = PadVoices() }

    graph.sync {
      engine.attach(layer.instrument)
      if let pv = layer.padVoices {
        engine.attach(pv.second)
        engine.attach(pv.mixer)
      }
      engine.attach(layer.strip)
      wire(layer)
      engine.connect(layer.strip, to: engine.mainMixerNode, format: nil)
      layer.midiBlock = layer.instrument.auAudioUnit.scheduleMIDIEventBlock

      let old: Layer? = lock.withLock {
        let old = layers[id]
        layers[id] = layer
        if !order.contains(id) { order.append(id) }
        return old
      }
      if let old { detach(old) }
    }
    applyMix()
  }

  /// Routes new notes / controllers to these layers only. Others keep ringing until their notes are released.
  func setActiveLayers(_ ids: [String]) {
    lock.withLock { activeIds = Set(ids) }
    applyMix()
  }

  func updateLayer(id: String, config patch: LayerConfigRecord) {
    lock.withLock { layers[id]?.config.apply(patch) }
    applyMix()
  }

  func removeLayer(id: String) {
    let layer: Layer? = lock.withLock {
      order.removeAll { $0 == id }
      let layer = layers.removeValue(forKey: id)
      layer?.send(0xB0, 123, 0)
      return layer
    }
    guard let layer else { return }
    graph.sync { detach(layer) }
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
      if layer.sampler == nil { replaceInstrument(of: layer, with: AVAudioUnitSampler()) }
      layer.samplerPreset = preset
      try layer.reloadSamplerPreset()
      retriggerPad(layer)
    }
  }

  // MARK: - Plugins

  /// Replaces the layer's instrument by an AUv3 instrument, optionally restoring a saved state.
  func loadPlugin(layerId: String, componentId: String, state: String?) async throws {
    let layer = try self.layer(layerId)
    let unit = try await PluginHost.instantiate(componentId: componentId)
    if let state { PluginHost.restore(state, into: unit) }
    graph.sync { replaceInstrument(of: layer, with: unit) }
  }

  func addEffect(layerId: String, effectId: String, componentId: String, state: String?, bypass: Bool) async throws {
    let layer = try self.layer(layerId)
    let unit = try await PluginHost.instantiate(componentId: componentId)
    if let state { PluginHost.restore(state, into: unit) }
    unit.auAudioUnit.shouldBypassEffect = bypass
    graph.sync {
      engine.attach(unit)
      unwire(layer)
      layer.effects.removeAll { $0.id == effectId }
      layer.effects.append(EffectSlot(id: effectId, unit: unit))
      wire(layer)
    }
  }

  func removeEffect(layerId: String, effectId: String) throws {
    let layer = try self.layer(layerId)
    graph.sync {
      guard let slot = layer.effects.first(where: { $0.id == effectId }) else { return }
      unwire(layer)
      layer.effects.removeAll { $0.id == effectId }
      wire(layer)
      engine.detach(slot.unit)
    }
  }

  /// Reorders the insert effects of a layer (ids in signal order; unknown ids are ignored).
  func setEffectOrder(layerId: String, ids: [String]) throws {
    let layer = try self.layer(layerId)
    graph.sync {
      let ordered = ids.compactMap { id in layer.effects.first { $0.id == id } }
      guard ordered.count == layer.effects.count, ordered.map(\.id) != layer.effects.map(\.id) else { return }
      unwire(layer)
      layer.effects = ordered
      wire(layer)
    }
  }

  func setEffectBypass(layerId: String, effectId: String, bypass: Bool) throws {
    try unit(layerId: layerId, slot: effectId).auAudioUnit.shouldBypassEffect = bypass
  }

  /// `slot` = "instrument" or an effect id.
  func unit(layerId: String, slot: String) throws -> AVAudioUnit {
    guard let unit = try layer(layerId).unit(slot: slot) else { throw PluginError.unknownSlot(slot) }
    return unit
  }

  private func layer(_ id: String) throws -> Layer {
    guard let layer = lock.withLock({ layers[id] }) else { throw EngineError.unknownLayer(id) }
    return layer
  }

  // MARK: - Graph (call on `graph` only)

  /// Connects instrument → effects → strip with one stereo float format at the hardware rate.
  private func wire(_ layer: Layer) {
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
    try? layer.reloadSamplerPreset()
    retriggerPad(layer)
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

  private func unwire(_ layer: Layer) {
    layer.chain.forEach(engine.disconnectNodeOutput)
    if let pv = layer.padVoices {
      engine.disconnectNodeOutput(layer.instrument)
      engine.disconnectNodeOutput(pv.second)
    }
  }

  private func replaceInstrument(of layer: Layer, with unit: AVAudioUnit) {
    engine.attach(unit)
    unwire(layer)
    let old: AVAudioUnit = lock.withLock {
      layer.send(0xB0, 123, 0)
      let old = layer.instrument
      layer.instrument = unit
      layer.midiBlock = nil
      return old
    }
    wire(layer)
    lock.withLock { layer.midiBlock = unit.auAudioUnit.scheduleMIDIEventBlock }
    engine.detach(old)
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
      for layer in layers.values {
        let audible = isActive(layer.id) ? isAudible(layer, anySolo: anySolo) : !layer.config.mute
        layer.strip.outputVolume = audible ? layer.config.volume : 0
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
      forEachListening(ch) { $0.send(0xE0, UInt8(value & 0x7F), UInt8(value >> 7)) }
      emit("pitchBend", ch, Int(value), 0)
    case let .channelPressure(ch, value):
      forEachListening(ch) { $0.send(0xD0, value, 0, length: 2) }
    case let .programChange(ch, program):
      // Not forwarded: program changes will drive patch switching (Phase 3).
      emit("programChange", ch, Int(program), 0)
    }
  }

  func noteOn(note: UInt8, velocity: UInt8, channel: UInt8) {
    let key = Int(channel) << 7 | Int(note)
    lock.withLock {
      // Retrigger of a held note: release it first.
      activeNotes.removeValue(forKey: key)?.forEach { $0.0.send(0x80, $0.1, 0) }

      let anySolo = soloActive()
      var targets: [(Layer, UInt8)] = []
      for id in order {
        guard let layer = layers[id], isActive(id), isAudible(layer, anySolo: anySolo),
              layer.config.accepts(note: note, velocity: velocity, channel: channel) else { continue }
        let played = Int(note) + layer.config.transpose
        guard (0...127).contains(played) else { continue }
        layer.send(0x90, UInt8(played), velocity)
        targets.append((layer, UInt8(played)))
      }
      if !targets.isEmpty { activeNotes[key] = targets }
    }
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
      forEachListening(channel, includeInactive: true) { if $0.config.sustainEnabled { $0.send(0xB0, 64, value) } }
    case 120, 123:
      panic()
    default:
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
    let from = pv.active
    guard wanted != pv.notes[from] else { return }
    pv.generation += 1
    let generation = pv.generation
    pv.fade?.cancel()

    let outVoice = layer.padVoice(from) as! AVAudioMixing
    let to = wanted.isEmpty ? from : 1 - from
    let inVoice = layer.padVoice(to) as! AVAudioMixing

    if !wanted.isEmpty {
      // The incoming voice may still hold a chord fading out from an earlier change: replace it.
      for note in pv.notes[to] { Layer.send(to: layer.padVoice(to), 0x80, note, 0) }
      if pv.notes[from].isEmpty {
        inVoice.volume = 1  // nothing playing: the sound's own attack does the fade-in
      } else {
        inVoice.volume = 0
      }
      for note in wanted { Layer.send(to: layer.padVoice(to), 0x90, note, velocity) }
      pv.notes[to] = wanted
      pv.active = to
    }

    let fadingOut = !pv.notes[from].isEmpty && (wanted.isEmpty || to != from)
    let outStart = outVoice.volume
    let inStart = wanted.isEmpty ? 0 : inVoice.volume
    let steps = max(Int(seconds / 0.02), 1)
    var step = 0

    let timer = DispatchSource.makeTimerSource(queue: fadeQueue)
    timer.schedule(deadline: .now(), repeating: .milliseconds(20))
    timer.setEventHandler { [weak self, weak layer] in
      guard let self, let layer else { return }
      step += 1
      // Equal-power curves: the sum stays steady, no dip in the middle of the change.
      let t = min(Double(step) / Double(steps), 1)
      if fadingOut { outVoice.volume = outStart * Float(cos(t * .pi / 2)) }
      if !wanted.isEmpty && to != from { inVoice.volume = inStart + (1 - inStart) * Float(sin(t * .pi / 2)) }
      guard t >= 1 else { return }
      timer.cancel()
      self.lock.withLock {
        guard pv.generation == generation, fadingOut else { return }
        // Release the faded-out chord; the voice stays silent until it plays the next chord.
        for note in pv.notes[from] { Layer.send(to: layer.padVoice(from), 0x80, note, 0) }
        pv.notes[from] = []
      }
    }
    pv.fade = timer
    timer.resume()
  }

  func panic() {
    lock.withLock {
      activeNotes.removeAll()
      for layer in layers.values {
        layer.padNotes.removeAll()
        if let pv = layer.padVoices {
          pv.fade?.cancel()
          pv.generation += 1
          for i in 0...1 {
            let voice = layer.padVoice(i)
            Layer.send(to: voice, 0xB0, 123, 0)
            (voice as? AVAudioMixing)?.volume = 1
          }
          pv.notes = [[], []]
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
        guard let l = layers[id], l.config.listens(on: channel), includeInactive || isActive(id) else { continue }
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
    try? AVAudioSession.sharedInstance().setActive(true)
    guard !engine.isRunning else { return }
    engine.prepare()
    try? engine.start()
    installMeter()
    attachMasterMeter()
    // A restarted engine resets every sampler to its default sound.
    graph.async { [self] in
      for layer in lock.withLock({ Array(layers.values) }) { try? layer.reloadSamplerPreset() }
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
