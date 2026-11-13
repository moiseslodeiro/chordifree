import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  formatChord,
  formatTime,
  type Accidental,
  type ChordSegment,
  type Notation,
} from '@chordifree/chords';
import {
  alignLyrics,
  buildChordChanges,
  type AlignedChord,
} from '../lyrics/align';
import { useT } from '../i18n';
import { detectInstrumentalSpans, harmonyBars } from '../lyrics/sections';
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

function chordMargin(lineChords: AlignedChord[]): string | undefined {
  const first = lineChords[0];
  if (!first || first.offset <= 0) return undefined;
  return `${Math.min(22, first.offset * 22)}%`;
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
  const changes = useMemo(
    () =>
      buildChordChanges(segments, (chord) => formatChord(chord, notation, accidental)),
    [segments, notation, accidental],
  );
  const instrumental = useMemo(
    () =>
      detectInstrumentalSpans(
        harmonyBars(segments, beats, beatsPerBar, duration),
        duration,
      ),
    [segments, beats, beatsPerBar, duration],
  );
  const lines = useMemo(() => {
    const aligned = alignLyrics(lyrics, changes, duration, { instrumental, vocalRegions });
    if (!chordLines || Object.keys(chordLines).length === 0) return aligned;

    const copy = aligned.map((line) => ({ ...line, chords: [...line.chords] }));
    const byIndex = new Map(copy.map((line) => [line.index, line] as const));
    const overrides = new Map<string, number>();
    for (const [key, target] of Object.entries(chordLines)) {
      const line = byIndex.get(target);
      if (line && line.text.trim().length > 0) overrides.set(key, target);
    }
    if (overrides.size === 0) return aligned;

    const moved = new Map<number, AlignedChord[]>();
    for (const line of copy) {
      line.chords = line.chords.filter((chord) => {
        const target = overrides.get(String(chord.segmentIndex));
        if (target === undefined || target === line.index) return true;
        const list = moved.get(target) ?? [];
        list.push(chord);
        moved.set(target, list);
        return false;
      });
    }

    for (const [target, chords] of moved) {
      const line = byIndex.get(target);
      if (!line) continue;
      const start = line.spans[0]?.start ?? line.start;
      const end = line.spans[line.spans.length - 1]?.end ?? line.end;
      for (const chord of chords) {
        const offset =
          end > start ? Math.max(0, Math.min(1, (chord.time - start) / (end - start))) : 0;
        line.chords.push({ ...chord, offset });
      }
      line.chords.sort((a, b) => a.time - b.time || a.segmentIndex - b.segmentIndex);
    }
    return copy;
  }, [lyrics, changes, duration, instrumental, vocalRegions, chordLines]);

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
    startOffset: number;
    offset: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  const clampOffset = (value: number) => Math.max(-4, Math.min(4, Math.round(value * 20) / 20));
  const offsetFor = (segmentIndex: number) => chordOffsets?.[String(segmentIndex)] ?? 0;
  const changeOffset = (segmentIndex: number, offset: number) => {
    onChordOffsetChange?.(segmentIndex, clampOffset(offset));
  };

  const startDrag = (event: PointerEvent<HTMLButtonElement>, segmentIndex: number) => {
    if (!adjusting || !onChordOffsetChange) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging({
      segmentIndex,
      startX: event.clientX,
      startOffset: offsetFor(segmentIndex),
      offset: offsetFor(segmentIndex),
      moved: false,
    });
  };

  const moveDrag = (event: PointerEvent<HTMLButtonElement>, segmentIndex: number) => {
    if (!dragging || dragging.segmentIndex !== segmentIndex) return;
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const next = clampOffset(dragging.startOffset + (event.clientX - dragging.startX) / rootFontSize);
    if (next !== dragging.offset) {
      setDragging({ ...dragging, offset: next, moved: true });
    }
  };

  const endDrag = (segmentIndex: number) => {
    if (!dragging || dragging.segmentIndex !== segmentIndex) return;
    if (dragging.moved) {
      suppressClick.current = true;
      changeOffset(segmentIndex, dragging.offset);
    }
    setDragging(null);
  };

  const neighborLine = (lineIndex: number, direction: -1 | 1): number | null => {
    const nonEmpty = lines.filter((line) => line.text.trim().length > 0);
    const position = nonEmpty.findIndex((line) => line.index === lineIndex);
    if (position < 0) return null;
    return nonEmpty[position + direction]?.index ?? null;
  };

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
              className="lyrics-line"
              data-lyric-line={line.index}
              aria-current={active ? 'true' : undefined}
            >
              {line.chords.length > 0 ? (
                <div
                  className="lyrics-chords"
                  role="group"
                  aria-label={t('lyrics.chordsOfLine', { line: line.index + 1 })}
                  style={{ paddingLeft: chordMargin(line.chords) }}
                >
                  {line.chords.map((chord) => {
                    const chordIsActive = chord === activeChord;
                    const offset =
                      dragging?.segmentIndex === chord.segmentIndex
                        ? dragging.offset
                        : offsetFor(chord.segmentIndex);
                    return (
                      <button
                        key={`${chord.segmentIndex}-${chord.time}`}
                        type="button"
                        className={`lyrics-chord${adjusting ? ' lyrics-chord-adjust' : ''}`}
                        style={{ transform: `translateX(${offset}em)` }}
                        aria-current={chordIsActive ? 'true' : undefined}
                        aria-label={`${chord.label} en ${formatTime(chord.time)}`}
                        title={adjusting ? t('lyrics.adjustHint') : undefined}
                        onPointerDown={(event) => startDrag(event, chord.segmentIndex)}
                        onPointerMove={(event) => moveDrag(event, chord.segmentIndex)}
                        onPointerUp={() => endDrag(chord.segmentIndex)}
                        onPointerCancel={() => setDragging(null)}
                        onKeyDown={(event) => {
                          if (!adjusting) return;
                          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                            event.preventDefault();
                            changeOffset(
                              chord.segmentIndex,
                              offsetFor(chord.segmentIndex) + (event.key === 'ArrowLeft' ? -0.25 : 0.25),
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
                        onClick={() => {
                          if (suppressClick.current) {
                            suppressClick.current = false;
                            return;
                          }
                          onSeek(chord.time);
                        }}
                      >
                        {chord.label}
                      </button>
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
