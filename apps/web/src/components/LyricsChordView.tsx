import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  formatTime,
  type Accidental,
  type ChordSegment,
  type Notation,
} from '@chordifree/chords';
import { buildLyricLines, chordRowMargin } from '../lyrics/lines';
import { useT } from '../i18n';
import type { PlaybackClock } from '../sync/clock';
import { usePlaybackTime } from '../sync/hooks';

interface LyricsChordViewProps {
  lyrics: string;
  segments: ChordSegment[];
  beats: number[];
  beatsPerBar: number;
  duration: number;
  notation: Notation;
  accidental: Accidental;
  clock: PlaybackClock | null;
  vocalRegions?: Array<{ start: number; end: number }>;
  chordOffsets?: Record<string, number>;
  chordLines?: Record<string, number>;
  onChordOffsetChange?: (segmentIndex: number, offset: number) => void;
  onChordLineChange?: (segmentIndex: number, lineIndex: number | null) => void;
  onResetChordOffsets?: () => void;
  onSeek: (time: number) => void;
  onEdit: () => void;
}

export function LyricsChordView({
  lyrics,
  segments,
  beats,
  beatsPerBar,
  duration,
  notation,
  accidental,
  clock,
  vocalRegions = [],
  chordOffsets,
  chordLines,
  onChordOffsetChange,
  onChordLineChange,
  onResetChordOffsets,
  onSeek,
  onEdit,
}: LyricsChordViewProps) {
  const t = useT();
  const lines = useMemo(
    () =>
      buildLyricLines({
        lyrics,
        segments,
        beats,
        beatsPerBar,
        duration,
        notation,
        accidental,
        vocalRegions,
        chordLines,
      }),
    [
      lyrics,
      segments,
      beats,
      beatsPerBar,
      duration,
      notation,
      accidental,
      vocalRegions,
      chordLines,
    ],
  );

  const activeTime = usePlaybackTime(clock);
  const activeLine = useMemo(() => {
    if (activeTime === null || activeTime < 0) return null;
    return (
      lines.find((line) =>
        line.spans.some(
          (span) => activeTime >= span.start - 1e-6 && activeTime < span.end - 1e-6,
        ),
      ) ?? null
    );
  }, [lines, activeTime]);
  const activeLineIndex = activeLine?.index ?? null;
  const listRef = useRef<HTMLOListElement>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [dragging, setDragging] = useState<{
    segmentIndex: number;
    startX: number;
    startY: number;
    startOffset: number;
    startLine: number;
    offset: number;
    lineDelta: number;
    moved: boolean;
  } | null>(null);

  const clampOffset = (value: number) => Math.max(-4, Math.min(4, Math.round(value * 20) / 20));
  const offsetFor = (segmentIndex: number) => chordOffsets?.[String(segmentIndex)] ?? 0;
  const changeOffset = (segmentIndex: number, offset: number) => {
    onChordOffsetChange?.(segmentIndex, clampOffset(offset));
  };

  const lineAtDelta = (lineIndex: number, delta: number): number => {
    const nonEmpty = lines.filter((line) => line.text.trim().length > 0);
    const position = nonEmpty.findIndex((line) => line.index === lineIndex);
    if (position < 0) return lineIndex;
    const target = nonEmpty[Math.max(0, Math.min(nonEmpty.length - 1, position + delta))];
    return target?.index ?? lineIndex;
  };

  const neighborLine = (lineIndex: number, direction: -1 | 1): number | null => {
    const target = lineAtDelta(lineIndex, direction);
    return target === lineIndex ? null : target;
  };

  const startDrag = (
    event: PointerEvent<HTMLButtonElement>,
    segmentIndex: number,
    lineIndex: number,
  ) => {
    if (!adjusting || (!onChordOffsetChange && !onChordLineChange)) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging({
      segmentIndex,
      startX: event.clientX,
      startY: event.clientY,
      startOffset: offsetFor(segmentIndex),
      startLine: lineIndex,
      offset: offsetFor(segmentIndex),
      lineDelta: 0,
      moved: false,
    });
  };

  const moveDrag = (event: PointerEvent<HTMLButtonElement>, segmentIndex: number) => {
    if (!dragging || dragging.segmentIndex !== segmentIndex) return;
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const offset = onChordOffsetChange
      ? clampOffset(dragging.startOffset + (event.clientX - dragging.startX) / rootFontSize)
      : dragging.startOffset;
    const lineDelta = onChordLineChange
      ? Math.trunc((event.clientY - dragging.startY) / 36)
      : 0;
    if (offset !== dragging.offset || lineDelta !== dragging.lineDelta) {
      setDragging({ ...dragging, offset, lineDelta, moved: true });
    }
  };

  const endDrag = (segmentIndex: number) => {
    if (!dragging || dragging.segmentIndex !== segmentIndex) return;
    if (dragging.moved) {
      if (onChordOffsetChange) changeOffset(segmentIndex, dragging.offset);
      if (onChordLineChange) {
        const target = lineAtDelta(dragging.startLine, dragging.lineDelta);
        if (target !== dragging.startLine) onChordLineChange(segmentIndex, target);
      }
    }
    setDragging(null);
  };

  const dropLine =
    dragging && dragging.lineDelta !== 0
      ? lineAtDelta(dragging.startLine, dragging.lineDelta)
      : null;

  useEffect(() => {
    if (activeLineIndex === null) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-lyric-line="${activeLineIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeLineIndex]);

  const activeChord = useMemo(() => {
    if (!activeLine) return null;
    const candidates = activeLine.chords.filter((chord) => chord.time <= activeTime! + 0.05);
    return candidates[candidates.length - 1] ?? activeLine.chords[0] ?? null;
  }, [activeLine, activeTime]);

  if (!lyrics.trim()) {
    return (
      <div className="lyrics-empty">
        <p className="font-display text-xl font-bold text-ink">{t('lyrics.emptyTitle')}</p>
        <p className="mx-auto mt-2 max-w-[42ch] text-sm leading-relaxed text-ink2">
          {t('lyrics.emptyBody')}
        </p>
        <button type="button" className="btn btn-primary mt-4" onClick={onEdit}>
          {t('lyrics.add')}
        </button>
      </div>
    );
  }

  return (
    <div className="lyrics-view">
      <div className="lyrics-toolbar">
        <p className="eyebrow">{t('lyrics.approx')}</p>
        <div className="flex flex-wrap gap-2">
          {onChordOffsetChange ? (
            <button
              type="button"
              className="btn min-h-0 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.1em]"
              aria-pressed={adjusting}
              onClick={() => setAdjusting((current) => !current)}
            >
              {adjusting ? t('lyrics.adjustDone') : t('lyrics.adjust')}
            </button>
          ) : null}
          {adjusting && onResetChordOffsets ? (
            <button
              type="button"
              className="btn min-h-0 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.1em]"
              onClick={onResetChordOffsets}
            >
              {t('lyrics.resetChords')}
            </button>
          ) : null}
          <button
            type="button"
            className="btn min-h-0 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.1em]"
            onClick={onEdit}
          >
            {t('lyrics.edit')}
          </button>
        </div>
      </div>
      {adjusting ? <p className="lyrics-adjust-hint">{t('lyrics.adjustHint')}</p> : null}

      <ol ref={listRef} className="lyrics-list" aria-label={t('lyrics.listAria')}>
        {lines.map((line) => {
          if (!line.text.trim()) {
            return <li key={line.index} className="lyrics-gap" aria-hidden="true" />;
          }
          const active = line.index === activeLineIndex;
          return (
            <li
              key={line.index}
              className={`lyrics-line${dropLine === line.index ? ' lyrics-line-drop' : ''}`}
              data-lyric-line={line.index}
              aria-current={active ? 'true' : undefined}
            >
              {line.chords.length > 0 ? (
                <div
                  className="lyrics-chords"
                  role="group"
                  aria-label={t('lyrics.chordsOfLine', { line: line.index + 1 })}
                  style={{ paddingLeft: chordRowMargin(line.chords) }}
                >
                  {line.chords.map((chord) => {
                    const chordIsActive = chord === activeChord;
                    const offset =
                      dragging?.segmentIndex === chord.segmentIndex
                        ? dragging.offset
                        : offsetFor(chord.segmentIndex);
                    return (
                      <span
                        key={`${chord.segmentIndex}-${chord.time}`}
                        className="lyrics-chord-item"
                      >
                        <button
                          type="button"
                          className="lyrics-chord"
                          style={{ transform: `translateX(${offset}em)` }}
                          aria-current={chordIsActive ? 'true' : undefined}
                          aria-label={`${chord.label} en ${formatTime(chord.time)}`}
                          onClick={() => onSeek(chord.time)}
                        >
                          {chord.label}
                        </button>
                        {adjusting ? (
                          <button
                            type="button"
                            className="lyrics-chord-handle"
                            aria-label={t('lyrics.moveChord', { chord: chord.label })}
                            title={t('lyrics.adjustHint')}
                            onPointerDown={(event) =>
                              startDrag(event, chord.segmentIndex, line.index)
                            }
                            onPointerMove={(event) => moveDrag(event, chord.segmentIndex)}
                            onPointerUp={() => endDrag(chord.segmentIndex)}
                            onPointerCancel={() => setDragging(null)}
                            onKeyDown={(event) => {
                              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                                event.preventDefault();
                                changeOffset(
                                  chord.segmentIndex,
                                  offsetFor(chord.segmentIndex) +
                                    (event.key === 'ArrowLeft' ? -0.25 : 0.25),
                                );
                                return;
                              }
                              if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                                event.preventDefault();
                                if (!onChordLineChange) return;
                                const target = neighborLine(
                                  line.index,
                                  event.key === 'ArrowUp' ? -1 : 1,
                                );
                                if (target !== null) onChordLineChange(chord.segmentIndex, target);
                                return;
                              }
                              if (event.key === 'Home' || event.key === '0') {
                                event.preventDefault();
                                onChordLineChange?.(chord.segmentIndex, null);
                                changeOffset(chord.segmentIndex, 0);
                              }
                            }}
                          >
                            <svg
                              viewBox="0 0 16 16"
                              width="12"
                              height="12"
                              aria-hidden="true"
                              focusable="false"
                            >
                              <path
                                d="M8 1v14M1 8h14M8 1 6 3m2-2 2 2M8 15l-2-2m2 2 2-2M1 8l2-2m-2 2 2 2M15 8l-2-2m2 2-2 2"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        ) : null}
                      </span>
                    );
                  })}
                </div>
              ) : null}
              <button
                type="button"
                className="lyrics-text"
                aria-label={t('lyrics.goToLine', { line: line.index + 1, time: formatTime(line.start) })}
                onClick={() => onSeek(line.start)}
              >
                {line.text}
              </button>
            </li>
          );
        })}
      </ol>

      {segments.length === 0 ? (
        <p className="note note-info mt-3 text-xs leading-relaxed">
          No hay acordes detectados; la letra se muestra sin capa de acordes.
        </p>
      ) : null}
    </div>
  );
}
