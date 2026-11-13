import {
  formatChord,
  formatTime,
  type Accidental,
  type Chord,
  type ChordSegment,
  type Notation,
} from '@chordifree/chords';
import { createPortal } from 'react-dom';
import { harmonyBars } from '../lyrics/sections';
import { buildLyricLines, chordRowMargin } from '../lyrics/lines';
import type { Instrument, Song } from '../types';
import { useT } from '../i18n';
import { ChordDiagram } from './ChordDiagram';

interface PrintSheetProps {
  song: Song;
  artist?: string | null;
  instrument: Instrument;
  keyLabel: string | null;
  capo: number;
  bpm: number | null;
  /** Chords shown in the grid, with simplification/reduction applied. */
  segments: ChordSegment[];
  /** Chords used by the lyrics view. */
  lyricsSegments: ChordSegment[];
  beats: number[];
  beatsPerBar: number;
  duration: number;
  accidental: Accidental;
  notation: Notation;
}

const INSTRUMENT_LABEL = {
  guitar: 'instrument.guitar',
  piano: 'instrument.piano',
  ukelele: 'instrument.ukelele',
} as const;

function chordKey(chord: Chord): string {
  return `${chord.root}:${chord.quality}:${chord.bass ?? ''}`;
}

function uniqueChords(segments: ChordSegment[]): Chord[] {
  const seen = new Set<string>();
  const chords: Chord[] = [];
  for (const segment of segments) {
    if (!segment.chord) continue;
    const key = chordKey(segment.chord);
    if (seen.has(key)) continue;
    seen.add(key);
    chords.push(segment.chord);
  }
  return chords;
}

export function PrintSheet({
  song,
  artist,
  instrument,
  keyLabel,
  capo,
  bpm,
  segments,
  lyricsSegments,
  beats,
  beatsPerBar,
  duration,
  accidental,
  notation,
}: PrintSheetProps) {
  const t = useT();
  const instrumentLabel = t(INSTRUMENT_LABEL[instrument]);
  const lyrics = song.lyrics?.trim() ?? '';
  const lines = buildLyricLines({
    lyrics: song.lyrics ?? '',
    segments: lyricsSegments,
    beats,
    beatsPerBar,
    duration,
    notation,
    accidental,
    vocalRegions: song.vocalRegions,
    chordLines: song.lyricChordLines,
  });
  const chords = uniqueChords([...segments, ...lyricsSegments]);
  const bars = harmonyBars(segments, beats, beatsPerBar, duration);
  const meta = [
    keyLabel,
    capo > 0 ? t('song.capoValue', { value: capo }) : null,
    bpm ? `${bpm} BPM` : null,
    formatTime(duration),
  ].filter(Boolean);

  const source =
    song.source.type === 'youtube'
      ? t('song.printYoutube', { id: song.source.videoId })
      : song.source.type === 'sheet'
        ? t('song.printSheet', { name: song.source.filename })
        : t('song.printAudio', { name: song.source.filename });

  return createPortal(
    <section
      className={`print-sheet print-sheet-${instrument}`}
      data-testid="print-sheet"
      aria-hidden="true"
    >
      <header className="print-sheet-header">
        <img className="print-logo" src="/brand-print.png" alt="chordifree" />
        <div className="print-heading">
          <h1>{song.title}</h1>
          {artist ? <p className="print-artist">{artist}</p> : null}
          <p className="print-meta">{[instrumentLabel, ...meta].join(' · ')}</p>
        </div>
      </header>

      <div className="print-body">
        <div className="print-main">
          {lyrics ? (
            <section className="print-section print-lyrics">
              <h2 className="print-section-title">{t('song.printLyrics')}</h2>
              <div className="print-lyric-lines">
                {lines.map((line) => (
                  <div className="print-lyric-line" key={line.index}>
                    {line.chords.length > 0 ? (
                      <div
                        className="print-lyric-chords"
                        style={{ paddingLeft: chordRowMargin(line.chords) }}
                      >
                        {line.chords.map((chord) => {
                          const offset = song.lyricChordOffsets?.[String(chord.segmentIndex)] ?? 0;
                          return (
                            <span
                              key={`${chord.segmentIndex}-${chord.time}`}
                              style={{ transform: `translateX(${offset}em)` }}
                            >
                              {chord.label}
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                    {line.text.trim() ? (
                      <p className="print-lyric-text">{line.text}</p>
                    ) : (
                      <div className="print-lyric-gap" />
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {chords.length > 0 ? (
          <aside className="print-side">
            <h2 className="print-section-title">
              {t('song.printChordsFor', { instrument: instrumentLabel })}
            </h2>
            <div className="print-diagrams">
              {chords.map((chord) => (
                <figure className="print-diagram" key={chordKey(chord)}>
                  <ChordDiagram
                    chord={chord}
                    instrument={instrument}
                    notation={notation}
                    accidental={accidental}
                  />
                  <figcaption>{formatChord(chord, notation, accidental)}</figcaption>
                </figure>
              ))}
            </div>
          </aside>
        ) : null}
      </div>

      {bars.length > 0 ? (
        <section className={`print-section print-progression${lyrics ? ' print-progression-separate' : ''}`}>
          {lyrics ? (
            <div className="print-continuation">
              <img className="print-logo" src="/brand-print.png" alt="chordifree" />
              <span>{song.title}</span>
            </div>
          ) : null}
          <h2 className="print-section-title">{t('song.printProgression')}</h2>
          <ol className="print-bars">
            {bars.map((bar, index) => (
              <li className="print-bar" key={`${bar.start}-${index}`}>
                <span className="print-bar-index">{String(index + 1).padStart(2, '0')}</span>
                <strong className="print-bar-chord">
                  {bar.chord ? formatChord(bar.chord, notation, accidental) : '·'}
                </strong>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <footer className="print-footer">
        <span>{source}</span>
        <span>{t('song.generatedOn', { date: new Date().toLocaleDateString() })}</span>
        <span>chordifree · v{__APP_VERSION__}</span>
      </footer>
    </section>,
    document.body,
  );
}
