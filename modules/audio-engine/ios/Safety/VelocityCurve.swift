import Foundation

/// Maps the keyboard's velocity to the one sent to the sounds, to suit the player's touch.
enum VelocityCurve: String {
  /// Light touch: soft playing already sounds full.
  case light
  case normal
  /// Heavy touch: needs more strength to reach forte.
  case heavy

  private var exponent: Double {
    switch self {
    case .light: 0.6
    case .normal: 1
    case .heavy: 1.6
    }
  }

  func apply(_ velocity: UInt8) -> UInt8 {
    guard velocity > 0, self != .normal else { return velocity }
    let shaped = 127 * pow(Double(velocity) / 127, exponent)
    return UInt8(min(max(shaped.rounded(), 1), 127))
  }
}
