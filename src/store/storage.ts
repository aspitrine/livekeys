import Storage from 'expo-sqlite/kv-store';
import type { StateStorage } from 'zustand/middleware';

const WRITE_DELAY_MS = 400;
const pending = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * SQLite-backed storage for zustand persist.
 * Reads are sync (store is hydrated before the first render); writes are debounced
 * so dragging a fader does not hit the disk 60 times per second.
 */
export const debouncedStorage: StateStorage = {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => {
    clearTimeout(pending.get(key));
    pending.set(
      key,
      setTimeout(() => {
        pending.delete(key);
        Storage.setItem(key, value).catch(console.warn);
      }, WRITE_DELAY_MS),
    );
  },
  removeItem: (key) => Storage.removeItemSync(key),
};
