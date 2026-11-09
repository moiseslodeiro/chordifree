import { describe, expect, it } from 'vitest';
import { parseChord, type ChordSegment } from '@chordifree/chords';
import { buildChordPro } from '../src/lib/chordpro';

const segments: ChordSegment[] = [
  { start: 0, end: 2, chord: parseChord('C') },
  { start: 2, end: 4, chord: parseChord('G') },
];

describe('buildChordPro', () => {
  it('writes metadata and places chords over the lyrics', () => {
    const content = buildChordPro({
      title: 'Demo song',
      artist: 'Chordifree',
      key: { tonic: 0, mode: 'major' },
      tempo: 120,
      lyrics: 'Hello world',
      segments,
      beats: [0, 1, 2, 3],
      beatsPerBar: 4,
      duration: 4,
      notation: 'english',
      accidental: 'sharp',
    });

    expect(content).toContain('{title: Demo song}');
    expect(content).toContain('{artist: Chordifree}');
    expect(content).toContain('{key: C}');
    expect(content).toContain('{tempo: 120}');
    expect(content).toContain('[C]Hello [G]world');
  });

  it('falls back to a bar grid when there are no lyrics', () => {
    const content = buildChordPro({
      title: 'Instrumental',
      segments: [
        { start: 0, end: 4, chord: parseChord('C') },
        { start: 4, end: 8, chord: parseChord('G') },
      ],
      beats: [0, 1, 2, 3, 4, 5, 6, 7],
      beatsPerBar: 4,
      duration: 8,
      notation: 'english',
      accidental: 'sharp',
    });

    expect(content).toContain('| C | G |');
  });
});
