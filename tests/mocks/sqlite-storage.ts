const items = new Map<string, string>();

export default {
  getItemSync: jest.fn((key: string) => items.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    items.set(key, value);
  }),
  removeItemSync: jest.fn((key: string) => {
    items.delete(key);
  }),
  clear: () => items.clear(),
};
