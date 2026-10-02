import Dispatch
import RenderStatsCore
import XCTest

final class RenderStatsTests: XCTestCase {
  func testRenderTimingAndWindowReset() {
    let stats = LKRenderStatsCreate(0.000001, 48000)!
    defer { LKRenderStatsDestroy(stats) }
    LKRenderStatsPreRender(stats, 10)
    LKRenderStatsPostRender(stats, 1010, 48)
    let sample = LKRenderStatsRead(stats)
    XCTAssertEqual(sample.count, 1)
    XCTAssertEqual(sample.average, 1, accuracy: 0.001)
    XCTAssertEqual(sample.peak, 1, accuracy: 0.001)
    XCTAssertEqual(sample.overloads, 0)
    XCTAssertEqual(LKRenderStatsRead(stats).count, 0)
    LKRenderStatsSetSampleRate(stats, 96000)
    LKRenderStatsPreRender(stats, 10)
    LKRenderStatsPostRender(stats, 1010, 48)
    XCTAssertEqual(LKRenderStatsRead(stats).overloads, 1)
  }

  func testConcurrentReadsDoNotLoseSamplesOrInventLoadSpikes() {
    let stats = LKRenderStatsCreate(1, 48000)!
    defer { LKRenderStatsDestroy(stats) }
    let group = DispatchGroup()
    let finished = DispatchSemaphore(value: 0)
    group.enter()
    DispatchQueue.global().async {
      for _ in 0..<200_000 { LKRenderStatsRecord(stats, 1.25) }
      finished.signal()
      group.leave()
    }
    var count: UInt64 = 0, overloads: UInt64 = 0
    repeat {
      let sample = LKRenderStatsRead(stats)
      count += sample.count
      overloads += sample.overloads
      if sample.count > 0 { XCTAssertEqual(sample.average, 1.25, accuracy: 0.001) }
      XCTAssertLessThanOrEqual(sample.peak, 1.25)
    } while finished.wait(timeout: .now()) == .timedOut
    group.wait()
    let remaining = LKRenderStatsRead(stats)
    XCTAssertEqual(count + remaining.count, 200_000)
    XCTAssertEqual(overloads + remaining.overloads, 200_000)
  }
}
