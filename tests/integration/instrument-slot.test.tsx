import { render, screen } from '@testing-library/react-native';

import { InstrumentSlot } from '../../src/components/EffectSlots';
import { makeLayer, makePadLayer } from '../../src/model/defaults';
import { SOUNDS } from '../../src/model/sounds';

// Native symbols are represented by their name; the real slot chooses the icon.
jest.mock('expo-symbols', () => ({
  SymbolView: ({ name }: { name: string }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, name);
  },
}));

test('a strings layer shows the strings category icon instead of piano keys', async () => {
  await render(<InstrumentSlot layer={makeLayer(SOUNDS.strings, 0)} />);
  expect(screen.getByText('music.note')).toBeOnTheScreen();
});

test('a chord pad shows the category of its current instrument', async () => {
  const layer = makePadLayer(0);
  const view = await render(<InstrumentSlot layer={layer} />);
  expect(screen.getByText('waveform')).toBeOnTheScreen();
  await view.rerender(<InstrumentSlot layer={{ ...layer, sound: SOUNDS.choirPad }} />);
  expect(screen.getByText('waveform')).toBeOnTheScreen();
  await view.rerender(<InstrumentSlot layer={{ ...layer, sound: SOUNDS.strings }} />);
  expect(screen.getByText('music.note')).toBeOnTheScreen();
});
