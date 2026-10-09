import Storage from 'expo-sqlite/kv-store';
import type { StateStorage } from 'zustand/middleware';

const WRITE_DELAY_MS = 400;
const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; value: string }>();

const cancel = (key: string) => {
  clearTimeout(pending.get(key)?.timer);
  pending.delete(key);
};

/**
 * SQLite-backed storage for zustand persist.
 * Reads are sync (store is hydrated before the first render); writes are debounced
 * so dragging a fader does not hit the disk 60 times per second.
 */
export const debouncedStorage: StateStorage = {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => {
    cancel(key);
    pending.set(key, {
      value,
      timer: setTimeout(() => {
        pending.delete(key);
        Storage.setItem(key, value).catch(console.warn);
      }, WRITE_DELAY_MS),
    });
  },
  removeItem: (key) => {
    // A write still waiting would bring the removed item back.
    cancel(key);
    Storage.removeItemSync(key);
  },
};

/**
 * Writes every debounced change now. Called when the app leaves the foreground: iOS may kill it
 * in the background before the delay ends, losing the last edits.
 */
export function flushWrites() {
  for (const [key, { value }] of pending) {
    cancel(key);
    try {
      Storage.setItemSync(key, value);
    } catch (e) {
      console.warn('[storage] flush', key, e);
    }
  }
}
