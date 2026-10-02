import { registerWebModule, NativeModule } from 'expo';

import type { AudioEngineModuleEvents } from './AudioEngine.types';

// The audio engine is native-only (iOS / iPadOS / macOS "Designed for iPad").
class AudioEngineModule extends NativeModule<AudioEngineModuleEvents> {}

export default registerWebModule(AudioEngineModule, 'AudioEngineModule');
