// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "LiveKeysAudioSafety",
  platforms: [.macOS(.v13)],
  targets: [
    .target(name: "RenderStatsCore", path: "modules/audio-engine/ios/RenderStatsCore"),
    .target(name: "AudioSafety", path: "modules/audio-engine/ios/Safety"),
    .testTarget(name: "AudioSafetyTests", dependencies: ["AudioSafety", "RenderStatsCore"], path: "tests/native"),
  ],
  cxxLanguageStandard: .cxx17
)
