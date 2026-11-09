import { isQuotaError, KEYS, SCHEMA_VERSION, StorageQuotaError, type StorageLike } from './keys';

export interface StoredEnvelope {
  schemaVersion: number;
  data: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Migrates envelopes from previous versions. Returns null for unsupported versions.
 * v0 (before versioning) stored `{ songs: [...] }` without an envelope.
 */
export function migrateEnvelope(raw: unknown): unknown | null {
  if (!isRecord(raw)) return null;
  const version = raw.schemaVersion;
  if (version === undefined) {
    if (Array.isArray(raw.songs)) return { songs: raw.songs };
    return null;
  }
  if (version === SCHEMA_VERSION) return raw.data;
  return null;
}

export function quarantine(storage: StorageLike, key: string, raw: string): void {
  try {
    storage.setItem(KEYS.corrupt(Date.now()), raw);
  } catch {
    // If the quarantine does not fit either, the corrupt data is discarded.
  }
  storage.removeItem(key);
}

export function readEnvelope<T>(
  storage: StorageLike,
  key: string,
  validate: (value: unknown) => value is T,
): T | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const migrated = migrateEnvelope(JSON.parse(raw));
    if (migrated !== null && validate(migrated)) return migrated;
  } catch {
    // Invalid JSON: treated as corruption.
  }

  quarantine(storage, key, raw);
  return null;
}

export function writeEnvelope<T>(storage: StorageLike, key: string, data: T): void {
  const envelope: StoredEnvelope = { schemaVersion: SCHEMA_VERSION, data };
  try {
    storage.setItem(key, JSON.stringify(envelope));
  } catch (error) {
    if (isQuotaError(error)) throw new StorageQuotaError();
    throw error;
  }
}

export function removeKey(storage: StorageLike, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage failures when cleaning up.
  }
}

export function listKeys(storage: StorageLike, prefix: string): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && key.startsWith(prefix)) keys.push(key);
  }
  return keys;
}
