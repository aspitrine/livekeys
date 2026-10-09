import { act, render, screen } from '@testing-library/react-native';
import { Profiler } from 'react';

import AudioEngine from '../../modules/audio-engine';
import { LevelMeter } from '../../src/components/LevelMeter';
import { MasterStrip } from '../../src/components/MasterStrip';
import { resetConcert } from '../fixtures';

type Level = { peak: number; reductionDb: number };

const native = jest.mocked(AudioEngine.addListener);

/** Sends a level to every component listening, as the engine does ~30 times per second. */
const emitLevel = (level: Level) =>
  act(() => {
    for (const [event, listener] of native.mock.calls) {
      if (event === 'onLevel') (listener as (e: Level) => void)(level);
    }
  });

/** Counts the commits of a tree: each one is work on the JS thread and a native view update. */
async function renderCounted(element: React.ReactElement) {
  const commits = { count: 0 };
  await render(
    <Profiler id="meter" onRender={() => commits.count++}>
      {element}
    </Profiler>,
  );
  commits.count = 0;
  return commits;
}

beforeEach(resetConcert);

test('the level meter does not re-render while the level it shows stays the same (silence)', async () => {
  const commits = await renderCounted(<LevelMeter />);

  for (let i = 0; i < 30; i++) await emitLevel({ peak: 0, reductionDb: 0 });
  expect(commits.count).toBe(0);

  // Below a visible step of the bar, nothing either.
  await emitLevel({ peak: 0.4455, reductionDb: 0 });
  const afterChange = commits.count;
  expect(afterChange).toBe(1);
  await emitLevel({ peak: 0.446, reductionDb: 0 });
  expect(commits.count).toBe(afterChange);

  // A new colour is shown even at the same width.
  await emitLevel({ peak: 0.446, reductionDb: 8 });
  expect(commits.count).toBe(afterChange + 1);
});

test('the limiter status re-renders only when its text or colour changes', async () => {
  const commits = await renderCounted(<MasterStrip />);

  for (let i = 0; i < 30; i++) await emitLevel({ peak: 0.5, reductionDb: 0 });
  expect(commits.count).toBe(0);
  expect(screen.getByText('Limiteur actif')).toBeTruthy();

  await emitLevel({ peak: 0.9, reductionDb: 4.1 });
  expect(screen.getByText('Limiteur −4 dB')).toBeTruthy();
  const afterChange = commits.count;
  await emitLevel({ peak: 0.9, reductionDb: 4.2 });
  await emitLevel({ peak: 0.9, reductionDb: 3.9 });
  expect(commits.count).toBe(afterChange);
});
