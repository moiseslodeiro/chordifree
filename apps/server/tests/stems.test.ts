import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { JobQueue } from '../src/jobs/queue';
import { JobStore } from '../src/jobs/store';
import type { TemporaryAudioCache } from '../src/services/audio-cache';
import { StemJobs } from '../src/services/stem-jobs';
import { NullStemEngine, PluginStemEngine } from '../src/services/stems';
import { makeAnalyzer, makeConfig, makeTempDir, makeTools } from './helpers';

const PLUGIN_SCRIPT = `import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [, , input, output] = process.argv;
writeFileSync(join(output, 'vocals.wav'), 'voice:' + input);
writeFileSync(join(output, 'instrumental.wav'), 'instrumental');
`;

async function fakeAudio(): Promise<{
  cache: TemporaryAudioCache;
  input: string;
}> {
  const dir = await mkdtemp(join(tmpdir(), 'chordifree-stems-audio-'));
  const input = join(dir, 'audio.webm');
  await writeFile(input, 'audio');
  const cache = {
    get: async () => ({ path: input, contentType: 'audio/webm', expiresAt: null }),
  } as unknown as TemporaryAudioCache;
  return { cache, input };
}

async function fakePlugin(command: string, args: (script: string) => string[]) {
  const dir = await mkdtemp(join(tmpdir(), 'chordifree-stems-plugin-'));
  const script = join(dir, 'fake-stems.mjs');
  await writeFile(script, PLUGIN_SCRIPT);
  await writeFile(
    join(dir, 'manifest.json'),
    JSON.stringify({
      name: 'fake-stems',
      version: '1.0.0',
      command,
      args: args(script),
      stems: ['vocals', 'instrumental'],
      timeoutSeconds: 60,
    }),
  );
  return dir;
}

describe('stems plugin engine', () => {
  it('reports unavailable without a manifest', async () => {
    const engine = new NullStemEngine();
    await expect(engine.status()).resolves.toEqual({ available: false });
    await expect(engine.separate('input', 'output')).rejects.toMatchObject({
      code: 'STEMS_UNAVAILABLE',
    });
  });

  it('runs the plugin and collects the declared stems', async () => {
    const dir = await fakePlugin(process.execPath, (script) => [script, '{input}', '{output}']);
    const engine = new PluginStemEngine(dir);
    expect(await engine.status()).toEqual({
      available: true,
      name: 'fake-stems',
      version: '1.0.0',
      stems: ['vocals', 'instrumental'],
    });

    const { input } = await fakeAudio();
    const output = await mkdtemp(join(tmpdir(), 'chordifree-stems-out-'));
    const result = await engine.separate(input, output);
    expect([...result.stems.keys()]).toEqual(['vocals', 'instrumental']);
    expect(await readFile(result.stems.get('vocals')!, 'utf8')).toBe(`voice:${input}`);
  });

  it('reports a broken manifest instead of starting', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'chordifree-stems-broken-'));
    await writeFile(join(dir, 'manifest.json'), '{ not json');
    const status = await new PluginStemEngine(dir).status();
    expect(status.available).toBe(false);
    expect(status.error).toBeTruthy();
  });
});

describe('stem jobs', () => {
  it('keeps the separated files available by job id', async () => {
    const dir = await fakePlugin(process.execPath, (script) => [script, '{input}', '{output}']);
    const { cache } = await fakeAudio();
    const workRoot = await mkdtemp(join(tmpdir(), 'chordifree-stems-jobs-'));
    const jobs = new StemJobs(new PluginStemEngine(dir), cache, workRoot);

    const started = await jobs.start('dQw4w9WgXcQ');
    expect(started.status).toBe('queued');

    let view = jobs.get(started.id);
    for (let attempt = 0; attempt < 100 && view?.status !== 'done'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      view = jobs.get(started.id);
    }
    expect(view?.status).toBe('done');
    expect(view?.stems).toEqual(['vocals', 'instrumental']);
    expect(jobs.file(started.id, 'vocals')).toContain('vocals.wav');
    expect(jobs.file(started.id, 'mix')).toBeNull();
  });

  it('requires the temporary audio first', async () => {
    const cache = { get: async () => null } as unknown as TemporaryAudioCache;
    const jobs = new StemJobs(new NullStemEngine(), cache, tmpdir());
    await expect(jobs.start('dQw4w9WgXcQ')).rejects.toMatchObject({ code: 'AUDIO_NOT_READY' });
  });
});

describe('GET /api/stems', () => {
  it('reports the feature as unavailable without a plugin', async () => {
    const app = createApp({
      config: makeConfig({ tempDir: await makeTempDir() }),
      store: new JobStore(),
      queue: new JobQueue(1),
      tools: makeTools(),
      analyzer: makeAnalyzer(),
    });

    const status = await request(app).get('/api/stems');
    expect(status.status).toBe(200);
    expect(status.body).toEqual({ available: false });

    const started = await request(app).post('/api/stems/dQw4w9WgXcQ');
    expect(started.status).toBe(404);
    expect(started.body.error.code).toBe('STEMS_UNAVAILABLE');
  });
});
