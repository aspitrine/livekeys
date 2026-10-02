import catalog from './library.json';

/** A downloadable sound bank, hosted on github.com/aspitrine/livekeys-sounds (release v1). */
export type LibraryBank = {
  /** Also the bank name used in SoundRef.bank once installed. */
  id: string;
  name: string;
  category: string;
  description: string;
  author: string;
  license: string;
  source: string;
  file: string;
  url: string;
  /** Bytes, used to check the download. */
  size: number;
  sha256: string;
};

export const LIBRARY: LibraryBank[] = catalog.banks;

export const libraryBank = (id: string) => LIBRARY.find((b) => b.id === id);

export const formatSize = (bytes: number) =>
  bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} Go` : `${Math.round(bytes / 1e6)} Mo`;
