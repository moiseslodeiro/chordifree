export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type Quality =
  | 'major'
  | 'minor'
  | 'dim'
  | 'aug'
  | 'sus2'
  | 'sus4'
  | 'power'
  | '6'
  | 'm6'
  | '7'
  | 'maj7'
  | 'm7'
  | 'dim7'
  | 'm7b5'
  | '7sus4'
  | 'add9'
  | '9'
  | 'maj9'
  | 'm9'
  | '11'
  | 'm11'
  | '13'
  | 'm13'
  | '6/9';

export interface Chord {
  /** Root as a pitch class, 0 = C. */
  root: PitchClass;
  quality: Quality;
  /** Inverted bass, only present when it differs from the root. */
  bass?: PitchClass;
  /** Original label, for debugging only. */
  raw?: string;
}

export interface ChordSegment {
  /** Start in seconds. */
  start: number;
  /** End in seconds. */
  end: number;
  /** null represents silence or no detectable chord. */
  chord: Chord | null;
  /** Optional confidence between 0 and 1. */
  confidence?: number;
}

export type Notation = 'english' | 'spanish';
export type AccidentalPreference = 'auto' | 'sharp' | 'flat';
export type Accidental = 'sharp' | 'flat';
export type KeyMode = 'major' | 'minor';

export interface EstimatedKey {
  tonic: PitchClass;
  mode: KeyMode;
}
