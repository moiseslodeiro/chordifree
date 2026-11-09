import { parseChord } from '@chordifree/chords';
import { songFromResult, type AnalysisResult, type Preferences, type Song } from './types';

export const DEMO_AUDIO_URL = '/demo.wav';

const DEMO_RESULT: AnalysisResult = {
  source: { type: 'upload', filename: 'demo.wav' },
  duration: 8,
  segments: [
    { start: 0, end: 2, chord: parseChord('C'), confidence: 0.9 },
    { start: 2, end: 4, chord: parseChord('G'), confidence: 0.9 },
    { start: 4, end: 6, chord: parseChord('Am'), confidence: 0.9 },
    { start: 6, end: 8, chord: parseChord('F'), confidence: 0.9 },
  ],
  // Curated grid: the demo is a controlled fixture, so the first beat is 0
  // and each chord starts exactly on a bar. The analyzer's first detected
  // beat can be off by one beat and would make the demo look wrong.
  beats: [
    0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5,
    4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5,
  ],
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
