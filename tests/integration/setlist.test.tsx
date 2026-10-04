import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ActionSheetIOS } from 'react-native';

import { SetlistSidebar } from '../../src/components/SetlistSidebar';
import { selectCurrentPatch, useConcert } from '../../src/store/concert';
import { resetConcert } from '../fixtures';

beforeEach(resetConcert);

test('the patch menu reorders and moves the selected patch through the real store', async () => {
  const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});
  const original = selectCurrentPatch(useConcert.getState())!;
  useConcert.getState().addSet('Encore');
  await render(<SetlistSidebar />);
  await fireEvent(screen.getByText(original.name), 'longPress');
  const [options, choose] = sheet.mock.calls.at(-1)!;
  expect(options.disabledButtonIndices).toContain(2);
  await act(() => choose(3));
  expect(useConcert.getState().concert.sets[0].patches[1].id).toBe(original.id);
  await fireEvent(screen.getByText(original.name), 'longPress');
  await act(() => sheet.mock.calls.at(-1)![1](4));
  expect(sheet.mock.calls.at(-1)![0].options).toEqual(['Encore', 'Annuler']);
  await act(() => sheet.mock.calls.at(-1)![1](0));
  expect(useConcert.getState().concert.sets[1].patches[0]).toEqual(original);
  expect(useConcert.getState().currentPatchId).toBe(original.id);
  sheet.mockRestore();
});

test('set menu disables movement at the edges and can change the set order', async () => {
  const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});
  useConcert.getState().addSet('Encore');
  await render(<SetlistSidebar />);
  await fireEvent(screen.getByText('Encore'), 'longPress');
  expect(sheet.mock.calls.at(-1)![0].disabledButtonIndices).toEqual([2]);
  await act(() => sheet.mock.calls.at(-1)![1](1));
  expect(useConcert.getState().concert.sets[0].name).toBe('Encore');
  sheet.mockRestore();
});
