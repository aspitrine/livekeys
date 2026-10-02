import AVFoundation
import XCTest
@testable import AudioSafety

final class PadScenariosTests: XCTestCase {
  func testRestartingTheSameChordDuringStopCancelsTheStop() throws {
    let pad = PadHarness()
    try pad.start()
    defer { pad.engine.stop() }
    let chord: Set<UInt8> = [48, 55, 60, 64]
    let initial = try XCTUnwrap(pad.voices.prepare(first: pad.first, wanted: chord, velocity: 90))
    _ = pad.voices.tick(initial, first: pad.first, progress: 1)
    XCTAssertGreaterThan(try pad.peak(seconds: 1), 0.001)
    let stop = try XCTUnwrap(pad.voices.prepare(first: pad.first, wanted: [], velocity: 90))
    _ = pad.voices.tick(stop, first: pad.first, progress: 0.5)
    let restart = try XCTUnwrap(pad.voices.prepare(first: pad.first, wanted: chord, velocity: 90))
    _ = pad.voices.tick(restart, first: pad.first, progress: 1)
    // An old queued stop callback must not silence the restarted chord.
    _ = pad.voices.tick(stop, first: pad.first, progress: 1)
    XCTAssertEqual(pad.voices.notes[pad.voices.active], chord)
    XCTAssertGreaterThan(try pad.peak(seconds: 0.5), 0.001)
  }

  func testStoppingHalfwayThroughAChordChangeSilencesBothVoices() throws {
    let pad = PadHarness()
    try pad.start()
    defer { pad.engine.stop() }
    let initial = try XCTUnwrap(pad.voices.prepare(first: pad.first, wanted: [48, 55, 60, 64], velocity: 90))
    _ = pad.voices.tick(initial, first: pad.first, progress: 1)
    _ = try pad.peak(seconds: 1)
    let change = try XCTUnwrap(pad.voices.prepare(first: pad.first, wanted: [50, 57, 62, 65], velocity: 90))
    _ = pad.voices.tick(change, first: pad.first, progress: 0.5)
    XCTAssertGreaterThan(try pad.peak(seconds: 0.25), 0.001)
    let stop = try XCTUnwrap(pad.voices.prepare(first: pad.first, wanted: [], velocity: 90))
    _ = pad.voices.tick(stop, first: pad.first, progress: 1)
    _ = pad.voices.tick(change, first: pad.first, progress: 1)
    XCTAssertTrue(pad.voices.notes.allSatisfy(\.isEmpty))
    _ = try pad.peak(seconds: 0.1)
    XCTAssertLessThan(try pad.peak(seconds: 0.25), 0.00001)
  }

  /// Chords often change faster than the fade (2 s): the voice holding the chord before last is
  /// still audible and gets recycled. It must ramp down, not drop to silence within one buffer.
  func testChangingChordDuringAFadeDoesNotCutTheRecycledVoice() throws {
    let pad = PadHarness()
    try pad.start()
    defer { pad.engine.stop() }
    let c: Set<UInt8> = [48, 55, 60, 64]
    let dm: Set<UInt8> = [50, 57, 62, 65]
    let g: Set<UInt8> = [43, 50, 55, 59]
    let first = try XCTUnwrap(pad.voices.prepare(first: pad.first, wanted: c, velocity: 90))
    _ = pad.voices.tick(first, first: pad.first, progress: 1)
    _ = try pad.peak(seconds: 1)
    let change = try XCTUnwrap(pad.voices.prepare(first: pad.first, wanted: dm, velocity: 90))
    _ = pad.voices.tick(change, first: pad.first, progress: 0.25)  // C still at 75 %
    _ = try pad.peak(seconds: 0.2)
    let before = try pad.rms(buffers: 1)
    let next = try XCTUnwrap(pad.voices.prepare(first: pad.first, wanted: g, velocity: 90, fadeSeconds: 2))
    _ = pad.voices.tick(next, first: pad.first, progress: 0.002)
    let after = try pad.rms(buffers: 1)
    XCTAssertGreaterThan(after / before, 0.8, "recycled voice dropped abruptly (click)")
    // The new chord still arrives and ends up alone.
    for step in 1...50 { _ = pad.voices.tick(next, first: pad.first, progress: Double(step) / 50) }
    XCTAssertEqual(pad.voices.notes[pad.voices.active], g)
    XCTAssertTrue(pad.voices.notes[1 - pad.voices.active].isEmpty)
    XCTAssertGreaterThan(try pad.peak(seconds: 0.5), 0.001)
  }
}

private final class PadHarness {
  let engine = AVAudioEngine()
  let first = AVAudioUnitSampler()
  let voices = PadVoices()
  let format = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 2)!
  lazy var buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 128)!

  func start() throws {
    engine.attach(first)
    engine.attach(voices.second)
    engine.attach(voices.mixer)
    engine.connect(first, to: voices.mixer, fromBus: 0, toBus: 0, format: format)
    engine.connect(voices.second, to: voices.mixer, fromBus: 0, toBus: 1, format: format)
    engine.connect(voices.mixer, to: engine.mainMixerNode, format: format)
    voices.mixer.outputVolume = 0.1
    try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 128)
    try engine.start()
    let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    let bank = root.appendingPathComponent("modules/audio-engine/ios/SoundFonts/GeneralUser-GS.sf2")
    for voice in [first, voices.second] {
      try voice.loadSoundBankInstrument(at: bank, program: 89,
        bankMSB: UInt8(kAUSampler_DefaultMelodicBankMSB), bankLSB: 0)
    }
  }

  func rms(buffers: Int) throws -> Float {
    var sum: Float = 0
    var count = 0
    for _ in 0..<buffers {
      XCTAssertEqual(try engine.renderOffline(128, to: buffer), .success)
      for ch in 0..<2 {
        for frame in 0..<Int(buffer.frameLength) { sum += buffer.floatChannelData![ch][frame] * buffer.floatChannelData![ch][frame]; count += 1 }
      }
    }
    return (sum / Float(max(count, 1))).squareRoot()
  }

  func peak(seconds: Double) throws -> Float {
    var maximum: Float = 0
    for _ in 0..<Int(seconds * 48000 / 128) {
      XCTAssertEqual(try engine.renderOffline(128, to: buffer), .success)
      for ch in 0..<2 {
        for frame in 0..<Int(buffer.frameLength) { maximum = max(maximum, abs(buffer.floatChannelData![ch][frame])) }
      }
    }
    return maximum
  }
}
