import type { AccidentalPreference, Notation } from '@chordifree/chords';
import { useT } from '../i18n';
import type { Instrument } from '../types';
import { DisplayControls } from './DisplayControls';
import { MoreSettings } from './MoreSettings';
import { NotationControls } from './NotationControls';

export interface SongPreferencePatch {
  notation?: Notation;
  accidentalPreference?: AccidentalPreference;
  transpose?: number;
  simplifyChords?: boolean;
  reduceChords?: boolean;
  reduceChordsMax?: boolean;
  instrument?: Instrument;
  gridView?: 'beats' | 'list' | 'bars' | 'lyrics';
  capo?: number;
}

interface SongToolbarProps {
  notation: Notation;
  accidentalPreference: AccidentalPreference;
  transpose: number;
  simplifyChords: boolean;
  reduceChords: boolean;
  reduceChordsMax: boolean;
  instrument: Instrument;
  capo: number;
  mobile: boolean;
  onChange: (patch: SongPreferencePatch) => void;
}

/** Notation and display controls, with the extra settings disclosure on mobile. */
export function SongToolbar({
  notation,
  accidentalPreference,
  transpose,
  simplifyChords,
  reduceChords,
  reduceChordsMax,
  instrument,
  capo,
  mobile,
  onChange,
}: SongToolbarProps) {
  const t = useT();

  return (
    <>
      <section
        className="song-toolbar flex flex-wrap items-stretch overflow-hidden rounded-xl border border-line bg-panel shadow-sm"
        aria-label={t('song.toolbarAria')}
      >
        <NotationControls
          notation={notation}
          accidentalPreference={accidentalPreference}
          transpose={transpose}
          hideAdvanced={mobile}
          onChange={onChange}
        />
        <DisplayControls
          simplifyChords={simplifyChords}
          reduceChords={reduceChords}
          reduceChordsMax={reduceChordsMax}
          instrument={instrument}
          capo={capo}
          hideAdvanced={mobile}
          onChange={onChange}
        />
      </section>

      {mobile ? (
        <MoreSettings
          accidentalPreference={accidentalPreference}
          instrument={instrument}
          capo={capo}
          onChange={onChange}
        />
      ) : null}
    </>
  );
}
