import { CATEGORIES, instrumentIcon, placeOf } from '../../src/model/soundCategories';
import { SOUNDS } from '../../src/model/sounds';
import type { SoundRef } from '../../src/model/types';

test.each(
  CATEGORIES.flatMap((category) =>
    category.subcategories.flatMap((sub) =>
      (sub.programs ?? []).map((program) => [category.name, program, category.icon] as const),
    ),
  ),
)('%s program %i uses its instrument category icon', (_category, program, icon) => {
  const sound = { bank: 'GeneralUser-GS', bankNumber: 0, program, name: 'Custom layer name' };
  expect(instrumentIcon({ sound })).toBe(icon);
});

test.each(['SplendidGrand', 'UprightPianoKW', 'jRhodes3d'])(
  'dedicated bank %s uses piano keys even with non-GM programs',
  (bank) => {
    const sound: SoundRef = { bank, bankNumber: 0, program: 42, name: 'Preset' };
    expect(instrumentIcon({ sound })).toBe('pianokeys');
  },
);

test('drum banks use the kit category rather than the melodic GM program', () => {
  const sound = { ...SOUNDS.grand, bankNumber: 128 };
  expect(placeOf(sound)).toEqual({ category: 'drums', subcategory: 'kits' });
  expect(instrumentIcon({ sound })).toBe('circle.circle');
});

test('unknown sounds use a neutral musical icon, and plugins retain their distinct icon', () => {
  expect(instrumentIcon({ sound: { ...SOUNDS.grand, program: 200 } })).toBe('music.note');
  expect(
    instrumentIcon({
      sound: SOUNDS.grand,
      plugin: { componentId: 'aumu:test:test', name: 'Synth', manufacturer: 'Test' },
    }),
  ).toBe('puzzlepiece.extension.fill');
});
