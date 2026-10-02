import { File } from 'expo-file-system';

import AudioEngine from '../../modules/audio-engine';
import { captureAudioDiagnostic } from '../../src/engine/diagnostics';
import { usePerformance } from '../../src/engine/performance';

jest.mock('expo-file-system', () => ({
  Paths: { cache: '/cache' },
  File: jest.fn(() => ({ uri: '/cache/livekeys-audio-diagnostic.json', create: jest.fn(), write: jest.fn() })),
}));

const native = AudioEngine as jest.Mocked<typeof AudioEngine>;

beforeEach(() => {
  jest.useFakeTimers();
  native.getInfo.mockReturnValue({
    running: true,
    sampleRate: 48000,
    bufferFrames: 128,
    ioBufferMs: 2.67,
    outputLatencyMs: 3,
    outputRoute: 'Speaker',
  });
});
afterEach(() => jest.useRealTimers());

function emit(name: string, payload: object) {
  const call = native.addListener.mock.calls.find(([event]) => event === name)!;
  (call[1] as (value: object) => void)(payload);
}

test('records peaks while no new notes arrive and shares the existing performance poll without resetting it', async () => {
  const recording = captureAudioDiagnostic();
  emit('onLevel', { peak: 1.4 });
  emit('onMidiEvent', { type: 'cc', channel: 0, data1: 64, data2: 127 });
  usePerformance.setState({
    current: { load: 3, peak: 140, overloads: 1, cpu: 5, memoryMB: 80, availableMemoryMB: 200, layers: [] },
  });
  await jest.advanceTimersByTimeAsync(30000);
  expect(await recording).toBe('/cache/livekeys-audio-diagnostic.json');
  const file = jest.mocked(File).mock.results[0].value;
  const report = JSON.parse(file.write.mock.calls[0][0]);
  expect(report.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'level', peak: 1.4 }),
      expect.objectContaining({ kind: 'midi', type: 'cc', data1: 64 }),
      expect.objectContaining({ kind: 'performance', overloads: 1, peak: 140 }),
    ]),
  );
  expect(report.events.filter((e: { type: string }) => e.type === 'noteOn')).toHaveLength(0);
  for (const result of native.addListener.mock.results) expect(result.value.remove).toHaveBeenCalledTimes(1);
});

test('rejects overlapping captures, bounds event floods and releases listeners after a file error', async () => {
  const recording = captureAudioDiagnostic();
  for (let i = 0; i < 2500; i++) emit('onLevel', { peak: 0.5 });
  const file = jest.mocked(File).mock.results[0].value;
  file.write.mockImplementationOnce(() => {
    throw new Error('Disk full');
  });
  await Promise.all([
    expect(captureAudioDiagnostic()).rejects.toThrow('déjà en cours'),
    expect(recording).rejects.toThrow('Disk full'),
    jest.advanceTimersByTimeAsync(30000),
  ]);
  const next = captureAudioDiagnostic();
  await jest.advanceTimersByTimeAsync(30000);
  await next;
  const report = JSON.parse(file.write.mock.calls[0][0]);
  expect(report.events).toHaveLength(2000);
  expect(report.droppedEvents).toBe(500);
});
