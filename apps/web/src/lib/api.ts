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
  AnalysisLogEntry,
  AnalysisResult,
  AnalysisView,
  CollabRevision,
  CollabShare,
  LyricsResult,
  Setlist,
  Song,
  UserProfile,
  YoutubeSearchResult,
} from '../types';

export type {
  AccessEntry,
  AnalysisLogEntry,
  AuthConfig,
  AuthMe,
  AuthUser,
  CloudLibrarySnapshot,
  CollabRevision,
  CollabShare,
  DeleteAccountResult,
  RuntimeConfig,
  UserProfile,
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

/** Newest first. Only administrators can read the activity feed. */
export async function listAnalysisRuns(limit = 100): Promise<AnalysisLogEntry[]> {
  const response = await fetch(`/api/admin/analyses?limit=${limit}`, {
    headers: authHeaders(),
  });
  const body = await parseResponse<{ entries?: AnalysisLogEntry[] }>(response);
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

export async function getProfile(): Promise<UserProfile> {
  const response = await fetch('/api/profile', { headers: authHeaders() });
  return parseResponse<UserProfile>(response);
}

export async function saveProfile(nickname: string): Promise<UserProfile> {
  const response = await fetch('/api/profile', {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ nickname }),
  });
  return parseResponse<UserProfile>(response);
}

/** Shares a song for collaborative editing and returns its revision history. */
export async function createCollabShare(song: Song): Promise<CollabShare> {
  const response = await fetch('/api/collab', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ song }),
  });
  return parseResponse<CollabShare>(response);
}

export async function getCollabShare(id: string): Promise<CollabShare> {
  const response = await fetch(`/api/collab/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
  });
  return parseResponse<CollabShare>(response);
}

export async function getCollabRevision(id: string, revisionId: string): Promise<CollabRevision> {
  const response = await fetch(
    `/api/collab/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revisionId)}`,
    { headers: authHeaders() },
  );
  return parseResponse<CollabRevision>(response);
}

/** Publishes a revision based on the last version the client saw. */
export async function saveCollabRevision(
  id: string,
  baseRevisionId: string,
  song: Song,
): Promise<CollabRevision> {
  const response = await fetch(`/api/collab/${encodeURIComponent(id)}/revisions`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ baseRevisionId, song }),
  });
  return parseResponse<CollabRevision>(response);
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

export interface StemsStatus {
  available: boolean;
  name?: string;
  version?: string;
  stems?: string[];
  error?: string;
}

export interface StemNote {
  start: number;
  end: number;
  pitch: number;
  velocity?: number;
}

export interface StemJobView {
  id: string;
  videoId: string;
  title?: string;
  status: 'queued' | 'processing' | 'done' | 'cancelled' | 'error';
  stems: string[];
  /** Stems with transcribed notes, for example bass and drums. */
  midi?: string[];
  error?: { code: string; message: string };
  createdAt: string;
  updatedAt: string;
}

export async function getStemsStatus(signal?: AbortSignal): Promise<StemsStatus> {
  const response = await fetch('/api/stems', { signal, headers: authHeaders() });
  return parseResponse<StemsStatus>(response);
}

export async function startStems(videoId: string, title?: string): Promise<StemJobView> {
  const response = await fetch(`/api/stems/${encodeURIComponent(videoId)}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(title ? { title } : {}),
  });
  return parseResponse<StemJobView>(response);
}

export interface StemCacheEntry {
  key: string;
  videoId: string;
  title?: string;
  plugin: string;
  stems: string[];
  midi: string[];
  createdAt: string;
  bytes: number;
}

export async function listStemCache(signal?: AbortSignal): Promise<StemCacheEntry[]> {
  const response = await fetch('/api/stems/cache', { signal, headers: authHeaders() });
  const body = await parseResponse<{ entries?: StemCacheEntry[] }>(response);
  return Array.isArray(body.entries) ? body.entries : [];
}

/** Returns null when the video has not been separated yet. */
export async function getStemCache(
  videoId: string,
  signal?: AbortSignal,
): Promise<StemCacheEntry | null> {
  const response = await fetch(`/api/stems/cache/${encodeURIComponent(videoId)}`, {
    signal,
    headers: authHeaders(),
  });
  if (response.status === 404) return null;
  return parseResponse<StemCacheEntry>(response);
}

export async function clearStemCache(): Promise<number> {
  const response = await fetch('/api/stems/cache', {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const body = await parseResponse<{ removed?: number }>(response);
  return body.removed ?? 0;
}

export async function removeStemCache(videoId: string): Promise<number> {
  const response = await fetch(`/api/stems/cache/${encodeURIComponent(videoId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const body = await parseResponse<{ removed?: number }>(response);
  return body.removed ?? 0;
}

export async function listStemJobs(signal?: AbortSignal): Promise<StemJobView[]> {
  const response = await fetch('/api/stems/jobs', { signal, headers: authHeaders() });
  const body = await parseResponse<{ jobs?: StemJobView[] }>(response);
  return Array.isArray(body.jobs) ? body.jobs : [];
}

export async function cancelStemJob(id: string): Promise<StemJobView> {
  const response = await fetch(`/api/stems/jobs/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return parseResponse<StemJobView>(response);
}

export async function getStemNotes(
  id: string,
  stem: string,
  signal?: AbortSignal,
): Promise<StemNote[]> {
  const response = await fetch(
    `/api/stems/jobs/${encodeURIComponent(id)}/notes/${encodeURIComponent(stem)}`,
    { signal, headers: authHeaders() },
  );
  const body = await parseResponse<{ notes?: StemNote[] }>(response);
  return Array.isArray(body.notes) ? body.notes : [];
}

export async function getStemsJob(id: string, signal?: AbortSignal): Promise<StemJobView> {
  const response = await fetch(`/api/stems/jobs/${encodeURIComponent(id)}`, {
    signal,
    headers: authHeaders(),
  });
  return parseResponse<StemJobView>(response);
}

/** An <audio> element cannot send the Bearer token, so the stem is fetched as a blob. */
export async function prepareStemAudio(
  jobId: string,
  stem: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(
    `/api/stems/jobs/${encodeURIComponent(jobId)}/${encodeURIComponent(stem)}`,
    { signal, headers: authHeaders() },
  );
  if (!response.ok) {
    throw new ApiClientError('STEMS_NOT_READY', t('stems.loadFailed'), response.status);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function downloadStem(jobId: string, stem: string, filename: string): Promise<void> {
  const response = await fetch(
    `/api/stems/jobs/${encodeURIComponent(jobId)}/${encodeURIComponent(stem)}`,
    { headers: authHeaders() },
  );
  if (!response.ok) {
    throw new ApiClientError('STEMS_NOT_READY', t('stems.loadFailed'), response.status);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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
