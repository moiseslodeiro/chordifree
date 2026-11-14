import { useMemo } from 'react';
import {
  chordDegree,
  formatChord,
  progressionDegrees,
  type Accidental,
  type ChordSegment,
  type EstimatedKey,
  type Notation,
} from '@chordifree/chords';
import { useT } from '../i18n';

interface HarmonicAnalysisProps {
  segments: ChordSegment[];
  harmonyKey: EstimatedKey | null;
  notation: Notation;
  accidental: Accidental;
  capo?: number;
}

interface DegreeItem {
  degree: string;
  chord: string;
  count: number;
}

const LOW_CONFIDENCE = 0.6;

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function HarmonicAnalysis({
  segments,
  harmonyKey,
  notation,
  accidental,
  capo = 0,
}: HarmonicAnalysisProps) {
  const t = useT();
  const degrees = useMemo(() => {
    if (!harmonyKey) return [];
    const items: DegreeItem[] = [];
    const index = new Map<string, DegreeItem>();
    for (const segment of segments) {
      if (!segment.chord) continue;
      const chord = formatChord(segment.chord, notation, accidental);
      const existing = index.get(chord);
      if (existing) {
        existing.count += 1;
        continue;
      }
      const item: DegreeItem = {
        degree: chordDegree(segment.chord, harmonyKey),
        chord,
        count: 1,
      };
      index.set(chord, item);
      items.push(item);
    }
    return items;
  }, [segments, harmonyKey, notation, accidental]);

  const progression = useMemo(
    () => (harmonyKey ? progressionDegrees(segments, harmonyKey) : []),
    [segments, harmonyKey],
  );

  const confidence = useMemo(() => {
    const values = segments
      .filter((segment) => segment.chord !== null && typeof segment.confidence === 'number')
      .map((segment) => segment.confidence!);
    if (values.length === 0) return null;
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const low = values.filter((value) => value < LOW_CONFIDENCE).length;
    return { average, low, total: values.length };
  }, [segments]);

  const hasChords = segments.some((segment) => segment.chord !== null);

  return (
    <section
      className="overflow-hidden rounded-xl border border-line bg-panel shadow-sm"
      aria-label={t('harmonic.aria')}
    >
      <h2 className="border-b border-line px-4 py-3 font-mono text-[0.62rem] font-medium uppercase tracking-[0.16em] text-ink3">
        {t('harmonic.title')}
      </h2>

      {!hasChords ? (
        <p className="px-4 py-4 text-sm text-ink2">{t('harmonic.empty')}</p>
      ) : (
        <div className="space-y-4 px-4 py-4">
          {harmonyKey ? (
            <>
              <div>
                <h3 className="eyebrow">{t('harmonic.progression')}</h3>
                {progression.length > 0 ? (
                  <ol
                    className="mt-2 flex flex-wrap items-center gap-1.5"
                    aria-label={t('harmonic.progressionAria')}
                  >
                    {progression.map((degree, index) => (
                      <li
                        key={`${index}-${degree}`}
                        className="degree-chip font-mono text-[0.7rem] font-semibold tabular-nums"
                      >
                        {degree}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-2 text-xs text-ink3">{t('harmonic.noChanges')}</p>
                )}
              </div>

              <div>
                <h3 className="eyebrow">{t('harmonic.byDegree')}</h3>
                <ul className="mt-2 space-y-1" aria-label={t('harmonic.degreesAria')}>
                  {degrees.map((item) => (
                    <li key={`${item.chord}-${item.degree}`} className="flex items-baseline gap-2">
                      <span className="min-w-[2.5rem] font-mono text-[0.7rem] font-semibold tabular-nums text-accent">
                        {item.degree}
                      </span>
                      <span className="font-display text-sm font-semibold text-ink">
                        {item.chord}
                      </span>
                      {item.count > 1 ? (
                        <span className="ml-auto font-mono text-[0.62rem] tabular-nums text-ink3">
                          ×{item.count}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className="text-sm text-ink2">
              {t('harmonic.noKey')}
            </p>
          )}

          {capo > 0 ? (
            <p className="text-xs leading-relaxed text-ink2">
              {t('harmonic.degreesCapo', { capo })}
            </p>
          ) : null}

          {confidence ? (
            <div className="border-t border-line pt-3">
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink3">
                {t('harmonic.averageConfidence', { percent: percent(confidence.average) })}
                {confidence.low > 0
                  ? ` · ${t(
                      confidence.total === 1
                        ? 'harmonic.doubtfulOne'
                        : 'harmonic.doubtfulOther',
                      { low: confidence.low, total: confidence.total },
                    )}`
                  : ''}
              </p>
              {confidence.low > 0 ? (
                <p className="mt-1 text-xs leading-relaxed text-ink2">
                  {t('harmonic.lowConfidenceHelp')}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
