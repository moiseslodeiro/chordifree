import { describe, expect, it } from 'vitest';
import { parseChord, reduceChordSegments, type ChordSegment } from '../src';

function segment(start: number, end: number, chord: string | null): ChordSegment {
  return { start, end, chord: chord === null ? null : parseChord(chord) };
}

const beats = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

describe('reduceChordSegments', () => {
  it('simplifies the quality and groups consecutive equal chords', () => {
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

  it('absorbs a passing chord shorter than half a beat', () => {
    const result = reduceChordSegments(
      [segment(0, 4, 'C'), segment(4, 4.4, 'G'), segment(4.4, 8, 'Am')],
      beats,
    );

    expect(result.map((item) => [item.start, item.end, item.chord?.root])).toEqual([
      [0, 4.4, 0],
      [4.4, 8, 9],
    ]);
  });

  it('absorbs a passing chord that lasts one beat between longer chords', () => {
    const result = reduceChordSegments(
      [segment(0, 4, 'C'), segment(4, 5, 'G'), segment(5, 9, 'Am')],
      beats,
    );

    expect(result.map((item) => [item.start, item.end, item.chord?.root])).toEqual([
      [0, 5, 0],
      [5, 9, 9],
    ]);
  });

  it('keeps chords that last more than one beat', () => {
    const result = reduceChordSegments(
      [segment(0, 4, 'C'), segment(4, 5.5, 'G'), segment(5.5, 9, 'Am')],
      beats,
    );

    expect(result.map((item) => item.chord?.root)).toEqual([0, 7, 9]);
  });

  it('keeps a progression with changes on every beat', () => {
    const result = reduceChordSegments(
      [segment(0, 1, 'C'), segment(1, 2, 'G'), segment(2, 3, 'Am'), segment(3, 4, 'F')],
      beats,
    );

    expect(result.map((item) => item.chord?.root)).toEqual([0, 7, 9, 5]);
  });

  it('absorbs into the next chord when it is the longer neighbour', () => {
    const result = reduceChordSegments(
      [segment(0, 1, 'C'), segment(1, 1.4, 'G'), segment(1.4, 10, 'Am')],
      beats,
    );

    expect(result.map((item) => [item.start, item.end, item.chord?.root])).toEqual([
      [0, 1, 0],
      [1, 10, 9],
    ]);
  });

  it('keeps a short chord when it has no stable neighbours', () => {
    const result = reduceChordSegments([segment(0, 0.5, 'G')], beats);

    expect(result).toHaveLength(1);
    expect(result[0]?.chord?.root).toBe(7);
  });

  it('uses a fallback beat when there are no beats', () => {
    const result = reduceChordSegments(
      [segment(0, 4, 'C'), segment(4, 4.5, 'G'), segment(4.5, 9, 'Am')],
      [],
    );

    expect(result.map((item) => [item.start, item.end, item.chord?.root])).toEqual([
      [0, 4, 0],
      [4, 9, 9],
    ]);
  });

  it('keeps explicit silences', () => {
    const result = reduceChordSegments(
      [segment(0, 4, 'C'), segment(4, 8, null), segment(8, 12, 'G')],
      beats,
    );

    expect(result.map((item) => item.chord?.root ?? null)).toEqual([0, null, 7]);
  });

  it('is idempotent and does not mutate the input', () => {
    const input = [segment(0, 4, 'Cmaj7'), segment(4, 4.5, 'G'), segment(4.5, 8, 'Am7')];
    const snapshot = JSON.parse(JSON.stringify(input)) as ChordSegment[];

    const once = reduceChordSegments(input, beats);
    const twice = reduceChordSegments(once, beats);

    expect(twice).toEqual(once);
    expect(input).toEqual(snapshot);
  });

  it('returns an empty list without segments', () => {
    expect(reduceChordSegments([], beats)).toEqual([]);
  });

  it('in maximum mode leaves one chord per bar', () => {
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

  it('in maximum mode merges consecutive bars with the same chord', () => {
    const result = reduceChordSegments(
      [segment(0, 2, 'C'), segment(2, 4, 'G'), segment(4, 6, 'C')],
      beats,
      'max',
    );

    expect(result.map((item) => [item.start, item.end, item.chord?.root])).toEqual([[0, 6, 0]]);
  });

  it('in maximum mode respects time signatures other than 4/4', () => {
    const threeFour = [0, 1, 2, 3, 4, 5];
    const result = reduceChordSegments(
      [
        segment(0, 1.5, 'C'),
        segment(1.5, 3, 'G'),
        segment(3, 4.5, 'F'),
        segment(4.5, 6, 'C'),
      ],
      threeFour,
      'max',
      3,
    );

    expect(result.map((item) => [item.start, item.end, item.chord?.root])).toEqual([
      [0, 3, 0],
      [3, 6, 5],
    ]);
  });

  it('in maximum mode keeps the real start of the dominant chord', () => {
    const result = reduceChordSegments(
      [segment(0, 1.6, 'C'), segment(1.6, 4, 'G')],
      [0, 1, 2, 3],
      'max',
    );

    expect(result.map((item) => [item.start, item.end, item.chord?.root])).toEqual([
      [0, 1.6, 0],
      [1.6, 4, 7],
    ]);
  });
});
