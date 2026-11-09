import { parseChord } from '@chordifree/chords';
import { songFromResult, type AnalysisResult, type Preferences, type Song } from './types';

export const DEMO_AUDIO_URL = '/demo.wav';

const DEMO_RESULT: AnalysisResult = {
  source: { type: 'upload', filename: 'demo.wav' },
  duration: 8,
  segments: [
    { start: 0.49, end: 2.0, chord: parseChord('C'), confidence: 0.8 },
    { start: 2.0, end: 3.99, chord: parseChord('G'), confidence: 0.79 },
    { start: 3.99, end: 6.01, chord: parseChord('Am'), confidence: 0.76 },
    { start: 6.01, end: 8.0, chord: parseChord('F'), confidence: 0.8 },
  ],
  beats: [0.488, 0.987, 1.486, 1.997, 2.496, 2.995, 3.495, 3.994, 4.493, 4.992, 5.503, 6.014, 6.502, 7.001, 7.5],
  beatsPerBar: 4,
  vocalRegions: [],
  analyzerVersion: 'essentia-1.6',
  createdAt: '2026-01-01T00:00:00.000Z',
};

/**
 * Built-in demo so a first-time visitor can try the grid, lyrics and A-B
 * practice without providing a YouTube link or an audio file.
 */
export function createDemoSong(preferences: Preferences): Song {
  const song = songFromResult(DEMO_RESULT, preferences);
  return {
    ...song,
    id: 'demo',
    title: 'Chordifree demo · C G Am F',
    lyrics: [
      'This is the Chordifree demo',
      'Four chords: C, G, Am and F',
      'Try the grid and the lyrics view',
      'Then mark A and B to practice',
    ].join('\n'),
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}
