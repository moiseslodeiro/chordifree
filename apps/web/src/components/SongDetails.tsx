import { formatTime } from '@chordifree/chords';
import type { ReactNode } from 'react';

interface SongDetailsProps {
  keyLabel: string | null;
  relativeKeyLabel: string | null;
  capo: number;
  capoKeyLabel: string | null;
  showCapo?: boolean;
  bpm: number | null;
  beatsPerBar: number;
  duration: number;
  artist: string | null;
  chords: string[];
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline">
      <dt className="shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink3">
        {label}
      </dt>
      <span className="leader" aria-hidden="true" />
      <dd className="min-w-0 text-right font-display text-base font-semibold leading-tight text-ink">
        {children}
      </dd>
    </div>
  );
}

export function SongDetails({
  keyLabel,
  relativeKeyLabel,
  capo,
  capoKeyLabel,
  showCapo = true,
  bpm,
  beatsPerBar,
  duration,
  artist,
  chords,
}: SongDetailsProps) {
  return (
    <section
      className="overflow-hidden rounded-xl border border-line bg-panel shadow-sm"
      aria-label="Detalles de la canción"
    >
      <h2 className="border-b border-line px-4 py-3 font-mono text-[0.62rem] font-medium uppercase tracking-[0.16em] text-ink3">
        Detalles de la canción
      </h2>

      <dl className="space-y-2.5 px-4 py-4">
        <Row label="Tonalidad">{keyLabel ?? '—'}</Row>
        <Row label="Relativa">{relativeKeyLabel ?? '—'}</Row>
        {showCapo ? (
          <Row label="Capo">
            {capo === 0
              ? 'Sin capo'
              : `Traste ${capo}${capoKeyLabel ? ` · ${capoKeyLabel}` : ''}`}
          </Row>
        ) : null}
        <Row label="BPM">{bpm ?? '—'}</Row>
        <Row label="Compás">{`${beatsPerBar}/4`}</Row>
        <Row label="Duración">{formatTime(duration)}</Row>
        <Row label="Artista">{artist ?? '—'}</Row>
      </dl>

      <div className="border-t border-line px-4 py-4">
        <h3 className="eyebrow">Acordes</h3>
        {chords.length > 0 ? (
          <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Acordes de la canción">
            {chords.map((chord) => (
              <li
                key={chord}
                className="border border-line px-2 py-0.5 font-display text-base font-semibold leading-snug text-ink"
              >
                {chord}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-ink3">No se detectaron acordes.</p>
        )}
      </div>
    </section>
  );
}
