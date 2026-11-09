import type { Chord, PitchClass } from '@chordifree/chords';

export type StringInstrument = 'guitar' | 'ukelele';
export type ShapeQuality = 'major' | 'minor' | 'dim' | 'aug' | 'power' | '7';

export interface StringShape {
  instrument: StringInstrument;
  /** Number of strings, from lowest to highest. */
  strings: number;
  /** Pitch class of each open string. */
  tuning: PitchClass[];
  /** Absolute fret of each string; -1 means a muted string. */
  frets: number[];
  /** Fret of the root on the root string. */
  rootFret: number;
  /** First fret shown by the diagram; 0 represents the nut. */
  baseFret: number;
  /** Number of frets drawn on the neck. */
  fretCount: number;
}

interface StringInstrumentSpec {
  strings: number;
  tuning: PitchClass[];
  rootString: number;
  shapes: Record<ShapeQuality, number[]>;
}

const GUITAR: StringInstrumentSpec = {
  strings: 6,
  // E2, A2, D3, G3, B3, E4.
  tuning: [4, 9, 2, 7, 11, 4],
  rootString: 0,
  shapes: {
    major: [0, 2, 2, 1, 0, 0],
    minor: [0, 2, 2, 0, 0, 0],
    dim: [0, 1, 2, 0, -1, 0],
    aug: [0, 3, 2, 1, 1, 0],
    power: [0, 2, 2, -1, -1, -1],
    '7': [0, 2, 0, 1, 0, 0],
  },
};

const UKELELE: StringInstrumentSpec = {
  strings: 4,
  // G4, C4, E4, A4 (standard reentrant tuning).
  tuning: [7, 0, 4, 9],
  rootString: 1,
  shapes: {
    major: [0, 0, 0, 3],
    minor: [0, 3, 3, 3],
    dim: [5, 0, 2, 6],
    aug: [1, 0, 0, 3],
    power: [0, 0, 3, 3],
    '7': [0, 0, 0, 1],
  },
};

const SHAPE_QUALITIES: ReadonlySet<string> = new Set([
  'major',
  'minor',
  'dim',
  'aug',
  'power',
  '7',
]);

function specFor(instrument: StringInstrument): StringInstrumentSpec {
  return instrument === 'guitar' ? GUITAR : UKELELE;
}

function rootFretFor(root: PitchClass, spec: StringInstrumentSpec): number {
  const open = spec.tuning[spec.rootString] ?? 0;
  return (((root - open) % 12) + 12) % 12;
}

/**
 * Resolves a movable shape for the chord. The qualities shown in
 * simplified form (`major`, `minor`, `dim`, `aug`, `power` and the dominant
 * seventh) have a fingering; the rest return `null` so the view
 * shows the corresponding notice.
 */
export function getStringShape(
  chord: Chord,
  instrument: StringInstrument,
): StringShape | null {
  if (!SHAPE_QUALITIES.has(chord.quality)) return null;
  const spec = specFor(instrument);
  const quality = chord.quality as ShapeQuality;
  const offsets = spec.shapes[quality];
  const rootFret = rootFretFor(chord.root, spec);
  const frets = offsets.map((offset) => (offset < 0 ? -1 : rootFret + offset));

  const positive = frets.filter((fret) => fret > 0);
  const minFret = positive.length > 0 ? Math.min(...positive) : 0;
  const maxFret = frets.reduce((max, fret) => Math.max(max, fret), 0);
  const baseFret = minFret <= 1 ? 0 : minFret;

  return {
    instrument,
    strings: spec.strings,
    tuning: spec.tuning,
    frets,
    rootFret,
    baseFret,
    fretCount: Math.max(4, maxFret - baseFret + 1),
  };
}

export interface PianoVoicing {
  /** Pitch classes of the chord, starting from the root. */
  pitchClasses: PitchClass[];
  /** MIDI notes in closed position from the root. */
  notes: number[];
}

const PIANO_INTERVALS: Record<ShapeQuality, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  power: [0, 7],
  '7': [0, 4, 7, 10],
};

/** Generates the piano voicing from the tones of the simplified chord. */
export function getPianoVoicing(chord: Chord): PianoVoicing | null {
  if (!SHAPE_QUALITIES.has(chord.quality)) return null;
  const intervals = PIANO_INTERVALS[chord.quality as ShapeQuality];
  const root = 60 + chord.root;
  const notes = intervals.map((interval) => root + interval);
  const pitchClasses = notes.map((note) => (note % 12) as PitchClass);
  return { pitchClasses, notes };
}
