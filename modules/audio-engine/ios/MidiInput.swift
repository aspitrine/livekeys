import CoreMIDI
import Foundation

enum MidiMessage {
  case noteOn(channel: UInt8, note: UInt8, velocity: UInt8)
  case noteOff(channel: UInt8, note: UInt8)
  case controlChange(channel: UInt8, controller: UInt8, value: UInt8)
  case programChange(channel: UInt8, program: UInt8)
  case pitchBend(channel: UInt8, value: UInt16)
  case channelPressure(channel: UInt8, value: UInt8)
}

struct MidiSource {
  let id: Int32
  let name: String
}

/// Listens to every connected MIDI source (USB, network, Bluetooth once paired) and
/// reconnects automatically when devices are plugged / unplugged.
/// `onMessage` is called on the CoreMIDI thread — never touch JS or UIKit from it.
final class MidiInput {
  var onMessage: ((MidiMessage) -> Void)?
  var onSourcesChanged: (([MidiSource]) -> Void)?
  /// A source went away (cable pulled, Bluetooth dropped): its pending note-offs will never arrive.
  var onSourceRemoved: (() -> Void)?

  private var client = MIDIClientRef()
  private var inputPort = MIDIPortRef()
  private var connected = Set<MIDIEndpointRef>()

  func start() throws {
    // CoreMIDI delivers setup notifications on the run loop of the thread that created the client.
    // Created on a background queue (no run loop), devices plugged / paired later are never seen.
    guard Thread.isMainThread else {
      try DispatchQueue.main.sync { try start() }
      return
    }
    guard client == 0 else { return }

    var status = MIDIClientCreateWithBlock("LiveKeys" as CFString, &client) { [weak self] notification in
      if notification.pointee.messageID == .msgSetupChanged {
        DispatchQueue.main.async { self?.connectAllSources() }
      }
    }
    guard status == noErr else { throw MidiError.osStatus(status) }

    status = MIDIInputPortCreateWithProtocol(client, "Input" as CFString, ._1_0, &inputPort) { [weak self] list, _ in
      self?.parse(list)
    }
    guard status == noErr else { throw MidiError.osStatus(status) }

    connectAllSources()
  }

  func sources() -> [MidiSource] {
    (0..<MIDIGetNumberOfSources()).map { i in
      let endpoint = MIDIGetSource(i)
      return MidiSource(id: uniqueID(endpoint), name: displayName(endpoint))
    }
  }

  /// Reconnects every current source (safety net when a notification was missed).
  func refresh() {
    DispatchQueue.main.async { [weak self] in
      guard let self, self.client != 0 else { return }
      self.connectAllSources()
    }
  }

  /// Connects new sources and forgets removed ones. Sources still present stay connected: dropping and
  /// re-adding them (e.g. when a Bluetooth keyboard reconnects) could lose a note-off in between.
  private func connectAllSources() {
    let current = Set((0..<MIDIGetNumberOfSources()).map { MIDIGetSource($0) })
    let removed = connected.subtracting(current)
    for endpoint in removed { MIDIPortDisconnectSource(inputPort, endpoint) }
    connected.subtract(removed)
    for endpoint in current.subtracting(connected) where MIDIPortConnectSource(inputPort, endpoint, nil) == noErr {
      connected.insert(endpoint)
    }
    if !removed.isEmpty { onSourceRemoved?() }
    onSourcesChanged?(sources())
  }

  // MARK: - UMP parsing (MIDI 1.0 protocol → message type 0x2 channel voice)

  /// Word count per UMP message type (0x0...0xF).
  private static let umpSizes = [1, 1, 1, 2, 2, 4, 1, 1, 2, 2, 2, 3, 3, 4, 4, 4]

  private func parse(_ list: UnsafePointer<MIDIEventList>) {
    let wordsOffset = MemoryLayout<MIDIEventPacket>.offset(of: \MIDIEventPacket.words)!
    for packet in list.unsafeSequence() {
      let count = Int(packet.pointee.wordCount)
      let words = (UnsafeRawPointer(packet) + wordsOffset).assumingMemoryBound(to: UInt32.self)
      var i = 0
      while i < count {
        let word = words[i]
        let type = Int(word >> 28)
        if type == 0x2, let message = Self.decodeMidi1(word) {
          onMessage?(message)
        }
        i += Self.umpSizes[type]
      }
    }
  }

  private static func decodeMidi1(_ word: UInt32) -> MidiMessage? {
    let status = UInt8((word >> 20) & 0xF)
    let channel = UInt8((word >> 16) & 0xF)
    let d1 = UInt8((word >> 8) & 0x7F)
    let d2 = UInt8(word & 0x7F)
    switch status {
    case 0x9: return d2 == 0 ? .noteOff(channel: channel, note: d1) : .noteOn(channel: channel, note: d1, velocity: d2)
    case 0x8: return .noteOff(channel: channel, note: d1)
    case 0xB: return .controlChange(channel: channel, controller: d1, value: d2)
    case 0xC: return .programChange(channel: channel, program: d1)
    case 0xD: return .channelPressure(channel: channel, value: d1)
    case 0xE: return .pitchBend(channel: channel, value: UInt16(d1) | (UInt16(d2) << 7))
    default: return nil
    }
  }

  private func displayName(_ endpoint: MIDIEndpointRef) -> String {
    var name: Unmanaged<CFString>?
    MIDIObjectGetStringProperty(endpoint, kMIDIPropertyDisplayName, &name)
    return (name?.takeRetainedValue() as String?) ?? "Unknown"
  }

  private func uniqueID(_ endpoint: MIDIEndpointRef) -> Int32 {
    var id: Int32 = 0
    MIDIObjectGetIntegerProperty(endpoint, kMIDIPropertyUniqueID, &id)
    return id
  }
}

enum MidiError: Error, CustomStringConvertible {
  case osStatus(OSStatus)
  var description: String {
    switch self {
    case .osStatus(let s): return "CoreMIDI error \(s)"
    }
  }
}
