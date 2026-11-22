import { useT } from '../i18n';
import { CollapsibleCard } from './CollapsibleCard';
import { HarmonicAnalysis, type HarmonicAnalysisProps } from './HarmonicAnalysis';
import { SongDetails, type SongDetailsProps } from './SongDetails';

interface SongInfoPanelProps {
  details: SongDetailsProps;
  harmony: HarmonicAnalysisProps;
}

/**
 * Song details and harmonic analysis share one collapsible card below the
 * chord grid, where they are easier to scan than in the right rail.
 */
export function SongInfoPanel({ details, harmony }: SongInfoPanelProps) {
  const t = useT();
  return (
    <CollapsibleCard title={t('song.infoTitle')} defaultOpen testId="song-info">
      <div className="grid gap-5 p-4 md:grid-cols-2">
        <div className="min-w-0">
          <h3 className="eyebrow mb-2">{t('details.title')}</h3>
          <SongDetails {...details} bare />
        </div>
        <div className="min-w-0" data-testid="song-harmony-column">
          <h3 className="eyebrow mb-2">{t('harmonic.title')}</h3>
          <HarmonicAnalysis {...harmony} bare />
        </div>
      </div>
    </CollapsibleCard>
  );
}
