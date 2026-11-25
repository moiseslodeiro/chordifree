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

  it('clamps tempo to the supported range', () => {
    const fast = parseChordPro('{tempo: 999}\n[C]Fast', 'fast.cho', DEFAULT_PREFERENCES);
    expect(fast.segments[0]).toMatchObject({ start: 0, end: 0.8 });

    const slow = parseChordPro('{tempo: 10}\n[C]Slow', 'slow.cho', DEFAULT_PREFERENCES);
    expect(slow.segments[0]).toMatchObject({ start: 0, end: 8 });
    expect(slow.duration).toBe(8);
  });

  it('reads capo only when it is a positive integer', () => {
    expect(parseChordPro('{capo: 2}\n[C]Hi', 'a.cho', DEFAULT_PREFERENCES).capo).toBe(2);
    expect(parseChordPro('{capo: 0}\n[C]Hi', 'a.cho', DEFAULT_PREFERENCES).capo).toBeUndefined();
    expect(parseChordPro('{capo: x}\n[C]Hi', 'a.cho', DEFAULT_PREFERENCES).capo).toBeUndefined();
  });

  it('skips comments and section directives', () => {
    const song = parseChordPro(
      '{start_of_chorus}\n# a comment\n[C]Hello\n{end_of_chorus}\n{comment: note}',
      'sections.cho',
      DEFAULT_PREFERENCES,
    );
    expect(song.lyrics).toBe('Hello');
    expect(song.segments).toHaveLength(1);
  });

  it('reads chord-only lines and normalizes CRLF', () => {
    const song = parseChordPro('C G\r\nD F\r\n', 'chords.cho', DEFAULT_PREFERENCES);
    expect(song.lyrics).toBe('');
    expect(song.segments).toHaveLength(4);
    expect(song.segments.map((segment) => segment.chord?.raw)).toEqual(['C', 'G', 'D', 'F']);
  });

  it('keeps inline chords aligned with their lyrics', () => {
    const song = parseChordPro('[C]Hello [G]world\nplain line', 'inline.cho', DEFAULT_PREFERENCES);
    expect(song.lyrics).toBe('Hello world\nplain line');
    expect(song.segments).toHaveLength(2);
  });

  it('uses the title directive and accepts the short form', () => {
    expect(parseChordPro('{t: Short}\n[C]Hi', 'x.cho', DEFAULT_PREFERENCES).title).toBe('Short');
  });
});
