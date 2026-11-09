export const PREFIX = 'chordifree:v1';
export const LEGACY_PREFIX = 'freechords:v1';
export const SCHEMA_VERSION = 1;

export const KEYS = {
  preferences: `${PREFIX}:preferences`,
  library: `${PREFIX}:library`,
  setlists: `${PREFIX}:setlists`,
  history: `${PREFIX}:history`,
  song: (id: string) => `${PREFIX}:song:${id}`,
  practice: (id: string) => `${PREFIX}:practice:${id}`,
  analysis: (key: string) => `${PREFIX}:analysis:${key}`,
  corrupt: (timestamp: number) => `${PREFIX}:corrupt:${timestamp}`,
};

export interface StorageLike {
  readonly length: number;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
}

import { t } from '../i18n';

export class StorageQuotaError extends Error {
  constructor(message = t('storage.quota')) {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

/** In-memory store for browsers with `localStorage` blocked. */
export function createMemoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
    key: (index) => Array.from(data.keys())[index] ?? null,
  };
}

/**
 * Moves keys from the previous brand to the current ones without overwriting
 * new data. Runs once at startup so the library and settings are not lost.
 */
export function migrateLegacyKeys(storage: StorageLike): void {
  const legacy: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(`${LEGACY_PREFIX}:`)) legacy.push(key);
  }

  for (const key of legacy) {
    const suffix = key.slice(LEGACY_PREFIX.length + 1);
    const nextKey = `${PREFIX}:${suffix}`;
    const value = storage.getItem(key);
    if (value !== null && storage.getItem(nextKey) === null) {
      storage.setItem(nextKey, value);
    }
    storage.removeItem(key);
  }
}

/**
 * Returns `localStorage` if it is available and writable; otherwise,
 * an in-memory store so the application remains usable.
 */
export function getStorage(): StorageLike {
  try {
    const storage = window.localStorage;
    const probe = `${PREFIX}:probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    try {
      migrateLegacyKeys(storage);
    } catch {
      // Migration must not prevent the application from being used.
    }
    return storage;
  } catch {
    return createMemoryStorage();
  }
}

export function isQuotaError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { name?: string; code?: number; message?: string };
  return (
    candidate.name === 'QuotaExceededError' ||
    candidate.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    candidate.code === 22 ||
    candidate.code === 1014 ||
    (typeof candidate.message === 'string' && /quota/i.test(candidate.message))
  );
}
