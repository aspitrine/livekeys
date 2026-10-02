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

    graph.sync {
      engine.attach(layer.instrument)
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
    try graph.sync {
      if layer.sampler == nil { replaceInstrument(of: layer, with: AVAudioUnitSampler()) }
      try layer.sampler!.loadSoundBankInstrument(
        at: url,
        program: UInt8(min(max(program, 0), 127)),
        bankMSB: UInt8(isDrums ? kAUSampler_DefaultPercussionBankMSB : kAUSampler_DefaultMelodicBankMSB),
        bankLSB: UInt8(isDrums ? kAUSampler_DefaultBankLSB : min(max(bank, 0), 127))
      )
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
    let nodes = layer.chain + [layer.strip]
    for (from, to) in zip(nodes, nodes.dropFirst()) {
      engine.connect(from, to: to, format: format)
    }
  }

  private func unwire(_ layer: Layer) {
    layer.chain.forEach(engine.disconnectNodeOutput)
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
    unwire(layer)
    engine.disconnectNodeOutput(layer.strip)
    layer.chain.forEach(engine.detach)
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

  func panic() {
    lock.withLock {
      activeNotes.removeAll()
      for layer in layers.values {
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
