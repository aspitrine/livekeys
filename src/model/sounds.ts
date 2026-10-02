import type { SoundRef } from './types';

const gu = (program: number, name: string, bankNumber = 0): SoundRef => ({
  bank: 'GeneralUser-GS',
  bankNumber,
  program,
  name,
});

/** Handy presets used by the default concert and new layers. Full list comes from the SF2 files. */
export const SOUNDS = {
  upright: { bank: 'UprightPianoKW-small', bankNumber: 0, program: 0, name: 'Upright piano KW' },
  grand: gu(0, 'Grand Piano'),
  tineEP: gu(4, 'Tine Electric Piano'),
  drawbar: gu(16, 'Drawbar Organ'),
  strings: gu(48, 'String Ensemble'),
  warmPad: gu(89, 'Warm Pad'),
  fingerBass: gu(33, 'Finger Bass'),
} satisfies Record<string, SoundRef>;
