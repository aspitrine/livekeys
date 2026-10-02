// Offline PCM check of the app's Apple sampler -> strip -> mixer -> limiter signal path.
// Usage: swift scripts/check-audio-stability.swift BANK.sf2 [program=89] [bank=0]
//        [layerGain=0.8] [velocity=90] [seconds=20] [copies=1] [output.wav]
// A clean result does not prove an iPad's real-time render deadlines or MIDI transport are healthy.
import AVFoundation

let args = CommandLine.arguments
guard args.count > 1 else {
  print("Usage: swift scripts/check-audio-stability.swift BANK.sf2 [program] [bank] [gain] [velocity] [seconds] [copies] [output.wav]")
  exit(2)
}
let source = URL(fileURLWithPath: args[1])
let program = UInt8(clamping: args.count > 2 ? Int(args[2]) ?? 89 : 89)
let bank = args.count > 3 ? Int(args[3]) ?? 0 : 0
let gain = Float(args.count > 4 ? Float(args[4]) ?? 0.8 : 0.8)
let velocity = UInt8(clamping: args.count > 5 ? Int(args[5]) ?? 90 : 90)
let seconds = max(1, args.count > 6 ? Int(args[6]) ?? 20 : 20)
let copies = max(1, min(16, args.count > 7 ? Int(args[7]) ?? 1 : 1))
let format = AVAudioFormat(standardFormatWithSampleRate: 48_000, channels: 2)!
let engine = AVAudioEngine()
let limiter = AVAudioUnitEffect(audioComponentDescription: AudioComponentDescription(
  componentType: kAudioUnitType_Effect, componentSubType: kAudioUnitSubType_PeakLimiter,
  componentManufacturer: kAudioUnitManufacturer_Apple, componentFlags: 0, componentFlagsMask: 0
))
engine.attach(limiter)
engine.disconnectNodeOutput(engine.mainMixerNode)
engine.connect(engine.mainMixerNode, to: limiter, format: format)
engine.connect(limiter, to: engine.outputNode, format: format)
engine.mainMixerNode.outputVolume = 0.9
var samplers: [AVAudioUnitSampler] = []
for _ in 0..<copies {
  let sampler = AVAudioUnitSampler()
  let strip = AVAudioMixerNode()
  engine.attach(sampler)
  engine.attach(strip)
  engine.connect(sampler, to: strip, format: format)
  engine.connect(strip, to: engine.mainMixerNode, format: format)
  strip.outputVolume = gain
  samplers.append(sampler)
}
try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 128)
try engine.start()
for sampler in samplers {
  try sampler.loadSoundBankInstrument(
    at: source, program: program,
    bankMSB: UInt8(bank == 128 ? kAUSampler_DefaultPercussionBankMSB : kAUSampler_DefaultMelodicBankMSB),
    bankLSB: UInt8(clamping: bank == 128 ? 0 : bank)
  )
  for note: UInt8 in [48, 55, 60, 64] { sampler.startNote(note, withVelocity: velocity, onChannel: 0) }
}
let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 128)!
let output = args.count > 8 ? try AVAudioFile(forWriting: URL(fileURLWithPath: args[8]), settings: format.settings) : nil
var clipped = 0, nonfinite = 0, rendered = 0
var maximum: Float = 0
for second in 0..<seconds {
  var remaining = 48_000
  var windowPeak: Float = 0, sum = 0.0, count = 0
  while remaining > 0 {
    let status = try engine.renderOffline(AVAudioFrameCount(min(128, remaining)), to: buffer)
    guard status == .success, buffer.frameLength > 0 else {
      print("FAIL: offline rendering failed: \(status.rawValue)")
      exit(1)
    }
    if let output { try output.write(from: buffer) }
    for channel in 0..<2 {
      let data = buffer.floatChannelData![channel]
      for frame in 0..<Int(buffer.frameLength) {
        let sample = data[frame]
        if !sample.isFinite { nonfinite += 1; continue }
        let amplitude = abs(sample)
        if amplitude > 1.001 { clipped += 1 }
        windowPeak = max(windowPeak, amplitude)
        sum += Double(sample) * Double(sample)
        count += 1
      }
    }
    remaining -= Int(buffer.frameLength)
    rendered += Int(buffer.frameLength)
  }
  maximum = max(maximum, windowPeak)
  print(String(format: "%02d-%02ds peak %.6f rms %.6f", second, second + 1, windowPeak, sqrt(sum / Double(max(count, 1)))))
}
engine.stop()
print("frames=\(rendered) peak=\(maximum) over-full-scale=\(clipped) nonfinite=\(nonfinite)")
exit(clipped == 0 && nonfinite == 0 ? 0 : 1)
