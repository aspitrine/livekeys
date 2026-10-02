import CoreAudioKit
import UIKit

/// Wraps Apple's Bluetooth MIDI central picker in a dismissable sheet.
enum BluetoothMidi {
  static func present() throws {
    #if targetEnvironment(simulator)
    // The simulator has no Bluetooth: Apple's picker crashes while laying out its table.
    throw BluetoothMidiError.unavailable
    #else
    guard let root = topViewController() else { return }
    let picker = CABTMIDICentralViewController()
    picker.preferredContentSize = CGSize(width: 540, height: 600)
    picker.navigationItem.rightBarButtonItem = UIBarButtonItem(
      systemItem: .done,
      primaryAction: UIAction { [weak picker] _ in picker?.dismiss(animated: true) }
    )
    let nav = UINavigationController(rootViewController: picker)
    nav.modalPresentationStyle = .formSheet
    nav.preferredContentSize = picker.preferredContentSize
    root.present(nav, animated: true)
    #endif
  }

  private static func topViewController() -> UIViewController? {
    let scene = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .first { $0.activationState == .foregroundActive }
    var top = scene?.keyWindow?.rootViewController
    while let presented = top?.presentedViewController { top = presented }
    return top
  }
}

enum BluetoothMidiError: Error, CustomStringConvertible {
  case unavailable
  var description: String { "Bluetooth MIDI indisponible sur le simulateur" }
}
