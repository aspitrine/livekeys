import XCTest
@testable import AudioSafety

/// The same keyboard connected twice (USB + Bluetooth) sends every note-on twice, a few ms apart.
final class DuplicateNoteTests: XCTestCase {
  func testSecondNoteOnFromAnotherConnectionIsIgnored() {
    var filter = NoteDeduplicator()
    XCTAssertTrue(filter.accept(key: 60, held: false, now: 1.000))
    XCTAssertFalse(filter.accept(key: 60, held: true, now: 1.004), "doubled note retriggers the attack")
  }

  func testRepeatedNoteAfterReleaseIsPlayed() {
    var filter = NoteDeduplicator()
    XCTAssertTrue(filter.accept(key: 60, held: false, now: 1.000))
    XCTAssertTrue(filter.accept(key: 60, held: false, now: 1.010))  // released in between: real repeat
  }

  func testHeldNoteStruckAgainLaterIsPlayed() {
    var filter = NoteDeduplicator()
    XCTAssertTrue(filter.accept(key: 60, held: false, now: 1.000))
    XCTAssertTrue(filter.accept(key: 60, held: true, now: 1.200))  // e.g. note-off lost, played again
  }

  func testOtherKeysAreIndependent() {
    var filter = NoteDeduplicator()
    XCTAssertTrue(filter.accept(key: 60, held: false, now: 1.000))
    XCTAssertTrue(filter.accept(key: 64, held: false, now: 1.001))
  }
}
