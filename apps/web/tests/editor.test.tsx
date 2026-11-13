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

describe('editor operations', () => {
  it('changes the chord of a single segment', () => {
    const result = changeChord(timeline(), 1, parseChord('D'));
    expect(result[0]?.chord).toMatchObject({ root: 0 });
    expect(result[1]?.chord).toMatchObject({ root: 2 });
    expect(result[2]?.chord).toMatchObject({ root: 9 });
  });

  it('marks a segment as a rest', () => {
    const result = changeChord(timeline(), 1, null);
    expect(result[1]?.chord).toBeNull();
  });

  it('rejects nonexistent indices', () => {
    expect(() => changeChord(timeline(), 9, C)).toThrow(EditorError);
  });

  it('adjusts the start by trimming the previous segment', () => {
    const result = setBoundary(timeline(), 1, 'start', 5, 12);
    expect(result[0]).toMatchObject({ start: 0, end: 5 });
    expect(result[1]).toMatchObject({ start: 5, end: 8 });
    expect(result.every((item) => item.start < item.end)).toBe(true);
  });

  it('adjusts the end by trimming the next segment', () => {
    const result = setBoundary(timeline(), 1, 'end', 7, 12);
    expect(result[1]).toMatchObject({ start: 4, end: 7 });
    expect(result[2]).toMatchObject({ start: 7, end: 12 });
  });

  it('rejects adjustments that would create overlaps or short segments', () => {
    expect(() => setBoundary(timeline(), 1, 'start', 0.1, 12)).toThrow(EditorError);
    expect(() => setBoundary(timeline(), 1, 'start', 7.9, 12)).toThrow(EditorError);
    expect(() => setBoundary(timeline(), 1, 'end', 4.1, 12)).toThrow(EditorError);
    expect(() => setBoundary(timeline(), 2, 'end', 13, 12)).toThrow(EditorError);
  });

  it('splits a segment in two keeping the same chord', () => {
    const result = splitSegment(timeline(), 1, 6, 12);
    expect(result).toHaveLength(4);
    expect(result[1]).toMatchObject({ start: 4, end: 6 });
    expect(result[2]).toMatchObject({ start: 6, end: 8 });
    expect(result[2]?.chord).toMatchObject({ root: 7 });
  });

  it('rejects splits too close to the edges', () => {
    expect(() => splitSegment(timeline(), 1, 4.1, 12)).toThrow(EditorError);
    expect(() => splitSegment(timeline(), 1, 7.95, 12)).toThrow(EditorError);
  });

  it('merges only adjacent segments and keeps the first chord', () => {
    const merged = mergeSegments(timeline(), 0, 12);
    expect(merged[0]).toMatchObject({ start: 0, end: 8 });
    expect(merged[0]?.chord).toMatchObject({ root: 0 });
    expect(canMerge(timeline(), 0)).toBe(true);
    expect(canMerge(timeline(), 2)).toBe(false);
    expect(canMerge([seg(0, 4, C), seg(5, 8, G)], 0)).toBe(false);
  });

  it('restores detection without sharing references', () => {
    const detected = timeline();
    const restored = restoreDetected(detected);
    expect(restored).toEqual(detected);
    expect(restored[0]).not.toBe(detected[0]);
  });
});

describe('useEditor', () => {
  it('applies changes and allows undoing and redoing in reverse order', () => {
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

  it('exposes the error from an invalid operation and keeps the state', () => {
    const { result } = renderHook(() => useEditor(timeline(), 12));
    act(() => result.current.updateBoundary(0, 'start', 5));
    expect(result.current.error).toBeTruthy();
    expect(result.current.segments[0]).toMatchObject({ start: 0, end: 4 });
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });

  it('limits history to 50 entries', () => {
    const { result } = renderHook(() => useEditor(timeline(), 12));
    for (let index = 0; index < 55; index += 1) {
      act(() => result.current.updateChord(0, parseChord(index % 2 === 0 ? 'D' : 'C')));
    }
    for (let index = 0; index < 50; index += 1) {
      act(() => result.current.undo());
    }
    expect(result.current.canUndo).toBe(false);
  });

  it('restores the original detection and allows saving the result', () => {
    const initial = timeline();
    const { result } = renderHook(() => useEditor(initial, 12));
    act(() => result.current.updateChord(0, parseChord('F')));
    act(() => result.current.restore());
    expect(result.current.segments).toEqual(initial);
    expect(result.current.canUndo).toBe(true);
  });

  it('resets when the initial state changes', () => {
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
