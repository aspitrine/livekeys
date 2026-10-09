import { AppState } from 'react-native';
import { create } from 'zustand';

import AudioEngine, {
  type BluetoothMidiDevice,
  type EngineInfo,
  type MidiEvent,
  type MidiSource,
} from '../../modules/audio-engine';
import type { Patch } from '../model/types';
import { selectCurrentPatch, selectNeighborPatches, useConcert } from '../store/concert';
import { flushWrites } from '../store/storage';
import { handleControlChange, hostOwnedControls } from './controls';
import { onKeyboardNote, updatePads } from './pads';
import { startPerformanceMonitor } from './performance';
import { patchTempo } from './tempo';
import { applyLiveSettings, syncMasterEffects, syncPatches } from './sync';

type EngineStatus = {
  info: EngineInfo | null;
  error: string | null;
  /** Audio runs but CoreMIDI is not set up yet (retried automatically): keyboards are not heard. */
  midiError: string | null;
  sources: MidiSource[];
  lastEvent: MidiEvent | null;
  /** Live state of the remembered Bluetooth keyboards. */
  bluetooth: BluetoothMidiDevice[];
};

export const useEngineStatus = create<EngineStatus>(() => ({
  info: null,
  error: null,
  midiError: null,
  sources: [],
  lastEvent: null,
  bluetooth: [],
}));

let started = false;

/** Starts audio + MIDI once, then keeps the engine in sync with the concert and settings. */
export async function bootEngine() {
  if (started) return;
  started = true;

  // Registered before the engine starts: edits must be saved, and a failed start retried, even while audio is down.
  AppState.addEventListener('change', (state) => {
    if (state !== 'active') return flushWrites();
    // Back in the app: retry at once what is still down; otherwise pick up keyboards plugged in the background.
    if (wakeAudioRetry) wakeAudioRetry();
    else if (useEngineStatus.getState().midiError) retryMidi(0, 0);
    else if (useEngineStatus.getState().info) AudioEngine.refreshMidi();
  });

  AudioEngine.addListener('onMidiSourcesChanged', ({ sources }) => {
    useEngineStatus.setState({ sources });
    rememberBluetoothKeyboards();
  });
  AudioEngine.addListener('onBluetoothMidiChanged', ({ devices }) => useEngineStatus.setState({ bluetooth: devices }));
  AudioEngine.addListener('onMidiEvent', (event) => {
    useEngineStatus.setState({ lastEvent: event });
    if (event.type === 'programChange') selectPatchByProgram(event.data1);
    if (event.type === 'cc') handleControlChange(event.channel, event.data1, event.data2);
    if (event.type === 'noteOn' || event.type === 'noteOff') onKeyboardNote(event.type, event.data1);
  });

  await startAudio();
  AudioEngine.setMidiMonitorEnabled(true);
  startPerformanceMonitor();

  let last: {
    mappings: ReturnType<typeof useConcert.getState>['concert']['mappings'];
    masterEffects: ReturnType<typeof useConcert.getState>['concert']['masterEffects'];
    active?: Patch;
    preload: Patch[];
    volume: number;
    tempo: number;
    limiter: boolean;
    bluetooth: string;
    sound: string;
  } | null = null;

  const apply = (state: ReturnType<typeof useConcert.getState>) => {
    if (state.concert.mappings !== last?.mappings)
      AudioEngine.setMidiVolumeControls(hostOwnedControls(state.concert.mappings));
    if (state.concert.masterEffects !== last?.masterEffects) syncMasterEffects(state.concert.masterEffects ?? []);
    const active = selectCurrentPatch(state);
    const preload = state.settings.preloadNeighbors ? selectNeighborPatches(state) : [];
    const patchesChanged =
      !last ||
      active !== last.active ||
      preload.length !== last.preload.length ||
      preload.some((p, i) => p !== last!.preload[i]);
    if (patchesChanged) {
      // Loaded layers react at once (Mute, faders, pad Stop / chord), even while banks load…
      applyLiveSettings(active);
      updatePads();
      // …then again once the queued sync has loaded whatever was missing.
      syncPatches(active, preload).then(updatePads);
    }
    const tempo = patchTempo(active);
    if (tempo !== last?.tempo) AudioEngine.setTempo(tempo);
    if (state.masterVolume !== last?.volume) AudioEngine.setMasterVolume(state.masterVolume);
    if (state.settings.limiter !== last?.limiter) AudioEngine.setLimiterEnabled(state.settings.limiter);
    const { glue, speakerProtection, velocityCurve } = state.settings;
    const sound = [glue, speakerProtection, velocityCurve].join('|');
    if (sound !== last?.sound) {
      AudioEngine.setGlueEnabled(glue);
      AudioEngine.setSpeakerProtection(speakerProtection);
      AudioEngine.setVelocityCurve(velocityCurve);
    }
    const { bluetoothAutoReconnect, bluetoothDevices } = state.settings;
    const bluetooth = bluetoothAutoReconnect ? bluetoothDevices.map((d) => d.id).join(',') : '';
    if (bluetooth !== last?.bluetooth) AudioEngine.setBluetoothMidiDevices(bluetooth ? bluetooth.split(',') : []);
    last = {
      mappings: state.concert.mappings,
      masterEffects: state.concert.masterEffects,
      active,
      preload,
      volume: state.masterVolume,
      tempo,
      limiter: state.settings.limiter,
      bluetooth,
      sound,
    };
  };

  // An interruption silenced the pads natively: play the chords the UI still shows as playing.
  AudioEngine.addListener('onEngineRestarted', updatePads);

  apply(useConcert.getState());
  useConcert.subscribe(apply);
}

/** Rescans MIDI inputs now (keyboards plugged while the app was open, concert check). Throws if the engine is down. */
export function rescanMidi() {
  AudioEngine.refreshMidi();
  useEngineStatus.setState({ sources: AudioEngine.getMidiSources() });
}

/**
 * Waits between retries of a failed audio or MIDI start: quick at first (the system audio and MIDI servers come
 * back within a second or two), then every 10 s, for as long as it takes.
 */
export const RETRY_MS = [1000, 2000, 5000, 10_000];
const retryDelay = (attempt: number) => RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)]!;
const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Set while a failed audio start waits for its next try: calling it retries now. */
let wakeAudioRetry: (() => void) | undefined;

/**
 * Starts the audio engine, retrying until it works. The audio session can be unavailable for a while (another app
 * holds it, media services restarting): a single failed try must not leave the app silent until it is killed.
 */
async function startAudio() {
  for (let attempt = 0; ; attempt++) {
    try {
      const { midiError, ...info } = await AudioEngine.start({ sampleRate: 48000, bufferFrames: 128 });
      useEngineStatus.setState({
        info,
        error: null,
        midiError: midiError ?? null,
        sources: AudioEngine.getMidiSources(),
      });
      if (midiError) retryMidi();
      return;
    } catch (e) {
      useEngineStatus.setState({ error: errorMessage(e) });
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, retryDelay(attempt));
        wakeAudioRetry = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      wakeAudioRetry = undefined;
    }
  }
}

let midiRetry: ReturnType<typeof setTimeout> | undefined;

/**
 * CoreMIDI was not ready when the engine started (e.g. its server was shutting down after a previous instance
 * of the app exited). Audio already plays; retry MIDI until it works, so keyboards come back without a restart.
 */
function retryMidi(attempt = 0, delay = retryDelay(attempt)) {
  clearTimeout(midiRetry);
  midiRetry = setTimeout(async () => {
    midiRetry = undefined;
    try {
      await AudioEngine.startMidi();
      useEngineStatus.setState({ midiError: null, sources: AudioEngine.getMidiSources() });
    } catch (e) {
      useEngineStatus.setState({ midiError: errorMessage(e) });
      retryMidi(attempt + 1);
    }
  }, delay);
}

/** System sheet to pair a Bluetooth MIDI keyboard. */
export const showBluetoothMidi = () => AudioEngine.showBluetoothMidi();

/** Any BLE MIDI keyboard connected (e.g. through the system picker) is remembered for auto-reconnect. */
function rememberBluetoothKeyboards() {
  const { settings, setSetting } = useConcert.getState();
  const known = new Set(settings.bluetoothDevices.map((d) => d.id));
  const fresh = AudioEngine.getConnectedBluetoothMidi().filter((d) => !known.has(d.id));
  if (fresh.length) {
    setSetting('bluetoothDevices', [...settings.bluetoothDevices, ...fresh.map(({ id, name }) => ({ id, name }))]);
  }
}

/** MIDI Program Change N → Nth patch of the set holding the current patch. */
function selectPatchByProgram(program: number) {
  const { concert, currentPatchId, selectPatch } = useConcert.getState();
  const set = concert.sets.find((s) => s.patches.some((p) => p.id === currentPatchId)) ?? concert.sets[0];
  const patch = set?.patches[program];
  if (patch) selectPatch(patch.id);
}
