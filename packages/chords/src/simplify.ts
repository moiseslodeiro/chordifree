import type { Chord, Quality } from './types';

/**
 * Reference quality for the visual simplification mode.
 * Tensions, ninths, elevenths, thirteenths and suspensions are reduced to their
 * triad. The dominant seventh is kept because it defines the function of the
 * chord (for example, `G7` → `G7`, not `G`) and is common in the progressions
 * that the analyzer recognizes.
 */
const SIMPLIFIED_QUALITY: Record<Quality, Quality> = {
  major: 'major',
  maj7: 'major',
  maj9: 'major',
  '6': 'major',
  '6/9': 'major',
  add9: 'major',
  '9': 'major',
  '11': 'major',
  '13': 'major',
  '7': '7',
  '7sus4': 'major',
  sus2: 'major',
  sus4: 'major',
  minor: 'minor',
  m7: 'minor',
  m9: 'minor',
  m11: 'minor',
  m13: 'minor',
  m6: 'minor',
  dim: 'dim',
  dim7: 'dim',
  m7b5: 'dim',
  aug: 'aug',
  power: 'power',
};

/**
 * Returns the simplified chord for display. Does not modify the original and
 * removes the inverted bass, so `C/G` becomes `C`.
 */
export function simplifyChord(chord: Chord): Chord {
  const simplified: Chord = {
    root: chord.root,
    quality: SIMPLIFIED_QUALITY[chord.quality],
  };
  if (chord.raw !== undefined) simplified.raw = chord.raw;
  return simplified;
}
