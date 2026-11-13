import { describe, expect, it, vi } from 'vitest';
import { createLyricsClient } from '../src/services/lyrics';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const record = {
  trackName: 'Demo song',
  artistName: 'Demo artist',
  albumName: 'Demo album',
  duration: 120,
  instrumental: false,
  plainLyrics: 'First line\nSecond line',
  syncedLyrics: '[00:01.00]First line\n[00:05.00]Second line',
};

describe('lyrics client', () => {
  it('uses the signature endpoint and returns plain lyrics', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request) => json(record));
    const client = createLyricsClient(fetchMock as unknown as typeof fetch);

    const result = await client.find({ title: 'Demo song', artist: 'Demo artist', duration: 120 });

    expect(result).toMatchObject({
      lyrics: 'First line\nSecond line',
      trackName: 'Demo song',
      artistName: 'Demo artist',
      source: 'lrclib',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/get?');
  });

  it('falls back to search when the exact signature is missing', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/api/get')) return json({}, 404);
      return json([{ ...record, duration: 118 }]);
    });
    const client = createLyricsClient(fetchMock as unknown as typeof fetch);

    const result = await client.find({ title: 'Demo song', artist: 'Demo artist', duration: 120 });

    expect(result.lyrics).toContain('First line');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('converts synced-only lyrics to plain text', async () => {
    const fetchMock = vi.fn(async () =>
      json({ ...record, plainLyrics: null, syncedLyrics: '[00:01.00]One\n[00:02.00]Two' }),
    );
    const client = createLyricsClient(fetchMock as unknown as typeof fetch);

    await expect(client.find({ title: 'Demo song', artist: 'Demo artist' })).resolves.toMatchObject({
      lyrics: 'One\nTwo',
    });
  });

  it('rejects when no lyrics are found', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/api/get')) return json({}, 404);
      return json([]);
    });
    const client = createLyricsClient(fetchMock as unknown as typeof fetch);

    await expect(client.find({ title: 'Missing', artist: 'Nobody' })).rejects.toMatchObject({
      code: 'LYRICS_NOT_FOUND',
      status: 404,
    });
  });

  it('maps provider rate limits and failures', async () => {
    const limited = createLyricsClient(
      vi.fn(async () => json({ message: 'slow down' }, 429)) as unknown as typeof fetch,
    );
    await expect(limited.find({ title: 'Demo', artist: 'Artist' })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
    });

    const unavailable = createLyricsClient(
      vi.fn(async () => json({ message: 'down' }, 503)) as unknown as typeof fetch,
    );
    await expect(unavailable.find({ title: 'Demo', artist: 'Artist' })).rejects.toMatchObject({
      code: 'LYRICS_UNAVAILABLE',
      status: 502,
    });
  });
});
