import { checkConcert, type CheckEnvironment } from '../../src/lib/concertCheck';
import { defaultConcert } from '../../src/model/defaults';
import type { Concert } from '../../src/model/types';
import { APPLE_EFFECTS } from '../fixtures';

const plugin = (componentId: string, name: string) => ({ componentId, name, manufacturer: 'Acme' });
const env = (overrides: Partial<CheckEnvironment> = {}): CheckEnvironment => ({
  installedPlugins: new Set(['aumu:Syn1:Acme', 'aufx:Dly1:Acme', ...APPLE_EFFECTS.map((p) => p.id)]),
  isBankInstalled: (bank) => bank !== 'SplendidGrand',
  layerErrors: {},
  ...overrides,
});

function concertWithResources(): Concert {
  const concert = defaultConcert();
  const [piano, padPatch, split] = concert.sets[0].patches;
  piano.layers[0].plugin = plugin('aumu:Gone:Acme', 'Lost Synth');
  piano.layers[0].effects = [{ id: 'fx', bypass: false, plugin: plugin('aufx:Rev9:Acme', 'Old Reverb') }];
  padPatch.layers[0].sound = { ...padPatch.layers[0].sound, bank: 'SplendidGrand' };
  split.layers.forEach((l) => (l.mute = true));
  concert.sets.push({ id: 'empty', name: 'Rappels', patches: [] });
  return concert;
}

test('a default concert with installed banks has no issue', () => {
  expect(checkConcert(defaultConcert(), env())).toEqual([]);
});

test('missing Audio Units and banks are errors attached to their patch', () => {
  const concert = concertWithResources();
  const [piano, padPatch, split] = concert.sets[0].patches;
  const issues = checkConcert(concert, env());
  expect(issues).toEqual([
    { level: 'error', patchId: piano.id, message: expect.stringContaining('instrument « Lost Synth » (Acme)') },
    { level: 'error', patchId: piano.id, message: expect.stringContaining('effet « Old Reverb »') },
    { level: 'error', patchId: padPatch.id, message: expect.stringContaining('« SplendidGrand » absente') },
    { level: 'warning', patchId: split.id, message: 'Set 1 › Basse / EP : tous les layers sont coupés.' },
    { level: 'warning', message: 'Le set « Rappels » est vide.' },
  ]);
});

test('an unavailable plugin scan does not report every Audio Unit as missing', () => {
  const issues = checkConcert(concertWithResources(), env({ installedPlugins: null }));
  expect(issues.some((i) => i.message.includes('non installé'))).toBe(false);
});

test('load errors are shown unless a missing resource already explains them', () => {
  const concert = concertWithResources();
  const [piano, padPatch, , organ] = concert.sets[0].patches;
  const issues = checkConcert(
    concert,
    env({
      layerErrors: {
        [piano.layers[0].id]: 'plugin crash',
        [padPatch.layers[0].id]: 'bank missing',
        [organ.layers[0].id]: 'Délai dépassé',
      },
    }),
  );
  expect(issues.filter((i) => i.message.includes('n’a pas pu être chargé'))).toEqual([
    { level: 'error', patchId: organ.id, message: expect.stringContaining('(Délai dépassé)') },
  ]);
});

test('empty concerts, layerless patches and shared MIDI controls are reported', () => {
  const concert = defaultConcert();
  expect(checkConcert({ ...concert, sets: [] }, env())).toEqual([{ level: 'error', message: 'Le concert est vide.' }]);
  concert.sets[0].patches[0].layers = [];
  concert.mappings = [
    { id: 'a', cc: 7, channel: -1, target: { kind: 'masterVolume' } },
    { id: 'b', cc: 7, channel: 2, target: { kind: 'layerVolume', index: 0 } },
    { id: 'c', cc: 7, channel: 3, target: { kind: 'layerMute', index: 0 } },
    { id: 'd', cc: 20, channel: 1, target: { kind: 'nextPatch' } },
    { id: 'e', cc: 20, channel: 2, target: { kind: 'prevPatch' } },
  ];
  expect(checkConcert(concert, env())).toEqual([
    {
      level: 'warning',
      patchId: concert.sets[0].patches[0].id,
      message: 'Set 1 › Piano : aucun layer, le patch est muet.',
    },
    { level: 'warning', message: expect.stringContaining('CC 7 affecté à plusieurs actions') },
  ]);
});
