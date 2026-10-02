import CoreBluetooth

/// Keeps remembered Bluetooth LE MIDI keyboards connected.
///
/// Once a BLE MIDI peripheral is connected (by us through CoreBluetooth, or by Apple's picker),
/// the system BLE MIDI driver exposes it as a CoreMIDI source, which `MidiInput` picks up automatically.
/// Connection requests never time out: a keyboard switched on later connects as soon as it is in range.
final class BleMidiReconnect: NSObject, CBCentralManagerDelegate {
  static let midiService = CBUUID(string: "03B80E5A-EDE8-4B33-A751-6CE34EC4C700")

  /// Called on the BLE queue with the state of every wanted device.
  var onChange: (([[String: Any]]) -> Void)?

  private let queue = DispatchQueue(label: "livekeys.ble-midi")
  private var central: CBCentralManager?
  private var wanted: Set<UUID> = []
  private var peripherals: [UUID: CBPeripheral] = [:]

  /// Creates the central manager (triggers the Bluetooth permission prompt the first time).
  func prepare() {
    queue.sync { ensureCentral() }
  }

  /// BLE MIDI keyboards currently connected to this device, by any app or the system picker.
  func connectedDevices() -> [[String: Any]] {
    queue.sync {
      guard let central, central.state == .poweredOn else { return [] }
      return central.retrieveConnectedPeripherals(withServices: [Self.midiService]).map(Self.describe)
    }
  }

  /// Devices to keep connected. Devices no longer wanted are released.
  func setWanted(_ ids: [String]) {
    queue.async { [self] in
      let next = Set(ids.compactMap(UUID.init(uuidString:)))
      for id in wanted.subtracting(next) {
        if let p = peripherals.removeValue(forKey: id) { central?.cancelPeripheralConnection(p) }
      }
      wanted = next
      guard !wanted.isEmpty else {
        emit()
        return
      }
      ensureCentral()
      connectWanted()
    }
  }

  // MARK: - Private (on `queue`)

  private func ensureCentral() {
    if central == nil {
      central = CBCentralManager(delegate: self, queue: queue)
    }
  }

  private func connectWanted() {
    guard let central, central.state == .poweredOn else { return }
    for peripheral in central.retrievePeripherals(withIdentifiers: Array(wanted)) {
      peripherals[peripheral.identifier] = peripheral
      if peripheral.state == .disconnected { connect(peripheral) }
    }
    emit()
  }

  private func connect(_ peripheral: CBPeripheral) {
    var options: [String: Any] = [:]
    if #available(iOS 17.0, *) {
      // The system re-establishes the link by itself after a drop.
      options[CBConnectPeripheralOptionEnableAutoReconnect] = true
    }
    central?.connect(peripheral, options: options)
  }

  private func emit() {
    onChange?(peripherals.values.map(Self.describe))
  }

  private static func describe(_ p: CBPeripheral) -> [String: Any] {
    let state: String
    switch p.state {
    case .connected: state = "connected"
    case .connecting: state = "connecting"
    default: state = "disconnected"
    }
    return ["id": p.identifier.uuidString, "name": p.name ?? "Clavier Bluetooth", "state": state]
  }

  // MARK: - CBCentralManagerDelegate

  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    if central.state == .poweredOn { connectWanted() } else { emit() }
  }

  func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
    emit()
  }

  func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
    emit()
    // Retry a bit later (keyboard rebooting, out of range…).
    queue.asyncAfter(deadline: .now() + 3) { [weak self] in
      guard let self, self.wanted.contains(peripheral.identifier) else { return }
      self.connect(peripheral)
    }
  }

  func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
    emit()
    // Pending connect: completes whenever the keyboard comes back in range.
    if wanted.contains(peripheral.identifier) { connect(peripheral) }
  }
}
