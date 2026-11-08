import type { Chord, Quality } from './types';

/**
 * Cualidad de referencia para el modo de simplificación visual.
 * Las tensiones, novenas, oncenas, trecenas y suspensiones se reducen a su
 * tríada. La séptima de dominante se conserva porque define la función del
 * acorde (por ejemplo, `G7` → `G7`, no `G`) y es habitual en las progresiones
 * que el analizador reconoce.
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
 * Devuelve el acorde simplificado para mostrarlo. No modifica el original y
 * elimina el bajo invertido, de modo que `C/G` se convierte en `C`.
 */
export function simplifyChord(chord: Chord): Chord {
  const simplified: Chord = {
    root: chord.root,
    quality: SIMPLIFIED_QUALITY[chord.quality],
  };
  if (chord.raw !== undefined) simplified.raw = chord.raw;
  return simplified;
}
