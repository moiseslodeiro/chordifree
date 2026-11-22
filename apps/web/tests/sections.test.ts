import { describe, expect, it } from 'vitest';
import type { Chord } from '@chordifree/chords';
import {
  activeSectionAt,
  detectSections,
  nextSection,
  previousSection,
} from '../src/sections/detect';
import type { Song } from '../src/types';

const C: Chord = { root: 0, quality: 'major' };
const G: Chord = { root: 7, quality: 'major' };
const Am: Chord = { root: 9, quality: 'minor' };
const F: Chord = { root: 5, quality: 'major' };

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 'song-1',
    title: 'My song',
    source: { type: 'youtube', videoId: 'dQw4w9WgXcQ' },
    duration: 180,
    segments: [
      { start: 0, end: 8, chord: C },
      { start: 8, end: 16, chord: G },
      { start: 16, end: 24, chord: Am },
      { start: 24, end: 32, chord: F },
    ],
    detectedSegments: [],
    beats: Array.from({ length: 89 }, (_, index) => index * 2),
    beatsPerBar: 4,
    vocalRegions: [],
    analyzerVersion: 'essentia-test',
    transpose: 0,
    notation: 'english',
    accidentalPreference: 'sharp',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('detectSections', () => {
  it('detects the intro before the first sung block', () => {
    const sections = detectSections(
      makeSong({ vocalRegions: [{ start: 16, end: 32 }], duration: 40 }),
    );
    expect(sections[0]).toEqual({ label: 'intro', start: 0, end: 16 });
    expect(sections).toContainEqual({ label: 'verse', start: 16, end: 32 });
    expect(sections.at(-1)).toEqual({ label: 'outro', start: 32, end: 40 });
  });

  it('marks every repetition of the chorus block as the chorus', () => {
    // Verse: C-G, chorus: Am-F, repeated twice.
    const sections = detectSections(
      makeSong({
        duration: 80,
        beats: Array.from({ length: 41 }, (_, index) => index * 2),
        segments: [
          { start: 0, end: 8, chord: C },
          { start: 8, end: 16, chord: G },
          { start: 20, end: 28, chord: Am },
          { start: 28, end: 36, chord: F },
          { start: 40, end: 48, chord: C },
          { start: 48, end: 56, chord: G },
          { start: 60, end: 68, chord: Am },
          { start: 68, end: 76, chord: F },
        ],
        vocalRegions: [
          { start: 0, end: 16 },
          { start: 20, end: 36 },
          { start: 40, end: 56 },
          { start: 60, end: 76 },
        ],
      }),
    );
    expect(sections.filter((section) => section.label === 'chorus')).toHaveLength(2);
    expect(sections.filter((section) => section.label === 'verse')).toHaveLength(2);
  });

  it('snaps the section edges to bar lines', () => {
    const sections = detectSections(
      makeSong({
        vocalRegions: [{ start: 9, end: 35 }],
        duration: 48,
        beats: Array.from({ length: 25 }, (_, index) => index * 2),
      }),
    );
    expect(sections[0]).toEqual({ label: 'intro', start: 0, end: 8 });
    expect(sections).toContainEqual({ label: 'verse', start: 8, end: 40 });
    expect(sections).toContainEqual({ label: 'outro', start: 40, end: 48 });
  });

  it('fills long instrumental gaps between sung blocks', () => {
    const sections = detectSections(
      makeSong({
        vocalRegions: [
          { start: 0, end: 16 },
          { start: 40, end: 56 },
        ],
        duration: 56,
      }),
    );
    expect(sections.map((section) => section.label)).toEqual(['verse', 'instrumental', 'verse']);
  });

  it('returns nothing without vocal regions', () => {
    expect(detectSections(makeSong())).toEqual([]);
  });

  it('keeps sections sorted and inside the song', () => {
    const sections = detectSections(
      makeSong({
        vocalRegions: [
          { start: 0, end: 32 },
          { start: 48, end: 96 },
        ],
        duration: 96,
      }),
    );
    let previous = 0;
    for (const section of sections) {
      expect(section.start).toBeGreaterThanOrEqual(previous);
      expect(section.end).toBeLessThanOrEqual(96);
      expect(section.end).toBeGreaterThan(section.start);
      previous = section.start;
    }
  });
});

describe('section navigation', () => {
  const sections = [
    { label: 'verse', start: 0, end: 30 },
    { label: 'chorus', start: 30, end: 60 },
    { label: 'verse', start: 60, end: 90 },
  ];

  it('finds the active, next and previous section', () => {
    expect(activeSectionAt(sections, 45)?.label).toBe('chorus');
    expect(nextSection(sections, 45)?.start).toBe(60);
    // Deep inside a section, previous restarts it; near its start it jumps back.
    expect(previousSection(sections, 45)?.start).toBe(30);
    expect(previousSection(sections, 31)?.start).toBe(0);
    expect(previousSection(sections, 3)?.start).toBe(0);
    expect(previousSection(sections, 65)?.start).toBe(60);
    expect(nextSection(sections, 95)).toBeNull();
  });
});
