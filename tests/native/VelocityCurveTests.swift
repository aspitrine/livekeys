import XCTest
@testable import AudioSafety

final class VelocityCurveTests: XCTestCase {
  func testNormalIsUnchanged() {
    for v: UInt8 in [1, 40, 64, 100, 127] { XCTAssertEqual(VelocityCurve.normal.apply(v), v) }
  }

  func testLightMakesSoftPlayingLouderHeavyQuieter() {
    XCTAssertGreaterThan(VelocityCurve.light.apply(50), 50)
    XCTAssertLessThan(VelocityCurve.heavy.apply(50), 50)
  }

  func testEndsAreKeptAndNoNoteIsLost() {
    for curve in [VelocityCurve.light, .heavy] {
      XCTAssertEqual(curve.apply(127), 127)
      XCTAssertGreaterThanOrEqual(curve.apply(1), 1)  // velocity 0 would turn the note into a note-off
    }
  }

  func testCurveStaysMonotonic() {
    for curve in [VelocityCurve.light, .normal, .heavy] {
      var previous: UInt8 = 0
      for v: UInt8 in 1...127 {
        XCTAssertGreaterThanOrEqual(curve.apply(v), previous)
        previous = curve.apply(v)
      }
    }
  }
}
