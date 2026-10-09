import { fireEvent, render, screen } from '@testing-library/react-native';

import AudioEngine from '../../modules/audio-engine';
import { SplitKeyboard } from '../../src/components/SplitKeyboard';
import { isBlackKey, PIANO_HIGH, PIANO_LOW } from '../../src/lib/notes';
import { makeLayer } from '../../src/model/defaults';
import { SOUNDS } from '../../src/model/sounds';

const WIDTH = 880;
const HEIGHT = 170;
const WHITES = Array.from({ length: PIANO_HIGH - PIANO_LOW + 1 }, (_, i) => PIANO_LOW + i).filter(
  (n) => !isBlackKey(n),
);
/** Centre of a white key, in pt. */
const whiteX = (note: number) => ((WHITES.indexOf(note) + 0.5) * WIDTH) / WHITES.length;

type Touch = { id: number; x: number; y?: number };
const touch = (phase: 'touchStart' | 'touchMove' | 'touchEnd', touches: Touch[]) =>
  fireEvent(screen.getByTestId('split-keyboard'), phase, {
    nativeEvent: {
      changedTouches: touches.map((t) => ({ identifier: t.id, locationX: t.x, locationY: t.y ?? 160 })),
    },
  });

async function keyboard(props: Partial<Parameters<typeof SplitKeyboard>[0]> = {}) {
  const view = await render(<SplitKeyboard layers={[]} height={HEIGHT} {...props} />);
  await fireEvent(screen.getByTestId('split-keyboard'), 'layout', {
    nativeEvent: { layout: { width: WIDTH, height: HEIGHT } },
  });
  return view;
}

const noteOn = jest.mocked(AudioEngine.noteOn);
const noteOff = jest.mocked(AudioEngine.noteOff);

test('each finger plays its own key, so chords work, and lifting one finger releases only its note', async () => {
  await keyboard();
  await touch('touchStart', [
    { id: 1, x: whiteX(60) },
    { id: 2, x: whiteX(64) },
  ]);
  expect(noteOn.mock.calls.map(([note]) => note)).toEqual([60, 64]);

  await touch('touchEnd', [{ id: 1, x: whiteX(60) }]);
  expect(noteOff).toHaveBeenCalledTimes(1);
  expect(noteOff).toHaveBeenCalledWith(60, 0);
});

test('sliding a finger plays a glissando, without retriggering inside a key', async () => {
  await keyboard();
  await touch('touchStart', [{ id: 1, x: whiteX(60) }]);
  await touch('touchMove', [{ id: 1, x: whiteX(60) + 2 }]);
  expect(noteOn).toHaveBeenCalledTimes(1);

  await touch('touchMove', [{ id: 1, x: whiteX(62) }]);
  expect(noteOff).toHaveBeenCalledWith(60, 0);
  expect(noteOn).toHaveBeenLastCalledWith(62, expect.any(Number), 0);
});

test('a key held by two fingers sounds until both are lifted', async () => {
  await keyboard();
  await touch('touchStart', [{ id: 1, x: whiteX(60) }]);
  await touch('touchStart', [{ id: 2, x: whiteX(60) + 1 }]);
  await touch('touchEnd', [{ id: 1, x: whiteX(60) }]);
  expect(noteOff).not.toHaveBeenCalled();
  await touch('touchEnd', [{ id: 2, x: whiteX(60) }]);
  expect(noteOff).toHaveBeenCalledWith(60, 0);
});

test('playing lower on a key is louder, and the black keys are on the upper part', async () => {
  await keyboard();
  await touch('touchStart', [{ id: 1, x: whiteX(60), y: HEIGHT - 2 }]);
  await touch('touchStart', [{ id: 2, x: whiteX(64), y: HEIGHT * 0.7 }]);
  const [[, loud], [, soft]] = noteOn.mock.calls;
  expect(loud).toBeGreaterThan(soft!);

  // Between C and D, high up, is C♯.
  await touch('touchStart', [{ id: 3, x: (whiteX(60) + whiteX(62)) / 2, y: 10 }]);
  expect(noteOn).toHaveBeenLastCalledWith(61, expect.any(Number), 0);
});

test('touches outside the keys play nothing', async () => {
  await keyboard();
  await touch('touchStart', [{ id: 1, x: whiteX(60), y: HEIGHT + 20 }]);
  await touch('touchStart', [{ id: 2, x: -5 }]);
  expect(noteOn).not.toHaveBeenCalled();
});

test('in note-picking mode, a touch picks the note instead of playing it', async () => {
  const onPickNote = jest.fn();
  await keyboard({ onPickNote });
  await touch('touchStart', [{ id: 1, x: whiteX(48) }]);
  expect(onPickNote).toHaveBeenCalledWith(48);
  expect(noteOn).not.toHaveBeenCalled();
});

describe('split zone handles', () => {
  const layer = { ...makeLayer(SOUNDS.grand, 0), keyLow: 60, keyHigh: 72 };

  async function zone() {
    const onRangeChange = jest.fn();
    const onRangeDrag = jest.fn();
    await keyboard({ layers: [layer], focusLayerId: layer.id, onRangeChange, onRangeDrag });
    const track = screen.getByLabelText('Zone de clavier C3 – C4');
    await fireEvent(track, 'layout', { nativeEvent: { layout: { width: WIDTH, height: 30 } } });
    const at = (x: number) => ({ nativeEvent: { locationX: x } });
    return { track, at, onRangeChange, onRangeDrag };
  }

  test('dragging the low handle moves only the low note, never past the high one', async () => {
    const { track, at, onRangeChange, onRangeDrag } = await zone();
    await fireEvent(track, 'responderGrant', at(whiteX(60) - 8));
    expect(onRangeDrag).toHaveBeenLastCalledWith(true);
    await fireEvent(track, 'responderMove', at(whiteX(48)));
    expect(onRangeChange).toHaveBeenLastCalledWith(48, 72);
    await fireEvent(track, 'responderMove', at(whiteX(84)));
    expect(onRangeChange).toHaveBeenLastCalledWith(72, 72);
    await fireEvent(track, 'responderRelease', at(whiteX(84)));
    expect(onRangeDrag).toHaveBeenLastCalledWith(false);
  });

  test('dragging the high handle moves only the high note', async () => {
    const { track, at, onRangeChange } = await zone();
    await fireEvent(track, 'responderGrant', at(whiteX(72) + 8));
    await fireEvent(track, 'responderMove', at(whiteX(96)));
    expect(onRangeChange).toHaveBeenLastCalledWith(60, 96);
  });

  test('dragging the middle shifts the whole zone, keeping its size, within the piano', async () => {
    const { track, at, onRangeChange } = await zone();
    await fireEvent(track, 'responderGrant', at(whiteX(65)));
    await fireEvent(track, 'responderMove', at(whiteX(77)));
    expect(onRangeChange).toHaveBeenLastCalledWith(72, 84);
    await fireEvent(track, 'responderMove', at(WIDTH));
    const [low, high] = onRangeChange.mock.calls.at(-1)!;
    expect(high).toBe(PIANO_HIGH);
    expect(high - low).toBe(12);
  });
});
