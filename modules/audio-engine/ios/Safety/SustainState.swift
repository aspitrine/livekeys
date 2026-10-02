/// MIDI controllers arrive on different input channels but each layer plays on
/// output channel 0. Caller serializes routing changes and events with the engine lock.
struct SustainState {
  private var enabled = true
  private var channel = -1
  private var heldChannels: [UInt8: UInt8] = [:]

  mutating func configure(enabled: Bool, channel: Int) -> UInt8? {
    let release = !heldChannels.isEmpty && (!enabled || channel != self.channel)
    if release { heldChannels.removeAll() }
    self.enabled = enabled
    self.channel = channel
    return release ? 0 : nil
  }

  mutating func receive(channel: UInt8, value: UInt8) -> UInt8? {
    guard enabled, self.channel < 0 || self.channel == Int(channel) else { return nil }
    if value >= 64 { heldChannels[channel] = value }
    else { heldChannels.removeValue(forKey: channel) }
    return heldChannels.values.max() ?? value
  }

  mutating func reset() { heldChannels.removeAll() }
  var restoredValue: UInt8 { heldChannels.values.max() ?? 0 }

  mutating func synchronize(from input: SustainState) -> UInt8? {
    let previous = restoredValue
    heldChannels = enabled ? input.heldChannels.filter { channel < 0 || Int($0.key) == channel } : [:]
    return restoredValue != previous ? restoredValue : nil
  }
}
