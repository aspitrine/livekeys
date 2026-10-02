import AVFoundation

/// SoundFont preset loaded in the built-in sampler, kept to reload it when needed.
struct SamplerPreset {
  let url: URL
  let program: UInt8
  let bankMSB: UInt8
  let bankLSB: UInt8
}

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
  /// Under the engine lock. Failed / unfinished loads must never play a default preset.
  var audioReady = false
  /// Fading out (before removal or a reload): the mix leaves its volume alone.
  var fading = false
  var sustain = SustainState()
  var instrument: AVAudioUnit = AVAudioUnitSampler()
  var effects: [EffectSlot] = []
  let strip = AVAudioMixerNode()
  /// What the sampler plays. AVAudioUnitSampler falls back to its default sine sound whenever it is
  /// reconnected or the engine restarts, so the preset is reloaded after each of those.
  var samplerPreset: SamplerPreset?
  /// Notes held by a chord pad (generated, not from the keyboard).
  var padNotes: Set<UInt8> = []
  var padVelocity: UInt8 = 90
  /// Set on chord pads with the built-in sampler (see PadVoices).
  var padVoices: PadVoices?
  /// Render time of the layer's chain (instrument + effects), measured on its last unit.
  let meter = RenderMeter()
  /// Cached once render resources are allocated; nil falls back to a lookup on each event.
  var midiBlock: AUScheduleMIDIEventBlock?

  init(id: String) {
    self.id = id
    strip.outputVolume = 0
  }

  var sampler: AVAudioUnitSampler? { instrument as? AVAudioUnitSampler }

  /// Reloads the sampler preset (no-op for AUv3 instruments).
  func reloadSamplerPreset() throws {
    guard let sampler, let p = samplerPreset else { return }
    try AudioSafety.reloadSamplers([sampler] + (padVoices.map { [$0.second] } ?? []), strip: strip,
      url: p.url, program: p.program, bankMSB: p.bankMSB, bankLSB: p.bankLSB)
  }

  /// Audio chain in signal order, strip excluded.
  /// Pads start from their voice mixer (the voices feed it).
  var chain: [AVAudioNode] { [padVoices?.mixer ?? instrument] + effects.map(\.unit) }

  /// Pad voice `index`: 0 = instrument, 1 = second sampler.
  func padVoice(_ index: Int) -> AVAudioUnit {
    index == 0 ? instrument : padVoices?.second ?? instrument
  }

  /// Raw MIDI to any unit of this layer (pad voices).
  static func send(to unit: AVAudioUnit, _ status: UInt8, _ d1: UInt8, _ d2: UInt8 = 0) {
    AudioSafety.send(to: unit, status, d1, d2)
  }

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
