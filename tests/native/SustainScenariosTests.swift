import AVFoundation
import XCTest
@testable import AudioSafety

final class SustainScenariosTests: XCTestCase {
  func testUnrelatedMixUpdatesAndChannelFilteringPreservePedalState() {
    var state = SustainState()
    XCTAssertNil(state.configure(enabled: true, channel: 2))
    XCTAssertNil(state.receive(channel: 0, value: 127))
    XCTAssertEqual(state.receive(channel: 2, value: 96), 96)
    XCTAssertNil(state.configure(enabled: true, channel: 2))
    XCTAssertEqual(state.restoredValue, 96)
    state.reset()
    XCTAssertEqual(state.restoredValue, 0)
    XCTAssertEqual(state.receive(channel: 2, value: 0), 0)
  }

  func testPedalReleaseDuringReloadIsRememberedForRestoration() {
    var state = SustainState()
    _ = state.receive(channel: 0, value: 127)
    XCTAssertEqual(state.restoredValue, 127)
    // A muted/loading instrument does not receive these events, but its state must.
    _ = state.receive(channel: 0, value: 0)
    XCTAssertEqual(state.restoredValue, 0)
  }

  func testNewPatchLoadedWhilePedalIsHeldReceivesThePedalPosition() throws {
    let sound = try SustainHarness()
    defer { sound.engine.stop() }
    var input = SustainState()
    _ = input.receive(channel: 0, value: 127)
    var newLayer = SustainState()
    sound.sustain(newLayer.synchronize(from: input))
    sound.sampler.startNote(60, withVelocity: 90, onChannel: 0)
    _ = try sound.peak(seconds: 0.25)
    sound.sampler.stopNote(60, onChannel: 0)
    _ = try sound.peak(seconds: 0.25)
    XCTAssertGreaterThan(try sound.peak(seconds: 0.25), 0.001)
    _ = input.receive(channel: 0, value: 0)
    sound.sustain(newLayer.synchronize(from: input))
    _ = try sound.peak(seconds: 0.25)
    XCTAssertLessThan(try sound.peak(seconds: 0.25), 0.00001)
  }

  func testReenablingSustainUsesOnlyTheCurrentlySelectedInputChannel() {
    var input = SustainState()
    _ = input.receive(channel: 0, value: 127)
    _ = input.receive(channel: 1, value: 80)
    var layer = SustainState()
    _ = layer.configure(enabled: false, channel: 1)
    XCTAssertNil(layer.synchronize(from: input))
    _ = layer.configure(enabled: true, channel: 1)
    XCTAssertEqual(layer.synchronize(from: input), 80)
    XCTAssertNil(layer.synchronize(from: input))
  }
  func testDisablingSustainWhilePedalIsHeldReleasesLatchedNotes() throws {
    try checkRoutingChange(enabled: false, channel: -1)
  }

  func testChangingInputChannelWhilePedalIsHeldReleasesLatchedNotes() throws {
    try checkRoutingChange(enabled: true, channel: 1)
  }

  private func checkRoutingChange(enabled: Bool, channel: Int) throws {
    let sound = try SustainHarness()
    defer { sound.engine.stop() }
    var state = SustainState()
    sound.sustain(state.receive(channel: 0, value: 127))
    sound.sampler.startNote(60, withVelocity: 90, onChannel: 0)
    _ = try sound.peak(seconds: 0.25)
    sound.sampler.stopNote(60, onChannel: 0)
    XCTAssertGreaterThan(try sound.peak(seconds: 0.25), 0.001)
    sound.sustain(state.configure(enabled: enabled, channel: channel))
    _ = try sound.peak(seconds: 0.25)
    XCTAssertLessThan(try sound.peak(seconds: 0.25), 0.00001)
  }

  func testOmniLayerKeepsSustainUntilBothInputPedalsAreReleased() throws {
    let sound = try SustainHarness()
    defer { sound.engine.stop() }
    var state = SustainState()
    sound.sustain(state.receive(channel: 0, value: 127))
    sound.sustain(state.receive(channel: 1, value: 127))
    sound.sampler.startNote(60, withVelocity: 90, onChannel: 0)
    _ = try sound.peak(seconds: 0.25)
    sound.sampler.stopNote(60, onChannel: 0)
    sound.sustain(state.receive(channel: 0, value: 0))
    _ = try sound.peak(seconds: 0.25)
    XCTAssertGreaterThan(try sound.peak(seconds: 0.25), 0.001)
    sound.sustain(state.receive(channel: 1, value: 0))
    _ = try sound.peak(seconds: 0.25)
    XCTAssertLessThan(try sound.peak(seconds: 0.25), 0.00001)
  }
}

private final class SustainHarness {
  let engine = AVAudioEngine()
  let sampler = AVAudioUnitSampler()
  let format = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 2)!
  lazy var buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 128)!

  init() throws {
    engine.attach(sampler)
    engine.connect(sampler, to: engine.mainMixerNode, format: format)
    try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 128)
    try engine.start()
    let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    try sampler.loadSoundBankInstrument(at: root.appendingPathComponent("modules/audio-engine/ios/SoundFonts/GeneralUser-GS.sf2"),
      program: 16, bankMSB: UInt8(kAUSampler_DefaultMelodicBankMSB), bankLSB: 0)
    sampler.volume = 0.1
  }

  func sustain(_ value: UInt8?) {
    if let value { AudioSafety.send(to: sampler, 0xB0, 64, value) }
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
