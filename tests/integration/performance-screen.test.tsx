import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import AudioEngine, { type PerformanceInfo } from '../../modules/audio-engine';
import PerformanceScreen from '../../src/app/performance';
import { useEngineStatus } from '../../src/engine/boot';
import { startPerformanceMonitor, usePerformance } from '../../src/engine/performance';
import { selectCurrentPatch, useConcert } from '../../src/store/concert';
import { resetConcert } from '../fixtures';
import { fakeFileSystem } from '../mocks/file-system';

jest.mock('expo-file-system', () => require('../mocks/file-system'));

const sample = (overrides: Partial<PerformanceInfo> = {}): PerformanceInfo => ({
  load: 30,
  peak: 40,
  overloads: 0,
  layers: [],
  cpu: 12,
  memoryMB: 300,
  availableMemoryMB: 0,
  ...overrides,
});

beforeEach(() => {
  resetConcert();
  fakeFileSystem.reset();
  usePerformance.setState({ current: null, history: [], overloads: 0 });
  useEngineStatus.setState({ info: null });
  jest.mocked(useLocalSearchParams).mockReturnValue({});
});

test('the monitor samples the engine every second, keeps one minute and adds up glitches', () => {
  const getPerformance = jest.mocked(AudioEngine.getPerformance);
  getPerformance.mockImplementationOnce(() => {
    throw new Error('engine not started');
  });
  startPerformanceMonitor();
  startPerformanceMonitor(); // a second start must not double the sampling

  jest.advanceTimersByTime(1000);
  expect(usePerformance.getState().current).toBeNull();

  getPerformance.mockReturnValue(sample({ load: 50, overloads: 2 }));
  jest.advanceTimersByTime(61_000);
  const state = usePerformance.getState();
  expect(state.history).toHaveLength(60);
  expect(state.overloads).toBe(122);
  expect(getPerformance).toHaveBeenCalledTimes(62);
});

test('shows load, glitches that can be reset, memory headroom, layers and the audio system', async () => {
  const patch = selectCurrentPatch(useConcert.getState())!;
  const [layer] = patch.layers;
  usePerformance.setState({
    current: sample({
      load: 82,
      peak: 97,
      availableMemoryMB: 2048,
      layers: [{ id: layer!.id, load: 12.34, peak: 20 }],
    }),
    history: [10, 90],
    overloads: 4,
  });
  useEngineStatus.setState({
    info: {
      running: true,
      sampleRate: 48000,
      bufferFrames: 128,
      ioBufferMs: 2.67,
      outputLatencyMs: 4,
      outputRoute: 'Speaker',
    },
  });
  await render(<PerformanceScreen />);

  expect(screen.getByText('82 %')).toBeOnTheScreen();
  expect(screen.getByText('97 %')).toBeOnTheScreen();
  expect(screen.getByText(/Encore 2\.0 Go disponibles/)).toBeOnTheScreen();
  expect(screen.getByText('12.3 %')).toBeOnTheScreen();
  expect(screen.getByText(`Layers du patch « ${patch.name} »`)).toBeOnTheScreen();
  expect(screen.getByText('128 échantillons · 2.7 ms à 48 kHz')).toBeOnTheScreen();
  expect(screen.getByText('Speaker')).toBeOnTheScreen();
  expect(screen.getByText('12 % de l’iPad')).toBeOnTheScreen();

  expect(screen.getByText('4')).toBeOnTheScreen();
  await fireEvent.press(screen.getByText('Remettre à zéro'));
  expect(usePerformance.getState().overloads).toBe(0);
});

test('before the first sample and on the simulator, says what cannot be measured', async () => {
  await render(<PerformanceScreen />);
  expect(screen.getByText('Limite non mesurable ici (simulateur).')).toBeOnTheScreen();
  expect(screen.getAllByText('—').length).toBeGreaterThan(0);
});

test('a 30 s audio diagnostic is captured to a local file', async () => {
  jest.mocked(AudioEngine.getInfo).mockReturnValue({
    running: true,
    sampleRate: 48000,
    bufferFrames: 128,
    ioBufferMs: 2.67,
    outputLatencyMs: 4,
    outputRoute: 'Speaker',
  });
  await render(<PerformanceScreen />);
  await fireEvent.press(screen.getByText('Capturer 30 secondes'));
  expect(screen.getByText('Capture en cours (30 s)')).toBeOnTheScreen();
  expect(screen.getByText('Laisse le son résonner pendant la capture.')).toBeOnTheScreen();

  await act(async () => jest.advanceTimersByTime(30_000));
  expect(screen.getByText('Diagnostic enregistré.')).toBeOnTheScreen();
  expect(fakeFileSystem.contents.get('/cache/livekeys-audio-diagnostic.json')).toContain('"version":1');
});
