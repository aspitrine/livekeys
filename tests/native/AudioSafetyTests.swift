import AVFoundation
import XCTest
@testable import AudioSafety

final class AudioSafetyTests: XCTestCase {
  func testCancelledFadeCannotChangeGains() {
    let fade = PadTransition(generation: 1, outgoingStart: 1, incomingStart: 0, fadesOut: true, fadesIn: true)
    XCTAssertNil(fade.gains(progress: 0.5, currentGeneration: 2))
  }

  func testCorrelatedVoicesNeverExceedTheLayerGain() {
    let fade = PadTransition(generation: 1, outgoingStart: 1, incomingStart: 0, fadesOut: true, fadesIn: true)
    for i in 0...100 {
      let gains = fade.gains(progress: Double(i) / 100, currentGeneration: 1)!
      XCTAssertLessThanOrEqual((gains.outgoing ?? 0) + (gains.incoming ?? 0), 1.000001)
    }
  }

  func testPanicSilencesBothRealSamplerVoicesWithoutRaisingTheirGains() throws {
    let engine = AVAudioEngine()
    let format = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 2)!
    let voices = [AVAudioUnitSampler(), AVAudioUnitSampler()]
    for voice in voices {
      engine.attach(voice)
      engine.connect(voice, to: engine.mainMixerNode, format: format)
      voice.volume = 0.05
    }
    try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 128)
    try engine.start()
    defer { engine.stop() }
    let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    let bank = root.appendingPathComponent("modules/audio-engine/ios/SoundFonts/GeneralUser-GS.sf2")
    for voice in voices {
      try voice.loadSoundBankInstrument(at: bank, program: 89,
        bankMSB: UInt8(kAUSampler_DefaultMelodicBankMSB), bankLSB: 0)
      voice.startNote(60, withVelocity: 90, onChannel: 0)
    }
    let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 128)!
    func peak(frames: Int) throws -> Float {
      var maximum: Float = 0, remaining = frames
      while remaining > 0 {
        XCTAssertEqual(try engine.renderOffline(AVAudioFrameCount(min(128, remaining)), to: buffer), .success)
        for channel in 0..<2 {
          for frame in 0..<Int(buffer.frameLength) { maximum = max(maximum, abs(buffer.floatChannelData![channel][frame])) }
        }
        remaining -= Int(buffer.frameLength)
      }
      return maximum
    }
    XCTAssertGreaterThan(try peak(frames: 48000), 0.001)
    AudioSafety.panicPadVoices(voices)
    XCTAssertTrue(voices.allSatisfy { $0.volume <= 0.05 })
    _ = try peak(frames: 4800) // Allow the mixer's gain ramp to settle.
    XCTAssertLessThan(try peak(frames: 24000), 0.00001)
  }
}
