import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SoundRef } from '../src/model/types';

/** Read the shipped SF2 headers so catalog regressions use actual presets, not invented fixtures. */
export function bundledPresets(bank: string): SoundRef[] {
  const data = readFileSync(join(__dirname, '../modules/audio-engine/ios/SoundFonts', `${bank}.sf2`));
  for (let offset = 12; offset + 12 <= data.length;) {
    const size = data.readUInt32LE(offset + 4);
    if (
      data.toString('ascii', offset, offset + 4) === 'LIST' &&
      data.toString('ascii', offset + 8, offset + 12) === 'pdta'
    ) {
      const end = offset + 8 + size;
      for (let sub = offset + 12; sub + 8 <= end;) {
        const subSize = data.readUInt32LE(sub + 4);
        if (data.toString('ascii', sub, sub + 4) === 'phdr') {
          const sounds: SoundRef[] = [];
          // The last 38-byte record is the EOP sentinel, not a playable preset.
          for (let record = sub + 8; record < sub + 8 + subSize - 38; record += 38) {
            sounds.push({
              bank,
              bankNumber: data.readUInt16LE(record + 22),
              program: data.readUInt16LE(record + 20),
              name: data
                .toString('utf8', record, record + 20)
                .split('\0')[0]
                .trim(),
            });
          }
          return sounds;
        }
        sub += 8 + subSize + (subSize & 1);
      }
    }
    offset += 8 + size + (size & 1);
  }
  throw new Error(`Missing SF2 preset headers in ${bank}`);
}
