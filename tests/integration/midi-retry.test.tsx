import { act, render, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import AudioEngine from '../../modules/audio-engine';
import { ConcertCheck } from '../../src/components/ConcertCheck';
import { TopBar } from '../../src/components/TopBar';
import { bootEngine, RETRY_MS, useEngineStatus } from '../../src/engine/boot';
import { resetConcert } from '../fixtures';

// Regression: on a quick relaunch, CoreMIDI's server may still be shutting down after the previous instance exited.
// `start` used to reject as a whole: audio was running, but the app showed « Moteur audio arrêté » and never loaded
// the patches (silent app). Now audio starts, MIDI is reported apart and retried until it works.

const appState: ((state: AppStateStatus) => void)[] = [];
const startMidi = jest.mocked(AudioEngine.startMidi);

beforeAll(() => {
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appState.push(listener);
    return { remove: jest.fn() };
  });
  resetConcert();
  jest.mocked(AudioEngine.start).mockResolvedValue({
    running: true,
    sampleRate: 48000,
    bufferFrames: 128,
    ioBufferMs: 2.7,
    outputLatencyMs: 4,
    outputRoute: 'Speaker',
    midiError: 'CoreMIDI error -10845',
  });
});

/** Lets the retry timer fire and its native call settle. */
const wait = (ms: number) => act(async () => jest.advanceTimersByTimeAsync(ms));

// One continuous scenario, booting inside the test: Jest resets fake timers between tests, which would drop the retry.
test('audio starts without MIDI, MIDI is retried with growing waits until it recovers', async () => {
  startMidi.mockRejectedValue(new Error('CoreMIDI error -10845'));
  await bootEngine();
  // Let the queued patch loading run (not the MIDI retry, 1 s later).
  await jest.advanceTimersByTimeAsync(0);
  expect(useEngineStatus.getState()).toMatchObject({ error: null, midiError: 'CoreMIDI error -10845' });
  expect(useEngineStatus.getState().info).not.toHaveProperty('midiError');
  // The patches were sent to the engine: the app is not silent.
  expect(AudioEngine.loadSoundFont).toHaveBeenCalled();

  const check = await render(<ConcertCheck />);
  expect(screen.getByText(/Moteur audio actif/)).toBeOnTheScreen();
  expect(screen.getByText(/MIDI indisponible \(CoreMIDI error -10845\)/)).toBeOnTheScreen();
  await check.unmount();

  await render(<TopBar />);
  expect(screen.getByText('MIDI indisponible')).toBeOnTheScreen();

  await wait(RETRY_MS[0]!);
  expect(startMidi).toHaveBeenCalledTimes(1);
  // Still failing: the next try waits longer.
  await wait(RETRY_MS[1]! - 1);
  expect(startMidi).toHaveBeenCalledTimes(1);

  startMidi.mockResolvedValue();
  jest.mocked(AudioEngine.getMidiSources).mockReturnValue([{ id: 1, name: 'Nord Stage' }] as never);
  await wait(1);
  expect(startMidi).toHaveBeenCalledTimes(2);
  expect(useEngineStatus.getState().midiError).toBeNull();
  expect(screen.getByText('Nord Stage')).toBeOnTheScreen();

  // Recovered: no more retries.
  await wait(60_000);
  expect(startMidi).toHaveBeenCalledTimes(2);
});

test('coming back to the app retries MIDI at once if it is still down', async () => {
  startMidi.mockRejectedValue(new Error('CoreMIDI error -10845'));
  await act(() => useEngineStatus.setState({ midiError: 'CoreMIDI error -10845' }));
  for (const listener of appState) listener('active');
  await wait(0);
  expect(startMidi).toHaveBeenCalledTimes(1);
  expect(AudioEngine.refreshMidi).not.toHaveBeenCalled();
});
