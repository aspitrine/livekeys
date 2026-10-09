import { debouncedStorage, flushWrites } from '../../src/store/storage';
import storage from '../mocks/sqlite-storage';

beforeEach(() => {
  storage.clear();
});

test('writes only the latest fader state after the debounce delay', () => {
  debouncedStorage.setItem('fader', 'first');
  jest.advanceTimersByTime(200);
  debouncedStorage.setItem('fader', 'last');
  jest.advanceTimersByTime(399);
  expect(storage.setItem).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(storage.setItem).toHaveBeenCalledTimes(1);
  expect(debouncedStorage.getItem('fader')).toBe('last');
});

test('debounces independent storage keys separately', () => {
  debouncedStorage.setItem('concert', 'show');
  debouncedStorage.setItem('settings', 'preferences');
  jest.advanceTimersByTime(400);
  expect(debouncedStorage.getItem('concert')).toBe('show');
  expect(debouncedStorage.getItem('settings')).toBe('preferences');
  debouncedStorage.removeItem('settings');
  expect(debouncedStorage.getItem('settings')).toBeNull();
});

test('flushes waiting writes at once when the app leaves the foreground', () => {
  debouncedStorage.setItem('concert', 'last edit');
  flushWrites();
  expect(storage.setItemSync).toHaveBeenCalledWith('concert', 'last edit');
  expect(debouncedStorage.getItem('concert')).toBe('last edit');

  // The flushed write must not run a second time when its delay ends.
  jest.advanceTimersByTime(400);
  expect(storage.setItem).not.toHaveBeenCalled();
  flushWrites();
  expect(storage.setItemSync).toHaveBeenCalledTimes(1);
});

test('a removed item is not brought back by a write still waiting', () => {
  debouncedStorage.setItem('settings', 'old');
  debouncedStorage.removeItem('settings');
  jest.advanceTimersByTime(400);
  expect(debouncedStorage.getItem('settings')).toBeNull();
});
