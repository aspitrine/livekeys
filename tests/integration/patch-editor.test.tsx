import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { StageNotes } from '../../src/components/StageNotes';
import { PatchEditor } from '../../src/components/PatchEditor';
import { selectCurrentPatch, useConcert } from '../../src/store/concert';
import { resetConcert } from '../fixtures';

beforeEach(resetConcert);
test('patch level can be adjusted and reset from its editor', async () => {
  const patch = selectCurrentPatch(useConcert.getState())!;
  const user = userEvent.setup();
  await render(<PatchEditor patchId={patch.id} />);
  expect(screen.getByRole('button', { name: 'Monter le niveau du patch' })).toBeDisabled();
  await user.press(screen.getByRole('button', { name: 'Baisser le niveau du patch' }));
  expect(screen.getByText('-1 dB')).toBeOnTheScreen();
  expect(selectCurrentPatch(useConcert.getState())!.layers).toEqual(patch.layers);
  await user.press(screen.getByRole('button', { name: 'Réinitialiser' }));
  expect(screen.getByText('0 dB')).toBeOnTheScreen();
});

test('notes entered in the patch editor are saved, copied and displayed on stage', async () => {
  const patch = resetConcert();
  const editor = await render(<PatchEditor patchId={patch.id} />);
  await fireEvent.changeText(screen.getByLabelText('Notes du patch'), 'Entrée après 8 mesures\nRefrain : cordes');
  const notes = selectCurrentPatch(useConcert.getState())!.notes;
  await act(() => useConcert.getState().duplicatePatch(patch.id));
  expect(selectCurrentPatch(useConcert.getState())!.notes).toBe(notes);
  await editor.unmount();
  await render(<StageNotes notes={notes} />);
  expect(screen.getByText('Entrée après 8 mesures\nRefrain : cordes')).toBeOnTheScreen();
});
