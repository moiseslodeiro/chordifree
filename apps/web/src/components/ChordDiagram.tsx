import { formatChord, type Accidental, type Chord, type Notation } from '@chordifree/chords';
import type { Instrument } from '../types';
import { getPianoVoicing, getStringShape } from '../chords/shapes';
import { useT } from '../i18n';
import { PianoVoicing } from './PianoVoicing';
import { StringDiagram } from './StringDiagram';

interface ChordDiagramProps {
  chord: Chord | null;
  instrument: Instrument;
  notation: Notation;
  accidental: Accidental;
}

const INSTRUMENT_NAME: Record<Instrument, 'instrument.guitar' | 'instrument.piano' | 'instrument.ukelele'> = {
  guitar: 'instrument.guitar',
  piano: 'instrument.piano',
  ukelele: 'instrument.ukelele',
};

function Fallback({ label, instrument }: { label: string; instrument: Instrument }) {
  const t = useT();
  return (
    <div
      role="img"
      aria-label={t('diagram.noShapeAria', {
        instrument: t(INSTRUMENT_NAME[instrument]),
        chord: label,
      })}
      className="flex min-h-[150px] w-full flex-col items-center justify-center gap-2 border border-dashed border-line-strong px-4 py-6 text-center"
    >
      <span className="font-display text-3xl font-extrabold leading-none text-ink">{label}</span>
      <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink3">
        {t('diagram.noShape')}
      </span>
    </div>
  );
}

export function ChordDiagram({ chord, instrument, notation, accidental }: ChordDiagramProps) {
  const t = useT();
  if (!chord) {
    return (
      <div
        role="img"
        aria-label={t('diagram.noActiveAria')}
        className="flex min-h-[150px] w-full items-center justify-center border border-dashed border-line-strong px-4 py-6 text-center font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink3"
      >
        {t('diagram.noActive')}
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
