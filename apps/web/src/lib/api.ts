import { t } from '../i18n';
import type {
  AccessEntry,
  AuthConfig,
  AuthMe,
  CloudLibrarySnapshot,
  DeleteAccountResult,
  RuntimeConfig,
} from '@chordifree/contracts';
import type {
  AnalysisResult,
  AnalysisView,
  LyricsResult,
  Setlist,
  Song,
  YoutubeSearchResult,
} from '../types';

export type {
  AccessEntry,
  AuthConfig,
  AuthMe,
  AuthUser,
  CloudLibrarySnapshot,
  DeleteAccountResult,
  RuntimeConfig,
} from '@chordifree/contracts';
import { normalizeLyricsText } from '../lyrics/normalize';

let authToken: string | null = null;

/** Sets the Google ID token used by every API request. */
export function setAuthToken(token: string | null): void {
  authToken = token;
  audioPreparations.clear();
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    ...extra,
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 0) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('chordifree:unauthorized'));
  }
  const body = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;
  if (!response.ok) {
    throw new ApiClientError(
      body?.error?.code ?? 'ANALYSIS_FAILED',
      body?.error?.message ?? t('error.api', { status: response.status }),
      response.status,
    );
  }
  return body as T;
}

export async function getHealth(signal?: AbortSignal): Promise<{
  analyzer: 'ok' | 'down';
  analyzerVersion: string;
  extractor?: 'ok' | 'down';
  extractorVersion?: string;
}> {
  try {
    const response = await fetch('/api/health', { signal, headers: authHeaders() });
    const body = await parseResponse<{
      analyzer?: string;
      analyzerVersion?: string;
      extractor?: string;
      extractorVersion?: string;
    }>(response);
    return {
      analyzer: body.analyzer === 'ok' ? 'ok' : 'down',
      analyzerVersion: body.analyzerVersion ?? 'unknown',
      ...(body.extractor === 'ok' || body.extractor === 'down'
        ? { extractor: body.extractor }
        : {}),
      ...(body.extractorVersion ? { extractorVersion: body.extractorVersion } : {}),
    };
  } catch {
    return { analyzer: 'down', analyzerVersion: 'unknown' };
  }
}

export async function createYoutubeAnalysis(
  youtubeUrl: string,
  signal?: AbortSignal,
  force = false,
): Promise<AnalysisView> {
  const response = await fetch('/api/analyses', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ youtubeUrl, ...(force ? { force: true } : {}) }),
    signal,
  });
  return parseResponse(response);
}

export async function createUploadAnalysis(
  file: File,
  signal?: AbortSignal,
): Promise<AnalysisView> {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch('/api/analyses', {
    method: 'POST',
    body: form,
    signal,
    headers: authHeaders(),
  });
  return parseResponse(response);
}

export async function searchYoutube(
  query: string,
  signal?: AbortSignal,
): Promise<YoutubeSearchResult[]> {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`/api/youtube/search?${params.toString()}`, {
    signal,
    headers: authHeaders(),
  });
  const body = await parseResponse<{ results?: YoutubeSearchResult[] }>(response);
  return Array.isArray(body.results) ? body.results : [];
}

export interface AudioCacheStats {
  entries: number;
  bytes: number;
  ttlMinutes: number;
}

/** Disk usage of the temporary audio kept for the YouTube pitch player. */
export async function getAudioCacheStats(signal?: AbortSignal): Promise<AudioCacheStats> {
  const response = await fetch('/api/youtube/audio-cache', { signal, headers: authHeaders() });
  return parseResponse<AudioCacheStats>(response);
}

/** Removes every temporary audio file from the server cache. */
export async function clearAudioCache(): Promise<{ removed: number }> {
  const response = await fetch('/api/youtube/audio-cache', {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return parseResponse<{ removed: number }>(response);
}

export async function getAuthConfig(signal?: AbortSignal): Promise<AuthConfig> {
  const response = await fetch('/api/auth/config', { signal });
  return parseResponse<AuthConfig>(response);
}

export async function getAuthMe(signal?: AbortSignal): Promise<AuthMe> {
  const response = await fetch('/api/auth/me', { signal, headers: authHeaders() });
  return parseResponse<AuthMe>(response);
}

export async function getRuntimeConfig(signal?: AbortSignal): Promise<RuntimeConfig> {
  const response = await fetch('/api/config', { signal });
  return parseResponse<RuntimeConfig>(response);
}

export async function listAccessEntries(signal?: AbortSignal): Promise<AccessEntry[]> {
  const response = await fetch('/api/admin/access', { signal, headers: authHeaders() });
  const body = await parseResponse<{ entries?: AccessEntry[] }>(response);
  return Array.isArray(body.entries) ? body.entries : [];
}

export async function addAccessEntry(email: string): Promise<AccessEntry> {
  const response = await fetch('/api/admin/access', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email }),
  });
  const body = await parseResponse<{ entry?: AccessEntry }>(response);
  if (!body.entry) throw new ApiClientError('INVALID_REQUEST', t('admin.addFailed'));
  return body.entry;
}

export async function removeAccessEntry(email: string): Promise<void> {
  const response = await fetch(`/api/admin/access/${encodeURIComponent(email)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!response.ok && response.status !== 404) {
    await parseResponse(response);
  }
}

export async function getCloudLibrary(signal?: AbortSignal): Promise<CloudLibrarySnapshot> {
  const response = await fetch('/api/cloud/library', { signal, headers: authHeaders() });
  const body = await parseResponse<Partial<CloudLibrarySnapshot>>(response);
  return {
    songs: Array.isArray(body.songs) ? body.songs : [],
    setlists: Array.isArray(body.setlists) ? body.setlists : [],
    ...(body.updatedAt ? { updatedAt: body.updatedAt } : {}),
  };
}

export async function saveCloudLibrary(snapshot: {
  songs: Song[];
  setlists: Setlist[];
}): Promise<void> {
  const response = await fetch('/api/cloud/library', {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(snapshot),
  });
  await parseResponse<{ saved: boolean }>(response);
}

/** Deletes the signed-in user's cloud library (and their access if they are not an admin). */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const response = await fetch('/api/account', {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return parseResponse<DeleteAccountResult>(response);
}

const audioPreparations = new Map<string, Promise<{ url: string; expiresAt?: string }>>();

/** Rejects with AbortError when the caller aborts, without cancelling the shared request. */
function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

/**
 * Asks the server for the temporary audio of a YouTube video. The response is
 * ready to be used as the `src` of an audio element. Concurrent calls for the
 * same video share one request, which also avoids the double effect run in
 * React StrictMode.
 */
export function prepareYoutubeAudio(
  videoId: string,
  signal?: AbortSignal,
): Promise<{ url: string; expiresAt?: string }> {
  const pending = audioPreparations.get(videoId);
  if (pending) return withAbort(pending, signal);

  const request = (async () => {
    const response = await fetch(`/api/youtube/${encodeURIComponent(videoId)}/audio`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const body = await parseResponse<{ url?: string; expiresAt?: string }>(response);
    if (!body.url) {
      throw new ApiClientError('AUDIO_NOT_READY', t('error.audioUnavailable'), response.status);
    }

    // An <audio> element cannot send the Bearer token. Fetch the temporary
    // audio with the normal headers and hand the player a same-origin blob.
    const audio = await fetch(body.url, { headers: authHeaders() });
    if (!audio.ok) {
      throw new ApiClientError('AUDIO_NOT_READY', t('error.audioUnavailable'), audio.status);
    }
    const blob = await audio.blob();
    return {
      url: URL.createObjectURL(blob),
      ...(body.expiresAt ? { expiresAt: body.expiresAt } : {}),
    };
  })();
  audioPreparations.set(videoId, request);
  void request
    .finally(() => {
      if (audioPreparations.get(videoId) === request) audioPreparations.delete(videoId);
    })
    .catch(() => undefined);
  return withAbort(request, signal);
}

export async function fetchLyrics(
  params: { title: string; artist?: string; duration?: number },
  signal?: AbortSignal,
): Promise<LyricsResult> {
  const query = new URLSearchParams({ title: params.title });
  if (params.artist) query.set('artist', params.artist);
  if (
    params.duration &&
    Number.isFinite(params.duration) &&
    params.duration >= 1 &&
    params.duration <= 3600
  ) {
    query.set('duration', String(Math.round(params.duration)));
  }
  const response = await fetch(`/api/lyrics?${query.toString()}`, {
    signal,
    headers: authHeaders(),
  });
  const lyrics = await parseResponse<LyricsResult>(response);
  return {
    ...lyrics,
    lyrics: normalizeLyricsText(lyrics.lyrics),
    ...(typeof lyrics.syncedLyrics === 'string'
      ? { syncedLyrics: normalizeLyricsText(lyrics.syncedLyrics) }
      : {}),
  };
}

export async function deleteAnalysis(id: string): Promise<void> {
  const response = await fetch(`/api/analyses/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!response.ok && response.status !== 404) {
    throw new ApiClientError(
      'DELETE_FAILED',
      t('error.api', { status: response.status }),
      response.status,
    );
  }
}

export async function getAnalysis(id: string, signal?: AbortSignal): Promise<AnalysisView> {
  const response = await fetch(`/api/analyses/${id}`, { signal, headers: authHeaders() });
  return parseResponse(response);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export interface PollOptions {
  signal?: AbortSignal;
  intervalMs?: number;
  onUpdate?: (view: AnalysisView) => void;
}

export async function pollAnalysis(id: string, options: PollOptions = {}): Promise<AnalysisResult> {
  const interval = options.intervalMs ?? 1000;
  for (;;) {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const view = await getAnalysis(id, options.signal);
    options.onUpdate?.(view);
    if (view.status === 'done' && view.result) return view.result;
    if (view.status === 'error') {
      throw new ApiClientError(
        view.error?.code ?? 'ANALYSIS_FAILED',
        view.error?.message ?? t('error.analysisFailed'),
      );
    }
    await sleep(interval, options.signal);
  }
}

export async function sha256File(file: File): Promise<string> {
  if (globalThis.crypto?.subtle && typeof file.arrayBuffer === 'function') {
    try {
      const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Environments without full WebCrypto: the basic fingerprint is used.
    }
  }
  return `${file.name}:${file.size}:${file.lastModified}`;
}
