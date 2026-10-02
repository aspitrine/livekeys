import ExpoModulesCore

public class AudioEngineModule: Module {
  private let mixer = MixerEngine.shared
  private let midi = MidiInput()
  private let bleMidi = BleMidiReconnect()
  private var midiMonitor = false

  public func definition() -> ModuleDefinition {
    Name("AudioEngine")

    Events("onMidiEvent", "onMidiSourcesChanged", "onLevel", "onBluetoothMidiChanged")

    OnCreate {
      self.midi.onMessage = { [weak self] message in self?.mixer.handle(message) }
      self.midi.onSourcesChanged = { [weak self] sources in
        self?.sendEvent("onMidiSourcesChanged", ["sources": sources.map(Self.serialize)])
      }
      self.mixer.onMidiEvent = { [weak self] event in
        guard let self, self.midiMonitor else { return }
        self.sendEvent("onMidiEvent", [
          "type": event.type, "channel": Int(event.channel), "data1": event.data1, "data2": event.data2,
        ])
      }
      self.bleMidi.onChange = { [weak self] devices in
        self?.sendEvent("onBluetoothMidiChanged", ["devices": devices])
      }
      self.mixer.onLevel = { [weak self] peak in
        self?.sendEvent("onLevel", ["peak": peak])
      }
    }

    OnDestroy {
      self.mixer.stop()
    }

    // MARK: Engine

    AsyncFunction("start") { (options: EngineOptions) -> [String: Any] in
      let info = try self.mixer.start(options: options)
      try self.midi.start()
      return info
    }

    Function("stop") { self.mixer.stop() }

    Function("getInfo") { self.mixer.info() }

    Function("setMasterVolume") { (volume: Double) in self.mixer.masterVolume = Float(volume) }

    Function("panic") { self.mixer.panic() }

    /// Load figures since the previous call (call it at a steady pace, e.g. once per second).
    Function("getPerformance") { self.mixer.performance() }

    Function("setLimiterEnabled") { (enabled: Bool) in self.mixer.limiterEnabled = enabled }

    /// Presents the system Bluetooth MIDI pairing screen.
    AsyncFunction("showBluetoothMidi") {
      self.bleMidi.prepare()
      try BluetoothMidi.present { [weak self] in self?.midi.refresh() }
    }.runOnQueue(.main)

    /// BLE MIDI keyboards currently connected (to remember them for auto-reconnect).
    Function("getConnectedBluetoothMidi") { self.bleMidi.connectedDevices() }

    /// Peripheral ids to keep connected; [] releases them all.
    Function("setBluetoothMidiDevices") { (ids: [String]) in
      self.bleMidi.setWanted(ids)
    }

    // MARK: Layers

    AsyncFunction("addLayer") { (id: String, config: LayerConfigRecord) in
      self.mixer.addLayer(id: id, config: config)
    }

    Function("setActiveLayers") { (ids: [String]) in
      self.mixer.setActiveLayers(ids)
    }

    /// Chord pads: the layer holds exactly these notes ([] releases them).
    Function("setLayerNotes") { (layerId: String, notes: [Int], velocity: Int, fade: Double) in
      self.mixer.setLayerNotes(layerId: layerId, notes: notes, velocity: velocity, fade: fade)
    }

    Function("updateLayer") { (id: String, config: LayerConfigRecord) in
      self.mixer.updateLayer(id: id, config: config)
    }

    AsyncFunction("removeLayer") { (id: String) in
      self.mixer.removeLayer(id: id)
    }

    AsyncFunction("loadSoundFont") { (layerId: String, path: String, program: Int, bank: Int) in
      try self.mixer.loadSoundFont(layerId: layerId, path: path, program: program, bank: bank)
    }

    AsyncFunction("getSoundFontPresets") { (path: String) -> [[String: Any]] in
      let url = path.hasPrefix("file://") ? URL(string: path)! : URL(fileURLWithPath: path)
      return try SoundFontInfo.presets(at: url).map { ["name": $0.name, "program": $0.program, "bank": $0.bank] }
    }

    /// Sound banks shipped inside the app (SoundFonts.bundle).
    Function("getBundledSoundFonts") { () -> [[String: String]] in
      guard let url = Bundle.main.url(forResource: "SoundFonts", withExtension: "bundle"),
            let bundle = Bundle(url: url) else { return [] }
      let files = (bundle.urls(forResourcesWithExtension: "sf2", subdirectory: nil) ?? [])
        + (bundle.urls(forResourcesWithExtension: "dls", subdirectory: nil) ?? [])
      return files
        .sorted { $0.lastPathComponent < $1.lastPathComponent }
        .map { ["name": $0.deletingPathExtension().lastPathComponent, "path": $0.path] }
    }

    // MARK: Plugins (AUv3 + Apple built-ins)

    /// `kind`: "instrument" or "effect".
    AsyncFunction("listPlugins") { (kind: String) -> [[String: Any]] in
      PluginHost.list(kind: PluginHost.Kind(rawValue: kind) ?? .instrument)
    }

    AsyncFunction("loadPlugin") { (layerId: String, componentId: String, state: String?) async throws in
      try await self.mixer.loadPlugin(layerId: layerId, componentId: componentId, state: state)
    }

    AsyncFunction("addEffect") { (layerId: String, effectId: String, componentId: String, state: String?, bypass: Bool) async throws in
      try await self.mixer.addEffect(layerId: layerId, effectId: effectId, componentId: componentId, state: state, bypass: bypass)
    }

    AsyncFunction("removeEffect") { (layerId: String, effectId: String) in
      try self.mixer.removeEffect(layerId: layerId, effectId: effectId)
    }

    Function("setEffectOrder") { (layerId: String, ids: [String]) in
      try self.mixer.setEffectOrder(layerId: layerId, ids: ids)
    }

    Function("setEffectBypass") { (layerId: String, effectId: String, bypass: Bool) in
      try self.mixer.setEffectBypass(layerId: layerId, effectId: effectId, bypass: bypass)
    }

    /// `slot`: "instrument" or an effect id. Returns base64 state, or null if the AU has none.
    AsyncFunction("getPluginState") { (layerId: String, slot: String) -> String? in
      try PluginHost.state(of: self.mixer.unit(layerId: layerId, slot: slot))
    }

    Function("getPluginParameters") { (layerId: String, slot: String) -> [[String: Any]] in
      PluginHost.parameters(of: try self.mixer.unit(layerId: layerId, slot: slot))
    }

    Function("getPluginPresets") { (layerId: String, slot: String) -> [String: Any] in
      PluginHost.presets(of: try self.mixer.unit(layerId: layerId, slot: slot))
    }

    Function("selectPluginPreset") { (layerId: String, slot: String, number: Int) in
      PluginHost.selectPreset(of: try self.mixer.unit(layerId: layerId, slot: slot), number: number)
    }

    Function("setPluginParameter") { (layerId: String, slot: String, address: Double, value: Double) in
      PluginHost.setParameter(of: try self.mixer.unit(layerId: layerId, slot: slot), address: address, value: value)
    }

    View(PluginEditorView.self) {
      Events("onLoad")
      Prop("layerId") { (view: PluginEditorView, value: String) in view.layerId = value }
      Prop("slot") { (view: PluginEditorView, value: String) in view.slot = value }
      OnViewDidUpdateProps { view in view.reload() }
    }

    // MARK: MIDI

    Function("getMidiSources") { self.midi.sources().map(Self.serialize) }

    /// Re-scans MIDI sources (app back to foreground, Bluetooth picker closed…).
    Function("refreshMidi") { self.midi.refresh() }

    Function("setMidiMonitorEnabled") { (enabled: Bool) in self.midiMonitor = enabled }

    /// On-screen keyboard: goes through the same router as hardware MIDI.
    Function("noteOn") { (note: Int, velocity: Int, channel: Int) in
      self.mixer.noteOn(note: midi7(note), velocity: max(midi7(velocity), 1), channel: UInt8(min(max(channel, 0), 15)))
    }

    Function("noteOff") { (note: Int, channel: Int) in
      self.mixer.noteOff(note: midi7(note), channel: UInt8(min(max(channel, 0), 15)))
    }
  }

  private static func serialize(_ source: MidiSource) -> [String: Any] {
    ["id": Int(source.id), "name": source.name]
  }
}

private func midi7(_ v: Int) -> UInt8 { UInt8(min(max(v, 0), 127)) }
