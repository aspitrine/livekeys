import { render, screen } from '@testing-library/react-native';

import LayerScreen from '../../src/app/layer/[id]';
import { useConcert } from '../../src/store/concert';
import { resetConcert } from '../fixtures';

beforeEach(resetConcert);

test('the layer editor shows a position among mixer layers, and none for the chord pad', async () => {
  const { useLocalSearchParams } = jest.requireMock('expo-router');
  const store = useConcert.getState();
  const patch = store.concert.sets[0].patches[2];
  store.selectPatch(patch.id);
  const padId = store.addPadLayer(patch.id);

  useLocalSearchParams.mockReturnValue({ id: patch.layers[1].id });
  const view = await render(<LayerScreen />);
  expect(screen.getByText('Position 2 / 2')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Déplacer à droite' })).toBeDisabled();
  await view.unmount();

  useLocalSearchParams.mockReturnValue({ id: padId });
  await render(<LayerScreen />);
  expect(screen.queryByText(/Position/)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Déplacer à gauche' })).toBeNull();
});
