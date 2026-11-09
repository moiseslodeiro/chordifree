import { useEffect, useMemo, useState } from 'react';
import {
  formatChord,
  formatTime,
  type Accidental,
  type Notation,
} from '@chordifree/chords';
import type { BarCell } from '../grid/barAlignment';
import type { PlaybackClock } from '../sync/clock';
import { usePlaybackTime } from '../sync/hooks';

interface BarGridProps {
  bars: BarCell[];
  notation: Notation;
  accidental: Accidental;
  clock: PlaybackClock | null;
  onSelectBar: (time: number) => void;
  loopA?: number | null;
  loopB?: number | null;
  markMode?: 'a' | 'b' | null;
}

function useCompactBars(): boolean {
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

export function BarGrid({
  bars,
  notation,
  accidental,
  clock,
  onSelectBar,
  loopA = null,
  loopB = null,
  markMode = null,
}: BarGridProps) {
  const compact = useCompactBars();
  const barsPerRow = compact ? 2 : 4;
  const activeTime = usePlaybackTime(clock);
  const [previewBar, setPreviewBar] = useState<number | null>(null);
  const rows = useMemo(() => {
    const result: BarCell[][] = [];
    for (let index = 0; index < bars.length; index += barsPerRow) {
      result.push(bars.slice(index, index + barsPerRow));
    }
    return result;
  }, [bars, barsPerRow]);

  const activeIndex =
    activeTime === null
      ? -1
      : bars.findIndex((bar) => activeTime >= bar.start && activeTime < bar.end);
  const hasLoop = loopA !== null && loopB !== null && loopB > loopA;

  const aBar =
    loopA === null
      ? -1
      : bars.findIndex((bar) => Math.abs(bar.start - loopA) < 0.08);
  let bBar = -1;
  if (loopB !== null) {
    for (const bar of bars) {
      if (bar.start < loopB - 0.05) bBar = bar.index;
    }
  }

  const loopRoleFor = (barIndex: number): 'a' | 'b' | 'ab' | 'range' | null => {
    const isA = barIndex === aBar;
    const isB = barIndex === bBar;
    if (isA && isB) return 'ab';
    if (isA) return 'a';
    if (isB) return 'b';
    if (aBar >= 0 && bBar >= 0 && barIndex > aBar && barIndex < bBar) return 'range';
    return null;
  };

  useEffect(() => {
    if (markMode === null) setPreviewBar(null);
  }, [markMode]);

  if (bars.length === 0) {
    return (
      <p className="note note-info mt-3 text-xs leading-relaxed">
        No hay compases suficientes para construir esta vista.
      </p>
    );
  }

  return (
    <div
      className="bar-grid mt-3"
      data-mark-mode={markMode ?? undefined}
      onMouseLeave={() => setPreviewBar(null)}
      aria-label="Parrilla por compases"
    >
      {rows.map((row) => {
        const first = row[0]!;
        return (
          <div
            key={first.index}
            className="bar-row"
            style={{ gridTemplateColumns: `3.5rem repeat(${barsPerRow}, minmax(0, 1fr))` }}
          >
            <div className="bar-row-label">
              <span className="tabular-nums">{formatTime(first.start)}</span>
              <span>{`C${first.index + 1}`}</span>
            </div>
            {row.map((bar) => {
              const label = bar.chord ? formatChord(bar.chord, notation, accidental) : '—';
              const role = loopRoleFor(bar.index);
              const inLoop = hasLoop && role !== null;
              const preview =
                markMode !== null && previewBar === bar.index ? markMode : null;
              const active = bar.index === activeIndex;
              return (
                <button
                  key={bar.index}
                  type="button"
                  data-testid={`bar-cell-${bar.index}`}
                  data-loop={role ?? undefined}
                  data-mark-preview={preview ?? undefined}
                  aria-current={active ? 'true' : undefined}
                  aria-label={`Compás ${bar.index + 1}, acorde ${label}, en ${formatTime(
                    bar.start,
                  )}${role === 'a' ? ', inicio A' : role === 'b' ? ', final B' : inLoop ? ', dentro del bucle' : ''}`}
                  className="bar-cell"
                  onMouseEnter={() => {
                    if (markMode !== null) setPreviewBar(bar.index);
                  }}
                  onFocus={() => {
                    if (markMode !== null) setPreviewBar(bar.index);
                  }}
                  onClick={() => onSelectBar(bar.start)}
                >
                  <span className="bar-cell-number">{`C${bar.index + 1}`}</span>
                  <span className="bar-cell-chord">{bar.chord ? label : '—'}</span>
                  <span className="bar-cell-time">{formatTime(bar.start)}</span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
