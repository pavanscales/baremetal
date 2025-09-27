// src/lib/kv.ts
const store = new Map<string, any>();

export const kv = {
  lpush: async (key: string, value: any) => {
    const list = store.get(key) ?? [];
    store.set(key, [value, ...list]);
  },

  incr: async (key: string) => {
    const value = store.get(key) ?? 0;
    const next = value + 1;
    store.set(key, next);
    return next;
  },

  mget: async (...keys: string[]) => {
    return keys.map((key) => store.get(key) ?? null);
  },
};
