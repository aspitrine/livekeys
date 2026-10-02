import AVFoundation

/// One inserted effect, keyed by the id JS gave it.
struct EffectSlot {
  let id: String
  let unit: AVAudioUnit
}

/// One sound layer: instrument → effects… → channel strip → main mixer.
/// `instrument` is either the built-in sampler (SoundFonts) or an AUv3 instrument.
/// Mutations of `instrument` / `effects` happen on the engine graph queue, under the engine lock.
final class Layer {
  let id: String
  var config = LayerConfig()
  var instrument: AVAudioUnit = AVAudioUnitSampler()
  var effects: [EffectSlot] = []
  let strip = AVAudioMixerNode()
  /// Cached once render resources are allocated; nil falls back to a lookup on each event.
  var midiBlock: AUScheduleMIDIEventBlock?

  init(id: String) {
    self.id = id
  }

  var sampler: AVAudioUnitSampler? { instrument as? AVAudioUnitSampler }

  /// Audio chain in signal order, strip excluded.
  var chain: [AVAudioNode] { [instrument] + effects.map(\.unit) }

  /// `"instrument"` or an effect id → the AU behind it.
  func unit(slot: String) -> AVAudioUnit? {
    slot == "instrument" ? instrument : effects.first { $0.id == slot }?.unit
  }

  /// Sends a raw MIDI message to the instrument. Always on channel 0: the layer already filtered the channel.
  func send(_ status: UInt8, _ d1: UInt8, _ d2: UInt8 = 0, length: Int = 3) {
    if let block = midiBlock ?? instrument.auAudioUnit.scheduleMIDIEventBlock {
      var bytes = (status, d1, d2)
      withUnsafeBytes(of: &bytes) { raw in
        block(AUEventSampleTimeImmediate, 0, length, raw.bindMemory(to: UInt8.self).baseAddress!)
      }
    } else if let midi = instrument as? AVAudioUnitMIDIInstrument {
      midi.sendMIDIEvent(status, data1: d1, data2: d2)
    }
  }
}
