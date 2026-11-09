import { useEffect, useMemo, useRef } from 'react';
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
  const lines = useMemo(
    () => alignLyrics(lyrics, changes, duration, { instrumental, vocalRegions }),
    [lyrics, changes, duration, instrumental, vocalRegions],
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
        <button
          type="button"
          className="btn min-h-0 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.1em]"
          onClick={onEdit}
        >
          {t('lyrics.edit')}
        </button>
      </div>

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
                    return (
                      <button
                        key={`${chord.segmentIndex}-${chord.time}`}
                        type="button"
                        className="lyrics-chord"
                        aria-current={chordIsActive ? 'true' : undefined}
                        aria-label={`${chord.label} en ${formatTime(chord.time)}`}
                        onClick={() => onSeek(chord.time)}
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
