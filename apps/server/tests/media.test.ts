import { execFile } from 'node:child_process';
import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { describe, expect, it } from 'vitest';
import { createMediaTools } from '../src/services/media';
import { makeConfig } from './helpers';

const execFileAsync = promisify(execFile);

async function makeScript(directory: string, name: string, body: string): Promise<string> {
  const path = join(directory, name);
  await writeFile(path, `#!/usr/bin/env bash\n${body}\n`);
  await chmod(path, 0o755);
  return path;
}

describe('MediaTools with fake binaries', () => {
  it('gets metadata, downloads and converts', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'chordifree-bin-'));
    const ytdlp = await makeScript(
      directory,
      'yt-dlp',
      [
        'if [[ "$*" == *"--dump-single-json"* ]]; then',
        '  echo \'{"duration":120,"title":"Demo"}\'',
        '  exit 0',
        'fi',
        'out=""',
        'args=("$@")',
        'for ((i=0;i<${#args[@]};i++)); do',
        '  if [[ "${args[$i]}" == "-o" ]]; then out="${args[$((i+1))]}"; fi',
        'done',
        'out=$(echo "$out" | sed "s/%(ext)s/webm/")',
        'mkdir -p "$(dirname "$out")"',
        'echo audio > "$out"',
      ].join('\n'),
    );
    const ffmpeg = await makeScript(directory, 'ffmpeg', 'last="${@: -1}"; echo wav > "$last"');
    const ffprobe = await makeScript(
      directory,
      'ffprobe',
      'echo \'{"format":{"duration":"12.5"},"streams":[{"codec_name":"pcm_s16le","channels":2}]}\'',
    );

    const tools = createMediaTools(
      makeConfig({ ytdlpPath: ytdlp, ffmpegPath: ffmpeg, ffprobePath: ffprobe }),
    );

    await expect(tools.probeYoutube('dQw4w9WgXcQ')).resolves.toEqual({
      duration: 120,
      title: 'Demo',
    });

    const downloaded = await tools.downloadYoutube('dQw4w9WgXcQ', directory);
    expect(downloaded.endsWith('dQw4w9WgXcQ.webm')).toBe(true);
    await expect(readFile(downloaded, 'utf8')).resolves.toContain('audio');

    const wav = join(directory, 'salida.wav');
    await tools.convertToWav(downloaded, wav);
    await expect(readFile(wav, 'utf8')).resolves.toContain('wav');

    await expect(tools.probeAudio(wav)).resolves.toEqual({
      duration: 12.5,
      codec: 'pcm_s16le',
      channels: 2,
    });
  });

  it('maps binary errors to stable codes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'chordifree-bin-'));
    const failing = await makeScript(directory, 'failing', 'exit 1');
    const tools = createMediaTools(
      makeConfig({ ytdlpPath: failing, ffmpegPath: failing, ffprobePath: failing }),
    );

    await expect(tools.probeYoutube('dQw4w9WgXcQ')).rejects.toMatchObject({
      code: 'VIDEO_UNAVAILABLE',
    });
    await expect(tools.downloadYoutube('dQw4w9WgXcQ', directory)).rejects.toMatchObject({
      code: 'VIDEO_UNAVAILABLE',
    });
    await expect(tools.convertToWav('a', 'b')).rejects.toMatchObject({ code: 'ANALYSIS_FAILED' });
    await expect(tools.probeAudio('a')).rejects.toMatchObject({ code: 'INVALID_AUDIO' });
  });

  it('applies timeouts to the binaries', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'chordifree-bin-'));
    const slow = await makeScript(directory, 'slow', 'sleep 1');
    const tools = createMediaTools(
      makeConfig({ ytdlpPath: slow }),
      { probe: 50, download: 50, convert: 50, ffprobe: 50 },
    );
    await expect(tools.probeYoutube('dQw4w9WgXcQ')).rejects.toMatchObject({
      code: 'VIDEO_UNAVAILABLE',
    });
  });
});

describe('real conversion with ffmpeg', () => {
  it('converts stereo audio to mono 22050 Hz WAV', async () => {
    if (!ffmpegStatic) throw new Error('ffmpeg-static no está disponible');
    const directory = await mkdtemp(join(tmpdir(), 'chordifree-audio-'));
    const stereo = join(directory, 'estereo.wav');
    await execFileAsync(ffmpegStatic, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=1',
      '-ac',
      '2',
      '-ar',
      '44100',
      stereo,
    ]);

    const tools = createMediaTools(
      makeConfig({ ffmpegPath: ffmpegStatic, ffprobePath: ffprobeStatic.path }),
    );
    const mono = join(directory, 'mono.wav');
    await tools.convertToWav(stereo, mono);

    const probe = await tools.probeAudio(mono);
    expect(probe.channels).toBe(1);
    expect(probe.duration).toBeCloseTo(1, 1);
  });
});
