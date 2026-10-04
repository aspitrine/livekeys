import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';

import { LayerStrips } from '../../src/components/LayerStrips';
import { selectCurrentPatch, useConcert } from '../../src/store/concert';
import { resetConcert } from '../fixtures';

beforeEach(() => {
  resetConcert();
  const store = useConcert.getState();
  store.selectPatch(store.concert.sets[0].patches[2].id);
});

function touch(pageX: number, startPageX: number, time: number) {
  const record = {
    touchActive: true,
    startPageX,
    startPageY: 10,
    startTimeStamp: 0,
    currentPageX: pageX,
    currentPageY: 10,
    currentTimeStamp: time,
    previousPageX: startPageX,
    previousPageY: 10,
    previousTimeStamp: time - 16,
  };
  return {
    nativeEvent: { touches: [{}], changedTouches: [{}], pageX, timestamp: time },
    touchHistory: {
      touchBank: [record],
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: time,
    },
  };
}

const names = () => selectCurrentPatch(useConcert.getState())!.layers.map((l) => l.name);
const renderStrips = () => render(<LayerStrips patch={selectCurrentPatch(useConcert.getState())!} />);

test('strips are reordered by dragging their handle horizontally', async () => {
  const user = userEvent.setup();
  const view = await renderStrips();
  const [bass, keys] = selectCurrentPatch(useConcert.getState())!.layers;
  expect(screen.queryByLabelText(`Déplacer le layer ${bass.name}`)).toBeNull();
  await user.press(screen.getByRole('button', { name: 'Réorganiser les layers' }));
  for (const [i, layer] of [bass, keys].entries())
    await fireEvent(screen.getByTestId(`strip-box-${layer.id}`), 'layout', {
      nativeEvent: { layout: { x: i * 144, y: 0, width: 132, height: 600 } },
    });
  const handle = screen.getByLabelText(`Déplacer le layer ${bass.name}`);
  await act(() => handle.props.onResponderGrant(touch(60, 60, 1)));
  await act(() => handle.props.onResponderMove(touch(240, 60, 50)));
  await act(() => handle.props.onResponderRelease(touch(240, 60, 100)));
  expect(names()).toEqual([keys.name, bass.name]);
  await view.rerender(<LayerStrips patch={selectCurrentPatch(useConcert.getState())!} />);
  await fireEvent(screen.getByLabelText(`Déplacer le layer ${bass.name}`), 'accessibilityAction', {
    nativeEvent: { actionName: 'decrement' },
  });
  expect(names()).toEqual([bass.name, keys.name]);
  await user.press(screen.getByRole('button', { name: 'Terminer la réorganisation des layers' }));
  expect(screen.queryByLabelText(`Déplacer le layer ${bass.name}`)).toBeNull();
});

test('a single strip offers nothing to reorder', async () => {
  const store = useConcert.getState();
  store.selectPatch(store.concert.sets[0].patches[0].id);
  await renderStrips();
  expect(screen.queryByRole('button', { name: 'Réorganiser les layers' })).toBeNull();
});
