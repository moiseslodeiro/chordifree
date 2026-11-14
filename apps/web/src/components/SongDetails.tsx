import { formatTime } from '@chordifree/chords';
import { useT } from '../i18n';
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
  onChangeMeter?: (beatsPerBar: number) => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline">
      <dt className="shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink3">
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
  onChangeMeter,
}: SongDetailsProps) {
  const t = useT();
  return (
    <section
      className="overflow-hidden rounded-xl border border-line bg-panel shadow-sm"
      aria-label={t('details.aria')}
    >
      <h2 className="border-b border-line px-4 py-3 font-mono text-[0.62rem] font-medium uppercase tracking-[0.16em] text-ink3">
        {t('details.title')}
      </h2>

      <dl className="space-y-2.5 px-4 py-4">
        <Row label={t('details.key')}>{keyLabel ?? '—'}</Row>
        <Row label={t('details.relative')}>{relativeKeyLabel ?? '—'}</Row>
        {showCapo ? (
          <Row label={t('details.capo')}>
            {capo === 0
              ? t('display.noCapo')
              : `${t('display.fret', { fret: capo })}${
                  capoKeyLabel ? ` · ${capoKeyLabel}` : ''
                }`}
          </Row>
        ) : null}
        <Row label={t('details.bpm')}>{bpm ?? '—'}</Row>
        <Row label={t('details.meter')}>
          {onChangeMeter ? (
            <select
              className="cursor-pointer border-0 bg-transparent p-0 text-right font-display text-base font-semibold text-ink underline decoration-line-strong underline-offset-4 focus:outline-none"
              value={beatsPerBar}
              onChange={(event) => onChangeMeter(Number(event.target.value))}
              aria-label={t('details.meter')}
            >
              {[...new Set([2, 3, 4, beatsPerBar])].sort((a, b) => a - b).map((value) => (
                <option key={value} value={value}>{`${value}/4`}</option>
              ))}
            </select>
          ) : (
            `${beatsPerBar}/4`
          )}
        </Row>
        <Row label={t('details.duration')}>{formatTime(duration)}</Row>
        <Row label={t('details.artist')}>{artist ?? '—'}</Row>
      </dl>

      <div className="border-t border-line px-4 py-4">
        <h3 className="eyebrow">{t('details.chords')}</h3>
        {chords.length > 0 ? (
          <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label={t('details.chordsAria')}>
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
          <p className="mt-2 text-xs text-ink3">{t('details.noChords')}</p>
        )}
      </div>
    </section>
  );
}
