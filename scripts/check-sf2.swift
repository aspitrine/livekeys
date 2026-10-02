// Usage: swift scripts/check-sf2.swift BANK.sf2 [program] [bank]
// Loads a SoundFont into Apple's AVAudioUnitSampler (the app's engine), plays notes offline and prints
// the level at the attack and while the note is held, to check the bank loads, sounds and sustains.
import AVFoundation

let args = CommandLine.arguments
let url = URL(fileURLWithPath: args[1])
let program = UInt8(args.count > 2 ? Int(args[2])! : 0)
let bank = args.count > 3 ? Int(args[3])! : 0

let engine = AVAudioEngine()
let sampler = AVAudioUnitSampler()
engine.attach(sampler)
engine.connect(sampler, to: engine.mainMixerNode, format: nil)
let format = AVAudioFormat(standardFormatWithSampleRate: 48_000, channels: 2)!
try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 4096)
try engine.start()

let started = Date()
try sampler.loadSoundBankInstrument(
  at: url, program: program,
  bankMSB: UInt8(bank == 128 ? kAUSampler_DefaultPercussionBankMSB : kAUSampler_DefaultMelodicBankMSB),
  bankLSB: UInt8(bank == 128 ? 0 : bank))
print(String(format: "loaded in %.2fs", Date().timeIntervalSince(started)))

func render(seconds: Double) -> (peak: Float, rms: Float) {
  let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 4096)!
  var peak: Float = 0, sum: Float = 0, count = 0
  var remaining = Int(seconds * 48_000)
  while remaining > 0 {
    let frames = AVAudioFrameCount(min(4096, remaining))
    _ = try! engine.renderOffline(frames, to: buffer)
    for ch in 0..<2 {
      let p = buffer.floatChannelData![ch]
      for i in 0..<Int(buffer.frameLength) {
        peak = max(peak, abs(p[i])); sum += p[i] * p[i]; count += 1
      }
    }
    remaining -= Int(frames)
  }
  return (peak, (sum / Float(max(count, 1))).squareRoot())
}

for (note, velocity) in [(36, 100), (60, 40), (60, 110), (84, 90)] as [(UInt8, UInt8)] {
  sampler.startNote(note, withVelocity: velocity, onChannel: 0)
  let attack = render(seconds: 0.5)
  let held = render(seconds: 3.0)
  sampler.stopNote(note, onChannel: 0)
  _ = render(seconds: 2.0)
  print(String(format: "note %3d vel %3d  attack peak %.3f rms %.4f   held(0.5-3.5s) rms %.4f",
               note, velocity, attack.peak, attack.rms, held.rms))
}
