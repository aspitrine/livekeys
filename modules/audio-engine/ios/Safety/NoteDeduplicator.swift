import Foundation

/// The same keyboard reachable twice (USB + Bluetooth MIDI) doubles every note-on a few ms apart.
/// A note-on for a key that is still held and was struck less than `window` ago cannot be a human
/// repeat (that needs a release in between): it is dropped. Caller serializes with the engine lock.
struct NoteDeduplicator {
  static let window: TimeInterval = 0.03
  private var lastOn: [Int: TimeInterval] = [:]

  /// `key`: channel << 7 | note. `held`: the key is currently sounding. `now`: seconds.
  mutating func accept(key: Int, held: Bool, now: TimeInterval) -> Bool {
    defer { lastOn[key] = now }
    guard held, let previous = lastOn[key] else { return true }
    return now - previous >= Self.window
  }

  mutating func reset() { lastOn.removeAll() }
}
