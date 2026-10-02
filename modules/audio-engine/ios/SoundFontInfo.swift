import Foundation

struct SoundFontPreset {
  let name: String
  let program: Int
  /// SF2 bank number: 0 = melodic, 1...127 = GS variations, 128 = drum kits.
  let bank: Int
}

/// Minimal SF2 reader: walks RIFF → LIST "pdta" → "phdr" to list the presets of a bank.
enum SoundFontInfo {
  private static let presetRecordSize = 38

  static func presets(at url: URL) throws -> [SoundFontPreset] {
    let data = try Data(contentsOf: url, options: .alwaysMapped)
    return data.withUnsafeBytes { raw -> [SoundFontPreset] in
      guard raw.count >= 12, fourCC(raw, 0) == "RIFF", fourCC(raw, 8) == "sfbk" else { return [] }

      var offset = 12
      while offset + 12 <= raw.count {
        let size = Int(u32(raw, offset + 4))
        if fourCC(raw, offset) == "LIST", fourCC(raw, offset + 8) == "pdta" {
          var sub = offset + 12
          let end = min(offset + 8 + size, raw.count)
          while sub + 8 <= end {
            let subSize = Int(u32(raw, sub + 4))
            if fourCC(raw, sub) == "phdr" {
              return parsePresetHeaders(raw, from: sub + 8, size: min(subSize, end - sub - 8))
            }
            sub += 8 + subSize + (subSize & 1)
          }
        }
        offset += 8 + size + (size & 1)
      }
      return []
    }
  }

  private static func parsePresetHeaders(_ raw: UnsafeRawBufferPointer, from start: Int, size: Int) -> [SoundFontPreset] {
    // Last record is the terminal "EOP" sentinel.
    let count = size / presetRecordSize - 1
    guard count > 0 else { return [] }
    return (0..<count).map { i in
      let base = start + i * presetRecordSize
      let nameBytes = raw[base..<base + 20].prefix { $0 != 0 }
      let name = String(decoding: nameBytes, as: UTF8.self).trimmingCharacters(in: .whitespaces)
      return SoundFontPreset(name: name, program: Int(u16(raw, base + 20)), bank: Int(u16(raw, base + 22)))
    }
    .sorted { ($0.bank, $0.program) < ($1.bank, $1.program) }
  }

  private static func fourCC(_ raw: UnsafeRawBufferPointer, _ at: Int) -> String {
    String(decoding: raw[at..<at + 4], as: UTF8.self)
  }

  private static func u32(_ raw: UnsafeRawBufferPointer, _ at: Int) -> UInt32 {
    UInt32(littleEndian: raw.loadUnaligned(fromByteOffset: at, as: UInt32.self))
  }

  private static func u16(_ raw: UnsafeRawBufferPointer, _ at: Int) -> UInt16 {
    UInt16(littleEndian: raw.loadUnaligned(fromByteOffset: at, as: UInt16.self))
  }
}
