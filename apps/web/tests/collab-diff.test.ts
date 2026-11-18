import { describe, expect, it } from 'vitest';
import { formatChordOrSilence } from '@chordifree/chords';
import { diffLines, diffSongs } from '../src/collab/diff';
import type { Song } from '../src/types';

const format = (chord: Parameters<typeof formatChordOrSilence>[0]) =>
  formatChordOrSilence(chord, 'english', 'sharp');

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 'song-1',
    title: 'My song',
    source: { type: 'youtube', videoId: 'dQw4w9WgXcQ' },
    duration: 120,
    segments: [
      { start: 0, end: 4, chord: { root: 0, quality: 'major' } },
      { start: 4, end: 8, chord: { root: 7, quality: 'major' } },
    ],
    detectedSegments: [],
    analyzerVersion: 'essentia-1.6',
    transpose: 0,
    notation: 'english',
    accidentalPreference: 'sharp',
    createdAt: '2026-11-18T10:00:00.000Z',
    updatedAt: '2026-11-18T10:00:00.000Z',
    ...overrides,
  };
}

describe('diffLines', () => {
  it('reports added, removed and changed lyric lines', () => {
    expect(diffLines('one\ntwo', 'one\nthree')).toEqual([
      { type: 'changed', before: 'two', after: 'three' },
    ]);
    expect(diffLines('one', 'one\ntwo')).toEqual([{ type: 'added', after: 'two' }]);
    expect(diffLines('one\ntwo', 'one')).toEqual([{ type: 'removed', before: 'two' }]);
    expect(diffLines('same', 'same')).toEqual([]);
  });
});

describe('diffSongs', () => {
  it('detects chord, lyric and detail changes', () => {
    const before = makeSong({ lyrics: 'hello' });
    const after = makeSong({
      title: 'Renamed',
      capo: 2,
      lyrics: 'hello\nworld',
      segments: [
        { start: 0, end: 4, chord: { root: 0, quality: 'major' } },
        { start: 4, end: 8, chord: { root: 9, quality: 'minor' } },
      ],
    });

    const diff = diffSongs(before, after, format);
    expect(diff.chords).toEqual([{ index: 1, start: 4, before: 'G', after: 'Am' }]);
    expect(diff.lyrics).toEqual([{ type: 'added', after: 'world' }]);
    expect(diff.fields.map((field) => field.label)).toEqual(['title', 'capo']);
    expect(diff.empty).toBe(false);
  });

  it('is empty when both versions match', () => {
    const song = makeSong({ lyrics: 'hello' });
    expect(diffSongs(song, song, format).empty).toBe(true);
  });
});
