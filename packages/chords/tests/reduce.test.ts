import { describe, expect, it } from 'vitest';
import { parseChord, reduceChordSegments, type ChordSegment } from '../src';

function segment(start: number, end: number, chord: string | null): ChordSegment {
  return { start, end, chord: chord === null ? null : parseChord(chord) };
}

const beats = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

describe('reduceChordSegments', () => {
  it('simplifica la calidad y agrupa acordes consecutivos iguales', () => {
    const result = reduceChordSegments(
      [segment(0, 2, 'Cmaj7'), segment(2, 4, 'C'), segment(4, 8, 'Am7')],
      beats,
    );

    expect(result.map((item) => [item.start, item.end, item.chord?.root])).toEqual([
      [0, 4, 0],
      [4, 8, 9],
    ]);
    expect(result[1]?.chord?.quality).toBe('minor');
  });

  it('absorbe un acorde de paso más breve que medio pulso', () => {
    const result = reduceChordSegments(
      [segment(0, 4, 'C'), segment(4, 4.4, 'G'), segment(4.4, 8, 'Am')],
      beats,
    );

    expect(result.map((item) => [item.start, item.end, item.chord?.root])).toEqual([
      [0, 4.4, 0],
      [4.4, 8, 9],
    ]);
  });

  it('absorbe un acorde de paso que dura una pulsación entre acordes más largos', () => {
    const result = reduceChordSegments(
      [segment(0, 4, 'C'), segment(4, 5, 'G'), segment(5, 9, 'Am')],
      beats,
    );

    expect(result.map((item) => [item.start, item.end, item.chord?.root])).toEqual([
      [0, 5, 0],
      [5, 9, 9],
    ]);
  });

  it('conserva los acordes que duran más de una pulsación', () => {
    const result = reduceChordSegments(
      [segment(0, 4, 'C'), segment(4, 5.5, 'G'), segment(5.5, 9, 'Am')],
      beats,
    );

    expect(result.map((item) => item.chord?.root)).toEqual([0, 7, 9]);
  });

  it('conserva una progresión con cambios en cada pulsación', () => {
    const result = reduceChordSegments(
      [segment(0, 1, 'C'), segment(1, 2, 'G'), segment(2, 3, 'Am'), segment(3, 4, 'F')],
      beats,
    );

    expect(result.map((item) => item.chord?.root)).toEqual([0, 7, 9, 5]);
  });

  it('absorbe en el siguiente cuando es el vecino más largo', () => {
    const result = reduceChordSegments(
      [segment(0, 1, 'C'), segment(1, 1.4, 'G'), segment(1.4, 10, 'Am')],
      beats,
    );

    expect(result.map((item) => [item.start, item.end, item.chord?.root])).toEqual([
      [0, 1, 0],
      [1, 10, 9],
    ]);
  });

  it('conserva un acorde breve si no tiene vecinos estables', () => {
    const result = reduceChordSegments([segment(0, 0.5, 'G')], beats);

    expect(result).toHaveLength(1);
    expect(result[0]?.chord?.root).toBe(7);
  });

  it('usa un pulso de reserva cuando no hay pulsos', () => {
    const result = reduceChordSegments(
      [segment(0, 4, 'C'), segment(4, 4.5, 'G'), segment(4.5, 9, 'Am')],
      [],
    );

    expect(result.map((item) => [item.start, item.end, item.chord?.root])).toEqual([
      [0, 4, 0],
      [4, 9, 9],
    ]);
  });

  it('conserva los silencios explícitos', () => {
    const result = reduceChordSegments(
      [segment(0, 4, 'C'), segment(4, 8, null), segment(8, 12, 'G')],
      beats,
    );

    expect(result.map((item) => item.chord?.root ?? null)).toEqual([0, null, 7]);
  });

  it('es idempotente y no muta la entrada', () => {
    const input = [segment(0, 4, 'Cmaj7'), segment(4, 4.5, 'G'), segment(4.5, 8, 'Am7')];
    const snapshot = JSON.parse(JSON.stringify(input)) as ChordSegment[];

    const once = reduceChordSegments(input, beats);
    const twice = reduceChordSegments(once, beats);

    expect(twice).toEqual(once);
    expect(input).toEqual(snapshot);
  });

  it('devuelve una lista vacía sin segmentos', () => {
    expect(reduceChordSegments([], beats)).toEqual([]);
  });

  it('en modo máximo deja un acorde por compás', () => {
    const result = reduceChordSegments(
      [segment(0, 2, 'C'), segment(2, 4, 'G'), segment(4, 6, 'Am'), segment(6, 8, 'F')],
      beats,
      'max',
    );

    expect(result.map((item) => [item.start, item.end, item.chord?.root])).toEqual([
      [0, 4, 0],
      [4, 8, 9],
    ]);
  });

  it('en modo máximo fusiona compases consecutivos con el mismo acorde', () => {
    const result = reduceChordSegments(
      [segment(0, 2, 'C'), segment(2, 4, 'G'), segment(4, 6, 'C')],
      beats,
      'max',
    );

    expect(result.map((item) => [item.start, item.end, item.chord?.root])).toEqual([[0, 6, 0]]);
  });
});
