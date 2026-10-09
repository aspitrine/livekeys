import { useEffect, useEffectEvent } from 'react';

import AudioEngine, { type AudioEngineModuleEvents } from '../../modules/audio-engine';

type EngineEvent = keyof AudioEngineModuleEvents;

/**
 * Subscribes a component to a native engine event for as long as it is mounted (and `enabled`).
 * The latest `listener` is always called, but the native subscription is made once: listeners that read
 * state or props do not resubscribe on every render. No per-render work either (`useEffectEvent`): meters
 * re-render ~30 times per second.
 */
export function useEngineEvent<E extends EngineEvent>(event: E, listener: AudioEngineModuleEvents[E], enabled = true) {
  const onEvent = useEffectEvent((...args: Parameters<AudioEngineModuleEvents[E]>) =>
    (listener as (...a: typeof args) => void)(...args),
  );

  useEffect(() => {
    if (!enabled) return;
    const sub = AudioEngine.addListener(event, ((...args: Parameters<AudioEngineModuleEvents[E]>) =>
      onEvent(...args)) as AudioEngineModuleEvents[E]);
    return () => sub.remove();
  }, [event, enabled]);
}
