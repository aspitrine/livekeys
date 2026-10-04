import XCTest
@testable import AudioSafety

final class MidiVolumeControlTests: XCTestCase {
  func testVolumeCCIsOwnedByHostOnlyOnItsMappedChannel() {
    let binding = MidiVolumeControl(cc: 7, channel: 2)
    XCTAssertTrue(binding.consumes(cc: 7, channel: 2))
    XCTAssertFalse(binding.consumes(cc: 7, channel: 1))
    XCTAssertFalse(binding.consumes(cc: 11, channel: 2))
    XCTAssertTrue(MidiVolumeControl(cc: 11, channel: -1).consumes(cc: 11, channel: 15))
  }
  func testSustainAndPanicCannotBeSwallowedByVolumeMappings() {
    for cc in [64, 120, 123] {
      XCTAssertFalse(MidiVolumeControl(cc: cc, channel: -1).consumes(cc: UInt8(cc), channel: 0))
    }
  }
}
