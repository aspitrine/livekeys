/// Last position of the performance controllers per input channel (pitch bend, mod wheel, expression…).
/// Layers only hear them while active; a layer that comes back (preloaded neighbour, previous patch)
/// or whose instrument was reloaded is brought in line with `snapshot`. Sustain lives in SustainState.
/// Caller serializes with the engine lock.
struct ControllerState {
  /// Controllers restored on (re)activation. Untouched ones are sent at their neutral value.
  static let tracked: [UInt8: UInt8] = [1: 0, 2: 0, 4: 0, 7: 100, 11: 127, 65: 0, 66: 0, 67: 0, 71: 64, 74: 64]
  private var bend: [UInt8: (lsb: UInt8, msb: UInt8)] = [:]
  private var pressure: [UInt8: UInt8] = [:]
  private var controls: [UInt8: [UInt8: UInt8]] = [:]
  /// Order of updates, so the latest channel wins for omni layers.
  private var stamp: [UInt8: Int] = [:]
  private var clock = 0

  mutating func receive(channel: UInt8, status: UInt8, data1: UInt8, data2: UInt8) {
    switch status {
    case 0xE0: bend[channel] = (data1, data2)
    case 0xD0: pressure[channel] = data1
    case 0xB0 where Self.tracked[data1] != nil: controls[channel, default: [:]][data1] = data2
    default: return
    }
    clock += 1
    stamp[channel] = clock
  }

  mutating func reset() {
    self = ControllerState()
  }

  /// Messages (channel 0, the layers' output channel) restoring every tracked controller as last heard
  /// on the channels the layer listens to.
  func snapshot(listening: (UInt8) -> Bool) -> [[UInt8]] {
    let channels = stamp.keys.filter(listening).sorted { stamp[$0]! < stamp[$1]! }
    var bendValue: (lsb: UInt8, msb: UInt8) = (0x00, 0x40)
    var pressureValue: UInt8 = 0
    var values = Self.tracked
    for channel in channels {  // oldest first: the most recent channel overwrites
      if let b = bend[channel] { bendValue = b }
      if let p = pressure[channel] { pressureValue = p }
      for (cc, v) in controls[channel] ?? [:] { values[cc] = v }
    }
    return [[0xE0, bendValue.lsb, bendValue.msb], [0xD0, pressureValue, 0]]
      + values.keys.sorted().map { [0xB0, $0, values[$0]!] }
  }
}

/// A CC owned by the host mixer must not also change the instrument's expression/volume.
/// Sustain and emergency messages always keep their native meaning.
struct MidiVolumeControl: Equatable {
  let cc: Int
  let channel: Int

  func consumes(cc: UInt8, channel: UInt8) -> Bool {
    ![64, 120, 123].contains(Int(cc)) && self.cc == Int(cc) && (self.channel == -1 || self.channel == Int(channel))
  }
}
