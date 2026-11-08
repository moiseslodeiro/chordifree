import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseChord, type ChordSegment } from '@chordifree/chords';
import {
  canMerge,
  changeChord,
  EditorError,
  mergeSegments,
  restoreDetected,
  setBoundary,
  splitSegment,
} from '../src/editor/operations';
import { useEditor } from '../src/editor/useEditor';

const C = parseChord('C');
const G = parseChord('G');
const Am = parseChord('Am');

const seg = (start: number, end: number, chord: ChordSegment['chord']): ChordSegment => ({
  start,
  end,
  chord,
});

const timeline = (): ChordSegment[] => [
  seg(0, 4, C),
  seg(4, 8, G),
  seg(8, 12, Am),
];

describe('operaciones del editor', () => {
  it('cambia el acorde de un único segmento', () => {
    const result = changeChord(timeline(), 1, parseChord('D'));
    expect(result[0]?.chord).toMatchObject({ root: 0 });
    expect(result[1]?.chord).toMatchObject({ root: 2 });
    expect(result[2]?.chord).toMatchObject({ root: 9 });
  });

  it('marca un segmento como silencio', () => {
    const result = changeChord(timeline(), 1, null);
    expect(result[1]?.chord).toBeNull();
  });

  it('rechaza índices inexistentes', () => {
    expect(() => changeChord(timeline(), 9, C)).toThrow(EditorError);
  });

  it('ajusta el inicio recortando el segmento anterior', () => {
    const result = setBoundary(timeline(), 1, 'start', 5, 12);
    expect(result[0]).toMatchObject({ start: 0, end: 5 });
    expect(result[1]).toMatchObject({ start: 5, end: 8 });
    expect(result.every((item) => item.start < item.end)).toBe(true);
  });

  it('ajusta el fin recortando el segmento siguiente', () => {
    const result = setBoundary(timeline(), 1, 'end', 7, 12);
    expect(result[1]).toMatchObject({ start: 4, end: 7 });
    expect(result[2]).toMatchObject({ start: 7, end: 12 });
  });

  it('rechaza ajustes que crearían solapamientos o segmentos cortos', () => {
    expect(() => setBoundary(timeline(), 1, 'start', 0.1, 12)).toThrow(EditorError);
    expect(() => setBoundary(timeline(), 1, 'start', 7.9, 12)).toThrow(EditorError);
    expect(() => setBoundary(timeline(), 1, 'end', 4.1, 12)).toThrow(EditorError);
    expect(() => setBoundary(timeline(), 2, 'end', 13, 12)).toThrow(EditorError);
  });

  it('divide un segmento en dos con el mismo acorde', () => {
    const result = splitSegment(timeline(), 1, 6, 12);
    expect(result).toHaveLength(4);
    expect(result[1]).toMatchObject({ start: 4, end: 6 });
    expect(result[2]).toMatchObject({ start: 6, end: 8 });
    expect(result[2]?.chord).toMatchObject({ root: 7 });
  });

  it('rechaza divisiones demasiado cerca de los bordes', () => {
    expect(() => splitSegment(timeline(), 1, 4.1, 12)).toThrow(EditorError);
    expect(() => splitSegment(timeline(), 1, 7.95, 12)).toThrow(EditorError);
  });

  it('fusiona solo segmentos adyacentes y conserva el primer acorde', () => {
    const merged = mergeSegments(timeline(), 0, 12);
    expect(merged[0]).toMatchObject({ start: 0, end: 8 });
    expect(merged[0]?.chord).toMatchObject({ root: 0 });
    expect(canMerge(timeline(), 0)).toBe(true);
    expect(canMerge(timeline(), 2)).toBe(false);
    expect(canMerge([seg(0, 4, C), seg(5, 8, G)], 0)).toBe(false);
  });

  it('restaura la detección sin compartir referencias', () => {
    const detected = timeline();
    const restored = restoreDetected(detected);
    expect(restored).toEqual(detected);
    expect(restored[0]).not.toBe(detected[0]);
  });
});

describe('useEditor', () => {
  it('aplica cambios y permite deshacer y rehacer en orden inverso', () => {
    const initial = timeline();
    const { result } = renderHook(() => useEditor(initial, 12));

    act(() => result.current.updateChord(0, parseChord('D')));
    act(() => result.current.updateChord(1, parseChord('E')));
    expect(result.current.segments[0]?.chord).toMatchObject({ root: 2 });
    expect(result.current.segments[1]?.chord).toMatchObject({ root: 4 });

    act(() => result.current.undo());
    expect(result.current.segments[1]?.chord).toMatchObject({ root: 7 });
    act(() => result.current.undo());
    expect(result.current.segments[0]?.chord).toMatchObject({ root: 0 });

    act(() => result.current.redo());
    expect(result.current.segments[0]?.chord).toMatchObject({ root: 2 });
    act(() => result.current.redo());
    expect(result.current.segments[1]?.chord).toMatchObject({ root: 4 });
    expect(result.current.canRedo).toBe(false);
  });

  it('expone el error de una operación inválida y conserva el estado', () => {
    const { result } = renderHook(() => useEditor(timeline(), 12));
    act(() => result.current.updateBoundary(0, 'start', 5));
    expect(result.current.error).toBeTruthy();
    expect(result.current.segments[0]).toMatchObject({ start: 0, end: 4 });
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });

  it('limita el historial a 50 entradas', () => {
    const { result } = renderHook(() => useEditor(timeline(), 12));
    for (let index = 0; index < 55; index += 1) {
      act(() => result.current.updateChord(0, parseChord(index % 2 === 0 ? 'D' : 'C')));
    }
    for (let index = 0; index < 50; index += 1) {
      act(() => result.current.undo());
    }
    expect(result.current.canUndo).toBe(false);
  });

  it('restaura la detección original y permite guardar el resultado', () => {
    const initial = timeline();
    const { result } = renderHook(() => useEditor(initial, 12));
    act(() => result.current.updateChord(0, parseChord('F')));
    act(() => result.current.restore());
    expect(result.current.segments).toEqual(initial);
    expect(result.current.canUndo).toBe(true);
  });

  it('se reinicia cuando cambia el estado inicial', () => {
    const first = timeline();
    const { result, rerender } = renderHook(
      ({ segments }: { segments: ChordSegment[] }) => useEditor(segments, 12),
      { initialProps: { segments: first } },
    );
    act(() => result.current.updateChord(0, parseChord('D')));
    const next = [seg(0, 12, parseChord('E'))];
    rerender({ segments: next });
    expect(result.current.segments).toEqual(next);
    expect(result.current.canUndo).toBe(false);
  });
});
