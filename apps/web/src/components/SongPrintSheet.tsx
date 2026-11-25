import { formatTime } from '@chordifree/chords';
import { useT } from '../i18n';
import type { LyricLine } from '../lyrics/align';
import { chordRowMargin } from '../lyrics/lines';
import type { Song } from '../types';

export interface PrintRow {
  time: string;
  chord: string;
  degree: string | null;
}

interface SongPrintSheetProps {
  song: Song;
  keyLabel: string | null;
  capo: number;
  capoAvailable: boolean;
  bpm: number | null;
  printLyrics: LyricLine[];
  printRows: PrintRow[];
}

/** Printable lead sheet. It is hidden on screen and only shown by print CSS. */
export function SongPrintSheet({
  song,
  keyLabel,
  capo,
  capoAvailable,
  bpm,
  printLyrics,
  printRows,
}: SongPrintSheetProps) {
  const t = useT();

  return (
    <section className="print-sheet" data-testid="print-sheet" aria-hidden="true">
      <header className="print-sheet-header">
        <img className="print-brand-logo" src="/brand-print.png" alt="chordifree" />
        <h1>{song.title}</h1>
        <p className="print-meta">
          {[
            keyLabel ?? t('song.unknownKey'),
            capoAvailable && capo > 0 ? t('song.capoValue', { value: capo }) : null,
            bpm ? `${bpm} BPM` : null,
            formatTime(song.duration),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>

      {song.lyrics?.trim() ? (
        <section className="print-lyrics">
          <h2 className="print-section-title">{t('song.printLyrics')}</h2>
          <div className="print-lyric-lines">
            {printLyrics.map((line) => (
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
                <p className="print-lyric-text">{line.text}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <ol className="print-chords" aria-label={t('song.printChordsAria')}>
        {printRows.map((row, index) => (
          <li key={`${row.time}-${row.chord}-${index}`}>
            <span className="print-time">{row.time}</span>
            <span className="print-chord">{row.chord}</span>
            {row.degree ? <span className="print-degree">{row.degree}</span> : null}
          </li>
        ))}
      </ol>

      <footer className="print-footer">
        {song.source.type === 'youtube'
          ? t('song.printYoutube', { id: song.source.videoId })
          : song.source.type === 'sheet'
            ? t('song.printSheet', { name: song.source.filename })
            : t('song.printAudio', { name: song.source.filename })}{' '}
        · {t('song.generatedOn', { date: new Date().toLocaleDateString() })} · v{__APP_VERSION__}
      </footer>
    </section>
  );
}
