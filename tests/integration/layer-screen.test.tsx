import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import AudioEngine, { type MidiEvent } from '../../modules/audio-engine';
import LayerScreen from '../../src/app/layer/[id]';
import { selectCurrentPatch, selectLayer, useConcert } from '../../src/store/concert';
import { resetConcert } from '../fixtures';

let layerId: string;
const layer = () => selectLayer(layerId)(useConcert.getState())!;
const update = (patch: Parameters<ReturnType<typeof useConcert.getState>['updateLayer']>[1]) =>
  act(() => useConcert.getState().updateLayer(layerId, patch));

/** Presses the nth button labelled `label` (the screen repeats steppers). */
const press = (label: string, index = 0) => fireEvent.press(screen.getAllByText(label)[index]!);

/** Plays a note on the hardware keyboard. */
const play = (note: number) =>
  act(() => {
    const event: MidiEvent = { type: 'noteOn', channel: 0, data1: note, data2: 100 };
    for (const [name, listener] of jest.mocked(AudioEngine.addListener).mock.calls)
      if (name === 'onMidiEvent') (listener as (e: MidiEvent) => void)(event);
  });

beforeEach(() => {
  const patch = resetConcert();
  layerId = patch.layers[0]!.id;
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: layerId });
});

test('transposition moves by semitones and octaves, within ±48', async () => {
  await render(<LayerScreen />);
  await press('+12', 2);
  expect(layer().transpose).toBe(12);
  expect(screen.getByText('+12 st')).toBeOnTheScreen();
  for (let i = 0; i < 4; i++) await press('+12', 2);
  expect(layer().transpose).toBe(48);
  await press('−', 2);
  expect(layer().transpose).toBe(47);
});

test('velocity bounds stay ordered: raising the minimum pushes the maximum', async () => {
  await update({ velocityLow: 100, velocityHigh: 105 });
  await render(<LayerScreen />);
  await press('+10', 0);
  expect(layer()).toMatchObject({ velocityLow: 110, velocityHigh: 110 });
  await press('−10', 1);
  expect(layer()).toMatchObject({ velocityLow: 100, velocityHigh: 100 });
});

test('the split low note pushes the high note, and « Tout le clavier » resets the zone', async () => {
  await update({ keyLow: 60, keyHigh: 64 });
  await render(<LayerScreen />);
  await press('+12', 0);
  expect(layer()).toMatchObject({ keyLow: 72, keyHigh: 72 });
  await press('−12', 1);
  expect(layer()).toMatchObject({ keyLow: 60, keyHigh: 60 });

  await fireEvent.press(screen.getByText('Tout le clavier'));
  expect(layer()).toMatchObject({ keyLow: 0, keyHigh: 127 });
});

test('MIDI learn sets the split from the next note played on the piano', async () => {
  await render(<LayerScreen />);
  await press('Apprendre', 1);
  expect(screen.getByText('En attente…')).toBeOnTheScreen();
  expect(screen.getByText(/Joue une note sur ton piano/)).toBeOnTheScreen();

  await play(40);
  expect(layer().keyHigh).toBe(40);
  expect(layer().keyLow).toBeLessThanOrEqual(40);
  // Learning stops after one note: the next note changes nothing.
  await play(90);
  expect(layer().keyHigh).toBe(40);
  expect(screen.queryByText('En attente…')).toBeNull();
});

test('MIDI channel, pan, sustain and name are edited in place', async () => {
  await render(<LayerScreen />);
  await fireEvent.press(screen.getByText('3'));
  expect(layer().midiChannel).toBe(2);
  await fireEvent.press(screen.getByText('Omni'));
  expect(layer().midiChannel).toBe(-1);

  await fireEvent(screen.getByLabelText('Pan'), 'valueChange', -0.504);
  expect(layer().pan).toBe(-0.5);
  expect(screen.getByText('L50')).toBeOnTheScreen();
  await fireEvent(screen.getByLabelText('Pan'), 'valueChange', 0.25);
  expect(screen.getByText('R25')).toBeOnTheScreen();

  await fireEvent(screen.getByLabelText('Pédale de sustain'), 'valueChange', false);
  expect(layer().sustainEnabled).toBe(false);

  await fireEvent.changeText(screen.getByDisplayValue(layer().name), 'Basse');
  expect(layer().name).toBe('Basse');
});

test('a plugin instrument shows its maker and opens its interface', async () => {
  await update({ plugin: { componentId: 'aumu:mdl1:Moog', name: 'Model D', manufacturer: 'Moog' } });
  await render(<LayerScreen />);
  expect(screen.getByText('Plugin · Moog')).toBeOnTheScreen();
  await fireEvent.press(screen.getByText('Interface'));
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/plugin/[layerId]',
    params: { layerId, slot: 'instrument' },
  });
  await fireEvent.press(screen.getByText('Changer'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/sound/[layerId]', params: { layerId } });
});

test('deleting a layer asks first, then closes the editor', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render(<LayerScreen />);
  await fireEvent.press(screen.getByText('Supprimer le layer'));
  expect(layer()).toBeDefined();

  const remove = alert.mock.calls[0]![2]!.find((b) => b.text === 'Supprimer')!;
  await act(async () => remove.onPress!());
  expect(router.back).toHaveBeenCalled();
  expect(selectLayer(layerId)(useConcert.getState())).toBeUndefined();
  alert.mockRestore();
});

test('a layer moves among the mixer strips from its editor', async () => {
  const patch = selectCurrentPatch(useConcert.getState())!;
  useConcert.getState().addLayer(patch.id);
  await render(<LayerScreen />);
  expect(screen.getByText('Position 1 / 2')).toBeOnTheScreen();
  await fireEvent.press(screen.getByLabelText('Déplacer à droite'));
  expect(screen.getByText('Position 2 / 2')).toBeOnTheScreen();
  await fireEvent.press(screen.getByLabelText('Déplacer à gauche'));
  expect(selectCurrentPatch(useConcert.getState())!.layers[0]!.id).toBe(layerId);
});
