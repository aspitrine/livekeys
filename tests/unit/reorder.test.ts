import { insertionIndex, placeAt, spanAt } from '../../src/lib/reorder';
import { useConcert } from '../../src/store/concert';
import { resetConcert } from '../fixtures';

const spans = [
  { id: 'a', top: 0, height: 40 },
  { id: 'b', top: 40, height: 40 },
  { id: 'c', top: 100, height: 40 },
];

test('drop geometry ignores the dragged item and clamps outside the list', () => {
  expect(insertionIndex(spans, 90, 'a')).toBe(1);
  expect(insertionIndex(spans, -50, 'c')).toBe(0);
  expect(spanAt(spans, 85)?.id).toBe('b');
  expect(spanAt(spans, 500)?.id).toBe('c');
  expect(spanAt([], 0)).toBeUndefined();
  expect(placeAt(spans, 'a', 9).map((s) => s.id)).toEqual(['b', 'c', 'a']);
  expect(placeAt(spans, 'zz', 0)).toEqual(spans);
});

test('store placement keeps the selection and ignores unknown targets', () => {
  const patch = resetConcert();
  const store = useConcert.getState();
  store.addSet('Encore');
  const before = useConcert.getState().concert;
  store.placePatch(patch.id, 'missing', 0);
  store.placePatch('missing', before.sets[1].id, 0);
  expect(useConcert.getState().concert).toBe(before);
  store.placePatch(patch.id, before.sets[0].id, 2);
  expect(useConcert.getState().concert.sets[0].patches[2].id).toBe(patch.id);
  store.placeSet(before.sets[1].id, 0);
  expect(useConcert.getState().concert.sets[0].name).toBe('Encore');
  expect(useConcert.getState().currentPatchId).toBe(patch.id);
});

test('layers are placed among the mixer strips while pads keep their slot', () => {
  resetConcert();
  const store = useConcert.getState();
  const patch = store.concert.sets[0].patches[2];
  store.selectPatch(patch.id);
  const padId = store.addPadLayer(patch.id);
  const [bass, keys] = patch.layers;
  const ids = () => useConcert.getState().concert.sets[0].patches[2].layers.map((l) => l.id);
  expect(ids()).toEqual([bass.id, keys.id, padId]);
  store.placeLayer(bass.id, 1);
  expect(ids()).toEqual([keys.id, bass.id, padId]);
  const before = useConcert.getState().concert;
  store.placeLayer(padId, 0);
  expect(useConcert.getState().concert.sets[0].patches[2]).toBe(before.sets[0].patches[2]);
});

test('moving a layer left or right skips the chord pad', () => {
  resetConcert();
  const store = useConcert.getState();
  const patch = store.concert.sets[0].patches[2];
  const padId = store.addPadLayer(patch.id);
  const [bass, keys] = patch.layers;
  const ids = () => useConcert.getState().concert.sets[0].patches[2].layers.map((l) => l.id);
  store.moveLayer(keys.id, 1);
  expect(ids()).toEqual([bass.id, keys.id, padId]);
  store.moveLayer(bass.id, 1);
  expect(ids()).toEqual([keys.id, bass.id, padId]);
  store.moveLayer(padId, -1);
  expect(ids()).toEqual([keys.id, bass.id, padId]);
  store.moveLayer('missing', 1);
  expect(ids()).toEqual([keys.id, bass.id, padId]);
});
