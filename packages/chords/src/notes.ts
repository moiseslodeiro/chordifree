import type { Accidental, Notation, PitchClass } from './types';

export const PITCH_CLASS_COUNT = 12;

export const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const FLAT_NAMES = [
  'C',
  'D♭',
  'D',
  'E♭',
  'E',
  'F',
  'G♭',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
];
export const SPANISH_SHARP_NAMES = [
  'Do',
  'Do♯',
  'Re',
  'Re♯',
  'Mi',
  'Fa',
  'Fa♯',
  'Sol',
  'Sol♯',
  'La',
  'La♯',
  'Si',
];
export const SPANISH_FLAT_NAMES = [
  'Do',
  'Re♭',
  'Re',
  'Mi♭',
  'Mi',
  'Fa',
  'Sol♭',
  'Sol',
  'La♭',
  'La',
  'Si♭',
  'Si',
];

export function mod12(value: number): PitchClass {
  return (((value % 12) + 12) % 12) as PitchClass;
}

export function noteName(
  pitchClass: PitchClass,
  notation: Notation = 'english',
  accidental: Accidental = 'sharp',
): string {
  const names =
    notation === 'spanish'
      ? accidental === 'flat'
        ? SPANISH_FLAT_NAMES
        : SPANISH_SHARP_NAMES
      : accidental === 'flat'
        ? FLAT_NAMES
        : SHARP_NAMES;
  return names[pitchClass] ?? names[0];
}
