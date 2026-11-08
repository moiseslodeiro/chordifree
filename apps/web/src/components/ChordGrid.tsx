import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  formatChordOrSilence,
  formatTime,
  type Accidental,
  type ChordSegment,
  type Notation,
} from '@chordifree/chords';
import { buildBeatRows } from '../grid/beats';
import type { PlaybackClock } from '../sync/clock';
import { useBeatIndex, useIsRowActive, usePlaybackIndex } from '../sync/hooks';
import type { GridView } from '../types';
import { activeBeatDescription, BeatGrid } from './BeatGrid';

interface ChordRowProps {
  index: number;
  segment: ChordSegment;
  notation: Notation;
  accidental: Accidental;
  clock: PlaybackClock | null;
  onSeek: (time: number) => void;
  onFocusRow: (index: number) => void;
}

/**
 * En móvil la parrilla muestra un compás por fila para que quepa sin scroll
 * horizontal; a partir de `sm` vuelve a dos compases por fila.
 */
function useCompactGrid() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(max-width: 639px)');
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return compact;
}

const ChordRow = memo(function ChordRow({
  index,
  segment,
  notation,
  accidental,
  clock,
  onSeek,
  onFocusRow,
}: ChordRowProps) {
  const active = useIsRowActive(clock, index);
  const label = formatChordOrSilence(segment.chord, notation, accidental);

  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        data-testid={`chord-row-${index}`}
        data-active={active ? 'true' : 'false'}
        aria-current={active ? 'true' : undefined}
        className="chord-row grid w-full grid-cols-[3.5rem_minmax(0,1fr)_auto] items-baseline gap-3 px-2 py-2.5 text-left focus-visible:outline-offset-[-2px]"
        onClick={() => onSeek(segment.start)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            onFocusRow(index + 1);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            onFocusRow(index - 1);
          } else if (event.key === 'Home') {
            event.preventDefault();
            onFocusRow(0);
          } else if (event.key === 'End') {
            event.preventDefault();
            onFocusRow(Number.MAX_SAFE_INTEGER);
          }
        }}
      >
        <span className="font-mono text-[0.68rem] tabular-nums text-ink3">
          {formatTime(segment.start)}
        </span>
        <span className="truncate font-display text-xl font-bold leading-tight text-ink">{label}</span>
        <span className="flex items-center gap-2">
          {segment.chord === null ? <span className="badge shrink-0">silencio</span> : null}
          {active ? (
            <span className="badge shrink-0 border-accent/50 text-accent">sonando</span>
          ) : null}
        </span>
      </button>
    </li>
  );
});

interface ChordGridProps {
  segments: ChordSegment[];
  notation: Notation;
  accidental: Accidental;
  clock: PlaybackClock | null;
  onSeek: (time: number) => void;
  beats?: number[];
  beatsPerBar?: number;
  duration?: number;
  view?: GridView;
  onViewChange?: (view: GridView) => void;
  loopA?: number | null;
  loopB?: number | null;
}

export function ChordGrid({
  segments,
  notation,
  accidental,
  clock,
  onSeek,
  beats = [],
  beatsPerBar = 4,
  duration,
  view = 'list',
  onViewChange = () => undefined,
  loopA = null,
  loopB = null,
}: ChordGridProps) {
  const active = usePlaybackIndex(clock);
  const activeBeat = useBeatIndex(clock);
  const compact = useCompactGrid();
  const rows = useMemo(
    () => buildBeatRows(segments, beats, beatsPerBar, compact ? 1 : 2, duration),
    [segments, beats, beatsPerBar, duration, compact],
  );
  const barCount = rows.reduce((total, row) => total + row.bars.length, 0);
  const canUseBeats = rows.length > 0;
  const effectiveView: GridView = view === 'beats' && canUseBeats ? 'beats' : 'list';
  const listRef = useRef<HTMLOListElement>(null);
  const manualUntil = useRef(0);
  const [follow, setFollow] = useState(true);

  useEffect(() => {
    if (!follow || effectiveView !== 'list' || active < 0 || Date.now() < manualUntil.current) {
      return;
    }
    const row = listRef.current?.querySelector<HTMLElement>(
      `[data-testid="chord-row-${active}"]`,
    );
    row?.scrollIntoView({ block: 'nearest' });
  }, [active, effectiveView, follow]);

  const focusRow = (index: number) => {
    const safe = Math.max(0, Math.min(segments.length - 1, index));
    listRef.current
      ?.querySelector<HTMLElement>(`[data-testid="chord-row-${safe}"]`)
      ?.focus();
  };

  const markManualScroll = () => {
    manualUntil.current = Date.now() + 3000;
  };

  if (segments.length === 0) {
    return (
      <div className="note note-info">
        No se detectaron acordes en este audio. Puedes volver a analizarlo o subir otro
        archivo.
      </div>
    );
  }

  const activeSegment = active >= 0 ? segments[active] : undefined;
  const liveMessage =
    effectiveView === 'beats'
      ? activeBeatDescription(rows, activeBeat, beatsPerBar, notation, accidental)
      : activeSegment
        ? `Acorde activo: ${formatChordOrSilence(
            activeSegment.chord,
            notation,
            accidental,
          )} en ${formatTime(activeSegment.start)}`
        : '';

  return (
    <section
      className="overflow-hidden rounded-xl border border-line bg-panel p-4 shadow-sm sm:p-5"
      aria-label="Línea de tiempo de acordes"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-display text-2xl leading-none text-ink">Línea de tiempo</h2>
          <span className="eyebrow">
            {effectiveView === 'beats'
              ? `${rows.length} ${rows.length === 1 ? 'fila' : 'filas'} · ${barCount} ${
                  barCount === 1 ? 'compás' : 'compases'
                }`
              : `${segments.length} segmentos`}
          </span>
        </div>
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label="Vista de la línea de tiempo"
        >
          <button
            type="button"
            aria-pressed={effectiveView === 'beats'}
            disabled={!canUseBeats}
            className={effectiveView === 'beats' ? 'tool-chip-active' : 'tool-chip'}
            onClick={() => onViewChange('beats')}
          >
            Parrilla
          </button>
          <button
            type="button"
            aria-pressed={effectiveView === 'list'}
            className={effectiveView === 'list' ? 'tool-chip-active' : 'tool-chip'}
            onClick={() => onViewChange('list')}
          >
            Lista
          </button>
          <button
            type="button"
            aria-pressed={follow}
            className={follow ? 'tool-chip-active' : 'tool-chip'}
            title="Seguir la reproducción y desplazar la fila activa"
            onClick={() => setFollow((value) => !value)}
          >
            Auto-scroll
          </button>
        </div>
      </div>

      {!canUseBeats ? (
        <p className="note note-warning mt-3 text-xs leading-relaxed">
          No se detectaron pulsos en esta canción; se muestra la vista de lista.
        </p>
      ) : null}

      {effectiveView === 'beats' ? (
        <div className="mt-3">
          <BeatGrid
            rows={rows}
            beatsPerBar={beatsPerBar}
            notation={notation}
            accidental={accidental}
            clock={clock}
            onSeek={onSeek}
            follow={follow}
            loopA={loopA}
            loopB={loopB}
          />
        </div>
      ) : (
        <div
          className="max-h-[60vh] overflow-y-auto pr-1"
          onWheel={markManualScroll}
          onTouchMove={markManualScroll}
        >
          <ol ref={listRef} className="mt-3" aria-label="Acordes detectados">
            {segments.map((segment, index) => (
              <ChordRow
                key={`${index}-${segment.start}`}
                index={index}
                segment={segment}
                notation={notation}
                accidental={accidental}
                clock={clock}
                onSeek={onSeek}
                onFocusRow={focusRow}
              />
            ))}
          </ol>
        </div>
      )}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </p>

      <p className="mt-3 font-mono text-[0.6rem] uppercase leading-relaxed tracking-[0.12em] text-ink3">
        {effectiveView === 'beats'
          ? 'Haz clic en un tiempo para saltar a su pulso. Usa las flechas para moverte, subir o bajar de fila, y Home o End para ir al primer o último pulso.'
          : 'Haz clic en un acorde para saltar a su tiempo. Usa las flechas arriba y abajo para moverte y Intro para saltar.'}
      </p>
    </section>
  );
}
