import AVFoundation

/// Shared MIDI send path for native voices; all messages here are channel 0, already routed by the layer.
enum AudioSafety {
  /// Leaves the strip silent on success AND failure. The engine applies the
  /// latest mix only after all voices and held notes have been restored.
  static func reloadSamplers(_ voices: [AVAudioUnitSampler], strip: AVAudioMixerNode,
                             url: URL, program: UInt8, bankMSB: UInt8, bankLSB: UInt8) throws {
    strip.outputVolume = 0
    for voice in voices {
      try voice.loadSoundBankInstrument(at: url, program: program, bankMSB: bankMSB, bankLSB: bankLSB)
    }
  }

  static func send(to unit: AVAudioUnit, _ status: UInt8, _ d1: UInt8, _ d2: UInt8 = 0) {
    if let block = unit.auAudioUnit.scheduleMIDIEventBlock {
      var bytes = (status, d1, d2)
      withUnsafeBytes(of: &bytes) { raw in
        block(AUEventSampleTimeImmediate, 0, 3, raw.bindMemory(to: UInt8.self).baseAddress!)
      }
    } else if let midi = unit as? AVAudioUnitMIDIInstrument {
      midi.sendMIDIEvent(status, data1: d1, data2: d2)
    }
  }

  static func panicPadVoices(_ voices: [AVAudioUnit]) {
    for voice in voices {
      // Silence first: all-notes-off can leave release tails sounding.
      (voice as? AVAudioMixing)?.volume = 0
      send(to: voice, 0xB0, 64, 0)
      send(to: voice, 0xB0, 123, 0)
      send(to: voice, 0xB0, 120, 0)
    }
  }
}
