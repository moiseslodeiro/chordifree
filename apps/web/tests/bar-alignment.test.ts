import { describe, expect, it } from 'vitest';
import { parseChord, type ChordSegment } from '@chordifree/chords';
import { chooseBarAlignment } from '../src/grid/barAlignment';

function segment(start: number, end: number, label: string): ChordSegment {
  return { start, end, chord: parseChord(label) };
}

describe('chooseBarAlignment', () => {
  it('prefiere mitad de tempo en canciones detectadas al doble', () => {
    const beats = Array.from({ length: 32 }, (_, index) => index * 0.5);
    const segments = [
      segment(0, 4, 'A'),
      segment(4, 8, 'E'),
      segment(8, 12, 'F#m'),
      segment(12, 16, 'D'),
    ];

    const alignment = chooseBarAlignment(segments, beats, 4, 16, 'auto');

    expect(alignment.factor).toBe('half');
    expect(alignment.barSeconds).toBeCloseTo(4);
    expect(alignment.bars.map((bar) => bar.chord?.root)).toEqual([9, 4, 6, 2]);
  });

  it('mantiene el tempo normal cuando ya está en un rango lento', () => {
    const beats = Array.from({ length: 16 }, (_, index) => index);
    const segments = [
      segment(0, 4, 'A'),
      segment(4, 8, 'E'),
      segment(8, 12, 'F#m'),
      segment(12, 16, 'D'),
    ];

    const alignment = chooseBarAlignment(segments, beats, 4, 16, 'auto');

    expect(alignment.factor).toBe('normal');
    expect(alignment.bars.map((bar) => bar.chord?.root)).toEqual([9, 4, 6, 2]);
  });

  it('elige la fase que alinea los cambios con los inicios de compás', () => {
    const beats = Array.from({ length: 32 }, (_, index) => index * 0.5);
    const segments = [
      segment(1, 5, 'C'),
      segment(5, 9, 'G'),
      segment(9, 13, 'Am'),
      segment(13, 16, 'F'),
    ];

    const alignment = chooseBarAlignment(segments, beats, 4, 16, 'half');

    expect(alignment.factor).toBe('half');
    expect(alignment.phase).toBe(1);
    expect(alignment.bars.map((bar) => bar.chord?.root)).toEqual([0, 7, 9, 5]);
  });

  it('permite forzar tempo normal o mitad', () => {
    const beats = Array.from({ length: 32 }, (_, index) => index * 0.5);
    const segments = [segment(0, 8, 'C'), segment(8, 16, 'G')];

    expect(chooseBarAlignment(segments, beats, 4, 16, 'normal').factor).toBe('normal');
    expect(chooseBarAlignment(segments, beats, 4, 16, 'half').factor).toBe('half');
  });
});
