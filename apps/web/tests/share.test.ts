import { describe, expect, it } from 'vitest';
import { createDemoSong } from '../src/demo';
import { buildShareUrl, decodeSongFromToken, encodeSongForShare } from '../src/lib/share';
import { DEFAULT_PREFERENCES } from '../src/storage/preferences';

describe('share tokens', () => {
  it('round-trips a song and regenerates identity fields', async () => {
    const song = createDemoSong(DEFAULT_PREFERENCES);
    const token = await encodeSongForShare(song);
    const decoded = await decodeSongFromToken(token);

    expect(decoded.title).toBe(song.title);
    expect(decoded.segments).toEqual(song.segments);
    expect(decoded.beats).toEqual(song.beats);
    expect(decoded.lyrics).toBe(song.lyrics);
    expect(decoded.id).not.toBe(song.id);
    expect(decoded.detectedSegments).toEqual(decoded.segments);
    expect(decoded.source).toEqual({ type: 'upload', filename: 'shared audio' });
  });

  it('rejects malformed tokens', async () => {
    await expect(decodeSongFromToken('nope')).rejects.toThrow();
    await expect(decodeSongFromToken('g.bm90LWd6aXA')).rejects.toThrow();
  });

  it('builds a hash link without query parameters', async () => {
    const song = createDemoSong(DEFAULT_PREFERENCES);
    const token = await encodeSongForShare(song);
    const url = new URL(buildShareUrl(token));
    expect(url.hash).toBe(`#share=${token}`);
    expect(url.search).toBe('');
  });
});
