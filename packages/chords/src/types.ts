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
  /** Fundamental como clase de altura, 0 = C. */
  root: PitchClass;
  quality: Quality;
  /** Bajo invertido, solo presente cuando difiere de la fundamental. */
  bass?: PitchClass;
  /** Etiqueta original, únicamente para depuración. */
  raw?: string;
}

export interface ChordSegment {
  /** Inicio en segundos. */
  start: number;
  /** Fin en segundos. */
  end: number;
  /** null representa silencio o ausencia de acorde detectable. */
  chord: Chord | null;
  /** Confianza opcional entre 0 y 1. */
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
