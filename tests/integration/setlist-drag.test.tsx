import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';

import { SetlistSidebar } from '../../src/components/SetlistSidebar';
import { useConcert } from '../../src/store/concert';
import { resetConcert } from '../fixtures';

beforeEach(resetConcert);

const layout = (y: number, height: number) => ({ nativeEvent: { layout: { x: 0, y, width: 250, height } } });

/** Touch history as the responder system records it, for one finger at `pageY`. */
function touch(pageY: number, startPageY: number, time: number) {
  const record = {
    touchActive: true,
    startPageX: 20,
    startPageY,
    startTimeStamp: 0,
    currentPageX: 20,
    currentPageY: pageY,
    currentTimeStamp: time,
    previousPageX: 20,
    previousPageY: startPageY,
    previousTimeStamp: time - 16,
  };
  return {
    nativeEvent: { touches: [{}], changedTouches: [{}], pageY, timestamp: time },
    touchHistory: {
      touchBank: [record],
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: time,
    },
  };
}

async function drag(handleLabel: string, dy: number) {
  const handle = screen.getByLabelText(handleLabel);
  await act(() => handle.props.onResponderGrant(touch(100, 100, 1)));
  await act(() => handle.props.onResponderMove(touch(100 + dy, 100, 50)));
  expect(screen.getByLabelText(handleLabel)).toBeOnTheScreen();
  await act(() => handle.props.onResponderRelease(touch(100 + dy, 100, 100)));
}

/** Lays out the sidebar like the device: set headers 30 pt, patch rows 40 pt. */
async function layoutSidebar() {
  const { concert } = useConcert.getState();
  let top = 0;
  for (const set of concert.sets) {
    const height = 30 + set.patches.length * 40;
    await fireEvent(screen.getByTestId(`set-box-${set.id}`), 'layout', layout(top, height));
    for (const [i, p] of set.patches.entries())
      await fireEvent(screen.getByTestId(`patch-box-${p.id}`), 'layout', layout(30 + i * 40, 40));
    top += height + 12;
  }
}

test('the reorder button shows drag handles and hides them again', async () => {
  const user = userEvent.setup();
  await render(<SetlistSidebar />);
  expect(screen.queryByLabelText('Déplacer le patch Piano')).toBeNull();
  await user.press(screen.getByRole('button', { name: 'Réorganiser les sets et patches' }));
  expect(screen.getByLabelText('Déplacer le patch Piano')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Terminer la réorganisation' }));
  expect(screen.queryByLabelText('Déplacer le patch Piano')).toBeNull();
});

test('patches are dragged within a set and into another set', async () => {
  const user = userEvent.setup();
  useConcert.getState().addSet('Encore');
  await render(<SetlistSidebar />);
  await user.press(screen.getByRole('button', { name: 'Réorganiser les sets et patches' }));
  await layoutSidebar();
  const names = () => useConcert.getState().concert.sets.map((s) => s.patches.map((p) => p.name));
  // Piano (middle at 50) dropped below Orgue (middle at 170).
  await drag('Déplacer le patch Piano', 130);
  expect(names()[0]).toEqual(['Piano + Pad', 'Basse / EP', 'Orgue', 'Piano', 'Cordes']);
  await layoutSidebar();
  // Cordes (middle at 210) dropped onto the empty « Encore » set (top 242).
  await drag('Déplacer le patch Cordes', 50);
  expect(names()).toEqual([['Piano + Pad', 'Basse / EP', 'Orgue', 'Piano'], ['Cordes']]);
});

test('sets are dragged, and VoiceOver can move items one step at a time', async () => {
  const user = userEvent.setup();
  useConcert.getState().addSet('Encore');
  await render(<SetlistSidebar />);
  await user.press(screen.getByRole('button', { name: 'Réorganiser les sets et patches' }));
  await layoutSidebar();
  await drag('Déplacer le set Encore', -260);
  expect(useConcert.getState().concert.sets.map((s) => s.name)).toEqual(['Encore', 'Set 1']);
  await fireEvent(screen.getByLabelText('Déplacer le set Encore'), 'accessibilityAction', {
    nativeEvent: { actionName: 'increment' },
  });
  expect(useConcert.getState().concert.sets.map((s) => s.name)).toEqual(['Set 1', 'Encore']);
  await fireEvent(screen.getByLabelText('Déplacer le patch Orgue'), 'accessibilityAction', {
    nativeEvent: { actionName: 'decrement' },
  });
  expect(useConcert.getState().concert.sets[0].patches[2].name).toBe('Orgue');
});
