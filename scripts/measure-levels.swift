// Measures the loudness of every preset of the given SoundFonts and prints a JSON gain table
// ("bank/bankNumber/program": dB) that brings each one to the same level, as played by the app.
// Usage: cp scripts/measure-levels.swift /tmp/main.swift && swiftc -O /tmp/main.swift modules/audio-engine/ios/SoundFontInfo.swift -o /tmp/ml
//        /tmp/ml bank1.sf2 bank2.sf2 … > table.json   (values then rounded to 0.1 dB in src/model/soundLevels.json)
import AVFoundation
import Darwin

/// Loudness the app aims for: RMS of a mezzo-forte chord, raw sampler output.
let targetDb: Float = -24
let minGain: Float = -24, maxGain: Float = 6
/// Quieter than this, the test chord probably missed the sound's range: leave it untouched.
let unreliableDb: Float = -40
let format = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 2)!

func loudness(url: URL, program: UInt8, bank: Int) throws -> Float {
  let engine = AVAudioEngine()
  let sampler = AVAudioUnitSampler()
  engine.attach(sampler)
  engine.connect(sampler, to: engine.mainMixerNode, format: format)
  let drums = bank == 128
  try sampler.loadSoundBankInstrument(at: url, program: program,
    bankMSB: UInt8(drums ? kAUSampler_DefaultPercussionBankMSB : kAUSampler_DefaultMelodicBankMSB),
    bankLSB: UInt8(drums ? 0 : bank))
  try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 512)
  try engine.start()
  defer { engine.stop() }
  // Mezzo-forte voicing in the middle of the keyboard (a small kit pattern for drums).
  for note: UInt8 in drums ? [36, 38, 42, 49] : [48, 55, 60, 64] { sampler.startNote(note, withVelocity: 90, onChannel: 0) }
  let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 512)!
  var sum: Double = 0
  var count = 0
  for _ in 0..<Int(1.5 * 48000 / 512) {
    guard try engine.renderOffline(512, to: buffer) == .success else { continue }
    for c in 0..<2 {
      for i in 0..<Int(buffer.frameLength) { let v = Double(buffer.floatChannelData![c][i]); sum += v * v; count += 1 }
    }
  }
  return Float(10 * log10(max(sum / Double(max(count, 1)), 1e-12)))
}

var table: [String: Float] = [:]
for path in CommandLine.arguments.dropFirst() {
  let url = URL(fileURLWithPath: path)
  let bankName = url.deletingPathExtension().lastPathComponent
  for preset in try SoundFontInfo.presets(at: url) {
    let db = try loudness(url: url, program: UInt8(preset.program), bank: preset.bank)
    let gain = db < unreliableDb ? 0 : min(max(targetDb - db, minGain), maxGain)
    table["\(bankName)/\(preset.bank)/\(preset.program)"] = (gain * 10).rounded() / 10
    FileHandle.standardError.write("\(bankName) \(preset.bank)/\(preset.program) \(preset.name): \(db) dB → \(gain) dB\n".data(using: .utf8)!)
  }
}
let data = try JSONSerialization.data(withJSONObject: table, options: [.sortedKeys, .prettyPrinted])
print(String(data: data, encoding: .utf8)!)
