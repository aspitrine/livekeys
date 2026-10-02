import Foundation

/// One pad transition. Caller holds the engine lock while reading the generation and applying the gains.
struct PadTransition {
  let generation: Int
  let outgoingStart: Float
  let incomingStart: Float
  let fadesOut: Bool
  let fadesIn: Bool
  var incomingEnd: Float = 1

  func gains(progress: Double, currentGeneration: Int) -> (outgoing: Float?, incoming: Float?)? {
    guard currentGeneration == generation else { return nil }
    let t = min(max(progress, 0), 1)
    // Both voices use the same preset and may share notes. A constant-amplitude
    // curve bounds correlated signals too; equal-power curves can add 3 dB.
    return (
      fadesOut ? outgoingStart * Float(1 - t) : nil,
      fadesIn ? incomingStart + (incomingEnd - incomingStart) * Float(t) : nil
    )
  }
}
