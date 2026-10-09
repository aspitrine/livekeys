import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { parseConcert } from '../model/concertSchema';
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

  let data: unknown;
  try {
    data = JSON.parse(await picked.result.text());
  } catch {
    throw new Error('Ce fichier n’est pas un concert LiveKeys (JSON illisible).');
  }
  return readConcertFile(data);
}

/** Checks an exported concert file (any version) and returns its concert, with fields added since filled in. */
export function readConcertFile(data: unknown): Concert {
  const file = data as { format?: unknown; version?: unknown; concert?: unknown } | null;
  if (file?.format !== FORMAT) throw new Error('Ce fichier n’est pas un concert LiveKeys.');
  if (typeof file.version === 'number' && file.version > VERSION) {
    throw new Error('Ce concert vient d’une version plus récente de LiveKeys : mets l’app à jour.');
  }
  const result = parseConcert(file.concert);
  if ('error' in result) throw new Error(`Concert invalide (${result.error}).`);
  return result.concert;
}
