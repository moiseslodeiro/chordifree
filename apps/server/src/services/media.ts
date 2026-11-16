import { execFile } from 'node:child_process';
import { readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { AppConfig } from '../config';
import { ApiError } from '../errors';
import type { AudioProbe, YoutubeMetadata, YoutubeSearchResult } from '../types';
import { isVideoId } from '../youtube';

const execFileAsync = promisify(execFile);

const SEARCH_RESULT_LIMIT = 10;

export interface MediaTools {
  probeYoutube(videoId: string): Promise<YoutubeMetadata>;
  downloadYoutube(videoId: string, directory: string): Promise<string>;
  searchYoutube(query: string): Promise<YoutubeSearchResult[]>;
  convertToWav(input: string, output: string): Promise<void>;
  probeAudio(path: string): Promise<AudioProbe>;
}

interface ExecOptions {
  timeout: number;
}

export interface MediaTimeouts {
  probe: number;
  search: number;
  download: number;
  convert: number;
  ffprobe: number;
}

const DEFAULT_TIMEOUTS: MediaTimeouts = {
  probe: 30_000,
  search: 20_000,
  download: 90_000,
  convert: 60_000,
  ffprobe: 20_000,
};

async function run(binary: string, args: string[], options: ExecOptions): Promise<string> {
  const { stdout } = await execFileAsync(binary, args, {
    timeout: options.timeout,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });
  return stdout;
}

function canonicalUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * YouTube blocks many datacenter IP ranges with a "confirm you're not a bot"
 * challenge. It is not the same as a missing/private video, so the UI can tell
 * the user to upload the audio instead.
 */
function isYoutubeBlocked(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const stderr = (error as { stderr?: string }).stderr ?? '';
  return /sign in to confirm|not a bot|LOGIN_REQUIRED/i.test(stderr);
}

interface ExtractorErrorBody {
  error?: { code?: string; message?: string };
}

function extractorBase(url: string): string {
  return url.replace(/\/$/, '');
}

function extractorHeaders(token: string, json = false): Record<string, string> {
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    'X-Chordifree-Token': token,
  };
}

function extractorFetchError(error: unknown): ApiError {
  const name = error instanceof Error ? error.name : '';
  return new ApiError(
    'EXTRACTOR_UNAVAILABLE',
    name === 'TimeoutError'
      ? 'The local YouTube extractor timed out.'
      : 'The local YouTube extractor is offline.',
  );
}

async function extractorFailure(response: Response): Promise<ApiError> {
  let code = '';
  let message = '';
  try {
    const body = (await response.json()) as ExtractorErrorBody;
    code = body.error?.code ?? '';
    message = body.error?.message ?? '';
  } catch {
    // Keep the generic message.
  }
  if (code === 'YOUTUBE_BLOCKED') {
    return new ApiError(
      'YOUTUBE_BLOCKED',
      message || 'YouTube is blocking the extractor. Upload the audio file instead.',
    );
  }
  if (response.status === 429) {
    return new ApiError(
      'EXTRACTOR_BUSY',
      'The local YouTube extractor is busy. Try again in a moment.',
    );
  }
  if (response.status === 401 || response.status === 403) {
    return new ApiError(
      'EXTRACTOR_UNAVAILABLE',
      'The local YouTube extractor rejected the server token.',
    );
  }
  if (response.status === 504) {
    return new ApiError('EXTRACTOR_UNAVAILABLE', 'The local YouTube extractor timed out.');
  }
  return new ApiError(
    'EXTRACTOR_UNAVAILABLE',
    message || 'The local YouTube extractor is unavailable.',
  );
}

export function createMediaTools(
  config: AppConfig,
  timeouts: Partial<MediaTimeouts> = {},
  fetchImpl: typeof fetch = fetch,
): MediaTools {
  const limits = { ...DEFAULT_TIMEOUTS, ...timeouts };
  const local: MediaTools = {
    async probeYoutube(videoId: string): Promise<YoutubeMetadata> {
      try {
        const stdout = await run(
          config.ytdlpPath,
          [
            '--no-playlist',
            '--no-warnings',
            '--skip-download',
            '--dump-single-json',
            canonicalUrl(videoId),
          ],
          { timeout: limits.probe },
        );
        const parsed = JSON.parse(stdout) as { duration?: number; title?: string };
        const duration = Number(parsed.duration);
        if (!Number.isFinite(duration) || duration <= 0) {
          throw new Error('Metadata without duration');
        }
        const metadata: YoutubeMetadata = { duration };
        if (parsed.title) metadata.title = parsed.title;
        return metadata;
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (isYoutubeBlocked(error)) {
          throw new ApiError(
            'YOUTUBE_BLOCKED',
            'YouTube is blocking this server. Upload the audio file instead.',
          );
        }
        throw new ApiError('VIDEO_UNAVAILABLE', 'Could not retrieve video information');
      }
    },

    async searchYoutube(query: string): Promise<YoutubeSearchResult[]> {
      try {
        const stdout = await run(
          config.ytdlpPath,
          [
            '--no-warnings',
            '--skip-download',
            '--flat-playlist',
            '--dump-single-json',
            `ytsearch${SEARCH_RESULT_LIMIT}:${query}`,
          ],
          { timeout: limits.search },
        );
        const parsed = JSON.parse(stdout) as {
          entries?: Array<{
            id?: string;
            title?: string;
            uploader?: string | null;
            channel?: string | null;
            duration?: number | null;
            live_status?: string | null;
          }>;
        };
        const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
        const results: YoutubeSearchResult[] = [];
        for (const entry of entries) {
          if (typeof entry.id !== 'string' || !isVideoId(entry.id)) continue;
          if (typeof entry.title !== 'string' || !entry.title.trim()) continue;
          if (entry.live_status === 'is_live' || entry.live_status === 'is_upcoming') continue;
          const result: YoutubeSearchResult = {
            videoId: entry.id,
            title: entry.title,
            thumbnail: `https://i.ytimg.com/vi/${entry.id}/mqdefault.jpg`,
          };
          const uploader = entry.uploader ?? entry.channel;
          if (uploader) result.uploader = uploader;
          if (
            typeof entry.duration === 'number' &&
            Number.isFinite(entry.duration) &&
            entry.duration > 0
          ) {
            result.duration = entry.duration;
          }
          results.push(result);
        }
        return results;
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (isYoutubeBlocked(error)) {
          throw new ApiError(
            'YOUTUBE_BLOCKED',
            'YouTube is blocking this server. Upload the audio file instead.',
          );
        }
        throw new ApiError('SEARCH_FAILED', 'Could not search YouTube');
      }
    },

    async downloadYoutube(videoId: string, directory: string): Promise<string> {
      try {
        await run(
          config.ytdlpPath,
          [
            '--no-playlist',
            '--no-warnings',
            '--no-part',
            '--match-filter',
            `duration <= ${config.maxDurationSeconds}`,
            '-f',
            'bestaudio[ext=m4a]/bestaudio',
            '-o',
            join(directory, `${videoId}.%(ext)s`),
            canonicalUrl(videoId),
          ],
          { timeout: limits.download },
        );
        const entries = await readdir(directory);
        const downloaded = entries.find((entry) => entry.startsWith(`${videoId}.`));
        if (!downloaded) throw new Error('Empty download');
        return join(directory, downloaded);
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (isYoutubeBlocked(error)) {
          throw new ApiError(
            'YOUTUBE_BLOCKED',
            'YouTube is blocking this server. Upload the audio file instead.',
          );
        }
        throw new ApiError('VIDEO_UNAVAILABLE', 'Could not download the video audio');
      }
    },

    async convertToWav(input: string, output: string): Promise<void> {
      try {
        await run(
          config.ffmpegPath,
          [
            '-hide_banner',
            '-loglevel',
            'error',
            '-y',
            '-i',
            input,
            '-ac',
            '1',
            '-ar',
            '22050',
            '-f',
            'wav',
            output,
          ],
          { timeout: limits.convert },
        );
      } catch {
        throw new ApiError('ANALYSIS_FAILED', 'Could not convert the audio for analysis');
      }
    },

    async probeAudio(path: string): Promise<AudioProbe> {
      try {
        const stdout = await run(
          config.ffprobePath,
          [
            '-v',
            'error',
            '-show_entries',
            'format=duration:stream=codec_name,channels',
            '-of',
            'json',
            path,
          ],
          { timeout: limits.ffprobe },
        );
        const parsed = JSON.parse(stdout) as {
          format?: { duration?: string };
          streams?: Array<{ codec_name?: string; channels?: number }>;
        };
        const duration = Number(parsed.format?.duration);
        const stream = parsed.streams?.[0];
        if (!Number.isFinite(duration) || duration <= 0 || !stream?.codec_name) {
          throw new Error('Invalid audio');
        }
        return {
          duration,
          codec: stream.codec_name,
          channels: Number(stream.channels ?? 1),
        };
      } catch {
        throw new ApiError('INVALID_AUDIO', 'The file is not valid audio');
      }
    },
  };

  if (!config.youtubeExtractorUrl) return local;

  const base = extractorBase(config.youtubeExtractorUrl);
  const token = config.youtubeExtractorToken;
  const requestTimeout = config.youtubeExtractorTimeoutMs;

  return {
    ...local,
    async probeYoutube(videoId: string): Promise<YoutubeMetadata> {
      let response: Response;
      try {
        response = await fetchImpl(`${base}/probe`, {
          method: 'POST',
          headers: extractorHeaders(token, true),
          body: JSON.stringify({ videoId }),
          signal: AbortSignal.timeout(requestTimeout),
        });
      } catch (error) {
        throw extractorFetchError(error);
      }
      if (!response.ok) throw await extractorFailure(response);

      const body = (await response.json().catch(() => null)) as {
        duration?: number;
        title?: string;
      } | null;
      const duration = Number(body?.duration);
      if (!body || !Number.isFinite(duration) || duration <= 0) {
        throw new ApiError(
          'EXTRACTOR_UNAVAILABLE',
          'The local YouTube extractor returned invalid metadata.',
        );
      }
      const metadata: YoutubeMetadata = { duration };
      if (typeof body.title === 'string' && body.title.trim()) {
        metadata.title = body.title.trim();
      }
      return metadata;
    },

    async searchYoutube(query: string): Promise<YoutubeSearchResult[]> {
      let response: Response;
      try {
        response = await fetchImpl(`${base}/search?q=${encodeURIComponent(query)}`, {
          headers: extractorHeaders(token),
          signal: AbortSignal.timeout(requestTimeout),
        });
      } catch (error) {
        throw extractorFetchError(error);
      }
      if (!response.ok) throw await extractorFailure(response);

      const body = (await response.json().catch(() => null)) as {
        results?: YoutubeSearchResult[];
      } | null;
      return Array.isArray(body?.results) ? body.results : [];
    },

    async downloadYoutube(videoId: string, directory: string): Promise<string> {
      let response: Response;
      try {
        response = await fetchImpl(`${base}/download`, {
          method: 'POST',
          headers: extractorHeaders(token, true),
          body: JSON.stringify({ videoId }),
          signal: AbortSignal.timeout(requestTimeout),
        });
      } catch (error) {
        throw extractorFetchError(error);
      }
      if (!response.ok) throw await extractorFailure(response);

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length === 0) {
        throw new ApiError(
          'EXTRACTOR_UNAVAILABLE',
          'The local YouTube extractor returned an empty audio file.',
        );
      }
      const rawName = response.headers.get('x-filename') ?? `${videoId}.m4a`;
      const filename = rawName.replace(/[^A-Za-z0-9._-]/g, '_');
      const path = join(directory, filename);
      await writeFile(path, buffer);
      return path;
    },
  };
}

export async function removeDirectory(directory: string): Promise<void> {
  await rm(directory, { recursive: true, force: true });
}
