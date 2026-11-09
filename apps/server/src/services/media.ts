import { execFile } from 'node:child_process';
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { AppConfig } from '../config';
import { ApiError } from '../errors';
import type { AudioProbe, YoutubeMetadata } from '../types';

const execFileAsync = promisify(execFile);

export interface MediaTools {
  probeYoutube(videoId: string): Promise<YoutubeMetadata>;
  downloadYoutube(videoId: string, directory: string): Promise<string>;
  convertToWav(input: string, output: string): Promise<void>;
  probeAudio(path: string): Promise<AudioProbe>;
}

interface ExecOptions {
  timeout: number;
}

export interface MediaTimeouts {
  probe: number;
  download: number;
  convert: number;
  ffprobe: number;
}

const DEFAULT_TIMEOUTS: MediaTimeouts = {
  probe: 30_000,
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

export function createMediaTools(
  config: AppConfig,
  timeouts: Partial<MediaTimeouts> = {},
): MediaTools {
  const limits = { ...DEFAULT_TIMEOUTS, ...timeouts };
  return {
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
        throw new ApiError('VIDEO_UNAVAILABLE', 'Could not retrieve video information');
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
            'bestaudio',
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
}

export async function removeDirectory(directory: string): Promise<void> {
  await rm(directory, { recursive: true, force: true });
}
