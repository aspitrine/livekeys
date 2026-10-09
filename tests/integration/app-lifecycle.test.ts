import { act } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import AudioEngine from '../../modules/audio-engine';
import { bootEngine, RETRY_MS, useEngineStatus } from '../../src/engine/boot';
import { useConcert } from '../../src/store/concert';
import { resetConcert } from '../fixtures';
import storage from '../mocks/sqlite-storage';

const info = {
  running: true,
  sampleRate: 48000,
  bufferFrames: 128,
  ioBufferMs: 2.7,
  outputLatencyMs: 4,
  outputRoute: 'Speaker',
};

/** Lets timers fire and native calls settle. */
const wait = (ms: number) => act(async () => jest.advanceTimersByTimeAsync(ms));

// One continuous scenario: the engine boots once per test file, and Jest resets fake timers between tests.
test('while audio cannot start, edits are still saved and the start is retried until audio plays', async () => {
  const appState: ((state: AppStateStatus) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appState.push(listener);
    return { remove: jest.fn() };
  });
  const send = (state: AppStateStatus) => appState.forEach((listener) => listener(state));
  const start = jest.mocked(AudioEngine.start);
  start.mockRejectedValue(new Error('Session audio refusée'));
  resetConcert();

  // The boot waits for audio: it is not awaited, as in the app's root layout.
  void bootEngine();
  await wait(0);
  expect(useEngineStatus.getState().error).toBe('Session audio refusée');
  expect(start).toHaveBeenCalledTimes(1);

  // Going to the background saves the last edits at once, audio or not.
  useConcert.getState().renameConcert('Tournée 2026');
  expect(storage.setItemSync).not.toHaveBeenCalled();
  send('background');
  expect(storage.setItemSync).toHaveBeenCalledWith('livekeys-concert', expect.stringContaining('Tournée 2026'));

  // Retried after a short wait, then longer ones.
  await wait(RETRY_MS[0]!);
  expect(start).toHaveBeenCalledTimes(2);
  await wait(RETRY_MS[1]! - 1);
  expect(start).toHaveBeenCalledTimes(2);

  // Coming back to the app retries at once; this time the audio session is free.
  start.mockResolvedValue(info);
  send('active');
  await wait(0);
  expect(start).toHaveBeenCalledTimes(3);
  expect(useEngineStatus.getState()).toMatchObject({ error: null, info });
  // The concert is loaded into the engine as soon as audio runs.
  expect(AudioEngine.loadSoundFont).toHaveBeenCalled();

  // Running: no more tries, and coming back only rescans keyboards.
  await wait(60_000);
  expect(start).toHaveBeenCalledTimes(3);
  send('active');
  expect(AudioEngine.refreshMidi).toHaveBeenCalled();
});
