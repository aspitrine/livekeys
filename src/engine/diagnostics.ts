import { File, Paths } from 'expo-file-system';

import AudioEngine, { type EngineInfo } from '../../modules/audio-engine';
import { selectCurrentPatch, useConcert } from '../store/concert';
import { usePerformance } from './performance';

const DURATION_MS = 30_000;
const MAX_EVENTS = 2000;
let recording = false;

function context() {
  const state = useConcert.getState();
  const patch = selectCurrentPatch(state);
  return {
    masterVolume: state.masterVolume,
    limiter: state.settings.limiter,
    preloadNeighbors: state.settings.preloadNeighbors,
    patchId: patch?.id,
    layers: patch?.layers.map(({ id, sound, plugin, volume, pan, mute, solo, pad, effects }) => ({
      id,
      sound,
      plugin: plugin?.componentId,
      volume,
      pan,
      mute,
      solo,
      pad,
      effects: effects.map((effect) => ({ componentId: effect.plugin.componentId, bypass: effect.bypass })),
    })),
  };
}

/** On-demand, bounded trace. No extra DSP polling, graph changes, MIDI sends or disk writes during capture.
 * Level is measured BEFORE the native limiter. Event times are JS delivery times, not audio sample timestamps.
 */
export async function captureAudioDiagnostic(): Promise<string> {
  if (recording) throw new Error('Une capture est déjà en cours.');
  recording = true;
  const cleanup: (() => void)[] = [];
  try {
    const file = new File(Paths.cache, 'livekeys-audio-diagnostic.json');
    const startedAt = Date.now();
    const initialInfo = AudioEngine.getInfo();
    const initialContext = context();
    const events: ({ ms: number; kind: string } & Record<string, unknown>)[] = [];
    let droppedEvents = 0;
    const record = (event: { kind: string } & Record<string, unknown>) => {
      if (events.length < MAX_EVENTS) events.push({ ...event, ms: Date.now() - startedAt });
      else droppedEvents += 1;
    };
    const level = AudioEngine.addListener('onLevel', (event) => record({ kind: 'level', ...event }));
    cleanup.push(() => level.remove());
    const midi = AudioEngine.addListener('onMidiEvent', (event) => record({ kind: 'midi', ...event }));
    cleanup.push(() => midi.remove());
    cleanup.push(
      usePerformance.subscribe((state, previous) => {
        if (state.current && state.current !== previous.current) record({ kind: 'performance', ...state.current });
      }),
    );
    cleanup.push(
      useConcert.subscribe((state, previous) => {
        if (
          state.concert !== previous.concert ||
          state.currentPatchId !== previous.currentPatchId ||
          state.masterVolume !== previous.masterVolume ||
          state.settings !== previous.settings
        ) {
          record({ kind: 'settings', ...context() });
        }
      }),
    );
    await new Promise<void>((resolve) => setTimeout(resolve, DURATION_MS));
    cleanup.splice(0).forEach((remove) => remove());
    let finalInfo: EngineInfo | undefined;
    let finalInfoError: string | undefined;
    try {
      finalInfo = AudioEngine.getInfo();
    } catch (error) {
      finalInfoError = String(error);
    }
    file.create({ overwrite: true });
    file.write(
      JSON.stringify({
        version: 1,
        startedAt,
        elapsedMs: Date.now() - startedAt,
        requestedMs: DURATION_MS,
        levelPosition: 'before-limiter',
        timestampSource: 'js-delivery',
        initialInfo,
        finalInfo,
        finalInfoError,
        initialContext,
        droppedEvents,
        events,
      }),
    );
    return file.uri;
  } finally {
    cleanup.forEach((remove) => remove());
    recording = false;
  }
}
