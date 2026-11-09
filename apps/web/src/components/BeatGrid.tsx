import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  formatChordOrSilence,
  formatTime,
  type Accidental,
  type Notation,
} from '@chordifree/chords';
import { translate, getLanguage, useT } from '../i18n';
import type { BeatCell, BeatRow } from '../grid/beats';
import type { PlaybackClock } from '../sync/clock';
import { useBeatIndex, useIsBeatActive } from '../sync/hooks';

interface BeatCellButtonProps {
  cell: BeatCell;
  rowIndex: number;
  cellIndex: number;
  barStart: boolean;
  beatsPerBar: number;
  notation: Notation;
  accidental: Accidental;
  clock: PlaybackClock | null;
  loopRole: LoopRole;
  showLoopMark: boolean;
  markPreview: 'a' | 'b' | null;
  onHoverBar: (barIndex: number | null) => void;
  onSeek: (time: number) => void;
  onNavigate: (
    event: KeyboardEvent<HTMLButtonElement>,
    rowIndex: number,
    cellIndex: number,
  ) => void;
}

type LoopRole = 'a' | 'b' | 'ab' | 'range' | null;

const LOOP_LABELS: Record<Exclude<LoopRole, null>, 'grid.loopA' | 'grid.loopB' | 'grid.loopAB' | 'grid.loopRange'> = {
  a: 'grid.loopA',
  b: 'grid.loopB',
  ab: 'grid.loopAB',
  range: 'grid.loopRange',
};

const LOOP_MARKS: Record<'a' | 'b' | 'ab', string> = {
  a: 'A',
  b: 'B',
  ab: 'A·B',
};

const BeatCellButton = memo(function BeatCellButton({
  cell,
  rowIndex,
  cellIndex,
  barStart,
  beatsPerBar,
  notation,
  accidental,
  clock,
  loopRole,
  showLoopMark,
  markPreview,
  onHoverBar,
  onSeek,
  onNavigate,
}: BeatCellButtonProps) {
  const t = useT();
  const active = useIsBeatActive(clock, cell.beatIndex);
  const barIndex = Math.floor(cell.beatIndex / beatsPerBar);
  const label = formatChordOrSilence(cell.chord, notation, accidental);
  const chordDescription = cell.chord ? `${t('common.chord')} ${label}` : t('common.silence');
  const lowConfidence =
    cell.chord !== null && cell.confidence !== undefined && cell.confidence < 0.4;
  const accessibleLabel =
    t('grid.rowLabel', {
      row: rowIndex + 1,
      bar: Math.floor(cell.beatIndex / beatsPerBar) + 1,
      beat: (cell.beatIndex % beatsPerBar) + 1,
      chord: chordDescription,
      time: formatTime(cell.time),
    }) +
    (loopRole ? t(LOOP_LABELS[loopRole]) : '') +
    (lowConfidence ? t('grid.lowConfidence') : '');

  return (
    <button
      type="button"
      data-testid={`beat-cell-${cell.beatIndex}`}
      data-beat-index={cell.beatIndex}
      data-row-index={rowIndex}
      data-cell-index={cellIndex}
      data-active={active ? 'true' : 'false'}
      data-change={cell.change ? 'true' : 'false'}
      data-loop={loopRole ?? undefined}
      data-mark-preview={markPreview ?? undefined}
      data-confidence={
        cell.confidence === undefined ? undefined : Math.round(cell.confidence * 100)
      }
      aria-current={active ? 'true' : undefined}
      aria-label={accessibleLabel}
      className={`beat-cell ${barStart && cellIndex > 0 ? 'border-l-2 border-l-line-strong' : ''}`}
      onClick={() => onSeek(cell.time)}
      onMouseEnter={() => onHoverBar(barIndex)}
      onFocus={() => onHoverBar(barIndex)}
      onKeyDown={(event) => onNavigate(event, rowIndex, cellIndex)}
    >
      {cell.change ? <span className="beat-label max-w-full truncate">{label}</span> : null}
      {showLoopMark && loopRole && loopRole !== 'range' ? (
        <span className="beat-loop-mark" aria-hidden="true">
          {LOOP_MARKS[loopRole]}
        </span>
      ) : null}
      {cell.change && lowConfidence ? (
        <span
          className="beat-confidence"
          aria-hidden="true"
          title={t('grid.confidence', { percent: Math.round((cell.confidence ?? 0) * 100) })}
        >
          ?
        </span>
      ) : null}
    </button>
  );
});

interface BeatGridProps {
  rows: BeatRow[];
  beatsPerBar: number;
  notation: Notation;
  accidental: Accidental;
  clock: PlaybackClock | null;
  onSeek: (time: number) => void;
  follow?: boolean;
  loopA?: number | null;
  loopB?: number | null;
  markMode?: 'a' | 'b' | null;
}

export function BeatGrid({
  rows,
  beatsPerBar,
  notation,
  accidental,
  clock,
  onSeek,
  follow = true,
  loopA = null,
  loopB = null,
  markMode = null,
}: BeatGridProps) {
  const t = useT();
  const activeBeat = useBeatIndex(clock);
  const containerRef = useRef<HTMLDivElement>(null);
  const manualUntil = useRef(0);
  const [previewBar, setPreviewBar] = useState<number | null>(null);
  const activeRowIndex = rows.findIndex((row) =>
    row.cells.some((cell) => cell?.beatIndex === activeBeat),
  );

  useEffect(() => {
    if (markMode === null) setPreviewBar(null);
  }, [markMode]);

  const hoverBar = (barIndex: number | null) => {
    if (markMode === null) return;
    setPreviewBar(barIndex);
  };

  const loopBars = useMemo(() => {
    const starts: number[] = [];
    for (const row of rows) {
      for (const bar of row.bars) starts[bar.index] = bar.start;
    }

    const findBarAt = (time: number | null): number => {
      if (time === null || !Number.isFinite(time)) return -1;
      let found = -1;
      let best = 0.08;
      for (let index = 0; index < starts.length; index += 1) {
        const start = starts[index];
        if (start === undefined) continue;
        const diff = Math.abs(start - time);
        if (diff <= best) {
          best = diff;
          found = index;
        }
      }
      return found;
    };

    let b = -1;
    if (loopB !== null && Number.isFinite(loopB)) {
      for (let index = 0; index < starts.length; index += 1) {
        const start = starts[index];
        if (start !== undefined && start < loopB - 0.05) b = index;
      }
    }

    return { a: findBarAt(loopA), b };
  }, [rows, loopA, loopB]);

  const loopRoleFor = (barIndex: number): LoopRole => {
    const isA = barIndex === loopBars.a;
    const isB = barIndex === loopBars.b;
    if (isA && isB) return 'ab';
    if (isA) return 'a';
    if (isB) return 'b';
    if (loopBars.a >= 0 && loopBars.b >= 0 && barIndex > loopBars.a && barIndex < loopBars.b) {
      return 'range';
    }
    return null;
  };

  useEffect(() => {
    if (!follow || activeRowIndex < 0 || Date.now() < manualUntil.current) return;
    containerRef.current
      ?.querySelector<HTMLElement>(`[data-testid="beat-row-${activeRowIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeRowIndex, follow]);

  const focusBeat = (beatIndex: number) => {
    containerRef.current
      ?.querySelector<HTMLElement>(`[data-beat-index="${beatIndex}"]`)
      ?.focus();
  };

  const firstCellIn = (rowIndex: number): BeatCell | null => {
    const row = rows[rowIndex];
    return row?.cells.find((cell): cell is BeatCell => cell !== null) ?? null;
  };

  const lastCellIn = (rowIndex: number): BeatCell | null => {
    const row = rows[rowIndex];
    if (!row) return null;
    for (let index = row.cells.length - 1; index >= 0; index -= 1) {
      const cell = row.cells[index];
      if (cell) return cell;
    }
    return null;
  };

  const neighborInRow = (
    row: BeatRow,
    cellIndex: number,
    direction: -1 | 1,
  ): BeatCell | null => {
    for (let index = cellIndex + direction; index >= 0 && index < row.cells.length; index += direction) {
      const cell = row.cells[index];
      if (cell) return cell;
    }
    return null;
  };

  const navigate = (
    event: KeyboardEvent<HTMLButtonElement>,
    rowIndex: number,
    cellIndex: number,
  ) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const row = rows[rowIndex];
      if (!row) return;
      const target = neighborInRow(row, cellIndex, event.key === 'ArrowRight' ? 1 : -1);
      if (target) focusBeat(target.beatIndex);
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const targetRow = rows[rowIndex + (event.key === 'ArrowDown' ? 1 : -1)];
      if (!targetRow) return;
      const sameCell = targetRow.cells[cellIndex] ?? null;
      const target = sameCell ?? firstCellIn(targetRow.index);
      if (target) focusBeat(target.beatIndex);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      const first = rows[0] ? firstCellIn(rows[0].index) : null;
      if (first) focusBeat(first.beatIndex);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      const last = rows.length > 0 ? lastCellIn(rows.length - 1) : null;
      if (last) focusBeat(last.beatIndex);
    }
  };

  const markManualScroll = () => {
    manualUntil.current = Date.now() + 3000;
  };

  return (
    <div
      ref={containerRef}
      data-testid="beat-grid"
      data-mark-mode={markMode ?? undefined}
      className="max-h-[68vh] w-full min-w-0 overflow-y-auto border-y border-line"
      onWheel={markManualScroll}
      onTouchMove={markManualScroll}
      onMouseLeave={() => setPreviewBar(null)}
      role="group"
      aria-label={t('grid.beatGridAria')}
    >
      <div className="w-full min-w-0 divide-y divide-line">
        {rows.map((row) => (
          <div
            key={row.index}
            data-testid={`beat-row-${row.index}`}
            className="flex items-stretch"
          >
            <div className="flex w-16 shrink-0 flex-col justify-center gap-0.5 border-r border-line px-2 py-1 font-mono text-[0.6rem] uppercase leading-tight tracking-[0.1em] text-ink3">
              <span className="tabular-nums">{formatTime(row.start)}</span>
              <span>C{(row.bars[0]?.index ?? row.index * 2) + 1}</span>
            </div>
            <div
              className="grid flex-1 items-stretch"
              style={{
                gridTemplateColumns: `repeat(${row.cells.length}, minmax(0, 1fr))`,
              }}
            >
              {row.cells.map((cell, cellIndex) =>
                cell ? (
                  <BeatCellButton
                    key={`${row.index}-${cellIndex}`}
                    cell={cell}
                    rowIndex={row.index}
                    cellIndex={cellIndex}
                    barStart={cellIndex % beatsPerBar === 0}
                    beatsPerBar={beatsPerBar}
                    notation={notation}
                    accidental={accidental}
                    clock={clock}
                    loopRole={loopRoleFor(Math.floor(cell.beatIndex / beatsPerBar))}
                    showLoopMark={cellIndex % beatsPerBar === 0}
                    markPreview={
                      markMode !== null &&
                      previewBar === Math.floor(cell.beatIndex / beatsPerBar)
                        ? markMode
                        : null
                    }
                    onHoverBar={hoverBar}
                    onSeek={onSeek}
                    onNavigate={navigate}
                  />
                ) : (
                  <div
                    key={`${row.index}-${cellIndex}`}
                    aria-hidden="true"
                    data-loop={
                      loopRoleFor(
                        row.bars[Math.floor(cellIndex / beatsPerBar)]?.index ?? -1,
                      ) ?? undefined
                    }
                    data-mark-preview={
                      markMode !== null &&
                      previewBar ===
                        (row.bars[Math.floor(cellIndex / beatsPerBar)]?.index ?? -1)
                        ? markMode
                        : undefined
                    }
                    className="beat-cell border-r border-line/40 bg-panel-2/40"
                    onMouseEnter={() =>
                      hoverBar(row.bars[Math.floor(cellIndex / beatsPerBar)]?.index ?? null)
                    }
                  />
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function activeBeatDescription(
  rows: BeatRow[],
  beatIndex: number,
  beatsPerBar: number,
  notation: Notation,
  accidental: Accidental,
): string {
  if (beatIndex < 0) return '';
  const row = rows.find((candidate) =>
    candidate.cells.some((cell) => cell?.beatIndex === beatIndex),
  );
  if (!row) return '';

  const barIndex = Math.floor(beatIndex / beatsPerBar);
  const beatOffset = beatIndex % beatsPerBar;
  const cell = row.cells.find((candidate) => candidate?.beatIndex === beatIndex);
  if (!cell) return '';
  const chord = formatChordOrSilence(cell.chord, notation, accidental);
  return translate(getLanguage(), 'grid.activeRow', {
    row: row.index + 1,
    bar: barIndex + 1,
    beat: beatOffset + 1,
    chord,
  });
}
