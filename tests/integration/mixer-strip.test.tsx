import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ActionSheetIOS } from 'react-native';

import { EffectSlots, InstrumentSlot } from '../../src/components/EffectSlots';
import { LayerStrip } from '../../src/components/LayerStrip';
import { MasterStrip } from '../../src/components/MasterStrip';
import { selectCurrentPatch, selectLayer, useConcert } from '../../src/store/concert';
import { clearEffects, resetConcert } from '../fixtures';

let sheet: jest.SpyInstance;
/** Chooses option `index` in the last action sheet shown. */
const choose = (index: number) => act(() => sheet.mock.calls.at(-1)![1](index));
const lastSheet = () => sheet.mock.calls.at(-1)![0];

let layerId: string;
const layer = () => selectLayer(layerId)(useConcert.getState())!;

beforeEach(() => {
  layerId = resetConcert().layers[0]!.id;
  sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});
});
afterEach(() => sheet.mockRestore());

const delay = { componentId: 'aufx:dely:appl', name: 'AUDelay', manufacturer: 'Apple' };
const reverb = { componentId: 'aufx:rvb2:appl', name: 'AUReverb2', manufacturer: 'Apple' };

describe('layer strip', () => {
  const strip = () => <LayerStrip layer={layer()} fxRows={1} />;

  test('the fader sets the layer volume, and VoiceOver can read and adjust it', async () => {
    const view = await render(strip());
    const fader = screen.getByLabelText(`Volume ${layer().name}`);
    expect(fader).toHaveAccessibilityValue({ now: 80 });

    await fireEvent(fader, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(layer().volume).toBe(0.85);
    await view.rerender(strip());
    expect(screen.getByText('85')).toBeOnTheScreen();

    await act(() => useConcert.getState().updateLayer(layerId, { volume: 0.02 }));
    await view.rerender(strip());
    await fireEvent(screen.getByLabelText(`Volume ${layer().name}`), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    expect(layer().volume).toBe(0);
  });

  test('mute and solo toggle, and the range and transposition are summed up', async () => {
    useConcert.getState().updateLayer(layerId, { keyLow: 48, keyHigh: 72, transpose: -12 });
    const view = await render(strip());
    expect(screen.getByText(/C2–C4/)).toBeOnTheScreen();
    expect(screen.getByText(/-12/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('M'));
    await fireEvent.press(screen.getByText('S'));
    expect(layer()).toMatchObject({ mute: true, solo: true });
    await view.rerender(strip());
    await fireEvent.press(screen.getByText('M'));
    expect(layer().mute).toBe(false);
  });

  test('tap edits the layer; long-press moves it among the strips', async () => {
    const patch = selectCurrentPatch(useConcert.getState())!;
    useConcert.getState().addLayer(patch.id);
    await render(strip());
    await fireEvent.press(screen.getByText('Éditer'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/layer/[id]', params: { id: layerId } });

    // The strip head (name) comes before the instrument slot, which shows the same sound name.
    await fireEvent(screen.getAllByText(layer().name)[0]!, 'longPress');
    expect(lastSheet().options).toEqual(['Éditer', 'Déplacer à gauche', 'Déplacer à droite', 'Annuler']);
    await choose(2);
    expect(selectCurrentPatch(useConcert.getState())!.layers[1]!.id).toBe(layerId);
    await choose(1);
    expect(selectCurrentPatch(useConcert.getState())!.layers[0]!.id).toBe(layerId);
  });
});

describe('effect slots', () => {
  const slots = () => <EffectSlots hostId={layerId} effects={layer().effects} rows={3} />;

  beforeEach(() => {
    clearEffects(layerId);
    useConcert.getState().addEffect(layerId, delay);
    useConcert.getState().addEffect(layerId, reverb);
  });

  test('slots show short Apple names: the « AU » prefix is dropped', async () => {
    await render(slots());
    expect(screen.getByText('Delay')).toBeOnTheScreen();
    expect(screen.queryByText('AUDelay')).toBeNull();
  });

  test('tap opens the effect, the power icon bypasses it', async () => {
    const [first] = layer().effects;
    const view = await render(slots());
    await fireEvent.press(screen.getByText('Delay'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/plugin/[layerId]',
      params: { layerId, slot: first!.id },
    });

    await fireEvent.press(screen.getAllByLabelText('Désactiver l’effet')[0]!);
    expect(layer().effects[0]!.bypass).toBe(true);
    await view.rerender(slots());
    expect(screen.getByLabelText('Activer l’effet')).toBeOnTheScreen();
  });

  test('the long-press menu reorders the chain, without moving past its ends, and removes', async () => {
    await render(slots());
    await fireEvent(screen.getByText('Delay'), 'longPress');
    // First effect: it cannot go earlier.
    expect(lastSheet().disabledButtonIndices).toEqual([2]);
    await choose(3);
    expect(layer().effects.map((e) => e.plugin.name)).toEqual(['AUReverb2', 'AUDelay']);

    await choose(1);
    expect(layer().effects[1]!.bypass).toBe(true);
    await choose(4);
    expect(layer().effects.map((e) => e.plugin.name)).toEqual(['AUReverb2']);
  });

  test('« Régler » in the menu opens the effect too', async () => {
    await render(slots());
    await fireEvent(screen.getByText('Reverb2'), 'longPress');
    expect(lastSheet().disabledButtonIndices).toEqual([3]);
    await choose(0);
    expect(router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/plugin/[layerId]' }));
  });
});

describe('instrument slot', () => {
  test('a SoundFont slot opens the sound browser, by tap or long-press', async () => {
    await render(<InstrumentSlot layer={layer()} />);
    await fireEvent(screen.getByLabelText(`Instrument : ${layer().sound.name}`), 'longPress');
    expect(router.push).toHaveBeenCalledWith({ pathname: '/sound/[layerId]', params: { layerId } });
    expect(sheet).not.toHaveBeenCalled();
  });

  test('a plugin slot opens its interface on tap, and offers to change it on long-press', async () => {
    useConcert
      .getState()
      .updateLayer(layerId, { plugin: { componentId: 'aumu:x:y', name: 'Synth', manufacturer: 'Y' } });
    await render(<InstrumentSlot layer={layer()} />);
    await fireEvent.press(screen.getByLabelText('Instrument : Synth'));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/plugin/[layerId]',
      params: { layerId, slot: 'instrument' },
    });

    await fireEvent(screen.getByLabelText('Instrument : Synth'), 'longPress');
    await choose(1);
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/sound/[layerId]', params: { layerId } });
    await choose(0);
    expect(router.push).toHaveBeenLastCalledWith(expect.objectContaining({ pathname: '/plugin/[layerId]' }));
  });
});

test('the master fader is adjustable with VoiceOver too', async () => {
  await render(<MasterStrip />);
  await fireEvent(screen.getByLabelText('Volume master'), 'accessibilityAction', {
    nativeEvent: { actionName: 'decrement' },
  });
  expect(useConcert.getState().masterVolume).toBe(0.85);
});
