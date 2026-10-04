import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { Concert } from '../model/types';

const FORMAT = 'livekeys-concert';
const VERSION = 3;

/** Writes the concert (patches, layers, plugin states, MIDI mappings) to JSON and opens the share sheet. */
export async function exportConcert(concert: Concert) {
  const name = concert.name.replace(/[^\p{L}\p{N}\- ]/gu, '').trim() || 'concert';
  const file = new File(Paths.cache, `${name}.livekeys.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify({ format: FORMAT, version: VERSION, concert }, null, 2));
  await Sharing.shareAsync(file.uri, { UTI: 'public.json', mimeType: 'application/json' });
}

/** Lets the user pick an exported concert file. Returns null if cancelled. Throws on an invalid file. */
export async function pickConcert(): Promise<Concert | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'public.json'] });
  if (picked.canceled) return null;

  const data = JSON.parse(await picked.result.text());
  if (data?.format !== FORMAT || !Array.isArray(data.concert?.sets)) {
    throw new Error('Ce fichier n’est pas un concert LiveKeys.');
  }
  const concert = data.concert as Concert;
  // Files from older versions: fill fields added since.
  return {
    ...concert,
    mappings: concert.mappings ?? [],
    masterEffects: concert.masterEffects ?? [],
    sets: concert.sets.map((s) => ({
      ...s,
      patches: s.patches.map((p) => ({ ...p, layers: p.layers.map((l) => ({ ...l, effects: l.effects ?? [] })) })),
    })),
  };
}
