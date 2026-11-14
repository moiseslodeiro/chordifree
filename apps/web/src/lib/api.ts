import { t } from '../i18n';
import type { AnalysisResult, AnalysisView, LyricsResult, YoutubeSearchResult } from '../types';
import { normalizeLyricsText } from '../lyrics/normalize';

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
  const body = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string } }
    | null;
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
}> {
  try {
    const response = await fetch('/api/health', { signal });
    const body = await parseResponse<{ analyzer?: string; analyzerVersion?: string }>(response);
    return {
      analyzer: body.analyzer === 'ok' ? 'ok' : 'down',
      analyzerVersion: body.analyzerVersion ?? 'unknown',
    };
  } catch {
    return { analyzer: 'down', analyzerVersion: 'unknown' };
  }
}

export async function createYoutubeAnalysis(
  youtubeUrl: string,
  signal?: AbortSignal,
): Promise<AnalysisView> {
  const response = await fetch('/api/analyses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ youtubeUrl }),
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
  const response = await fetch('/api/analyses', { method: 'POST', body: form, signal });
  return parseResponse(response);
}

export async function searchYoutube(
  query: string,
  signal?: AbortSignal,
): Promise<YoutubeSearchResult[]> {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`/api/youtube/search?${params.toString()}`, { signal });
  const body = await parseResponse<{ results?: YoutubeSearchResult[] }>(response);
  return Array.isArray(body.results) ? body.results : [];
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
  const response = await fetch(`/api/lyrics?${query.toString()}`, { signal });
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
  const response = await fetch(`/api/analyses/${id}`, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) {
    throw new ApiClientError(
      'DELETE_FAILED',
      t('error.api', { status: response.status }),
      response.status,
    );
  }
}

export async function getAnalysis(id: string, signal?: AbortSignal): Promise<AnalysisView> {
  const response = await fetch(`/api/analyses/${id}`, { signal });
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

export async function pollAnalysis(
  id: string,
  options: PollOptions = {},
): Promise<AnalysisResult> {
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
