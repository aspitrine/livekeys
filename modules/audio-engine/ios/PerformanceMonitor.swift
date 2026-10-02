import AVFoundation
import Darwin

/// Times the render of one Audio Unit (and everything it pulls upstream) against the buffer duration.
final class RenderMeter {
  private let stats: OpaquePointer
  private var unit: AudioUnit?

  init() {
    var timebase = mach_timebase_info_data_t()
    mach_timebase_info(&timebase)
    stats = LKRenderStatsCreate(Double(timebase.numer) / Double(timebase.denom) / 1e9, 48_000)
  }

  deinit {
    detach()
    LKRenderStatsDestroy(stats)
  }

  func attach(_ unit: AudioUnit, sampleRate: Double) {
    detach()
    LKRenderStatsSetSampleRate(stats, sampleRate)
    if AudioUnitAddRenderNotify(unit, renderNotify, UnsafeMutableRawPointer(stats)) == noErr {
      self.unit = unit
    }
  }

  func detach() {
    guard let unit else { return }
    AudioUnitRemoveRenderNotify(unit, renderNotify, UnsafeMutableRawPointer(stats))
    self.unit = nil
  }

  /// Average and peak load since the previous read (1.0 = 100 % of the buffer), and overloads.
  func read() -> (average: Double, peak: Double, overloads: Int) {
    let s = LKRenderStatsRead(stats)
    return (s.average, s.peak, Int(s.overloads))
  }
}

/// Runs on the audio thread: no allocation or mutex; counters cross threads through lock-free atomics.
private let renderNotify: AURenderCallback = { refCon, flags, _, bus, frames, _ in
  guard bus == 0 else { return noErr }
  let s = OpaquePointer(refCon)
  if flags.pointee.contains(.unitRenderAction_PreRender) {
    LKRenderStatsPreRender(s, mach_absolute_time())
  } else if flags.pointee.contains(.unitRenderAction_PostRender) {
    LKRenderStatsPostRender(s, mach_absolute_time(), frames)
  }
  return noErr
}

/// Process-wide figures: CPU of all app threads and memory.
enum SystemStats {
  /// CPU used by the app, in % of the whole device (all cores).
  static func cpuPercent() -> Double {
    var threads: thread_act_array_t?
    var count: mach_msg_type_number_t = 0
    guard task_threads(mach_task_self_, &threads, &count) == KERN_SUCCESS, let threads else { return 0 }
    defer {
      vm_deallocate(mach_task_self_, vm_address_t(bitPattern: threads), vm_size_t(Int(count) * MemoryLayout<thread_t>.stride))
    }
    var total = 0.0
    for i in 0..<Int(count) {
      var info = thread_basic_info()
      var infoCount = mach_msg_type_number_t(THREAD_INFO_MAX)
      let kr = withUnsafeMutablePointer(to: &info) {
        $0.withMemoryRebound(to: integer_t.self, capacity: Int(infoCount)) {
          thread_info(threads[i], thread_flavor_t(THREAD_BASIC_INFO), $0, &infoCount)
        }
      }
      if kr == KERN_SUCCESS, info.flags & TH_FLAGS_IDLE == 0 {
        total += Double(info.cpu_usage) / Double(TH_USAGE_SCALE)
      }
      mach_port_deallocate(mach_task_self_, threads[i])
    }
    return total * 100 / Double(max(ProcessInfo.processInfo.activeProcessorCount, 1))
  }

  /// Memory used by the app (what iOS counts against its limit), in MB.
  static func memoryMB() -> Double {
    var info = task_vm_info_data_t()
    var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<integer_t>.size)
    let kr = withUnsafeMutablePointer(to: &info) {
      $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
        task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
      }
    }
    return kr == KERN_SUCCESS ? Double(info.phys_footprint) / 1_048_576 : 0
  }

  /// Memory the app can still use before iOS terminates it, in MB.
  static func availableMemoryMB() -> Double {
    Double(os_proc_available_memory()) / 1_048_576
  }
}
