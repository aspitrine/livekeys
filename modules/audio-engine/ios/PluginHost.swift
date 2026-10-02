import AVFoundation

/// Discovers, instantiates and (de)serializes Audio Units (AUv3 + Apple built-ins).
/// Component ids are "type:subtype:manufacturer" four-char codes, e.g. "aumu:Moog:Moog".
enum PluginHost {
  enum Kind: String {
    case instrument, effect
  }

  static func list(kind: Kind) -> [[String: Any]] {
    let types: [OSType] =
      kind == .instrument
      ? [kAudioUnitType_MusicDevice]
      : [kAudioUnitType_Effect, kAudioUnitType_MusicEffect]

    return types.flatMap { type in
      AVAudioUnitComponentManager.shared().components(matching: description(type: type))
    }
    .sorted { ($0.manufacturerName, $0.name) < ($1.manufacturerName, $1.name) }
    .map { c in
      [
        "id": componentId(c.audioComponentDescription),
        "name": c.name,
        "manufacturer": c.manufacturerName,
        "kind": kind.rawValue,
        "isAUv3": c.audioComponentDescription.componentFlags & AudioComponentFlags.isV3AudioUnit.rawValue != 0,
      ]
    }
  }

  static func instantiate(componentId id: String) async throws -> AVAudioUnit {
    guard let desc = parse(componentId: id) else { throw PluginError.badComponentId(id) }
    // iOS always hosts AUv3 extensions out of process; no option needed.
    return try await AVAudioUnit.instantiate(with: desc, options: [])
  }

  // MARK: State

  /// Plugin state as base64 binary plist (what we persist in the patch).
  static func state(of unit: AVAudioUnit) throws -> String? {
    let au = unit.auAudioUnit
    guard let state = au.fullStateForDocument ?? au.fullState else { return nil }
    let data = try PropertyListSerialization.data(fromPropertyList: state, format: .binary, options: 0)
    return data.base64EncodedString()
  }

  static func restore(_ base64: String, into unit: AVAudioUnit) {
    guard let data = Data(base64Encoded: base64),
          let state = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any]
    else { return }
    unit.auAudioUnit.fullStateForDocument = state
  }

  // MARK: Generic parameters (for AUs without a custom view)

  static func parameters(of unit: AVAudioUnit, limit: Int = 64) -> [[String: Any]] {
    (unit.auAudioUnit.parameterTree?.allParameters ?? [])
      .filter { $0.flags.contains(.flag_IsWritable) }
      .prefix(limit)
      .map { p in
        [
          "address": Double(p.address),
          "name": p.displayName,
          "min": p.minValue,
          "max": p.maxValue,
          "value": p.value,
          "unit": p.unitName ?? "",
        ]
      }
  }

  static func setParameter(of unit: AVAudioUnit, address: Double, value: Double) {
    unit.auAudioUnit.parameterTree?.parameter(withAddress: AUParameterAddress(address))?.value = AUValue(value)
  }

  // MARK: Component ids

  static func componentId(_ d: AudioComponentDescription) -> String {
    [d.componentType, d.componentSubType, d.componentManufacturer].map(fourCC).joined(separator: ":")
  }

  static func parse(componentId id: String) -> AudioComponentDescription? {
    let parts = id.split(separator: ":", omittingEmptySubsequences: false).map(String.init)
    guard parts.count == 3, let t = osType(parts[0]), let s = osType(parts[1]), let m = osType(parts[2]) else { return nil }
    return AudioComponentDescription(componentType: t, componentSubType: s, componentManufacturer: m, componentFlags: 0, componentFlagsMask: 0)
  }

  private static func description(type: OSType) -> AudioComponentDescription {
    AudioComponentDescription(componentType: type, componentSubType: 0, componentManufacturer: 0, componentFlags: 0, componentFlagsMask: 0)
  }

  private static func fourCC(_ code: OSType) -> String {
    let bytes = [24, 16, 8, 0].map { UInt8((code >> $0) & 0xFF) }
    return String(decoding: bytes, as: UTF8.self)
  }

  private static func osType(_ s: String) -> OSType? {
    let bytes = Array(s.utf8)
    guard bytes.count == 4 else { return nil }
    return bytes.reduce(0) { ($0 << 8) | OSType($1) }
  }
}

enum PluginError: Error, CustomStringConvertible {
  case badComponentId(String)
  case unknownSlot(String)
  var description: String {
    switch self {
    case .badComponentId(let id): return "Invalid component id '\(id)'"
    case .unknownSlot(let slot): return "Unknown plugin slot '\(slot)'"
    }
  }
}
