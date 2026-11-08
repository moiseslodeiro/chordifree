import { formatChord, type Accidental, type Chord, type Notation } from '@chordifree/chords';
import type { Instrument } from '../types';
import { getPianoVoicing, getStringShape } from '../chords/shapes';
import { PianoVoicing } from './PianoVoicing';
import { StringDiagram } from './StringDiagram';

interface ChordDiagramProps {
  chord: Chord | null;
  instrument: Instrument;
  notation: Notation;
  accidental: Accidental;
}

const INSTRUMENT_NAME: Record<Instrument, string> = {
  guitar: 'Guitarra',
  piano: 'Piano',
  ukelele: 'Ukelele',
};

function Fallback({ label, instrument }: { label: string; instrument: Instrument }) {
  return (
    <div
      role="img"
      aria-label={`${INSTRUMENT_NAME[instrument]}: ${label}. Sin digitación disponible`}
      className="flex min-h-[150px] w-full flex-col items-center justify-center gap-2 border border-dashed border-line-strong px-4 py-6 text-center"
    >
      <span className="font-display text-3xl font-extrabold leading-none text-ink">{label}</span>
      <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink3">
        Sin digitación disponible
      </span>
    </div>
  );
}

export function ChordDiagram({ chord, instrument, notation, accidental }: ChordDiagramProps) {
  if (!chord) {
    return (
      <div
        role="img"
        aria-label="Sin acorde activo"
        className="flex min-h-[150px] w-full items-center justify-center border border-dashed border-line-strong px-4 py-6 text-center font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink3"
      >
        Sin acorde activo
      </div>
    );
  }

  const label = formatChord(chord, notation, accidental);

  if (instrument === 'piano') {
    const voicing = getPianoVoicing(chord);
    if (!voicing) return <Fallback label={label} instrument={instrument} />;
    return (
      <PianoVoicing
        voicing={voicing}
        label={label}
        notation={notation}
        accidental={accidental}
      />
    );
  }

  const shape = getStringShape(chord, instrument);
  if (!shape) return <Fallback label={label} instrument={instrument} />;
  return <StringDiagram shape={shape} label={label} />;
}
