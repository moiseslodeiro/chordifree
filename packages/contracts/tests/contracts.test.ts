import { describe, expect, it } from 'vitest';
import { CloudLibraryBodySchema } from '../src';

const SONG = {
  id: 'song-1',
  title: 'Demo',
  updatedAt: '2026-01-01T00:00:00.000Z',
  source: { type: 'youtube', videoId: 'dQw4w9WgXcQ' },
  duration: 8,
  segments: [],
};

const SETLIST = {
  id: 'list-1',
  name: 'Ensayo',
  songIds: ['song-1'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('CloudLibraryBodySchema', () => {
  it('accepts a valid snapshot and keeps extra song fields', () => {
    const parsed = CloudLibraryBodySchema.parse({
      songs: [SONG],
      setlists: [SETLIST],
    });
    expect(parsed.songs[0]).toMatchObject(SONG);
    expect(parsed.setlists[0]).toMatchObject(SETLIST);
  });

  it('rejects a song without a title', () => {
    const result = CloudLibraryBodySchema.safeParse({
      songs: [{ id: 'song-1', updatedAt: '2026-01-01T00:00:00.000Z' }],
      setlists: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a setlist without songIds', () => {
    const result = CloudLibraryBodySchema.safeParse({
      songs: [],
      setlists: [
        {
          id: 'list-1',
          name: 'Ensayo',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
