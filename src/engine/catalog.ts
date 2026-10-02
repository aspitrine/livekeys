import AudioEngine from '../../modules/audio-engine';
import { LIBRARY } from '../model/library';
import type { SoundRef } from '../model/types';
import { bankFile } from './bankFiles';

/** Display names for bundled and downloadable banks. */
export const BANK_LABELS: Record<string, string> = {
  'GeneralUser-GS': 'GeneralUser GS',
  'UprightPianoKW-small': 'Upright Piano KW (léger)',
  ...Object.fromEntries(LIBRARY.map((b) => [b.id, b.name])),
};

let bankPaths: Map<string, string> | null = null;

/** Bank name (e.g. "GeneralUser-GS", "SplendidGrand") → file path: bundled in the app or downloaded. */
export function bankPath(bank: string): string {
  bankPaths ??= new Map(AudioEngine.getBundledSoundFonts().map((b) => [b.name, b.path]));
  const bundled = bankPaths.get(bank);
  if (bundled) return bundled;
  const downloaded = LIBRARY.some((b) => b.id === bank) ? bankFile(bank) : null;
  if (downloaded?.exists) return downloaded.uri;
  throw new Error(`Banque « ${BANK_LABELS[bank] ?? bank} » non installée : télécharge-la dans la bibliothèque de sons`);
}

/** Bundled banks plus downloaded ones, as { name, path }. */
function availableBanks() {
  const downloaded = LIBRARY.filter((b) => bankFile(b.id).exists).map((b) => ({
    name: b.id,
    path: bankFile(b.id).uri,
  }));
  return [...AudioEngine.getBundledSoundFonts(), ...downloaded];
}

let catalog: Promise<SoundRef[]> | null = null;

/** Forget the cached preset list (a bank was downloaded or deleted). */
export function invalidateCatalog() {
  catalog = null;
}

/** Every preset of every available bank, read from the SF2 headers (cached until invalidated). */
export function loadCatalog(): Promise<SoundRef[]> {
  catalog ??= (async () => {
    const banks = availableBanks();
    const lists = await Promise.all(
      banks.map(async (b) =>
        (await AudioEngine.getSoundFontPresets(b.path)).map((p): SoundRef => ({
          bank: b.name,
          bankNumber: p.bank,
          program: p.program,
          name: p.name,
        })),
      ),
    );
    return lists.flat();
  })();
  return catalog;
}

export const soundKey = (s: SoundRef) => `${s.bank}/${s.bankNumber}/${s.program}`;
