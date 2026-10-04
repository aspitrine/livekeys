import AVFoundation

/// Tempo and beat position given to Audio Units (synced delays, arpeggiators, LFOs) through the AUv3
/// host musical context. The output unit's render advances the beat; there is no transport to start or stop.
final class MusicalContext {
  /// Never freed: loaded Audio Units keep calling the context block for as long as they live.
  private static let clock = LKMusicalClockCreate(120, 48_000)!
  private var unit: AudioUnit?

  func setTempo(_ bpm: Double) { LKMusicalClockSetTempo(Self.clock, bpm) }

  /// Call before the Audio Unit allocates its render resources (i.e. before attaching it to the engine).
  static func install(on unit: AVAudioUnit) {
    let clock = Self.clock
    unit.auAudioUnit.musicalContextBlock = { tempo, numerator, denominator, beat, offset, downbeat in
      // Runs on the plugin's render thread: lock-free read, no allocation.
      let context = LKMusicalClockRead(clock)
      tempo?.pointee = context.tempo
      numerator?.pointee = 4
      denominator?.pointee = 4
      beat?.pointee = context.beatPosition
      offset?.pointee = Int(context.sampleOffsetToNextBeat)
      downbeat?.pointee = context.measureDownbeatPosition
      return true
    }
  }

  func attach(_ output: AudioUnit, sampleRate: Double) {
    detach()
    LKMusicalClockSetSampleRate(Self.clock, sampleRate)
    if AudioUnitAddRenderNotify(output, advance, UnsafeMutableRawPointer(Self.clock)) == noErr { unit = output }
  }

  func detach() {
    guard let unit else { return }
    AudioUnitRemoveRenderNotify(unit, advance, UnsafeMutableRawPointer(Self.clock))
    self.unit = nil
  }
}

/// Audio thread, once per output buffer: no allocation or mutex.
private let advance: AURenderCallback = { refCon, flags, _, bus, frames, _ in
  if bus == 0, flags.pointee.contains(.unitRenderAction_PostRender) {
    LKMusicalClockAdvance(OpaquePointer(refCon), frames)
  }
  return noErr
}
