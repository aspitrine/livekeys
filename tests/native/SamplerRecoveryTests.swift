import AVFoundation
import XCTest
@testable import AudioSafety

final class SamplerRecoveryTests: XCTestCase {
  func testFailedPresetLoadLeavesAnAlreadyPlayingLayerSilent() throws {
    try exerciseRecovery(fail: true)
  }

  func testSuccessfulReloadStaysSilentUntilTheLatestMixIsApplied() throws {
    try exerciseRecovery(fail: false)
  }

  private func exerciseRecovery(fail: Bool) throws {
    let engine = AVAudioEngine()
    let sampler = AVAudioUnitSampler()
    let strip = AVAudioMixerNode()
    let format = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 2)!
    engine.attach(sampler)
    engine.attach(strip)
    engine.connect(sampler, to: strip, format: format)
    engine.connect(strip, to: engine.mainMixerNode, format: format)
    try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 128)
    try engine.start()
    defer { engine.stop() }
    let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    let bank = root.appendingPathComponent("modules/audio-engine/ios/SoundFonts/GeneralUser-GS.sf2")
    try sampler.loadSoundBankInstrument(at: bank, program: 89,
      bankMSB: UInt8(kAUSampler_DefaultMelodicBankMSB), bankLSB: 0)
    strip.outputVolume = 0.1
    sampler.startNote(60, withVelocity: 90, onChannel: 0)
    let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 128)!
    func peak(seconds: Double) throws -> Float {
      var maximum: Float = 0
      for _ in 0..<Int(seconds * 48000 / 128) {
        XCTAssertEqual(try engine.renderOffline(128, to: buffer), .success)
        for channel in 0..<2 {
          for frame in 0..<Int(buffer.frameLength) { maximum = max(maximum, abs(buffer.floatChannelData![channel][frame])) }
        }
      }
      return maximum
    }
    XCTAssertGreaterThan(try peak(seconds: 1), 0.001)
    let reload = {
      try AudioSafety.reloadSamplers([sampler], strip: strip,
        url: fail ? root.appendingPathComponent("missing-bank.sf2") : bank,
        program: 89, bankMSB: UInt8(kAUSampler_DefaultMelodicBankMSB), bankLSB: 0)
    }
    if fail { XCTAssertThrowsError(try reload()) }
    else { try reload() }
    XCTAssertEqual(strip.outputVolume, 0)
    sampler.startNote(60, withVelocity: 90, onChannel: 0)
    _ = try peak(seconds: 0.1) // Let mixer gain ramp settle.
    XCTAssertLessThan(try peak(seconds: 0.25), 0.00001)
    if !fail {
      strip.outputVolume = 0.02 // Latest fader setting, not the previous 0.1.
      XCTAssertGreaterThan(try peak(seconds: 0.25), 0.00001)
    }
  }
}
