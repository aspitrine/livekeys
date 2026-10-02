import XCTest
@testable import AudioSafety

/// Wheels and pedals keep moving while a layer is inactive (preloaded neighbour, previous patch).
/// When it becomes active again it must be brought back in line with the hardware.
final class ControllerScenariosTests: XCTestCase {
  func testPitchBendLeftUpWhilePatchChangedIsCentredWhenReactivated() {
    var input = ControllerState()
    input.receive(channel: 0, status: 0xE0, data1: 0x7F, data2: 0x7F)  // wheel up, sent to the old patch
    input.receive(channel: 0, status: 0xE0, data1: 0x00, data2: 0x40)  // back to centre, only new patch heard it
    let messages = input.snapshot(listening: { _ in true })
    XCTAssertTrue(messages.contains { $0 == [0xE0, 0x00, 0x40] }, "pitch bend not restored to centre")
  }

  func testModWheelAndExpressionAreRestored() {
    var input = ControllerState()
    input.receive(channel: 0, status: 0xB0, data1: 1, data2: 90)
    input.receive(channel: 0, status: 0xB0, data1: 11, data2: 40)
    let messages = input.snapshot(listening: { _ in true })
    XCTAssertTrue(messages.contains { $0 == [0xB0, 1, 90] })
    XCTAssertTrue(messages.contains { $0 == [0xB0, 11, 40] })
  }

  func testOnlyChannelsTheLayerListensToAreRestored() {
    var input = ControllerState()
    input.receive(channel: 0, status: 0xE0, data1: 0, data2: 0x60)
    input.receive(channel: 1, status: 0xE0, data1: 0, data2: 0x20)
    let messages = input.snapshot(listening: { $0 == 1 })
    XCTAssertEqual(messages.filter { $0[0] == 0xE0 }, [[0xE0, 0, 0x20]])
  }

  func testUntouchedControllersAreResetToNeutral() {
    let messages = ControllerState().snapshot(listening: { _ in true })
    XCTAssertTrue(messages.contains { $0 == [0xE0, 0x00, 0x40] })
    XCTAssertTrue(messages.contains { $0 == [0xB0, 1, 0] })
  }

  func testSustainAndModeMessagesAreNotStoredHere() {
    var input = ControllerState()
    input.receive(channel: 0, status: 0xB0, data1: 64, data2: 127)  // owned by SustainState
    input.receive(channel: 0, status: 0xB0, data1: 123, data2: 0)
    XCTAssertFalse(input.snapshot(listening: { _ in true }).contains { $0[1] == 64 || $0[1] == 123 })
  }
}
