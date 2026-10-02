import AudioEngine from '../../modules/audio-engine';
import type { SoundRef } from '../model/types';

/** Display names for bundled banks. */
export const BANK_LABELS: Record<string, string> = {
  'GeneralUser-GS': 'GeneralUser GS',
  'UprightPianoKW-small': 'Upright Piano KW',
};

let bankPaths: Map<string, string> | null = null;

/** Bundled bank name (e.g. "GeneralUser-GS") → file path inside the app. */
export function bankPath(bank: string): string {
  bankPaths ??= new Map(AudioEngine.getBundledSoundFonts().map((b) => [b.name, b.path]));
  const path = bankPaths.get(bank);
  if (!path) throw new Error(`Sound bank "${bank}" is not bundled`);
  return path;
}

let catalog: Promise<SoundRef[]> | null = null;

/** Every preset of every bundled bank, read once from the SF2 headers. */
export function loadCatalog(): Promise<SoundRef[]> {
  catalog ??= (async () => {
    const banks = AudioEngine.getBundledSoundFonts();
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
