import {
  BANK_PLACES,
  CATEGORIES,
  instrumentIcon,
  placeKey,
  placeLabel,
  placeOf,
} from '../../src/model/soundCategories';
import fs from 'node:fs';
import path from 'node:path';

import { BANK_LABELS } from '../../src/engine/catalog';
import { LIBRARY } from '../../src/model/library';
import { bundledPresets } from '../soundFontPresets';

const generalUser = bundledPresets('GeneralUser-GS');

test.each([
  [120, 0, 'Standard 1 Kit', 'drums', 'kits'],
  [120, 16, 'Power Kit', 'drums', 'kits'],
  [13, 48, 'Woodwind Choir', 'winds', 'reeds'],
  [0, 47, 'Timpani', 'drums', 'percussion'],
  [0, 55, 'Orchestra Hit', 'synths', 'fx'],
  [0, 31, 'Guitar Harmonics', 'guitars', 'electric'],
  [8, 31, 'Guitar Feedback', 'guitars', 'distorted'],
  [8, 48, 'Orchestra Pad', 'synths', 'pads'],
  [11, 0, 'Piano & Str.-Fade', 'pianos', 'hybrid'],
  [11, 1, 'Piano & Str.-Sus', 'pianos', 'hybrid'],
  [12, 0, 'Bell Piano', 'pianos', 'hybrid'],
  [1, 98, 'Synth Mallet', 'mallets', 'mallets'],
  [11, 96, 'Mystery Pad', 'synths', 'pads'],
  [11, 98, 'Synth Chime', 'mallets', 'bells'],
  [11, 100, 'Bright Saw Stack', 'synths', 'leads'],
  [0, 3, 'Honky-Tonk Piano', 'pianos', 'honky-tonk'],
  [0, 7, 'Clavinet', 'pianos', 'clavinet'],
  [0, 15, 'Dulcimer', 'mallets', 'other'],
  [0, 108, 'Kalimba', 'mallets', 'other'],
  [0, 112, 'Tinker Bell', 'mallets', 'bells'],
  [0, 114, 'Steel Drums', 'mallets', 'other'],
  [0, 62, 'Synth Brass 1', 'winds', 'synth'],
  [8, 63, 'Synth Brass 4', 'winds', 'synth'],
] as const)('%s/%s %s is in %s/%s', (bankNumber, program, name, category, subcategory) => {
  const sound = generalUser.find((preset) => preset.bankNumber === bankNumber && preset.program === program)!;
  expect(sound?.name).toBe(name);
  expect(placeOf(sound)).toEqual({ category, subcategory });
  expect(placeOf({ ...sound, name: 'Renamed instrument' })).toEqual({ category, subcategory });
  expect(instrumentIcon({ sound })).toBe(CATEGORIES.find((item) => item.id === category)!.icon);
});

test('every shipped preset has a visible category and subcategory', () => {
  const places = new Set(
    CATEGORIES.flatMap((category) => category.subcategories.map((sub) => `${category.id}/${sub.id}`)),
  );
  const catalog = [...generalUser, ...bundledPresets('UprightPianoKW-small')];
  expect(catalog.length).toBeGreaterThan(250);
  for (const sound of catalog) {
    const place = placeOf(sound);
    expect(place).not.toBeNull();
    expect(places.has(placeKey(place!))).toBe(true);
    expect(placeLabel(place!)).toContain(' › ');
  }
  for (const place of Object.values(BANK_PLACES)) expect(places.has(placeKey(place))).toBe(true);
});

test('every GM program has exactly one fallback category', () => {
  const programs = CATEGORIES.flatMap((category) => category.subcategories.flatMap((sub) => sub.programs ?? []));
  expect(programs.toSorted((a, b) => a - b)).toEqual(Array.from({ length: 128 }, (_, index) => index));
});

test('both GeneralUser drum bank formats go to kits, including SFX and orchestral kits', () => {
  const kits = generalUser.filter((sound) => [120, 128].includes(sound.bankNumber));
  expect(kits).toHaveLength(26);
  for (const sound of kits) expect(placeOf(sound)).toEqual({ category: 'drums', subcategory: 'kits' });
});

test('GS overrides do not change another bank or ordinary GM presets in the same slot', () => {
  const strings = generalUser.find((sound) => sound.bankNumber === 0 && sound.program === 48)!;
  expect(placeOf(strings)).toEqual({ category: 'strings', subcategory: 'ensemble' });
  expect(placeOf({ ...strings, bank: 'OtherBank', bankNumber: 13 })).toEqual({
    category: 'strings',
    subcategory: 'ensemble',
  });
  expect(placeOf({ ...strings, bank: 'OtherBank', bankNumber: 120 })).toEqual({
    category: 'strings',
    subcategory: 'ensemble',
  });
});

test('category labels describe the reclassified instruments', () => {
  expect(placeLabel({ category: 'drums', subcategory: 'percussion' })).toBe(
    'Batteries & percussions › Timbales & percussions',
  );
  expect(placeLabel({ category: 'strings', subcategory: 'pizz' })).toBe('Cordes › Pizzicato & harpe');
  expect(placeLabel({ category: 'missing', subcategory: 'missing' })).toBe('');
});

test('every bank, bundled or downloadable, has its place and its name in the sound browser', () => {
  const bundled = fs
    .readdirSync(path.join(__dirname, '../../modules/audio-engine/ios/SoundFonts'))
    .filter((f) => f.endsWith('.sf2') && f !== 'GeneralUser-GS.sf2')
    .map((f) => f.replace('.sf2', ''));
  for (const bank of [...bundled, ...LIBRARY.map((b) => b.id)]) {
    expect({ bank, place: BANK_PLACES[bank] }).toEqual({
      bank,
      place: expect.objectContaining({ category: 'pianos' }),
    });
    expect(BANK_LABELS[bank]).toBeTruthy();
  }
});
