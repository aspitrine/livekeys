import AVFoundation

/// Chord pads play on two identical sampler voices mixed together, so a chord change can
/// crossfade (new chord fades in on one voice while the old one fades out on the other)
/// instead of cutting notes. Voice 0 is the layer's instrument, voice 1 is `second`.
final class PadVoices {
  let second = AVAudioUnitSampler()
  let mixer = AVAudioMixerNode()
  /// Notes held by each voice.
  var notes: [Set<UInt8>] = [[], []]
  var active = 0
  /// Bumped on every chord change, so a finished fade knows if it is still current.
  var generation = 0
  var fade: DispatchSourceTimer?
  private var requested: Set<UInt8> = []
  /// Chord waiting for its voice to finish a short ramp-down (the voice was still audible).
  private var pendingStart: (generation: Int, notes: Set<UInt8>, velocity: UInt8)?
  /// Ramp applied to a still-audible voice before it is recycled for a new chord.
  static let recycleSeconds = 0.04

  init(restoring: Set<UInt8> = []) {
    notes[0] = restoring
    requested = restoring
  }

  /// Call under the engine lock. Prepares the real MIDI voices for one transition.
  func prepare(first: AVAudioUnit, wanted: Set<UInt8>, velocity: UInt8, fadeSeconds: Double = 2) -> PadVoiceFade? {
    func voice(_ index: Int) -> AVAudioUnit { index == 0 ? first : second }
    let from = self.active
    // Compare with the requested target, not notes still sounding during a fade.
    guard wanted != requested else { return nil }
    requested = wanted
    self.generation += 1
    let generation = self.generation
    self.fade?.cancel()
    pendingStart = nil

    let outVoice = voice(from) as! AVAudioMixing
    let to = 1 - from
    let inVoice = voice(to) as! AVAudioMixing
    var recycleFraction = 0.0

    if !wanted.isEmpty {
      // The incoming voice may still hold a chord fading out from an earlier change (chords that
      // change faster than the fade). Cutting it at once clicks: ramp it down first, then start.
      let recycledGain = notes[to].isEmpty ? 0 : inVoice.volume
      if recycledGain > 0.001 {
        recycleFraction = min(Self.recycleSeconds / max(fadeSeconds, Self.recycleSeconds), 0.5)
        pendingStart = (generation, wanted, velocity)
      } else {
        start(wanted, velocity: velocity, on: voice(to), fromSilence: self.notes[from].isEmpty)
        self.notes[to] = wanted
      }
      self.active = to
    }

    let fadingOut = !self.notes[from].isEmpty && (wanted.isEmpty || to != from)
    let outStart = outVoice.volume
    let inStart = inVoice.volume
    let transition = PadTransition(generation: generation, outgoingStart: outStart, incomingStart: inStart,
      fadesOut: fadingOut, fadesIn: !wanted.isEmpty || !notes[to].isEmpty, incomingEnd: wanted.isEmpty ? 0 : 1)
    return PadVoiceFade(from: from, to: to, transition: transition, recycleFraction: recycleFraction)
  }

  /// Starts a chord on a silent voice (all sound off first, so no stale release tail comes back).
  private func start(_ chord: Set<UInt8>, velocity: UInt8, on voice: AVAudioUnit, fromSilence: Bool) {
    AudioSafety.panicPadVoices([voice])
    // Nothing else playing: the sound's own attack does the fade-in.
    (voice as! AVAudioMixing).volume = fromSilence ? 1 : 0
    for note in chord { AudioSafety.send(to: voice, 0x90, note, velocity) }
  }

  /// Caller serializes ticks with preparation / Panic using the engine lock.
  func tick(_ fade: PadVoiceFade, first: AVAudioUnit, progress: Double) -> Bool {
    guard let gains = fade.transition.gains(progress: progress, currentGeneration: generation) else { return true }
    let incomingVoice = fade.to == 0 ? first : second
    if let volume = gains.outgoing { ((fade.from == 0 ? first : second) as! AVAudioMixing).volume = volume }

    if let pending = pendingStart, pending.generation == fade.transition.generation {
      // Phase 1: the recycled voice ramps down; phase 2 starts the new chord on it.
      if progress < fade.recycleFraction {
        let t = Float(progress / fade.recycleFraction)
        (incomingVoice as! AVAudioMixing).volume = fade.transition.incomingStart * (1 - t)
        return false
      }
      pendingStart = nil
      start(pending.notes, velocity: pending.velocity, on: incomingVoice, fromSilence: false)
      notes[fade.to] = pending.notes
    }
    if fade.recycleFraction > 0 {
      // Incoming chord fades in over what remains of the transition.
      let u = fade.recycleFraction < 1 ? (progress - fade.recycleFraction) / (1 - fade.recycleFraction) : 1
      (incomingVoice as! AVAudioMixing).volume = Float(min(max(u, 0), 1)) * fade.transition.incomingEnd
    } else if let volume = gains.incoming {
      (incomingVoice as! AVAudioMixing).volume = volume
    }
    guard progress >= 1 else { return false }
    if fade.transition.fadesOut {
      let voice = fade.from == 0 ? first : second
      for note in notes[fade.from] { AudioSafety.send(to: voice, 0x80, note, 0) }
      notes[fade.from] = []
    }
    if fade.transition.incomingEnd == 0 {
      let voice = fade.to == 0 ? first : second
      for note in notes[fade.to] { AudioSafety.send(to: voice, 0x80, note, 0) }
      notes[fade.to] = []
    }
    return true
  }

  func panic(first: AVAudioUnit) {
    fade?.cancel()
    fade = nil
    pendingStart = nil
    generation += 1
    requested = []
    notes = [[], []]
    AudioSafety.panicPadVoices([first, second])
  }
}

struct PadVoiceFade {
  let from: Int
  let to: Int
  let transition: PadTransition
  /// Share of the transition spent ramping a recycled voice down before the new chord starts (0 = none).
  var recycleFraction: Double = 0
}
