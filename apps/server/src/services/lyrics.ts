import { z } from 'zod';
import { ApiError } from '../errors';

export interface LyricsQuery {
  title: string;
  artist?: string;
  duration?: number;
}

export interface LyricsResult {
  lyrics: string;
  syncedLyrics?: string;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  source: 'lrclib';
}

export interface LyricsClient {
  find(query: LyricsQuery): Promise<LyricsResult>;
}

const LyricsRecordSchema = z.object({
  trackName: z.string(),
  artistName: z.string(),
  albumName: z.string().optional().default(''),
  duration: z.number().optional(),
  instrumental: z.boolean().optional().default(false),
  plainLyrics: z.string().nullable().optional(),
  syncedLyrics: z.string().nullable().optional(),
});

const LyricsSearchSchema = z.array(LyricsRecordSchema);

type LyricsRecord = z.infer<typeof LyricsRecordSchema>;

const BASE_URL = 'https://lrclib.net';
const USER_AGENT = 'Chordifree/0.1.0 (+https://github.com/moiseslodeiro/chordifree)';
const TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function stripLrc(value: string): string {
  return value
    .split('\n')
    .map((line) => line.replace(/^\s*\[[^\]]+\]\s*/, ''))
    .filter((line) => line.trim().length > 0)
    .join('\n')
    .trim();
}

function toResult(record: LyricsRecord): LyricsResult | null {
  if (record.instrumental) return null;
  const lyrics = record.plainLyrics?.trim() || (record.syncedLyrics ? stripLrc(record.syncedLyrics) : '');
  if (!lyrics) return null;
  return {
    lyrics,
    ...(record.syncedLyrics ? { syncedLyrics: record.syncedLyrics } : {}),
    trackName: record.trackName,
    artistName: record.artistName,
    ...(record.albumName ? { albumName: record.albumName } : {}),
    ...(record.duration ? { duration: record.duration } : {}),
    source: 'lrclib',
  };
}

function pickBest(records: LyricsRecord[], duration?: number): LyricsRecord | null {
  const candidates = records.filter(
    (record) => !record.instrumental && (record.plainLyrics || record.syncedLyrics),
  );
  if (candidates.length === 0) return null;
  if (!duration || !Number.isFinite(duration)) return candidates[0] ?? null;
  return (
    [...candidates].sort((a, b) => {
      const aDistance = a.duration ? Math.abs(a.duration - duration) : Number.POSITIVE_INFINITY;
      const bDistance = b.duration ? Math.abs(b.duration - duration) : Number.POSITIVE_INFINITY;
      return aDistance - bDistance;
    })[0] ?? null
  );
}

export function createLyricsClient(
  fetchImpl: typeof fetch = fetch,
  userAgent = USER_AGENT,
): LyricsClient {
  async function request(path: string): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchImpl(`${BASE_URL}${path}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': userAgent,
          'X-User-Agent': userAgent,
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new ApiError('LYRICS_UNAVAILABLE', 'Could not reach the lyrics provider');
    }

    if (response.status === 404) return null;
    if (response.status === 429) {
      throw new ApiError('RATE_LIMITED', 'The lyrics provider is rate limited. Try again later.');
    }
    if (!response.ok) {
      throw new ApiError('LYRICS_UNAVAILABLE', 'The lyrics provider is unavailable');
    }

    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > MAX_RESPONSE_BYTES) {
      throw new ApiError('LYRICS_UNAVAILABLE', 'The lyrics response was too large');
    }
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) {
      throw new ApiError('LYRICS_UNAVAILABLE', 'The lyrics response was too large');
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new ApiError('LYRICS_UNAVAILABLE', 'Invalid lyrics response');
    }
  }

  async function getBySignature(params: URLSearchParams): Promise<LyricsRecord | null> {
    const data = await request(`/api/get?${params.toString()}`);
    if (!data) return null;
    const parsed = LyricsRecordSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  }

  async function search(params: URLSearchParams): Promise<LyricsRecord[]> {
    const data = await request(`/api/search?${params.toString()}`);
    if (!data) return [];
    const parsed = LyricsSearchSchema.safeParse(data);
    return parsed.success ? parsed.data : [];
  }

  return {
    async find({ title, artist, duration }: LyricsQuery): Promise<LyricsResult> {
      const track = title.trim();
      const performer = artist?.trim();
      if (!track) throw new ApiError('LYRICS_NOT_FOUND', 'No lyrics found for this song');
      const safeDuration =
        duration && Number.isFinite(duration) && duration >= 1 && duration <= 3600
          ? Math.round(duration)
          : undefined;

      if (performer) {
        const exact = new URLSearchParams({ track_name: track, artist_name: performer });
        if (safeDuration) exact.set('duration', String(safeDuration));
        const record = await getBySignature(exact);
        if (record) {
          const result = toResult(record);
          if (result) return result;
        }
      }

      const params = performer
        ? new URLSearchParams({ track_name: track, artist_name: performer })
        : new URLSearchParams({ q: track });
      const records = await search(params);
      const best = pickBest(records, safeDuration);
      const result = best ? toResult(best) : null;
      if (!result) throw new ApiError('LYRICS_NOT_FOUND', 'No lyrics found for this song');
      return result;
    },
  };
}
