Pod::Spec.new do |s|
  s.name           = 'AudioEngine'
  s.version        = '1.0.0'
  s.summary        = 'Live keyboard audio engine: MIDI routing, layers, instruments'
  s.description    = 'AVAudioEngine + CoreMIDI engine for the live keyboard host app'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation', 'CoreMIDI', 'AudioToolbox', 'CoreBluetooth', 'CoreAudioKit'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
  # Bundled sound banks, copied into the app as SoundFonts.bundle
  s.resource_bundles = { 'SoundFonts' => ['SoundFonts/*.{sf2,dls,txt}'] }
end
