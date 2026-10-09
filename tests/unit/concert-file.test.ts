import { File } from 'expo-file-system';

import { pickConcert, readConcertFile } from '../../src/lib/concertFile';
import { defaultConcert, makePadLayer } from '../../src/model/defaults';
import type { Concert } from '../../src/model/types';

jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: { pickFileAsync: jest.fn() }, Paths: {} }));

/** The document picker returning a file with this text. */
const picks = (text: string) =>
  jest.mocked(File.pickFileAsync).mockResolvedValue({ canceled: false, result: { text: async () => text } } as never);

const exported = (concert: unknown, version = 3) =>
  JSON.parse(JSON.stringify({ format: 'livekeys-concert', version, concert }));

/** Deep copy of a fresh concert that a test can damage. */
const editable = () => JSON.parse(JSON.stringify(defaultConcert())) as Concert;

test('reads back an exported concert unchanged', () => {
  const concert = defaultConcert();
  concert.sets[0].patches[0].layers.push(makePadLayer(1));
  concert.mappings = [{ id: 'm1', cc: 7, channel: -1, target: { kind: 'layerVolume', index: 0 }, pickup: true }];
  expect(readConcertFile(exported(concert))).toEqual(concert);
});

test('fills the fields older files lack and drops the old reverb send', () => {
  const old = editable() as unknown as {
    mappings?: unknown;
    masterEffects?: unknown;
    sets: { patches: { layers: { effects?: unknown; reverbSend?: number }[] }[] }[];
  };
  delete old.mappings;
  delete old.masterEffects;
  const layer = old.sets[0].patches[0].layers[0];
  delete layer.effects;
  layer.reverbSend = 0.3;

  const concert = readConcertFile(exported(old, 1));
  expect(concert.mappings).toEqual([]);
  expect(concert.masterEffects).toEqual([]);
  expect(concert.sets[0].patches[0].layers[0].effects).toEqual([]);
  expect(concert.sets[0].patches[0].layers[0]).not.toHaveProperty('reverbSend');
});

test('refuses files that are not LiveKeys concerts', () => {
  expect(() => readConcertFile({ format: 'other', concert: defaultConcert() })).toThrow('pas un concert LiveKeys');
  expect(() => readConcertFile(null)).toThrow('pas un concert LiveKeys');
});

test('refuses concerts from a newer app version instead of guessing', () => {
  expect(() => readConcertFile(exported(defaultConcert(), 99))).toThrow('version plus récente');
});

test('names the field of a hand-edited value the engine cannot take', () => {
  const concert = editable();
  concert.sets[0].patches[1].layers[0].keyLow = 200;
  expect(() => readConcertFile(exported(concert))).toThrow('sets.0.patches.1.layers.0.keyLow');
});

test('refuses missing layer lists and unknown MIDI targets', () => {
  const noLayers = editable() as unknown as { sets: { patches: { layers?: unknown }[] }[] };
  delete noLayers.sets[0].patches[0].layers;
  expect(() => readConcertFile(exported(noLayers))).toThrow('layers');

  const badTarget = editable() as unknown as { mappings: unknown[] };
  badTarget.mappings = [{ id: 'm1', cc: 1, channel: 0, target: { kind: 'launchRocket' } }];
  expect(() => readConcertFile(exported(badTarget))).toThrow('mappings.0.target');
});

test('refuses duplicated ids, which would mix up patches and layers', () => {
  const concert = editable();
  const [first, second] = concert.sets[0].patches;
  second.layers[0].id = first.layers[0].id;
  expect(() => readConcertFile(exported(concert))).toThrow('Identifiants en double');
});

test('importing reads the picked file, and cancelling the picker changes nothing', async () => {
  const concert = defaultConcert();
  picks(JSON.stringify(exported(concert)));
  await expect(pickConcert()).resolves.toEqual(concert);

  jest.mocked(File.pickFileAsync).mockResolvedValue({ canceled: true } as never);
  await expect(pickConcert()).resolves.toBeNull();
});

test('a file that is not even JSON gets a readable message, not a parser error', async () => {
  picks('{ "format": "livekeys-concert", ');
  await expect(pickConcert()).rejects.toThrow('JSON illisible');
});
