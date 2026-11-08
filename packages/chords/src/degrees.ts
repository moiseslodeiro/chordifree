import { mod12 } from './notes';
import type { Chord, ChordSegment, EstimatedKey, Quality } from './types';

/** Sufijo de extensión para el grado romano. */
const QUALITY_SUFFIX: Record<Quality, string> = {
  major: '',
  minor: '',
  dim: '°',
  aug: '+',
  sus2: 'sus2',
  sus4: 'sus4',
  power: '5',
  '6': '6',
  m6: '6',
  '7': '7',
  maj7: 'maj7',
  m7: '7',
  dim7: '°7',
  m7b5: 'ø7',
  '7sus4': '7sus4',
  add9: 'add9',
  '9': '9',
  maj9: 'maj9',
  m9: '9',
  '11': '11',
  m11: '11',
  '13': '13',
  m13: '13',
  '6/9': '6/9',
};

const LOWER_CASE: ReadonlySet<Quality> = new Set<Quality>([
  'minor',
  'm6',
  'm7',
  'm9',
  'm11',
  'm13',
  'dim',
  'dim7',
  'm7b5',
]);

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

interface DegreePosition {
  degree: number;
  accidental: '' | '♭' | '♯';
}

/** Grado y alteración de cada una de las doce clases de altura en modo mayor. */
const MAJOR_DEGREES: readonly DegreePosition[] = [
  { degree: 1, accidental: '' },
  { degree: 2, accidental: '♭' },
  { degree: 2, accidental: '' },
  { degree: 3, accidental: '♭' },
  { degree: 3, accidental: '' },
  { degree: 4, accidental: '' },
  { degree: 4, accidental: '♯' },
  { degree: 5, accidental: '' },
  { degree: 6, accidental: '♭' },
  { degree: 6, accidental: '' },
  { degree: 7, accidental: '♭' },
  { degree: 7, accidental: '' },
];

/** Grado y alteración en modo menor natural, con las alteraciones usuales. */
const MINOR_DEGREES: readonly DegreePosition[] = [
  { degree: 1, accidental: '' },
  { degree: 2, accidental: '♭' },
  { degree: 2, accidental: '' },
  { degree: 3, accidental: '' },
  { degree: 3, accidental: '♯' },
  { degree: 4, accidental: '' },
  { degree: 4, accidental: '♯' },
  { degree: 5, accidental: '' },
  { degree: 6, accidental: '' },
  { degree: 6, accidental: '♯' },
  { degree: 7, accidental: '' },
  { degree: 7, accidental: '♯' },
];

function degreePosition(pitch: number, key: EstimatedKey): DegreePosition {
  const diff = mod12(pitch - key.tonic);
  const table = key.mode === 'major' ? MAJOR_DEGREES : MINOR_DEGREES;
  return table[diff] ?? MAJOR_DEGREES[0]!;
}

/** Devuelve el grado romano de un acorde respecto a la tonalidad indicada. */
export function chordDegree(chord: Chord, key: EstimatedKey): string {
  const position = degreePosition(chord.root, key);
  const roman = ROMAN[position.degree - 1] ?? 'I';
  const numeral = LOWER_CASE.has(chord.quality) ? roman.toLowerCase() : roman;
  const suffix = QUALITY_SUFFIX[chord.quality] ?? '';
  const bass =
    chord.bass === undefined
      ? ''
      : (() => {
          const bassPosition = degreePosition(chord.bass, key);
          return `/${bassPosition.accidental}${ROMAN[bassPosition.degree - 1] ?? 'I'}`;
        })();

  return `${position.accidental}${numeral}${suffix}${bass}`;
}

/** Lista de grados en orden de aparición, colapsando repeticiones consecutivas. */
export function progressionDegrees(
  segments: ChordSegment[],
  key: EstimatedKey,
  limit = 16,
): string[] {
  const degrees: string[] = [];
  for (const segment of segments) {
    if (!segment.chord) continue;
    const degree = chordDegree(segment.chord, key);
    if (degrees[degrees.length - 1] === degree) continue;
    degrees.push(degree);
    if (degrees.length >= limit) break;
  }
  return degrees;
}
