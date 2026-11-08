import { describe, expect, it } from 'vitest';
import {
  chordEquals,
  findActiveSegmentIndex,
  normalizeSegments,
  totalDuration,
} from '../src/segments';
import { parseChord } from '../src/parse';
import type { ChordSegment } from '../src/types';

const c = parseChord('C');
const g = parseChord('G');
const am = parseChord('Am');

const seg = (start: number, end: number, chord: ChordSegment['chord']): ChordSegment => ({
  start,
  end,
  chord,
});

describe('normalizeSegments', () => {
  it('ordena, recorta y cubre la duración completa', () => {
    const result = normalizeSegments([seg(4, 8, g), seg(0, 4, c)], 8);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ start: 0, end: 4 });
    expect(result[1]).toMatchObject({ start: 4, end: 8 });
    expect(result[result.length - 1]?.end).toBe(8);
  });

  it('fusiona acordes iguales consecutivos', () => {
    const result = normalizeSegments([seg(0, 2, c), seg(2, 4, c), seg(4, 8, g)], 8);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ start: 0, end: 4 });
  });

  it('absorbe segmentos más cortos que la duración mínima', () => {
    const result = normalizeSegments([seg(0, 4, c), seg(4, 4.1, g), seg(4.1, 8, c)], 8);
    expect(result).toHaveLength(1);
    expect(result[0]?.chord).toMatchObject({ root: 0 });
    expect(result[0]).toMatchObject({ start: 0, end: 8 });
  });

  it('rellena huecos con silencio', () => {
    const result = normalizeSegments([seg(2, 4, c)], 8);
    expect(result.map((item) => item.chord)).toEqual([null, c, null]);
    expect(result[0]).toMatchObject({ start: 0, end: 2 });
    expect(result[2]).toMatchObject({ start: 4, end: 8 });
  });

  it('resuelve solapamientos', () => {
    const result = normalizeSegments([seg(0, 5, c), seg(3, 8, g)], 8);
    expect(result).toHaveLength(2);
    expect(result[1]?.start).toBe(5);
    expect(result.every((item) => item.start < item.end)).toBe(true);
  });

  it('convierte N en silencio y mantiene cobertura', () => {
    const result = normalizeSegments([seg(0, 4, null), seg(4, 8, c)], 8);
    expect(result[0]?.chord).toBeNull();
    expect(result[1]?.chord).toMatchObject({ root: 0 });
  });

  it('devuelve una lista vacía para duraciones inválidas', () => {
    expect(normalizeSegments([seg(0, 4, c)], 0)).toEqual([]);
    expect(normalizeSegments([seg(0, 4, c)], Number.NaN)).toEqual([]);
  });

  it('cubre toda la duración cuando no hay segmentos', () => {
    expect(normalizeSegments([], 10)).toEqual([{ start: 0, end: 10, chord: null }]);
  });
});

describe('findActiveSegmentIndex', () => {
  const segments = [seg(0, 4, c), seg(4, 8, g), seg(8, 12, am)];

  it('encuentra el segmento activo', () => {
    expect(findActiveSegmentIndex(segments, 0)).toBe(0);
    expect(findActiveSegmentIndex(segments, 3.9)).toBe(0);
    expect(findActiveSegmentIndex(segments, 4)).toBe(1);
    expect(findActiveSegmentIndex(segments, 11.9)).toBe(2);
  });

  it('devuelve -1 fuera de rango o sin segmentos', () => {
    expect(findActiveSegmentIndex(segments, -1)).toBe(-1);
    expect(findActiveSegmentIndex(segments, 12.5)).toBe(-1);
    expect(findActiveSegmentIndex([], 1)).toBe(-1);
  });

  it('admite el final exacto del último segmento', () => {
    expect(findActiveSegmentIndex(segments, 12)).toBe(2);
  });
});

describe('utilidades', () => {
  it('compara acordes', () => {
    expect(chordEquals(c, parseChord('C'))).toBe(true);
    expect(chordEquals(c, g)).toBe(false);
    expect(chordEquals(null, null)).toBe(true);
    expect(chordEquals(null, c)).toBe(false);
  });

  it('calcula la duración total', () => {
    expect(totalDuration([seg(0, 4, c), seg(4, 9, g)])).toBe(9);
  });
});
