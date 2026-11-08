import { describe, expect, it } from 'vitest';
import { parseChord, type ChordSegment } from '@chordifree/chords';
import { buildBeatGrid, buildBeatRows, extendBeats, tempoFromBeats } from '../src/grid/beats';

const segments: ChordSegment[] = [
  { start: 0, end: 2.5, chord: parseChord('C') },
  { start: 2.5, end: 10, chord: parseChord('G') },
];

describe('buildBeatGrid', () => {
  it('agrupa los pulsos en compases completos de cuatro tiempos', () => {
    const bars = buildBeatGrid(segments, [0, 1, 2, 3, 4, 5, 6, 7]);
    expect(bars).toHaveLength(2);
    expect(bars[0]?.start).toBe(0);
    expect(bars[1]?.start).toBe(4);
    expect(bars[0]?.cells).toHaveLength(4);
    expect(bars[0]?.cells.every((cell) => cell !== null)).toBe(true);
  });

  it('rellena con celdas no focusables el último compás incompleto', () => {
    const bars = buildBeatGrid(segments, [0, 1, 2, 3, 4, 5]);
    expect(bars).toHaveLength(2);
    expect(bars[1]?.cells.map((cell) => cell?.time ?? null)).toEqual([4, 5, null, null]);
  });

  it('marca el cambio de acorde en el pulso correspondiente', () => {
    const changing: ChordSegment[] = [
      { start: 0, end: 1.5, chord: parseChord('C') },
      { start: 1.5, end: 10, chord: parseChord('G') },
    ];
    const bars = buildBeatGrid(changing, [0, 1, 2, 3, 4]);
    expect(bars[0]?.cells.map((cell) => cell?.change)).toEqual([true, false, true, false]);
    expect(bars[0]?.cells.map((cell) => cell?.chord?.quality ?? null)).toEqual([
      'major',
      'major',
      'major',
      'major',
    ]);
    expect(bars[0]?.cells[2]?.chord?.root).toBe(7);
  });

  it('muestra el silencio como ausencia explícita de acorde', () => {
    const withSilence: ChordSegment[] = [
      { start: 0, end: 2, chord: null },
      { start: 2, end: 10, chord: parseChord('C') },
    ];
    const bars = buildBeatGrid(withSilence, [0, 1, 2, 3]);
    expect(bars[0]?.cells[0]?.chord).toBeNull();
    expect(bars[0]?.cells[0]?.change).toBe(true);
    expect(bars[0]?.cells[1]?.change).toBe(false);
    expect(bars[0]?.cells[2]?.change).toBe(true);
  });

  it('devuelve una parrilla vacía sin pulsos', () => {
    expect(buildBeatGrid(segments, [])).toEqual([]);
  });

  it('sanea pulsos inválidos y usa cuatro tiempos por defecto', () => {
    const bars = buildBeatGrid(segments, [3, 0, 0, 1, -1, Number.NaN], 0);
    expect(bars).toHaveLength(1);
    expect(bars[0]?.cells.map((cell) => cell?.time ?? null)).toEqual([0, 1, 3, null]);
  });

  it('prolonga los pulsos incompletos hasta la duración con el intervalo mediano', () => {
    const bars = buildBeatGrid(segments, [0, 1, 2, 3, 4], 4, 9.5);
    const times = bars
      .flatMap((bar) => bar.cells)
      .filter((cell) => cell !== null)
      .map((cell) => cell.time);
    expect(times).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('no inventa pulsos cuando la lista llega vacía', () => {
    expect(buildBeatGrid(segments, [], 4, 120)).toEqual([]);
  });

  it('no prolonga si el último pulso ya cubre hasta la duración', () => {
    const bars = buildBeatGrid(segments, [0, 1, 2, 3], 4, 4);
    const times = bars.flatMap((bar) => bar.cells.map((cell) => cell?.time ?? null));
    expect(times).toEqual([0, 1, 2, 3]);
  });
});

describe('extendBeats', () => {
  it('prolonga con el intervalo mediano y es idempotente', () => {
    const once = extendBeats([0, 2, 4], 7);
    expect(once).toEqual([0, 2, 4, 6]);
    expect(extendBeats(once, 7)).toEqual(once);
  });

  it('devuelve la lista saneada sin duración', () => {
    expect(extendBeats([3, 0, 0, -1, Number.NaN])).toEqual([0, 3]);
  });

  it('reconstruye la rejilla con tempo constante y corrige el jitter', () => {
    expect(extendBeats([0, 1.1, 1.9, 3.1, 4], 6)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('tempoFromBeats', () => {
  it('estima los pulsos por minuto con la mediana de los intervalos', () => {
    expect(tempoFromBeats([0, 0.5, 1, 1.5, 2])).toBe(120);
    expect(tempoFromBeats([0, 1.2, 2.4, 3.6])).toBe(50);
  });

  it('devuelve null sin pulsos suficientes', () => {
    expect(tempoFromBeats([])).toBeNull();
    expect(tempoFromBeats([12])).toBeNull();
  });
});

describe('buildBeatRows', () => {
  const beats = Array.from({ length: 24 }, (_, index) => index);

  it('agrupa dos compases de cuatro tiempos en una fila de ocho celdas', () => {
    const rows = buildBeatRows(segments, beats, 4);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.cells).toHaveLength(8);
    expect(rows[0]?.bars).toHaveLength(2);
    expect(rows[0]?.start).toBe(0);
    expect(rows[0]?.barStarts).toEqual([0, 4]);
    expect(rows[1]?.start).toBe(8);
    expect(rows[1]?.barStarts).toEqual([8, 12]);
    expect(rows[2]?.start).toBe(16);
    expect(rows[2]?.barStarts).toEqual([16, 20]);
  });

  it('rellena hasta ocho posiciones la última fila incompleta', () => {
    const rows = buildBeatRows(segments, beats.slice(0, 18), 4);
    expect(rows).toHaveLength(3);
    expect(rows[2]?.cells).toHaveLength(8);
    expect(rows[2]?.cells.filter((cell) => cell !== null)).toHaveLength(2);
    expect(rows[2]?.cells.slice(2)).toEqual([null, null, null, null, null, null]);
  });

  it('respeta la frontera entre filas al resolver el acorde vigente', () => {
    const changing: ChordSegment[] = [
      { start: 0, end: 7.5, chord: parseChord('C') },
      { start: 7.5, end: 30, chord: parseChord('G') },
    ];
    const rows = buildBeatRows(changing, beats, 4);
    expect(rows[0]?.cells[7]?.chord?.root).toBe(0);
    expect(rows[1]?.cells[0]?.chord?.root).toBe(7);
  });

  it('cubre toda la canción cuando los pulsos guardados se cortan antes', () => {
    const rows = buildBeatRows(segments, [0, 1, 2, 3, 4], 4, 2, 20);
    const cells = rows.flatMap((row) => row.cells).filter((cell) => cell !== null);
    expect(cells.at(-1)?.time).toBe(19);
    expect(cells.length).toBe(20);
  });

  it('devuelve una lista vacía sin pulsos', () => {
    expect(buildBeatRows(segments, [], 4)).toEqual([]);
  });
});
