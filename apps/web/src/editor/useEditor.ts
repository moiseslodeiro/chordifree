import { useCallback, useEffect, useRef, useState } from 'react';
import type { Chord, ChordSegment } from '@chordifree/chords';
import {
  changeChord,
  mergeSegments,
  restoreDetected,
  setBoundary,
  splitSegment,
} from './operations';
import { t } from '../i18n';

const HISTORY_LIMIT = 50;

export interface EditorApi {
  segments: ChordSegment[];
  error: string | null;
  canUndo: boolean;
  canRedo: boolean;
  updateChord: (index: number, chord: Chord | null) => void;
  updateBoundary: (index: number, edge: 'start' | 'end', time: number) => void;
  split: (index: number, time: number) => void;
  merge: (index: number) => void;
  undo: () => void;
  redo: () => void;
  restore: () => void;
  reset: (segments: ChordSegment[]) => void;
  clearError: () => void;
}

interface EditorState {
  segments: ChordSegment[];
  past: ChordSegment[][];
  future: ChordSegment[][];
  error: string | null;
}

function initialState(segments: ChordSegment[]): EditorState {
  return { segments, past: [], future: [], error: null };
}

function sameChord(a: ChordSegment['chord'], b: ChordSegment['chord']): boolean {
  if (a === null || b === null) return a === b;
  return a.root === b.root && a.quality === b.quality && a.bass === b.bass;
}

/** Compares by content to tolerate the parent recreating the array. */
function sameSegments(a: ChordSegment[], b: ChordSegment[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every(
    (segment, index) =>
      segment.start === b[index]?.start &&
      segment.end === b[index]?.end &&
      sameChord(segment.chord, b[index]?.chord ?? null),
  );
}

export function useEditor(initial: ChordSegment[], duration: number): EditorApi {
  const [state, setState] = useState<EditorState>(() => initialState(initial));
  const lastInitial = useRef(initial);

  useEffect(() => {
    if (sameSegments(lastInitial.current, initial)) return;
    lastInitial.current = initial;
    setState(initialState(initial));
  }, [initial]);

  const apply = useCallback((operation: (current: ChordSegment[]) => ChordSegment[]) => {
    setState((current) => {
      try {
        const next = operation(current.segments);
        return {
          segments: next,
          past: [...current.past.slice(-(HISTORY_LIMIT - 1)), current.segments],
          future: [],
          error: null,
        };
      } catch (caught) {
        return {
          ...current,
          error: caught instanceof Error ? caught.message : t('editor.applyFailed'),
        };
      }
    });
  }, []);

  const undo = useCallback(() => {
    setState((current) => {
      const previous = current.past[current.past.length - 1];
      if (!previous) return current;
      return {
        segments: previous,
        past: current.past.slice(0, -1),
        future: [current.segments, ...current.future].slice(0, HISTORY_LIMIT),
        error: null,
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((current) => {
      const [next, ...rest] = current.future;
      if (!next) return current;
      return {
        segments: next,
        past: [...current.past.slice(-(HISTORY_LIMIT - 1)), current.segments],
        future: rest,
        error: null,
      };
    });
  }, []);

  const reset = useCallback((next: ChordSegment[]) => {
    lastInitial.current = next;
    setState(initialState(next));
  }, []);

  const clearError = useCallback(() => {
    setState((current) => (current.error === null ? current : { ...current, error: null }));
  }, []);

  return {
    segments: state.segments,
    error: state.error,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    updateChord: (index, chord) => apply((current) => changeChord(current, index, chord)),
    updateBoundary: (index, edge, time) =>
      apply((current) => setBoundary(current, index, edge, time, duration)),
    split: (index, time) => apply((current) => splitSegment(current, index, time, duration)),
    merge: (index) => apply((current) => mergeSegments(current, index, duration)),
    undo,
    redo,
    restore: () => apply(() => restoreDetected(initial)),
    reset,
    clearError,
  };
}
