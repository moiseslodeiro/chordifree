import { describe, expect, it } from 'vitest';
import { JobQueue } from '../src/jobs/queue';
import { JobStore } from '../src/jobs/store';

describe('JobQueue', () => {
  it('respeta la concurrencia y encola el resto', async () => {
    const queue = new JobQueue(2);
    let active = 0;
    let maxActive = 0;
    const releases: Array<() => void> = [];

    const tasks = Array.from({ length: 5 }, (_, index) =>
      queue.add(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise<void>((resolve) => releases.push(resolve));
        active -= 1;
        return index;
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(queue.activeCount).toBe(2);
    expect(queue.pendingCount).toBe(3);

    releases.splice(0).forEach((release) => release());
    await new Promise((resolve) => setTimeout(resolve, 20));
    releases.splice(0).forEach((release) => release());
    await new Promise((resolve) => setTimeout(resolve, 20));
    releases.splice(0).forEach((release) => release());

    await expect(Promise.all(tasks)).resolves.toEqual([0, 1, 2, 3, 4]);
    expect(maxActive).toBe(2);
    expect(queue.pendingCount).toBe(0);
  });

  it('propaga errores y libera el hueco', async () => {
    const queue = new JobQueue(1);
    await expect(
      queue.add(async () => {
        throw new Error('fallo');
      }),
    ).rejects.toThrow('fallo');
    await expect(queue.add(async () => 'ok')).resolves.toBe('ok');
  });
});

describe('JobStore', () => {
  it('crea y actualiza trabajos', () => {
    const store = new JobStore();
    const job = store.create({ type: 'youtube', videoId: 'dQw4w9WgXcQ' });
    expect(job.status).toBe('queued');
    store.update(job.id, { status: 'processing', progress: 40 });
    expect(store.get(job.id)).toMatchObject({ status: 'processing', progress: 40 });
    expect(store.toView(store.get(job.id)!)).not.toHaveProperty('result');
  });

  it('elimina un trabajo y su índice de vídeo', () => {
    const store = new JobStore();
    const job = store.create({ type: 'youtube', videoId: 'dQw4w9WgXcQ' });
    store.update(job.id, {
      status: 'done',
      result: {
        source: { type: 'youtube', videoId: 'dQw4w9WgXcQ' },
        duration: 10,
        segments: [],
        analyzerVersion: 'v1',
        createdAt: new Date().toISOString(),
      },
    });
    store.indexVideo('dQw4w9WgXcQ', job.id, 'v1');
    expect(store.findByVideo('dQw4w9WgXcQ', 'v1')).toBeDefined();

    expect(store.remove(job.id)).toBe(true);
    expect(store.get(job.id)).toBeUndefined();
    expect(store.findByVideo('dQw4w9WgXcQ', 'v1')).toBeUndefined();
    expect(store.remove('missing')).toBe(false);
  });

  it('cachea el resultado por video y respeta el TTL', () => {
    let now = 1_000;
    const store = new JobStore(1_000, () => now);
    const job = store.create({ type: 'youtube', videoId: 'dQw4w9WgXcQ' });
    store.update(job.id, {
      status: 'done',
      result: {
        source: { type: 'youtube', videoId: 'dQw4w9WgXcQ' },
        duration: 10,
        segments: [],
        analyzerVersion: 'v1',
        createdAt: new Date(now).toISOString(),
      },
    });
    store.indexVideo('dQw4w9WgXcQ', job.id, 'v1');
    expect(store.findByVideo('dQw4w9WgXcQ', 'v1')?.id).toBe(job.id);

    now += 1_500;
    expect(store.findByVideo('dQw4w9WgXcQ', 'v1')).toBeUndefined();
  });

  it('no devuelve trabajos que aún no han terminado', () => {
    const store = new JobStore();
    const job = store.create({ type: 'youtube', videoId: 'dQw4w9WgXcQ' });
    store.indexVideo('dQw4w9WgXcQ', job.id, 'v1');
    expect(store.findByVideo('dQw4w9WgXcQ', 'v1')).toBeUndefined();
  });

  it('invalida la caché cuando cambia la versión del analizador', () => {
    const store = new JobStore();
    const job = store.create({ type: 'youtube', videoId: 'dQw4w9WgXcQ' });
    store.update(job.id, {
      status: 'done',
      result: {
        source: { type: 'youtube', videoId: 'dQw4w9WgXcQ' },
        duration: 10,
        segments: [],
        analyzerVersion: 'essentia-1.0',
        createdAt: new Date().toISOString(),
      },
    });
    store.indexVideo('dQw4w9WgXcQ', job.id, 'essentia-1.0');

    expect(store.findByVideo('dQw4w9WgXcQ', 'essentia-1.0')?.id).toBe(job.id);
    expect(store.findByVideo('dQw4w9WgXcQ', 'essentia-1.2')).toBeUndefined();
  });

  it('barre trabajos antiguos', () => {
    let now = 0;
    const store = new JobStore(100, () => now);
    const job = store.create({ type: 'upload', filename: 'a.wav' });
    now = 200;
    expect(store.sweep()).toBe(1);
    expect(store.get(job.id)).toBeUndefined();
  });
});
