import ExpoModulesCore

/// Routing + mix settings for one layer. Value type so the MIDI thread can work on a snapshot.
struct LayerConfig {
  var volume: Float = 0.8
  var pan: Float = 0
  var mute = false
  var solo = false
  var keyLow: UInt8 = 0
  var keyHigh: UInt8 = 127
  var velocityLow: UInt8 = 1
  var velocityHigh: UInt8 = 127
  var transpose = 0
  /// -1 = omni, 0...15 = MIDI channel
  var midiChannel = -1
  var sustainEnabled = true
  /// false for chord pads: the layer ignores the keyboard and only plays notes sent with `setLayerNotes`.
  var keyboard = true
  /// Send to the shared reverb, 0…1 (post-fader).
  var reverbSend: Float = 0

  func accepts(note: UInt8, velocity: UInt8, channel: UInt8) -> Bool {
    guard keyboard else { return false }
    if midiChannel >= 0 && Int(channel) != midiChannel { return false }
    return (keyLow...keyHigh).contains(note) && (velocityLow...velocityHigh).contains(velocity)
  }

  func listens(on channel: UInt8) -> Bool {
    guard keyboard else { return false }
    return midiChannel < 0 || Int(channel) == midiChannel
  }

  mutating func apply(_ patch: LayerConfigRecord) {
    if let v = patch.volume { volume = Float(min(max(v, 0), 1)) }
    if let v = patch.pan { pan = Float(min(max(v, -1), 1)) }
    if let v = patch.mute { mute = v }
    if let v = patch.solo { solo = v }
    if let v = patch.keyLow { keyLow = clamp7(v) }
    if let v = patch.keyHigh { keyHigh = clamp7(v) }
    if let v = patch.velocityLow { velocityLow = max(clamp7(v), 1) }
    if let v = patch.velocityHigh { velocityHigh = max(clamp7(v), 1) }
    if let v = patch.transpose { transpose = min(max(v, -48), 48) }
    if let v = patch.midiChannel { midiChannel = min(max(v, -1), 15) }
    if let v = patch.sustainEnabled { sustainEnabled = v }
    if let v = patch.keyboard { keyboard = v }
    if let v = patch.reverbSend { reverbSend = Float(min(max(v, 0), 1)) }
    if keyLow > keyHigh { swap(&keyLow, &keyHigh) }
    if velocityLow > velocityHigh { swap(&velocityLow, &velocityHigh) }
  }
}

private func clamp7(_ v: Int) -> UInt8 { UInt8(min(max(v, 0), 127)) }

/// Partial layer config coming from JS. Every field is optional so JS can send diffs.
struct LayerConfigRecord: Record {
  @Field var volume: Double?
  @Field var pan: Double?
  @Field var mute: Bool?
  @Field var solo: Bool?
  @Field var keyLow: Int?
  @Field var keyHigh: Int?
  @Field var velocityLow: Int?
  @Field var velocityHigh: Int?
  @Field var transpose: Int?
  @Field var midiChannel: Int?
  @Field var sustainEnabled: Bool?
  @Field var keyboard: Bool?
  @Field var reverbSend: Double?
}

struct EngineOptions: Record {
  @Field var sampleRate: Double = 48_000
  @Field var bufferFrames: Int = 128
}
