import { Directory, File, Paths } from 'expo-file-system';

/** Folder holding downloaded sound banks. */
export const banksDir = new Directory(Paths.document, 'SoundBanks');

/** Where a downloaded bank lives on the device. */
export const bankFile = (id: string) => new File(banksDir, `${id}.sf2`);
