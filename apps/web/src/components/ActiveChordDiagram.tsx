import {
  formatChordOrSilence,
  type Accidental,
  type ChordSegment,
  type Notation,
} from '@chordifree/chords';
import type { PlaybackClock } from '../sync/clock';
import { usePlaybackIndex } from '../sync/hooks';
import type { Instrument } from '../types';
import { ChordDiagram } from './ChordDiagram';

interface ActiveChordDiagramProps {
  segments: ChordSegment[];
  clock: PlaybackClock | null;
  instrument: Instrument;
  notation: Notation;
  accidental: Accidental;
}

export function ActiveChordDiagram({
  segments,
  clock,
  instrument,
  notation,
  accidental,
}: ActiveChordDiagramProps) {
  const index = usePlaybackIndex(clock);
  const segment = index >= 0 ? segments[index] : undefined;
  const label = formatChordOrSilence(segment?.chord ?? null, notation, accidental);

  return (
    <section
      className="overflow-hidden rounded-xl border border-line bg-panel shadow-sm"
      aria-label="Acorde activo"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="font-mono text-[0.62rem] font-medium uppercase tracking-[0.16em] text-ink3">
          Acorde activo
        </h2>
        <span className="font-display text-3xl font-extrabold leading-none text-ink">{label}</span>
      </div>
      <div className="flex min-h-[9.5rem] items-center justify-center px-4 py-4">
        <ChordDiagram
          chord={segment?.chord ?? null}
          instrument={instrument}
          notation={notation}
          accidental={accidental}
        />
      </div>
    </section>
  );
}
