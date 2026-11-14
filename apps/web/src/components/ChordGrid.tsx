import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  formatChordOrSilence,
  formatTime,
  type Accidental,
  type ChordSegment,
  type Notation,
} from '@chordifree/chords';
import { useT } from '../i18n';
import { buildBeatRows } from '../grid/beats';
import { chooseBarAlignment, type BarTempo } from '../grid/barAlignment';
import type { PlaybackClock } from '../sync/clock';
import { useBeatIndex, useIsRowActive, usePlaybackIndex } from '../sync/hooks';
import type { GridView } from '../types';
import { activeBeatDescription, BeatGrid } from './BeatGrid';
import { BarGrid } from './BarGrid';
import { LyricsChordView } from './LyricsChordView';

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
 * On mobile the grid shows one bar per row so it fits without horizontal
 * scrolling; from `sm` onward it returns to two bars per row.
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
  const t = useT();
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
          {segment.chord === null ? <span className="badge shrink-0">{t('common.silence')}</span> : null}
          {segment.chord !== null &&
          segment.confidence !== undefined &&
          segment.confidence < 0.4 ? (
            <span
              className="badge shrink-0 border-warning/50 text-warning"
              title={t('grid.confidence', { percent: Math.round(segment.confidence * 100) })}
            >
              {t('grid.doubtful')}
            </span>
          ) : null}
          {active ? (
            <span className="badge shrink-0 border-accent/50 text-accent">{t('grid.sounding')}</span>
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
  onSelectBar?: (time: number) => void;
  beats?: number[];
  beatsPerBar?: number;
  duration?: number;
  view?: GridView;
  onViewChange?: (view: GridView) => void;
  lyrics?: string;
  lyricChordOffsets?: Record<string, number>;
  lyricChordLines?: Record<string, number>;
  onLyricChordOffsetChange?: (segmentIndex: number, offset: number) => void;
  onLyricChordLineChange?: (segmentIndex: number, lineIndex: number | null) => void;
  onResetLyricChordOffsets?: () => void;
  lyricsSegments?: ChordSegment[];
  onEditLyrics?: () => void;
  loopA?: number | null;
  loopB?: number | null;
  markMode?: 'a' | 'b' | null;
  vocalRegions?: Array<{ start: number; end: number }>;
}

export function ChordGrid({
  segments,
  notation,
  accidental,
  clock,
  onSeek,
  onSelectBar,
  beats = [],
  beatsPerBar = 4,
  duration,
  view = 'list',
  onViewChange = () => undefined,
  lyrics = '',
  lyricChordOffsets,
  lyricChordLines,
  onLyricChordOffsetChange,
  onLyricChordLineChange,
  onResetLyricChordOffsets,
  lyricsSegments,
  onEditLyrics = () => undefined,
  loopA = null,
  loopB = null,
  markMode = null,
  vocalRegions = [],
}: ChordGridProps) {
  const t = useT();
  const active = usePlaybackIndex(clock);
  const activeBeat = useBeatIndex(clock);
  const compact = useCompactGrid();
  const [barTempo, setBarTempo] = useState<BarTempo>('auto');
  const rows = useMemo(
    () => buildBeatRows(segments, beats, beatsPerBar, compact ? 1 : 2, duration),
    [segments, beats, beatsPerBar, duration, compact],
  );
  const barCount = rows.reduce((total, row) => total + row.bars.length, 0);
  const canUseBeats = rows.length > 0;
  const sheetDuration = duration ?? segments.at(-1)?.end ?? 0;
  const effectiveView: GridView =
    view === 'lyrics'
      ? 'lyrics'
      : view === 'bars'
        ? 'bars'
        : view === 'beats' && canUseBeats
          ? 'beats'
          : 'list';
  const barAlignment = useMemo(
    () =>
      chooseBarAlignment(
        lyricsSegments ?? segments,
        beats,
        beatsPerBar,
        sheetDuration,
        barTempo,
      ),
    [lyricsSegments, segments, beats, beatsPerBar, sheetDuration, barTempo],
  );
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
        {t('grid.noChords')}
      </div>
    );
  }

  const activeSegment = active >= 0 ? segments[active] : undefined;
  const liveMessage =
    effectiveView === 'beats'
      ? activeBeatDescription(rows, activeBeat, beatsPerBar, notation, accidental)
      : activeSegment
        ? t('grid.activeChord', {
            chord: formatChordOrSilence(activeSegment.chord, notation, accidental),
            time: formatTime(activeSegment.start),
          })
        : '';

  return (
    <section
      className="overflow-hidden rounded-xl border border-line bg-panel p-4 shadow-sm sm:p-5"
      aria-label={t('grid.timelineAria')}
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-display text-2xl leading-none text-ink">{t('grid.timeline')}</h2>
          <span className="eyebrow">
            {effectiveView === 'beats'
              ? t('grid.rowCount', {
                  rows: rows.length,
                  bars: barCount,
                })
              : effectiveView === 'lyrics'
                ? t('grid.lyricsWithChords')
                : effectiveView === 'bars'
                  ? `${barAlignment.bars.length} ${
                      barAlignment.bars.length === 1
                        ? t('common.measure')
                        : t('common.measures')
                    } · ${barAlignment.factor === 'half' ? t('grid.halfTempo') : t('grid.normalTempo')}`
                  : t('grid.segments', { count: segments.length })}
          </span>
        </div>
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label={t('grid.viewAria')}
        >
          <button
            type="button"
            aria-pressed={effectiveView === 'beats'}
            disabled={!canUseBeats}
            className={effectiveView === 'beats' ? 'tool-chip-active' : 'tool-chip'}
            onClick={() => onViewChange('beats')}
          >
            {t('grid.beats')}
          </button>
          <button
            type="button"
            aria-pressed={effectiveView === 'list'}
            className={effectiveView === 'list' ? 'tool-chip-active' : 'tool-chip'}
            onClick={() => onViewChange('list')}
          >
            {t('grid.list')}
          </button>
          <button
            type="button"
            aria-pressed={effectiveView === 'bars'}
            className={effectiveView === 'bars' ? 'tool-chip-active' : 'tool-chip'}
            onClick={() => onViewChange('bars')}
          >
            {t('grid.bars')}
          </button>
          <button
            type="button"
            aria-pressed={effectiveView === 'lyrics'}
            className={effectiveView === 'lyrics' ? 'tool-chip-active' : 'tool-chip'}
            onClick={() => onViewChange('lyrics')}
          >
            {t('grid.lyrics')}
          </button>
          <button
            type="button"
            aria-pressed={follow}
            className={follow ? 'tool-chip-active' : 'tool-chip'}
            title={t('grid.autoScrollTitle')}
            onClick={() => setFollow((value) => !value)}
          >
            {t('grid.autoScroll')}
          </button>
        </div>
      </div>

      {effectiveView === 'bars' ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-b border-line pb-3">
          <span className="eyebrow">{t('grid.frame')}</span>
          <div
            className="flex items-center gap-1"
            role="group"
            aria-label={t('grid.barTempo')}
          >
            {(
              [
                ['auto', t('grid.auto')],
                ['normal', t('grid.normal')],
                ['half', t('grid.half')],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={barTempo === value}
                className={barTempo === value ? 'tool-chip-active' : 'tool-chip'}
                onClick={() => setBarTempo(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-xs text-ink3">{t('grid.barHelp')}</span>
        </div>
      ) : null}

      {!canUseBeats && effectiveView !== 'lyrics' && effectiveView !== 'bars' ? (
        <p className="note note-warning mt-3 text-xs leading-relaxed">
          {t('grid.noBeats')}
        </p>
      ) : null}

      {effectiveView === 'bars' ? (
        <BarGrid
          bars={barAlignment.bars}
          notation={notation}
          accidental={accidental}
          clock={clock}
          onSelectBar={onSelectBar ?? onSeek}
          loopA={loopA}
          loopB={loopB}
          markMode={markMode}
        />
      ) : effectiveView === 'lyrics' ? (
        <LyricsChordView
          lyrics={lyrics}
          segments={lyricsSegments ?? segments}
          beats={beats}
          beatsPerBar={beatsPerBar}
          duration={sheetDuration}
          notation={notation}
          accidental={accidental}
          clock={clock}
          vocalRegions={vocalRegions}
          chordOffsets={lyricChordOffsets}
          chordLines={lyricChordLines}
          onChordOffsetChange={onLyricChordOffsetChange}
          onChordLineChange={onLyricChordLineChange}
          onResetChordOffsets={onResetLyricChordOffsets}
          onSeek={onSeek}
          onEdit={onEditLyrics}
        />
      ) : effectiveView === 'beats' ? (
        <div className="mt-3">
          <BeatGrid
            rows={rows}
            beatsPerBar={beatsPerBar}
            notation={notation}
            accidental={accidental}
            clock={clock}
            onSeek={onSelectBar ?? onSeek}
            follow={follow}
            loopA={loopA}
            loopB={loopB}
            markMode={markMode}
          />
        </div>
      ) : (
        <div
          className="max-h-[60vh] overflow-y-auto pr-1"
          onWheel={markManualScroll}
          onTouchMove={markManualScroll}
        >
          <ol ref={listRef} className="mt-3" aria-label={t('grid.detectedChords')}>
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
        {markMode !== null
          ? t(markMode === 'a' ? 'grid.markAHelp' : 'grid.markBHelp')
          : effectiveView === 'beats'
            ? t('grid.beatHelp')
            : effectiveView === 'bars'
              ? t('grid.barHelpClick')
              : effectiveView === 'lyrics'
                ? t('grid.lyricsHelp')
                : t('grid.listHelp')}
      </p>
    </section>
  );
}
