import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { PadEditor } from '../../src/components/PadEditor';
import { usePadChord } from '../../src/engine/pads';
import { makePadLayer } from '../../src/model/defaults';
import type { LayerDef, PadConfig } from '../../src/model/types';

/** Renders the editor as the layer screen does: each change is applied and shown again. */
async function editor(pad: Partial<PadConfig> = {}) {
  const base = makePadLayer(0);
  let layer: LayerDef = { ...base, pad: { ...base.pad!, ...pad } };
  const changes: PadConfig[] = [];
  const view = await render(<PadEditor layer={layer} onChange={onChange} />);
  async function onChange(next: PadConfig) {
    changes.push(next);
    layer = { ...layer, pad: next };
    await view.rerender(<PadEditor layer={layer} onChange={onChange} />);
  }
  return { changes, last: () => changes.at(-1)! };
}

beforeEach(() => usePadChord.setState({ detected: null }));

test('in follow mode, shows the chord detected from the keyboard', async () => {
  await editor({ mode: 'follow' });
  expect(screen.getByText('—')).toBeOnTheScreen();
  await act(() => usePadChord.setState({ detected: { root: 2, quality: 'm7' } }));
  expect(screen.getByText('Dm7')).toBeOnTheScreen();
});

test('a fixed chord is built from a root and a chord type', async () => {
  const { last } = await editor({ mode: 'follow' });
  await fireEvent.press(screen.getByText('Accord fixe'));
  expect(last().mode).toBe('fixed');

  await fireEvent.press(screen.getByText('F  Fa'));
  await fireEvent.press(screen.getByText('Mineur'));
  expect(last().chord).toEqual({ root: 5, quality: 'min' });
  expect(screen.getByText('Fm')).toBeOnTheScreen();
});

test('fade, register and play / stop are saved in the pad', async () => {
  const { last } = await editor({ playing: true });
  await fireEvent.press(screen.getByText('Très lente'));
  expect(last().fade).toBe(8);
  await fireEvent.press(screen.getByText('Grave'));
  expect(last().base).toBe(36);
  await fireEvent.press(screen.getByText('Stop'));
  expect(last().playing).toBe(false);
  expect(screen.getByText('Jouer')).toBeOnTheScreen();
});
