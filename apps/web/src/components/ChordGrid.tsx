import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  formatChordOrSilence,
  formatTime,
  type Accidental,
  type ChordSegment,
  type Notation,
} from '@chordifree/chords';
import { useT, type MessageKey } from '../i18n';
import { keepLookaheadVisible } from '../grid/scroll';
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
  practiceHit: boolean;
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
  practiceHit,
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
        data-practice-hit={practiceHit ? 'true' : undefined}
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
        <span className="font-mono text-[0.7rem] tabular-nums text-ink3">
          {formatTime(segment.start)}
        </span>
        <span className="truncate font-display text-xl font-bold leading-tight text-ink">
          {label}
        </span>
        <span className="flex items-center gap-2">
          {segment.chord === null ? (
            <span className="badge shrink-0">{t('common.silence')}</span>
          ) : null}
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
            <span className="badge shrink-0 border-accent/50 text-accent">
              {t('grid.sounding')}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
});

function useFollowActiveRow(
  listRef: React.RefObject<HTMLOListElement | null>,
  follow: boolean,
  view: GridView,
  active: number,
  manualUntil: React.RefObject<number>,
): void {
  useEffect(() => {
    if (!follow || view !== 'list' || active < 0 || Date.now() < manualUntil.current) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-testid="chord-row-${active}"]`);
    keepLookaheadVisible(row ?? null);
  }, [listRef, follow, view, active, manualUntil]);
}

function alignmentSegments(
  lyricsSegments: ChordSegment[] | undefined,
  fallback: ChordSegment[],
): ChordSegment[] {
  return lyricsSegments ?? fallback;
}

function focusChordRow(
  listRef: React.RefObject<HTMLOListElement | null>,
  count: number,
  index: number,
): void {
  const safe = Math.max(0, Math.min(count - 1, index));
  listRef.current?.querySelector<HTMLElement>(`[data-testid="chord-row-${safe}"]`)?.focus();
}

function columnsFor(compact: boolean): number {
  return compact ? 1 : 2;
}

function sheetDurationOf(segments: ChordSegment[], duration?: number): number {
  return duration ?? segments.at(-1)?.end ?? 0;
}

function segmentAt(segments: ChordSegment[], index: number): ChordSegment | undefined {
  if (index < 0) return undefined;
  return segments[index];
}

type Translate = ReturnType<typeof useT>;
type BarAlignment = ReturnType<typeof chooseBarAlignment>;

function resolveEffectiveView(view: GridView, canUseBeats: boolean): GridView {
  if (view === 'lyrics' || view === 'bars') return view;
  if (view === 'beats' && canUseBeats) return 'beats';
  return 'list';
}

function viewSummary(
  t: Translate,
  view: GridView,
  rows: ReturnType<typeof buildBeatRows>,
  barCount: number,
  barAlignment: BarAlignment,
  segments: ChordSegment[],
): string {
  if (view === 'beats') return t('grid.rowCount', { rows: rows.length, bars: barCount });
  if (view === 'lyrics') return t('grid.lyricsWithChords');
  if (view === 'bars') {
    const measures = barAlignment.bars.length === 1 ? t('common.measure') : t('common.measures');
    const tempo = barAlignment.factor === 'half' ? t('grid.halfTempo') : t('grid.normalTempo');
    return `${barAlignment.bars.length} ${measures} · ${tempo}`;
  }
  return t('grid.segments', { count: segments.length });
}

function activeMessage(
  t: Translate,
  view: GridView,
  activeSegment: ChordSegment | undefined,
  activeBeatMessage: string,
  notation: Notation,
  accidental: Accidental,
): string {
  if (view === 'beats') return activeBeatMessage;
  if (!activeSegment) return '';
  return t('grid.activeChord', {
    chord: formatChordOrSilence(activeSegment.chord, notation, accidental),
    time: formatTime(activeSegment.start),
  });
}

function viewHelp(t: Translate, markMode: 'a' | 'b' | null, view: GridView): string {
  if (markMode !== null) return t(markMode === 'a' ? 'grid.markAHelp' : 'grid.markBHelp');
  const keys: Record<GridView, MessageKey> = {
    beats: 'grid.beatHelp',
    bars: 'grid.barHelpClick',
    lyrics: 'grid.lyricsHelp',
    list: 'grid.listHelp',
  };
  return t(keys[view]);
}

interface ViewToggleProps {
  view: GridView;
  canUseBeats: boolean;
  follow: boolean;
  onViewChange: (view: GridView) => void;
  onToggleFollow: () => void;
}

function ViewToggle({ view, canUseBeats, follow, onViewChange, onToggleFollow }: ViewToggleProps) {
  const t = useT();
  const options: Array<{ view: GridView; label: string; disabled?: boolean }> = [
    { view: 'beats', label: t('grid.beats'), disabled: !canUseBeats },
    { view: 'list', label: t('grid.list') },
    { view: 'bars', label: t('grid.bars') },
    { view: 'lyrics', label: t('grid.lyrics') },
  ];

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('grid.viewAria')}>
      {options.map((option) => (
        <button
          key={option.view}
          type="button"
          aria-pressed={view === option.view}
          disabled={option.disabled}
          className={view === option.view ? 'tool-chip-active' : 'tool-chip'}
          onClick={() => onViewChange(option.view)}
        >
          {option.label}
        </button>
      ))}
      <button
        type="button"
        aria-pressed={follow}
        className={follow ? 'tool-chip-active' : 'tool-chip'}
        title={t('grid.autoScrollTitle')}
        onClick={onToggleFollow}
      >
        {t('grid.autoScroll')}
      </button>
    </div>
  );
}

interface BarTempoSelectorProps {
  value: BarTempo;
  onChange: (tempo: BarTempo) => void;
}

function BarTempoSelector({ value, onChange }: BarTempoSelectorProps) {
  const t = useT();
  const options: Array<{ value: BarTempo; label: string }> = [
    { value: 'auto', label: t('grid.auto') },
    { value: 'normal', label: t('grid.normal') },
    { value: 'half', label: t('grid.half') },
  ];

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-b border-line pb-3">
      <span className="eyebrow">{t('grid.frame')}</span>
      <div className="flex items-center gap-1" role="group" aria-label={t('grid.barTempo')}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            className={value === option.value ? 'tool-chip-active' : 'tool-chip'}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <span className="text-xs text-ink3">{t('grid.barHelp')}</span>
    </div>
  );
}

interface ChordGridContentProps {
  view: GridView;
  canUseBeats: boolean;
  barAlignment: BarAlignment;
  barTempo: BarTempo;
  onBarTempoChange: (tempo: BarTempo) => void;
  notation: Notation;
  accidental: Accidental;
  clock: PlaybackClock | null;
  segments: ChordSegment[];
  lyricsSegments?: ChordSegment[];
  lyrics: string;
  beats: number[];
  beatsPerBar: number;
  duration: number;
  vocalRegions: Array<{ start: number; end: number }>;
  lyricChordOffsets?: Record<string, number>;
  lyricChordLines?: Record<string, number>;
  onLyricChordOffsetChange?: (segmentIndex: number, offset: number) => void;
  onLyricChordLineChange?: (segmentIndex: number, lineIndex: number | null) => void;
  onResetLyricChordOffsets?: () => void;
  onEditLyrics: () => void;
  onSeek: (time: number) => void;
  onSelectBar?: (time: number) => void;
  loopA: number | null;
  loopB: number | null;
  markMode: 'a' | 'b' | null;
  practiceHits?: ReadonlySet<number>;
  practiceHitRanges: Array<{ start: number; end: number }>;
  rows: ReturnType<typeof buildBeatRows>;
  follow: boolean;
  listRef: React.RefObject<HTMLOListElement | null>;
  onFocusRow: (index: number) => void;
  onManualScroll: () => void;
}

function ChordGridContent({
  view,
  canUseBeats,
  barAlignment,
  barTempo,
  onBarTempoChange,
  notation,
  accidental,
  clock,
  segments,
  lyricsSegments,
  lyrics,
  beats,
  beatsPerBar,
  duration,
  vocalRegions,
  lyricChordOffsets,
  lyricChordLines,
  onLyricChordOffsetChange,
  onLyricChordLineChange,
  onResetLyricChordOffsets,
  onEditLyrics,
  onSeek,
  onSelectBar,
  loopA,
  loopB,
  markMode,
  practiceHits,
  practiceHitRanges,
  rows,
  follow,
  listRef,
  onFocusRow,
  onManualScroll,
}: ChordGridContentProps) {
  const t = useT();
  const target = onSelectBar ?? onSeek;

  if (view === 'bars') {
    return (
      <>
        <BarTempoSelector value={barTempo} onChange={onBarTempoChange} />
        <BarGrid
          bars={barAlignment.bars}
          notation={notation}
          accidental={accidental}
          clock={clock}
          onSelectBar={target}
          loopA={loopA}
          loopB={loopB}
          markMode={markMode}
          practiceHits={practiceHitRanges}
        />
      </>
    );
  }

  if (view === 'lyrics') {
    return (
      <LyricsChordView
        lyrics={lyrics}
        segments={lyricsSegments ?? segments}
        beats={beats}
        beatsPerBar={beatsPerBar}
        duration={duration}
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
    );
  }

  if (view === 'beats') {
    return (
      <div className="mt-3">
        <BeatGrid
          rows={rows}
          beatsPerBar={beatsPerBar}
          notation={notation}
          accidental={accidental}
          clock={clock}
          onSeek={target}
          follow={follow}
          loopA={loopA}
          loopB={loopB}
          markMode={markMode}
          practiceHits={practiceHitRanges}
        />
      </div>
    );
  }

  return (
    <>
      {!canUseBeats ? (
        <p className="note note-warning mt-3 text-xs leading-relaxed">{t('grid.noBeats')}</p>
      ) : null}
      <div
        className="max-h-[60vh] overflow-y-auto pr-1"
        onWheel={onManualScroll}
        onTouchMove={onManualScroll}
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
              practiceHit={practiceHits?.has(index) ?? false}
              onSeek={onSeek}
              onFocusRow={onFocusRow}
            />
          ))}
        </ol>
      </div>
    </>
  );
}

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
  practiceHits?: ReadonlySet<number>;
  practiceHitRanges?: Array<{ start: number; end: number }>;
}

interface ChordGridPanelProps extends ChordGridProps {
  beats: number[];
  beatsPerBar: number;
  lyrics: string;
  onViewChange: (view: GridView) => void;
  onEditLyrics: () => void;
  markMode: 'a' | 'b' | null;
  loopA: number | null;
  loopB: number | null;
  vocalRegions: Array<{ start: number; end: number }>;
  practiceHitRanges: Array<{ start: number; end: number }>;
  effectiveView: GridView;
  canUseBeats: boolean;
  rows: ReturnType<typeof buildBeatRows>;
  barCount: number;
  barAlignment: BarAlignment;
  sheetDuration: number;
  liveMessage: string;
  follow: boolean;
  onToggleFollow: () => void;
  barTempo: BarTempo;
  onBarTempoChange: (tempo: BarTempo) => void;
  listRef: React.RefObject<HTMLOListElement | null>;
  onFocusRow: (index: number) => void;
  onManualScroll: () => void;
}

function ChordGridPanel({
  segments,
  notation,
  accidental,
  clock,
  onSeek,
  onSelectBar,
  beats,
  beatsPerBar,
  onViewChange,
  lyrics,
  lyricChordOffsets,
  lyricChordLines,
  onLyricChordOffsetChange,
  onLyricChordLineChange,
  onResetLyricChordOffsets,
  lyricsSegments,
  onEditLyrics,
  loopA,
  loopB,
  markMode,
  vocalRegions,
  practiceHits,
  practiceHitRanges,
  effectiveView,
  canUseBeats,
  rows,
  barCount,
  barAlignment,
  sheetDuration,
  liveMessage,
  follow,
  onToggleFollow,
  barTempo,
  onBarTempoChange,
  listRef,
  onFocusRow,
  onManualScroll,
}: ChordGridPanelProps) {
  const t = useT();

  return (
    <section
      className="overflow-hidden rounded-xl border border-line bg-panel p-4 shadow-sm sm:p-5"
      aria-label={t('grid.timelineAria')}
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-display text-2xl leading-none text-ink">{t('grid.timeline')}</h2>
          <span className="eyebrow">
            {viewSummary(t, effectiveView, rows, barCount, barAlignment, segments)}
          </span>
        </div>
        <ViewToggle
          view={effectiveView}
          canUseBeats={canUseBeats}
          follow={follow}
          onViewChange={onViewChange}
          onToggleFollow={onToggleFollow}
        />
      </div>

      <ChordGridContent
        view={effectiveView}
        canUseBeats={canUseBeats}
        barAlignment={barAlignment}
        barTempo={barTempo}
        onBarTempoChange={onBarTempoChange}
        notation={notation}
        accidental={accidental}
        clock={clock}
        segments={segments}
        lyricsSegments={lyricsSegments}
        lyrics={lyrics}
        beats={beats}
        beatsPerBar={beatsPerBar}
        duration={sheetDuration}
        vocalRegions={vocalRegions}
        lyricChordOffsets={lyricChordOffsets}
        lyricChordLines={lyricChordLines}
        onLyricChordOffsetChange={onLyricChordOffsetChange}
        onLyricChordLineChange={onLyricChordLineChange}
        onResetLyricChordOffsets={onResetLyricChordOffsets}
        onEditLyrics={onEditLyrics}
        onSeek={onSeek}
        onSelectBar={onSelectBar}
        loopA={loopA}
        loopB={loopB}
        markMode={markMode}
        practiceHits={practiceHits}
        practiceHitRanges={practiceHitRanges}
        rows={rows}
        follow={follow}
        listRef={listRef}
        onFocusRow={onFocusRow}
        onManualScroll={onManualScroll}
      />

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </p>

      <p className="mt-3 font-mono text-[0.62rem] uppercase leading-relaxed tracking-[0.12em] text-ink3">
        {viewHelp(t, markMode, effectiveView)}
      </p>
    </section>
  );
}

function ChordGridBody({
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
  practiceHits,
  practiceHitRanges = [],
}: ChordGridProps) {
  const t = useT();
  const active = usePlaybackIndex(clock);
  const activeBeat = useBeatIndex(clock);
  const compact = useCompactGrid();
  const [barTempo, setBarTempo] = useState<BarTempo>('auto');
  const rows = useMemo(
    () => buildBeatRows(segments, beats, beatsPerBar, columnsFor(compact), duration),
    [segments, beats, beatsPerBar, duration, compact],
  );
  const barCount = rows.reduce((total, row) => total + row.bars.length, 0);
  const canUseBeats = rows.length > 0;
  const sheetDuration = sheetDurationOf(segments, duration);
  const effectiveView = resolveEffectiveView(view, canUseBeats);
  const barAlignment = useMemo(
    () =>
      chooseBarAlignment(
        alignmentSegments(lyricsSegments, segments),
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

  useFollowActiveRow(listRef, follow, effectiveView, active, manualUntil);

  const focusRow = (index: number) => focusChordRow(listRef, segments.length, index);
  const markManualScroll = () => {
    manualUntil.current = Date.now() + 3000;
  };

  const liveMessage = activeMessage(
    t,
    effectiveView,
    segmentAt(segments, active),
    activeBeatDescription(rows, activeBeat, beatsPerBar, notation, accidental),
    notation,
    accidental,
  );

  return (
    <ChordGridPanel
      segments={segments}
      notation={notation}
      accidental={accidental}
      clock={clock}
      onSeek={onSeek}
      onSelectBar={onSelectBar}
      beats={beats}
      beatsPerBar={beatsPerBar}
      onViewChange={onViewChange}
      lyrics={lyrics}
      lyricChordOffsets={lyricChordOffsets}
      lyricChordLines={lyricChordLines}
      onLyricChordOffsetChange={onLyricChordOffsetChange}
      onLyricChordLineChange={onLyricChordLineChange}
      onResetLyricChordOffsets={onResetLyricChordOffsets}
      lyricsSegments={lyricsSegments}
      onEditLyrics={onEditLyrics}
      loopA={loopA}
      loopB={loopB}
      markMode={markMode}
      vocalRegions={vocalRegions}
      practiceHits={practiceHits}
      practiceHitRanges={practiceHitRanges}
      effectiveView={effectiveView}
      canUseBeats={canUseBeats}
      rows={rows}
      barCount={barCount}
      barAlignment={barAlignment}
      sheetDuration={sheetDuration}
      liveMessage={liveMessage}
      follow={follow}
      onToggleFollow={() => setFollow((value) => !value)}
      barTempo={barTempo}
      onBarTempoChange={setBarTempo}
      listRef={listRef}
      onFocusRow={focusRow}
      onManualScroll={markManualScroll}
    />
  );
}

export function ChordGrid(props: ChordGridProps) {
  const t = useT();
  if (props.segments.length === 0) {
    return <div className="note note-info">{t('grid.noChords')}</div>;
  }
  return <ChordGridBody {...props} />;
}
