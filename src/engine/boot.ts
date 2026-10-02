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
import { handleControlChange } from './controls';
import { onKeyboardNote, updatePads } from './pads';
import { startPerformanceMonitor } from './performance';
import { applyLiveSettings, syncPatches } from './sync';

type EngineStatus = {
  info: EngineInfo | null;
  error: string | null;
  sources: MidiSource[];
  lastEvent: MidiEvent | null;
  /** Live state of the remembered Bluetooth keyboards. */
  bluetooth: BluetoothMidiDevice[];
};

export const useEngineStatus = create<EngineStatus>(() => ({
  info: null,
  error: null,
  sources: [],
  lastEvent: null,
  bluetooth: [],
}));

let started = false;

/** Starts audio + MIDI once, then keeps the engine in sync with the concert and settings. */
export async function bootEngine() {
  if (started) return;
  started = true;

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

  try {
    const info = await AudioEngine.start({ sampleRate: 48000, bufferFrames: 128 });
    useEngineStatus.setState({ info, sources: AudioEngine.getMidiSources() });
    AudioEngine.setMidiMonitorEnabled(true);
    startPerformanceMonitor();
  } catch (e) {
    useEngineStatus.setState({ error: String(e) });
    return;
  }

  let last: {
    active?: Patch;
    preload: Patch[];
    volume: number;
    limiter: boolean;
    bluetooth: string;
  } | null = null;

  const apply = (state: ReturnType<typeof useConcert.getState>) => {
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
    if (state.masterVolume !== last?.volume) AudioEngine.setMasterVolume(state.masterVolume);
    if (state.settings.limiter !== last?.limiter) AudioEngine.setLimiterEnabled(state.settings.limiter);
    const { bluetoothAutoReconnect, bluetoothDevices } = state.settings;
    const bluetooth = bluetoothAutoReconnect ? bluetoothDevices.map((d) => d.id).join(',') : '';
    if (bluetooth !== last?.bluetooth) AudioEngine.setBluetoothMidiDevices(bluetooth ? bluetooth.split(',') : []);
    last = { active, preload, volume: state.masterVolume, limiter: state.settings.limiter, bluetooth };
  };

  // An interruption silenced the pads natively: play the chords the UI still shows as playing.
  AudioEngine.addListener('onEngineRestarted', updatePads);

  // Keyboards plugged or paired while the app was in the background.
  AppState.addEventListener('change', (state) => state === 'active' && AudioEngine.refreshMidi());

  apply(useConcert.getState());
  useConcert.subscribe(apply);
}

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
