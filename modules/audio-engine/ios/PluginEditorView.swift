import CoreAudioKit
import ExpoModulesCore

/// Hosts the custom UI of a loaded Audio Unit (instrument or effect of a layer).
/// Emits `onLoad { hasView }`; when the AU has no UI, JS shows a generic parameter editor instead.
final class PluginEditorView: ExpoView {
  var layerId = ""
  var slot = "instrument"
  let onLoad = EventDispatcher()

  private var loadedKey = ""
  private var controller: UIViewController?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .black
  }

  /// Called after props change; loads the UI once per (layer, slot).
  func reload() {
    let key = "\(layerId)/\(slot)"
    guard !layerId.isEmpty, key != loadedKey else { return }
    loadedKey = key
    detachController()

    guard let unit = try? MixerEngine.shared.unit(layerId: layerId, slot: slot) else {
      onLoad(["hasView": false])
      return
    }
    unit.auAudioUnit.requestViewController { [weak self] vc in
      DispatchQueue.main.async {
        guard let self, key == self.loadedKey else { return }
        guard let vc else {
          self.onLoad(["hasView": false])
          return
        }
        self.attach(vc)
        self.onLoad(["hasView": true])
      }
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    controller?.view.frame = bounds
  }

  override func removeFromSuperview() {
    detachController()
    super.removeFromSuperview()
  }

  private func attach(_ vc: UIViewController) {
    controller = vc
    if let parent = parentViewController {
      parent.addChild(vc)
      addSubview(vc.view)
      vc.didMove(toParent: parent)
    } else {
      addSubview(vc.view)
    }
    vc.view.frame = bounds
    vc.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
  }

  private func detachController() {
    guard let vc = controller else { return }
    vc.willMove(toParent: nil)
    vc.view.removeFromSuperview()
    vc.removeFromParent()
    controller = nil
  }

  private var parentViewController: UIViewController? {
    var responder: UIResponder? = self
    while let r = responder {
      if let vc = r as? UIViewController { return vc }
      responder = r.next
    }
    return nil
  }
}
