import { describe, expect, it } from 'vitest';
import { formatChord, parseChord, type ChordSegment } from '@chordifree/chords';
import {
  alignLyrics,
  buildChordChanges,
  chordGap,
  parseLyricLine,
  splitLyricLines,
  type ChordChange,
} from '../src/lyrics/align';
import { detectInstrumentalSpans, type HarmonyBar } from '../src/lyrics/sections';

function change(time: number, end: number, label = 'C', segmentIndex = 0): ChordChange {
  return { time, end, label, segmentIndex };
}

function segment(start: number, end: number, label: string | null): ChordSegment {
  return { start, end, chord: label ? parseChord(label) : null };
}

describe('splitLyricLines', () => {
  it('conserva líneas vacías y normaliza los saltos de línea', () => {
    expect(splitLyricLines('uno\r\ndos\rtres\n\ncuatro')).toEqual([
      'uno',
      'dos',
      'tres',
      '',
      'cuatro',
    ]);
  });
});

describe('buildChordChanges', () => {
  it('fusiona acordes consecutivos, corta en silencios y conserva el índice', () => {
    const changes = buildChordChanges(
      [
        segment(0, 4, 'C'),
        segment(4, 6, 'C'),
        segment(6, 8, null),
        segment(8, 12, 'G'),
        segment(12, 16, 'G'),
        segment(16, 20, 'C'),
      ],
      (chord) => formatChord(chord),
    );

    expect(changes).toEqual([
      { time: 0, end: 6, segmentIndex: 0, label: 'C' },
      { time: 8, end: 16, segmentIndex: 3, label: 'G' },
      { time: 16, end: 20, segmentIndex: 5, label: 'C' },
    ]);
  });

  it('formatea los acordes con la notación recibida', () => {
    const changes = buildChordChanges([segment(0, 4, 'F#')], (chord) =>
      formatChord(chord, 'spanish'),
    );
    expect(changes[0]?.label).toBe('Fa♯');
  });
});

describe('alignLyrics', () => {
  it('da todo el tramo a una sola línea', () => {
    const lines = alignLyrics('Una sola línea', [change(5, 8)], 20);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ text: 'Una sola línea', start: 5, end: 8 });
    expect(lines[0]?.chords[0]).toMatchObject({ label: 'C', offset: 0 });
  });

  it('reparte cuatro líneas y coloca el acorde en la que contiene su tiempo', () => {
    const changes = [change(0, 4), change(15, 18, 'G'), change(36, 40, 'F')];
    const lines = alignLyrics('Uno\nDos\nTres\nCuatro', changes, 40);

    expect(lines.map((line) => [line.start, line.end])).toEqual([
      [0, 10],
      [10, 20],
      [20, 30],
      [30, 40],
    ]);
    expect(lines[1]?.chords).toHaveLength(1);
    expect(lines[1]?.chords[0]).toMatchObject({ label: 'G' });
    expect(lines[1]?.chords[0]?.offset).toBeCloseTo(0.476, 2);
    expect(lines[0]?.chords[0]?.offset).toBe(0);
    expect(lines[3]?.chords[0]?.offset).toBeCloseTo(0.571, 2);
  });

  it('conserva las líneas vacías como separadores sin acordes', () => {
    const changes = [change(0, 4), change(15, 18, 'G'), change(28, 30, 'F')];
    const lines = alignLyrics('A\n\nB\n\nC', changes, 30);

    expect(lines.map((line) => line.text)).toEqual(['A', '', 'B', '', 'C']);
    expect(lines[1]).toMatchObject({ start: 0, end: 0, chords: [] });
    expect(lines[3]).toMatchObject({ start: 0, end: 0, chords: [] });
    expect(lines[2]?.chords).toHaveLength(1);
    expect(lines[2]?.start).toBe(10);
    expect(lines[2]?.end).toBe(20);
  });

  it('ordena y separa varios acordes dentro de la misma línea', () => {
    const changes = [change(3, 4, 'C'), change(2, 3, 'G'), change(1, 2, 'Am')];
    const lines = alignLyrics('Una línea larga', changes, 20);
    const chords = lines[0]?.chords ?? [];

    expect(chords.map((chord) => chord.label)).toEqual(['Am', 'G', 'C']);
    expect(chords[0]!.offset).toBeLessThan(chords[1]!.offset);
    expect(chords[1]!.offset).toBeLessThan(chords[2]!.offset);
    expect(chords.every((chord) => chord.offset >= 0 && chord.offset <= 1)).toBe(true);
    expect(chords[1]!.offset - chords[0]!.offset).toBeGreaterThan(0.02);
    expect(chordGap('Am')).toBeGreaterThan(0);
  });

  it('mantiene las posiciones dentro de [0, 1] en los extremos del tramo', () => {
    const lines = alignLyrics('A\nB', [change(-1, 5), change(20, 25)], 20);
    const first = lines[0]?.chords[0];
    const last = lines[1]?.chords.at(-1);

    expect(first?.offset).toBe(0);
    expect(last?.offset).toBeGreaterThanOrEqual(0);
    expect(last?.offset).toBeLessThanOrEqual(1);
  });

  it('muestra la letra sin acordes cuando no hay cambios', () => {
    const lines = alignLyrics('A\nB', [], 20);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ start: 0, end: 10, chords: [] });
    expect(lines[1]).toMatchObject({ start: 10, end: 20, chords: [] });
  });

  it('devuelve una lista vacía sin letra', () => {
    expect(alignLyrics('', [change(0, 4)], 20)).toEqual([]);
    expect(alignLyrics('  \n \n', [change(0, 4)], 20)).toEqual([]);
  });

  it('excluye los tramos instrumentales del reparto y de los acordes', () => {
    const changes = [
      change(0, 10, 'C'),
      change(12, 18, 'G'),
      change(22, 28, 'Dm'),
      change(32, 36, 'Am'),
      change(36, 40, 'F'),
    ];
    const lines = alignLyrics('Uno\nDos\nTres\nCuatro', changes, 40, {
      instrumental: [
        { start: 0, end: 10, kind: 'intro' },
        { start: 20, end: 30, kind: 'interlude' },
      ],
    });

    expect(lines.map((line) => [line.start, line.end])).toEqual([
      [10, 15],
      [15, 20],
      [30, 35],
      [35, 40],
    ]);
    expect(lines[0]?.chords[0]?.label).toBe('G');
    expect(lines[1]?.chords).toHaveLength(0);
    expect(lines[2]?.chords[0]?.label).toBe('Am');
    expect(lines[3]?.chords[0]?.label).toBe('F');
    expect(lines.every((line) => !line.chords.some((chord) => chord.label === 'C'))).toBe(true);
    expect(lines.every((line) => !line.chords.some((chord) => chord.label === 'Dm'))).toBe(true);
  });

  it('respeta las anclas y reparte las líneas entre ellas', () => {
    const lines = alignLyrics('[00:10] Uno\nDos\n[00:30] Tres', [change(12, 15), change(32, 35)], 40);

    expect(lines[0]).toMatchObject({ text: 'Uno', anchor: 10, start: 10, end: 20 });
    expect(lines[1]).toMatchObject({ text: 'Dos', anchor: null, start: 20, end: 30 });
    expect(lines[2]).toMatchObject({ text: 'Tres', anchor: 30, start: 30, end: 35 });
    expect(lines[0]?.chords[0]?.label).toBe('C');
    expect(lines[2]?.chords[0]?.label).toBe('C');
  });

  it('usa una línea vacía anclada como frontera instrumental', () => {
    const lines = alignLyrics(
      'Uno\n[00:20]\n[00:30] Dos',
      [change(5, 6), change(25, 26), change(35, 36)],
      40,
    );

    expect(lines[0]).toMatchObject({ text: 'Uno', start: 5, end: 20 });
    expect(lines[0]?.chords[0]?.time).toBe(5);
    expect(lines[1]).toMatchObject({ text: '', start: 0, end: 0, chords: [] });
    expect(lines[2]).toMatchObject({ text: 'Dos', start: 30, end: 36 });
    expect(lines[2]?.chords[0]?.time).toBe(35);
    expect(lines.flatMap((line) => line.chords).some((chord) => chord.time === 25)).toBe(false);
  });

  it('da prioridad al ancla sobre la heurística de tramos', () => {
    const lines = alignLyrics('[00:05] Uno', [change(6, 8)], 20, {
      instrumental: [{ start: 0, end: 10, kind: 'intro' }],
    });

    expect(lines[0]).toMatchObject({ anchor: 5, start: 5 });
  });

  it('combina anclas y tramos instrumentales', () => {
    const lines = alignLyrics('[00:08] Uno\n[00:40] Dos', [change(8, 12, 'C'), change(20, 24, 'G'), change(24, 28, 'C'), change(40, 44, 'F')], 56, {
      instrumental: [
        { start: 0, end: 8, kind: 'intro' },
        { start: 24, end: 40, kind: 'interlude' },
      ],
    });

    expect(lines[0]).toMatchObject({ text: 'Uno', start: 8, end: 24 });
    expect(lines[1]).toMatchObject({ text: 'Dos', start: 40, end: 44 });
    expect(lines[0]?.chords.map((chord) => chord.label)).toEqual(['C', 'G']);
    expect(lines[1]?.chords.map((chord) => chord.label)).toEqual(['F']);
  });
});

describe('parseLyricLine', () => {
  it('extrae minutos y segundos', () => {
    expect(parseLyricLine('[01:12] Hola')).toEqual({ text: 'Hola', anchor: 72 });
    expect(parseLyricLine('   [0:05] Hola')).toEqual({ text: 'Hola', anchor: 5 });
  });

  it('deja el texto intacto si el ancla no es válida', () => {
    expect(parseLyricLine('[00:99] Hola')).toEqual({ text: '[00:99] Hola', anchor: null });
    expect(parseLyricLine('Hola')).toEqual({ text: 'Hola', anchor: null });
  });
});

function bars(labels: Array<string | null>, barSeconds = 4): HarmonyBar[] {
  return labels.map((label, index) => ({
    start: index * barSeconds,
    end: (index + 1) * barSeconds,
    chord: label ? parseChord(label) : null,
  }));
}

describe('detectInstrumentalSpans', () => {
  const main = ['C', 'G', 'Am', 'F'];

  it('detecta una intro antes de la frase principal', () => {
    const harmony = bars(['C', 'Dm', ...main, ...main, ...main]);
    expect(detectInstrumentalSpans(harmony, harmony.length * 4)).toEqual([
      { start: 0, end: 8, kind: 'intro' },
    ]);
  });

  it('no marca una intro gigante si la frase principal aparece tarde', () => {
    const varied = ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim', 'C', 'Dm', 'F', 'G', 'C', 'Am', 'F', 'G', 'Dm', 'Em', 'C', 'F', 'G'];
    const harmony = bars([...varied, ...main, ...main, ...main]);
    expect(detectInstrumentalSpans(harmony, harmony.length * 4)).toEqual([]);
  });

  it('detecta un outro después de la última frase principal', () => {
    const harmony = bars([...main, ...main, 'C', 'Dm']);
    expect(detectInstrumentalSpans(harmony, harmony.length * 4)).toEqual([
      { start: 32, end: 40, kind: 'outro' },
    ]);
  });

  it('detecta un interludio de vamp entre dos frases principales', () => {
    const harmony = bars([...main, 'C', 'C', 'C', 'C', ...main]);
    expect(detectInstrumentalSpans(harmony, harmony.length * 4)).toEqual([
      { start: 16, end: 32, kind: 'interlude' },
    ]);
  });

  it('no marca nada sin una frase principal repetida', () => {
    const harmony = bars(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim', 'C']);
    expect(detectInstrumentalSpans(harmony, harmony.length * 4)).toEqual([]);
  });

  it('no marca nada con pocos compases', () => {
    expect(detectInstrumentalSpans(bars(main), 16)).toEqual([]);
  });
});
