import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { JobQueue } from '../src/jobs/queue';
import { JobStore } from '../src/jobs/store';
import type { TemporaryAudioCache } from '../src/services/audio-cache';
import { StemJobs } from '../src/services/stem-jobs';
import { StemCache } from '../src/services/stem-cache';
import {
  NullStemEngine,
  PluginStemEngine,
  RemoteStemEngine,
  type StemEngine,
} from '../src/services/stems';
import { ApiError } from '../src/errors';
import { makeAnalyzer, makeConfig, makeTempDir, makeTools } from './helpers';

const PLUGIN_SCRIPT = `import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [, , input, output] = process.argv;
writeFileSync(join(output, 'vocals.wav'), 'voice:' + input);
writeFileSync(join(output, 'instrumental.wav'), 'instrumental');
writeFileSync(join(output, 'bass.wav'), 'bass');
writeFileSync(join(output, 'drums.wav'), 'drums');
writeFileSync(join(output, 'bass.notes.json'), JSON.stringify({ notes: [{ start: 0, end: 1, pitch: 40, velocity: 92 }] }));
writeFileSync(join(output, 'drums.notes.json'), JSON.stringify({ notes: [{ start: 0, end: 0.1, pitch: 36 }] }));
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

async function fakePlugin(
  command: string,
  args: (script: string) => string[],
  manifest: Record<string, unknown> = {},
) {
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
      ...manifest,
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

  it('resolves relative audio paths from the server cwd', async () => {
    const dir = await fakePlugin(process.execPath, (script) => [script, '{input}', '{output}']);
    const { input } = await fakeAudio();
    const output = await mkdtemp(join(tmpdir(), 'chordifree-stems-relative-'));
    const result = await new PluginStemEngine(dir).separate(relative(process.cwd(), input), output);
    expect([...result.stems.keys()]).toEqual(['vocals', 'instrumental']);
  });

  it('collects transcribed notes declared by the plugin', async () => {
    const dir = await fakePlugin(process.execPath, (script) => [script, '{input}', '{output}'], {
      stems: ['bass', 'drums'],
      transcribe: ['bass', 'drums'],
    });
    const { input } = await fakeAudio();
    const output = await mkdtemp(join(tmpdir(), 'chordifree-stems-notes-'));
    const result = await new PluginStemEngine(dir).separate(input, output);
    expect([...result.notes.keys()]).toEqual(['bass', 'drums']);
    expect(result.notes.get('bass')?.[0]).toMatchObject({ pitch: 40, velocity: 92 });
    expect(result.notes.get('drums')?.[0]).toMatchObject({ pitch: 36 });
  });

  it('reports a broken manifest instead of starting', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'chordifree-stems-broken-'));
    await writeFile(join(dir, 'manifest.json'), '{ not json');
    const status = await new PluginStemEngine(dir).status();
    expect(status.available).toBe(false);
    expect(status.error).toBeTruthy();
  });
});

async function fakeRemoteService() {
  const server = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          name: 'remote-demucs',
          version: '9.9.9',
          stems: ['vocals', 'no_vocals'],
        }),
      );
      return;
    }
    if (req.url === '/separate' && req.method === 'POST') {
      req.resume();
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({ id: 'job-remote', status: 'done', stems: ['vocals', 'no_vocals'] }),
        );
      });
      return;
    }
    if (req.url === '/jobs/job-remote/vocals') {
      res.writeHead(200, { 'content-type': 'audio/wav' });
      res.end('vocals-bytes');
      return;
    }
    if (req.url === '/jobs/job-remote/no_vocals') {
      res.writeHead(200, { 'content-type': 'audio/wav' });
      res.end('instrumental-bytes');
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { server, url: `http://127.0.0.1:${port}` };
}

describe('remote stems service', () => {
  it('reports the remote status with the same shape as the local plugin', async () => {
    const remote = await fakeRemoteService();
    try {
      const engine = new RemoteStemEngine(remote.url);
      await expect(engine.status()).resolves.toEqual({
        available: true,
        name: 'remote-demucs',
        version: '9.9.9',
        stems: ['vocals', 'no_vocals'],
      });
    } finally {
      await new Promise((resolve) => remote.server.close(resolve));
    }
  });

  it('uploads the cached audio and downloads the stems', async () => {
    const remote = await fakeRemoteService();
    try {
      const engine = new RemoteStemEngine(remote.url);
      const { input } = await fakeAudio();
      const output = await mkdtemp(join(tmpdir(), 'chordifree-stems-remote-'));
      const result = await engine.separate(input, output);
      expect([...result.stems.keys()]).toEqual(['vocals', 'no_vocals']);
      expect(await readFile(result.stems.get('vocals')!, 'utf8')).toBe('vocals-bytes');
      expect(await readFile(result.stems.get('no_vocals')!, 'utf8')).toBe('instrumental-bytes');
    } finally {
      await new Promise((resolve) => remote.server.close(resolve));
    }
  });

  it('reports an unreachable service as unavailable', async () => {
    const engine = new RemoteStemEngine('http://127.0.0.1:1', '', 60_000);
    const status = await engine.status();
    expect(status.available).toBe(false);
  });
});

describe('stem jobs', () => {
  it('keeps the separated files available by job id', async () => {
    const dir = await fakePlugin(process.execPath, (script) => [script, '{input}', '{output}']);
    const { cache } = await fakeAudio();
    const workRoot = await mkdtemp(join(tmpdir(), 'chordifree-stems-jobs-'));
    const jobs = new StemJobs(
      new PluginStemEngine(dir),
      cache,
      workRoot,
      new StemCache(join(workRoot, 'cache')),
    );

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

  it('exposes the transcribed notes by job id', async () => {
    const dir = await fakePlugin(process.execPath, (script) => [script, '{input}', '{output}'], {
      stems: ['bass', 'drums'],
      transcribe: ['bass', 'drums'],
    });
    const { cache } = await fakeAudio();
    const workRoot = await mkdtemp(join(tmpdir(), 'chordifree-stems-jobs-notes-'));
    const jobs = new StemJobs(
      new PluginStemEngine(dir),
      cache,
      workRoot,
      new StemCache(join(workRoot, 'cache')),
    );

    const started = await jobs.start('dQw4w9WgXcQ');
    let view = jobs.get(started.id);
    for (let attempt = 0; attempt < 100 && view?.status !== 'done'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      view = jobs.get(started.id);
    }
    expect(view?.status).toBe('done');
    expect(view?.midi).toEqual(['bass', 'drums']);
    expect(jobs.notes(started.id, 'bass')?.[0]?.pitch).toBe(40);
    expect(jobs.notes(started.id, 'missing')).toBeNull();
  });

  it('reuses the persistent cache instead of separating again', async () => {
    const dir = await fakePlugin(process.execPath, (script) => [script, '{input}', '{output}']);
    const { cache } = await fakeAudio();
    const workRoot = await mkdtemp(join(tmpdir(), 'chordifree-stems-cache-'));
    const stemCache = new StemCache(join(workRoot, 'cache'));
    const engine = new PluginStemEngine(dir);
    const separate = vi.spyOn(engine, 'separate');
    const jobs = new StemJobs(engine, cache, workRoot, stemCache);

    const first = await jobs.start('dQw4w9WgXcQ', 'Demo');
    let view = jobs.get(first.id);
    for (let attempt = 0; attempt < 100 && view?.status !== 'done'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      view = jobs.get(first.id);
    }
    expect(view?.status).toBe('done');
    expect(view?.title).toBe('Demo');
    expect(separate).toHaveBeenCalledTimes(1);

    const second = await jobs.start('dQw4w9WgXcQ', 'Demo');
    expect(second.status).toBe('done');
    expect(second.stems).toEqual(['vocals', 'instrumental']);
    expect(jobs.file(second.id, 'vocals')).toContain('vocals.wav');
    expect(second.id).toBe(first.id);
    expect(jobs.list()).toHaveLength(1);
    expect(separate).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent requests for the same video', async () => {
    const dir = await fakePlugin(process.execPath, (script) => [script, '{input}', '{output}']);
    const { cache } = await fakeAudio();
    const workRoot = await mkdtemp(join(tmpdir(), 'chordifree-stems-race-'));
    const engine = new PluginStemEngine(dir);
    const separate = vi.spyOn(engine, 'separate');
    const jobs = new StemJobs(engine, cache, workRoot, new StemCache(join(workRoot, 'cache')));

    const [first, second] = await Promise.all([
      jobs.start('dQw4w9WgXcQ', 'Demo'),
      jobs.start('dQw4w9WgXcQ', 'Demo'),
    ]);

    expect(first.id).toBe(second.id);
    let view = jobs.get(first.id);
    for (let attempt = 0; attempt < 100 && view?.status !== 'done'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      view = jobs.get(first.id);
    }
    expect(view?.status).toBe('done');
    expect(separate).toHaveBeenCalledTimes(1);
    expect(jobs.list()).toHaveLength(1);
  });

  it('cancels a running separation', async () => {
    const engine: StemEngine = {
      status: async () => ({
        available: true,
        name: 'slow',
        version: '1',
        stems: ['vocals'],
      }),
      separate: (_input, _output, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () =>
            reject(new ApiError('STEMS_CANCELLED', 'cancelled')),
          );
        }),
    };
    const { cache } = await fakeAudio();
    const workRoot = await mkdtemp(join(tmpdir(), 'chordifree-stems-cancel-'));
    const jobs = new StemJobs(engine, cache, workRoot, new StemCache(join(workRoot, 'cache')));

    const started = await jobs.start('dQw4w9WgXcQ');
    const cancelled = jobs.cancel(started.id);
    expect(cancelled?.status).toBe('cancelled');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(jobs.get(started.id)?.status).toBe('cancelled');
  });

  it('lists and clears the persisted cache', async () => {
    const root = await makeTempDir();
    const source = join(root, 'source');
    await mkdir(source, { recursive: true });
    await writeFile(join(source, 'vocals.wav'), 'voice');
    const cache = new StemCache(join(root, 'cache'));
    await cache.save({
      videoId: 'dQw4w9WgXcQ',
      title: 'Demo',
      plugin: 'fake@1',
      sourceDir: source,
      stems: ['vocals'],
      midi: [],
    });

    const app = createApp({
      config: makeConfig({ tempDir: root }),
      store: new JobStore(),
      queue: new JobQueue(1),
      tools: makeTools(),
      analyzer: makeAnalyzer(),
      stemsCache: cache,
    });
    const listed = await request(app).get('/api/stems/cache');
    expect(listed.status).toBe(200);
    expect(listed.body.entries[0]).toMatchObject({
      videoId: 'dQw4w9WgXcQ',
      title: 'Demo',
      stems: ['vocals'],
    });
    const removed = await request(app).delete('/api/stems/cache');
    expect(removed.body.removed).toBe(1);
  });

  it('exposes the local plugin setup endpoints', async () => {
    const job = {
      id: 'install-1',
      status: 'running' as const,
      step: 'pip' as const,
      progress: 42,
      message: 'Installing PyTorch and Demucs',
      startedAt: '2026-11-19T10:00:00.000Z',
      updatedAt: '2026-11-19T10:00:00.000Z',
    };
    const setup = {
      status: vi.fn(async () => ({
        supported: true,
        installed: false,
        managed: false,
        pluginDir: '/tmp/chordifree-stems',
        python: { command: 'python3', version: '3.12.3' },
        job,
      })),
      install: vi.fn(async () => job),
      cancel: vi.fn(() => job),
      getJob: vi.fn(() => job),
      uninstall: vi.fn(async () => undefined),
    };
    const app = createApp({ config: makeConfig(), stemsSetup: setup });

    const status = await request(app).get('/api/stems/setup');
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({
      supported: true,
      installed: false,
      python: { version: '3.12.3' },
    });

    const installed = await request(app).post('/api/stems/setup/install');
    expect(installed.status).toBe(202);
    expect(installed.body.step).toBe('pip');
    expect(setup.install).toHaveBeenCalledTimes(1);

    const cancelled = await request(app).post('/api/stems/setup/cancel');
    expect(cancelled.status).toBe(200);
    expect(setup.cancel).toHaveBeenCalledTimes(1);

    const removed = await request(app).delete('/api/stems/setup');
    expect(removed.status).toBe(200);
    expect(setup.uninstall).toHaveBeenCalledTimes(1);
  });

  it('reports the setup as unsupported without an installer', async () => {
    const app = createApp({ config: makeConfig() });
    const status = await request(app).get('/api/stems/setup');
    expect(status.body).toEqual({ supported: false, installed: false, managed: false });
    const install = await request(app).post('/api/stems/setup/install');
    expect(install.status).toBe(404);
    expect(install.body.error.code).toBe('STEMS_SETUP_UNAVAILABLE');
  });

  it('requires the temporary audio first', async () => {
    const cache = { get: async () => null } as unknown as TemporaryAudioCache;
    const jobs = new StemJobs(
      new NullStemEngine(),
      cache,
      tmpdir(),
      new StemCache(join(tmpdir(), 'chordifree-stems-cache-empty')),
    );
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
