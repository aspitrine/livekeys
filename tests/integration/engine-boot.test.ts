import { act } from '@testing-library/react-native';

import AudioEngine, { type MidiEvent } from '../../modules/audio-engine';
import { bootEngine, rescanMidi, useEngineStatus } from '../../src/engine/boot';
import { selectCurrentPatch, useConcert } from '../../src/store/concert';
import { resetConcert } from '../fixtures';

/** Listeners the boot registers, kept here because Jest clears mock calls between tests. */
const listeners = new Map<string, ((event: unknown) => void)[]>();

const emit = (name: string, event: unknown) =>
  act(() => {
    for (const listener of listeners.get(name) ?? []) listener(event);
  });
const midi = (event: Omit<MidiEvent, 'channel'> & { channel?: number }) =>
  emit('onMidiEvent', { channel: 0, ...event });

beforeAll(async () => {
  // The boot starts a 1 s performance monitor: keep it on fake timers so Jest can exit.
  jest.useFakeTimers();
  jest.mocked(AudioEngine.addListener).mockImplementation(((name: string, listener: (event: unknown) => void) => {
    listeners.set(name, [...(listeners.get(name) ?? []), listener]);
    return { remove: jest.fn() };
  }) as never);
  jest.mocked(AudioEngine.start).mockResolvedValue({
    running: true,
    sampleRate: 48000,
    bufferFrames: 128,
    ioBufferMs: 2.7,
    outputLatencyMs: 4,
    outputRoute: 'Speaker',
  });
  await bootEngine();
});

beforeEach(() => {
  resetConcert();
});

test('a normal start reports the engine running and MIDI ready', () => {
  expect(useEngineStatus.getState()).toMatchObject({ error: null, midiError: null, info: { running: true } });
});

test('a Program Change selects the Nth patch of the current set', async () => {
  const patches = useConcert.getState().concert.sets[0]!.patches;
  await midi({ type: 'programChange', data1: 3, data2: 0 });
  expect(useConcert.getState().currentPatchId).toBe(patches[3]!.id);

  // Out of range: stay on the current patch.
  await midi({ type: 'programChange', data1: 99, data2: 0 });
  expect(useConcert.getState().currentPatchId).toBe(patches[3]!.id);
  expect(useEngineStatus.getState().lastEvent).toMatchObject({ type: 'programChange', data1: 99 });
});

test('a learned controller drives its target from the MIDI stream', async () => {
  useConcert.getState().addMapping({ cc: 21, channel: -1, target: { kind: 'nextPatch' } });
  const before = selectCurrentPatch(useConcert.getState())!.id;
  await midi({ type: 'cc', data1: 21, data2: 127 });
  expect(selectCurrentPatch(useConcert.getState())!.id).not.toBe(before);
});

test('keyboards plugged or paired are shown, and new Bluetooth ones are remembered once', async () => {
  useConcert.getState().setSetting('bluetoothDevices', [{ id: 'old', name: 'Old Keys' }]);
  jest.mocked(AudioEngine.getConnectedBluetoothMidi).mockReturnValue([
    { id: 'old', name: 'Old Keys', state: 'connected' },
    { id: 'new', name: 'Roli', state: 'connected' },
  ] as never);
  await emit('onMidiSourcesChanged', { sources: [{ id: '1', name: 'Roli' }] });

  expect(useEngineStatus.getState().sources).toEqual([{ id: '1', name: 'Roli' }]);
  expect(useConcert.getState().settings.bluetoothDevices).toEqual([
    { id: 'old', name: 'Old Keys' },
    { id: 'new', name: 'Roli' },
  ]);

  await emit('onBluetoothMidiChanged', { devices: [{ id: 'new', name: 'Roli', state: 'connecting' }] });
  expect(useEngineStatus.getState().bluetooth).toEqual([{ id: 'new', name: 'Roli', state: 'connecting' }]);
});

test('rescanning MIDI refreshes the list of inputs', () => {
  jest.mocked(AudioEngine.getMidiSources).mockReturnValue([{ id: '2', name: 'Nord' }] as never);
  rescanMidi();
  expect(AudioEngine.refreshMidi).toHaveBeenCalled();
  expect(useEngineStatus.getState().sources).toEqual([{ id: '2', name: 'Nord' }]);
});
