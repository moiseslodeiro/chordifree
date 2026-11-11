import { describe, expect, it } from 'vitest';
import { parseChordPro } from '../src/lib/chordpro';
import { DEFAULT_PREFERENCES } from '../src/storage/preferences';

const SHEET = `{title: My Song}
{artist: The Band}
{key: G}
{tempo: 100}

Verse:
[G]Hello [C]world
[Em]This is [D]a test
| G | C | D | G |
`;

describe('ChordPro import', () => {
  it('reads metadata, lyrics and chords with a synthetic timeline', () => {
    const song = parseChordPro(SHEET, 'my-song.cho', DEFAULT_PREFERENCES);

    expect(song.title).toBe('My Song');
    expect(song.artist).toBe('The Band');
    expect(song.source).toEqual({ type: 'sheet', filename: 'my-song.cho' });
    expect(song.lyrics).toContain('Hello world');
    expect(song.lyrics).toContain('This is a test');
    expect(song.segments).toHaveLength(8);
    expect(song.segments[0]?.chord?.root).toBe(7);
    expect(song.segments[1]?.chord?.root).toBe(0);
    expect(song.beats?.length).toBeGreaterThan(0);
    expect(song.duration).toBeCloseTo(8 * (60 / 100) * 4, 1);
  });

  it('falls back to the filename and rejects empty files', () => {
    const song = parseChordPro('[C]Only chords', 'fallback.cho', DEFAULT_PREFERENCES);
    expect(song.title).toBe('fallback');
    expect(() => parseChordPro('   \n  ', 'empty.cho', DEFAULT_PREFERENCES)).toThrow();
  });
});
