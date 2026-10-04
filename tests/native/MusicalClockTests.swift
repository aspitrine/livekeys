import Dispatch
import RenderStatsCore
import XCTest

final class MusicalClockTests: XCTestCase {
  func testBeatPositionFollowsTempoAndStaysContinuousAcrossChanges() {
    let clock = LKMusicalClockCreate(120, 48000)!
    defer { LKMusicalClockDestroy(clock) }
    // 120 BPM at 48 kHz: one beat = 24 000 frames.
    LKMusicalClockAdvance(clock, 12000)
    var context = LKMusicalClockRead(clock)
    XCTAssertEqual(context.tempo, 120)
    XCTAssertEqual(context.beatPosition, 0.5, accuracy: 1e-9)
    XCTAssertEqual(context.sampleOffsetToNextBeat, 12000)
    XCTAssertEqual(context.measureDownbeatPosition, 0)

    LKMusicalClockSetTempo(clock, 60)
    context = LKMusicalClockRead(clock)
    XCTAssertEqual(context.beatPosition, 0.5, accuracy: 1e-9, "a tempo change never jumps the position")
    XCTAssertEqual(context.sampleOffsetToNextBeat, 24000, "half a beat at 60 BPM")
    for _ in 0..<9 { LKMusicalClockAdvance(clock, 48000) }
    context = LKMusicalClockRead(clock)
    XCTAssertEqual(context.beatPosition, 9.5, accuracy: 1e-9)
    XCTAssertEqual(context.measureDownbeatPosition, 8)
  }

  func testInvalidValuesAreClamped() {
    let clock = LKMusicalClockCreate(.nan, 0)!
    defer { LKMusicalClockDestroy(clock) }
    XCTAssertEqual(LKMusicalClockRead(clock).tempo, 120)
    LKMusicalClockSetTempo(clock, 1000)
    XCTAssertEqual(LKMusicalClockRead(clock).tempo, 300)
    LKMusicalClockSetTempo(clock, 5)
    XCTAssertEqual(LKMusicalClockRead(clock).tempo, 20)
    LKMusicalClockSetSampleRate(clock, -1)
    LKMusicalClockSetTempo(clock, 120)
    LKMusicalClockAdvance(clock, 24000)
    XCTAssertEqual(LKMusicalClockRead(clock).beatPosition, 1, accuracy: 1e-9, "falls back to 48 kHz")
  }

  /// Render thread advances while the UI changes tempo and plugin threads read: no torn values, no races (TSan).
  func testConcurrentTempoChangesAndReads() {
    let clock = LKMusicalClockCreate(100, 48000)!
    defer { LKMusicalClockDestroy(clock) }
    let group = DispatchGroup()
    DispatchQueue.global().async(group: group) {
      for _ in 0..<100_000 { LKMusicalClockAdvance(clock, 128) }
    }
    DispatchQueue.global().async(group: group) {
      for i in 0..<10_000 { LKMusicalClockSetTempo(clock, i.isMultiple(of: 2) ? 90 : 140) }
    }
    var last = 0.0
    while group.wait(timeout: .now()) == .timedOut {
      let context = LKMusicalClockRead(clock)
      XCTAssertTrue([90, 100, 140].contains(context.tempo))
      XCTAssertGreaterThanOrEqual(context.beatPosition, last)
      XCTAssertGreaterThanOrEqual(context.sampleOffsetToNextBeat, 0)
      last = context.beatPosition
    }
    XCTAssertGreaterThan(LKMusicalClockRead(clock).beatPosition, 0)
  }
}
