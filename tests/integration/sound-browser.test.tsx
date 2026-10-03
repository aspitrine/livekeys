import { fireEvent, render, screen } from '@testing-library/react-native';

import AudioEngine from '../../modules/audio-engine';
import { SoundBrowser } from '../../src/components/SoundBrowser';
import { invalidateCatalog } from '../../src/engine/catalog';
import { bundledPresets } from '../soundFontPresets';

// Only native file access is substituted; the catalog, grouping and library store stay real.
jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    exists = false;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');
    }
  }
  class File extends Directory {
    size = 0;
  }
  return { Directory, File, Paths: { document: '/test/documents' }, DownloadTask: jest.fn() };
});

const generalUser = bundledPresets('GeneralUser-GS');
const upright = bundledPresets('UprightPianoKW-small')[0];

beforeEach(() => {
  invalidateCatalog();
  jest.mocked(AudioEngine.getSoundFontPresets).mockImplementation(async (path: string) => {
    const sounds = path.includes('GeneralUser-GS') ? generalUser : [upright];
    return sounds.map((sound) => ({ bank: sound.bankNumber, program: sound.program, name: sound.name }));
  });
});

test('the browser keeps drum kit compatibility presets out of pianos and selects them from kits', async () => {
  const onChoose = jest.fn();
  await render(<SoundBrowser selected={null} query="" onChoose={onChoose} />);
  expect(await screen.findByText('Grand Piano')).toBeOnTheScreen();
  expect(screen.queryByText('Standard 1 Kit')).not.toBeOnTheScreen();
  await fireEvent.press(screen.getByText('Batteries & percussions'));
  const kit = await screen.findByText('Standard 1 Kit');
  await fireEvent.press(kit);
  expect(onChoose).toHaveBeenCalledWith(generalUser.find((sound) => sound.bankNumber === 120 && sound.program === 0));
  expect(screen.queryByText('Grand Piano')).not.toBeOnTheScreen();
});

test('an existing Woodwind Choir selection opens its corrected family and search uses the same label', async () => {
  const selected = generalUser.find((sound) => sound.bankNumber === 13 && sound.program === 48)!;
  const view = await render(<SoundBrowser selected={selected} query="" onChoose={jest.fn()} />);
  expect(await screen.findByText('Woodwind Choir')).toBeOnTheScreen();
  expect(screen.getByText('Saxophones & bois')).toBeOnTheScreen();
  expect(screen.queryByText('Fast Strings')).not.toBeOnTheScreen();
  await view.rerender(<SoundBrowser selected={selected} query="Woodwind" onChoose={jest.fn()} />);
  expect(screen.getByText('Cuivres & vents › Saxophones & bois')).toBeOnTheScreen();
});

test('reference upright pianos remain available in their dedicated subcategory', async () => {
  await render(<SoundBrowser selected={upright} query="" onChoose={jest.fn()} />);
  expect(await screen.findByText('Upright piano KW')).toBeOnTheScreen();
  expect(screen.getByText('Piano droit')).toBeOnTheScreen();
  expect(screen.queryByText('Honky-Tonk Piano')).not.toBeOnTheScreen();
  expect(screen.getByText('Upright Piano KW')).toBeOnTheScreen();
});
