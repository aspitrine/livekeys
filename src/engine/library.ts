import { DownloadTask, File } from 'expo-file-system';
import { create } from 'zustand';

import { LIBRARY, type LibraryBank } from '../model/library';
import { banksDir as dir, bankFile } from './bankFiles';
import { invalidateCatalog } from './catalog';

type BankStatus =
  | { state: 'absent' }
  | { state: 'downloading'; progress: number }
  | { state: 'installed' }
  | { state: 'error'; message: string };

/** A bank counts as installed once its file is complete (size matches the catalog). */
const installed = (bank: LibraryBank) => {
  const file = bankFile(bank.id);
  return file.exists && file.size === bank.size;
};

export const useLibrary = create<Record<string, BankStatus>>(() =>
  Object.fromEntries(
    LIBRARY.map((b): [string, BankStatus] => [b.id, installed(b) ? { state: 'installed' } : { state: 'absent' }]),
  ),
);

const setStatus = (id: string, status: BankStatus) => useLibrary.setState({ [id]: status });

const tasks = new Map<string, DownloadTask>();

/** Downloads a bank next to its final name, checks its size, then moves it in place. */
export async function downloadBank(bank: LibraryBank) {
  if (tasks.has(bank.id)) return;
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const partial = new File(dir, `${bank.id}.sf2.part`);
  if (partial.exists) partial.delete();

  let lastPercent = -1;
  setStatus(bank.id, { state: 'downloading', progress: 0 });
  const task = new DownloadTask(bank.url, partial, {
    onProgress: ({ bytesWritten, totalBytes }) => {
      const percent = Math.floor((bytesWritten / (totalBytes > 0 ? totalBytes : bank.size)) * 100);
      if (percent !== lastPercent) {
        lastPercent = percent;
        setStatus(bank.id, { state: 'downloading', progress: percent / 100 });
      }
    },
  });
  tasks.set(bank.id, task);

  try {
    const result = await task.downloadAsync();
    if (!result) throw new Error('Téléchargement interrompu');
    if (partial.size !== bank.size) throw new Error('Fichier incomplet, réessaie');
    const target = bankFile(bank.id);
    if (target.exists) target.delete();
    partial.move(target);
    invalidateCatalog();
    setStatus(bank.id, { state: 'installed' });
  } catch (e) {
    if (partial.exists) partial.delete();
    const cancelled = task.state === 'cancelled';
    setStatus(
      bank.id,
      cancelled ? { state: 'absent' } : { state: 'error', message: String((e as Error)?.message ?? e) },
    );
  } finally {
    tasks.delete(bank.id);
  }
}

export function cancelDownload(id: string) {
  tasks.get(id)?.cancel();
}

export function deleteBank(id: string) {
  const file = bankFile(id);
  if (file.exists) file.delete();
  invalidateCatalog();
  setStatus(id, { state: 'absent' });
}
