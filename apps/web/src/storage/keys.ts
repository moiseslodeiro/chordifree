export const PREFIX = 'chordifree:v1';
export const LEGACY_PREFIX = 'freechords:v1';
export const SCHEMA_VERSION = 1;

export const KEYS = {
  preferences: `${PREFIX}:preferences`,
  library: `${PREFIX}:library`,
  song: (id: string) => `${PREFIX}:song:${id}`,
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

export class StorageQuotaError extends Error {
  constructor(message = 'El almacenamiento local está lleno') {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

/** Almacén en memoria para navegadores con `localStorage` bloqueado. */
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
 * Mueve las claves de la marca anterior a las actuales sin sobrescribir datos
 * nuevos. Se ejecuta una vez al arrancar para no perder biblioteca ni ajustes.
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
 * Devuelve `localStorage` si está disponible y permite escribir; si no,
 * un almacén en memoria para que la aplicación siga siendo usable.
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
      // La migración no debe impedir usar la aplicación.
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
