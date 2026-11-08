import { describe, expect, it } from 'vitest';
import { clampTranspose, transposeChord } from '../src/transpose';
import { parseChord } from '../src/parse';
import { formatChord } from '../src/format';

const chord = (label: string) => {
  const parsed = parseChord(label);
  if (!parsed) throw new Error(`No se pudo parsear ${label}`);
  return parsed;
};

describe('transposeChord', () => {
  it('traspone la fundamental', () => {
    expect(formatChord(transposeChord(chord('C'), 2))).toBe('D');
    expect(formatChord(transposeChord(chord('Am'), 2))).toBe('Bm');
    expect(formatChord(transposeChord(chord('F'), 2))).toBe('G');
  });

  it('envuelve la octava', () => {
    expect(formatChord(transposeChord(chord('B'), 1))).toBe('C');
    expect(formatChord(transposeChord(chord('C'), -1))).toBe('B');
  });

  it('traspone también el bajo', () => {
    expect(formatChord(transposeChord(chord('C/G'), 2))).toBe('D/A');
    expect(formatChord(transposeChord(chord('Am/C'), -2), 'english', 'flat')).toBe('Gm/B♭');
  });

  it('mantiene el bajo al trasponer', () => {
    const transposed = transposeChord(chord('C/E'), 4);
    expect(transposed.bass).toBe(8);
    expect(formatChord(transposed)).toBe('E/G#');
  });

  it('mantiene la cualidad y descarta la etiqueta original', () => {
    const transposed = transposeChord(chord('C#m7b5'), 3);
    expect(transposed.quality).toBe('m7b5');
    expect(transposed.raw).toBeUndefined();
  });

  it('limita el rango de trasposición', () => {
    expect(clampTranspose(20)).toBe(11);
    expect(clampTranspose(-20)).toBe(-11);
    expect(clampTranspose(Number.NaN)).toBe(0);
    expect(clampTranspose(3.9)).toBe(3);
  });
});
