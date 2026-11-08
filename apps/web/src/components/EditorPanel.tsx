import { useEffect, useState } from 'react';
import {
  formatChordOrSilence,
  parseChordInput,
  transposeChord,
  type Accidental,
  type Chord,
  type ChordSegment,
  type Notation,
} from '@chordifree/chords';
import { MIN_SEGMENT_SECONDS } from '../editor/operations';
import { useEditor } from '../editor/useEditor';
import type { Song } from '../types';
import { ErrorBanner } from './ErrorBanner';

interface ChordFieldProps {
  value: string;
  onCommit: (text: string) => boolean;
}

function ChordField({ value, onCommit }: ChordFieldProps) {
  const [text, setText] = useState(value);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(value);
    setInvalid(false);
  }, [value]);

  return (
    <input
      type="text"
      className={`field font-display font-bold ${invalid ? 'border-danger' : ''}`}
      value={text}
      aria-label="Acorde del segmento"
      aria-invalid={invalid}
      spellCheck={false}
      onChange={(event) => {
        setText(event.target.value);
        setInvalid(false);
      }}
      onBlur={() => setInvalid(!onCommit(text))}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
}

interface TimeFieldProps {
  value: number;
  label: string;
  onCommit: (seconds: number) => void;
}

function TimeField({ value, label, onCommit }: TimeFieldProps) {
  const [text, setText] = useState(value.toFixed(2));

  useEffect(() => {
    setText(value.toFixed(2));
  }, [value]);

  const commit = () => {
    const seconds = Number(text);
    if (Number.isFinite(seconds)) onCommit(seconds);
    else setText(value.toFixed(2));
  };

  return (
    <label className="flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink3">
      {label}
      <input
        type="number"
        min={0}
        step={0.1}
        className="field w-24 py-1.5 font-mono text-xs tabular-nums text-ink"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

interface EditorPanelProps {
  song: Song;
  notation: Notation;
  accidental: Accidental;
  onSave: (segments: ChordSegment[]) => void;
  onDiscard: () => void;
}

export function EditorPanel({ song, notation, accidental, onSave, onDiscard }: EditorPanelProps) {
  const editor = useEditor(song.segments, song.duration);
  const [inputError, setInputError] = useState<string | null>(null);

  const displayChord = (chord: Chord | null): string =>
    formatChordOrSilence(
      chord ? transposeChord(chord, song.transpose) : null,
      notation,
      accidental,
    );

  const commitChord = (index: number, text: string): boolean => {
    const parsed = parseChordInput(text);
    if (!parsed.ok) {
      setInputError(parsed.error);
      return false;
    }
    setInputError(null);
    editor.updateChord(
      index,
      parsed.chord ? transposeChord(parsed.chord, -song.transpose) : null,
    );
    return true;
  };

  const commitBoundary = (index: number, edge: 'start' | 'end', seconds: number) => {
    setInputError(null);
    editor.updateBoundary(index, edge, seconds);
  };

  const message = inputError ?? editor.error;

  return (
    <section
      className="rounded-xl border border-line bg-panel p-4 shadow-sm sm:p-5"
      aria-label="Editor de acordes"
    >
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="eyebrow">Edición</p>
          <h2 className="display mt-2 text-2xl">Modo edición</h2>
          <p className="mt-1 max-w-[52ch] text-xs leading-relaxed text-ink3">
            Los acordes se editan en afinación original; la rejilla aplica la trasposición.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn min-h-0 px-3 py-1.5 text-xs"
            onClick={editor.undo}
            disabled={!editor.canUndo}
          >
            Deshacer
          </button>
          <button
            type="button"
            className="btn min-h-0 px-3 py-1.5 text-xs"
            onClick={editor.redo}
            disabled={!editor.canRedo}
          >
            Rehacer
          </button>
          <button
            type="button"
            className="btn min-h-0 px-3 py-1.5 text-xs"
            onClick={() => {
              if (
                window.confirm(
                  '¿Restaurar la detección original? Se descartarán las correcciones de esta sesión.',
                )
              ) {
                editor.restore();
              }
            }}
          >
            Restaurar detección
          </button>
          <button
            type="button"
            className="btn min-h-0 px-3 py-1.5 text-xs"
            onClick={onDiscard}
          >
            Descartar
          </button>
          <button
            type="button"
            className="btn btn-primary min-h-0 px-3 py-1.5 text-xs"
            onClick={() => onSave(editor.segments)}
          >
            Guardar cambios
          </button>
        </div>
      </div>

      {message ? (
        <div className="mt-4">
          <ErrorBanner message={message} onDismiss={() => setInputError(null)} />
        </div>
      ) : null}

      <ol className="mt-4 border-t border-line" aria-label="Segmentos editables">
        {editor.segments.map((segment, index) => {
          const following = editor.segments[index + 1];
          const canMerge = Boolean(
            following && Math.abs(segment.end - following.start) < 0.001,
          );
          const canSplit = segment.end - segment.start >= MIN_SEGMENT_SECONDS * 2;

          return (
            <li key={`${index}-${segment.start}-${segment.end}`} className="border-b border-line py-3">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                <span className="hidden w-7 shrink-0 pb-1.5 font-mono text-[0.62rem] tracking-[0.1em] text-ink3 sm:block">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <TimeField
                  label="Inicio"
                  value={segment.start}
                  onCommit={(seconds) => commitBoundary(index, 'start', seconds)}
                />
                <TimeField
                  label="Fin"
                  value={segment.end}
                  onCommit={(seconds) => commitBoundary(index, 'end', seconds)}
                />
                <div className="min-w-[9rem] flex-1 space-y-1">
                  <span className="eyebrow block">Acorde</span>
                  <ChordField
                    value={displayChord(segment.chord)}
                    onCommit={(text) => commitChord(index, text)}
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="btn btn-ghost min-h-0 px-2 py-1 text-xs"
                    onClick={() => {
                      setInputError(null);
                      editor.updateChord(index, null);
                    }}
                  >
                    Silencio
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost min-h-0 px-2 py-1 text-xs"
                    disabled={!canSplit}
                    onClick={() => {
                      setInputError(null);
                      editor.split(index, (segment.start + segment.end) / 2);
                    }}
                  >
                    Dividir
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost min-h-0 px-2 py-1 text-xs"
                    disabled={!canMerge}
                    onClick={() => {
                      setInputError(null);
                      editor.merge(index);
                    }}
                  >
                    Fusionar
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 font-mono text-[0.6rem] uppercase leading-relaxed tracking-[0.12em] text-ink3">
        Duración mínima por segmento: {MIN_SEGMENT_SECONDS} s. Los ajustes recortan el segmento
        vecino para no dejar huecos ni solapamientos.
      </p>
    </section>
  );
}
