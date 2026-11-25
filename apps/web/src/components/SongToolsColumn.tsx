import type { Accidental, Notation } from '@chordifree/chords';
import type { useStems } from '../hooks/useStems';
import { useT } from '../i18n';
import type { PlayerAdapter } from '../player/types';
import type { PlaybackClock } from '../sync/clock';
import type {
  CollabRevision,
  CollabShare,
  Instrument,
  Preferences,
  Song,
  SongSection,
} from '../types';
import { ActiveChordDiagram } from './ActiveChordDiagram';
import { AudioControls } from './AudioControls';
import { CollabPanel } from './CollabPanel';
import { PlayerHost } from './PlayerHost';
import { SectionsPanel } from './SectionsPanel';
import { StemsInstallPrompt } from './StemsInstallPrompt';
import { StemsPanel } from './StemsPanel';
import type { ShareNotice } from './SongShareDialog';

interface StemMix {
  stems: Array<{ name: string; url: string }>;
}

export interface SongToolsColumnProps {
  song: Song;
  audioUrl: string | null;
  forceFake: boolean;
  pitch: number;
  karaoke: boolean;
  onKaraokeChange: (value: boolean) => void;
  mixActive: boolean;
  stemMix: StemMix | null;
  stemGains: Record<string, number>;
  adapter: PlayerAdapter | null;
  rate: number;
  onRateChange: (value: number) => void;
  onPitchChange: (value: number) => void;
  videoId: string | null;
  stems: ReturnType<typeof useStems>;
  stemError: string | null;
  stemMidiBusy: boolean;
  mixBusy: boolean;
  uninstalling: boolean;
  onToggleMix: (active: boolean) => void;
  onStemGainChange: (stem: string, value: number) => void;
  onDownloadStem: (stem: string) => void;
  onDownloadStemMidi: () => void;
  onUninstallStems: () => void;
  onOpenStems: () => void;
  segments: Song['segments'];
  clock: PlaybackClock | null;
  instrument: Instrument;
  notation: Notation;
  accidental: Accidental;
  sections: SongSection[];
  currentTime: number;
  onSeek: (time: number) => void;
  onSectionsChange: (sections: SongSection[]) => void;
  collabShare: CollabShare | null;
  collabUid: string | null;
  language: Preferences['language'];
  collabLoading: boolean;
  onShareNotice: (notice: ShareNotice | null) => void;
  onRefreshCollab: () => void;
  onLoadCollabRevision: (revisionId: string) => Promise<CollabRevision | null>;
  onApplyCollabRevision: (revision: CollabRevision) => void;
  onAdapter: (adapter: PlayerAdapter | null) => void;
  onPlaybackError: (message: string | null) => void;
}

/** Right column: player, audio controls, stems, active chord, sections and collaboration. */
export function SongToolsColumn({
  song,
  audioUrl,
  forceFake,
  pitch,
  karaoke,
  onKaraokeChange,
  mixActive,
  stemMix,
  stemGains,
  adapter,
  rate,
  onRateChange,
  onPitchChange,
  videoId,
  stems,
  stemError,
  stemMidiBusy,
  mixBusy,
  uninstalling,
  onToggleMix,
  onStemGainChange,
  onDownloadStem,
  onDownloadStemMidi,
  onUninstallStems,
  onOpenStems,
  segments,
  clock,
  instrument,
  notation,
  accidental,
  sections,
  currentTime,
  onSeek,
  onSectionsChange,
  collabShare,
  collabUid,
  language,
  collabLoading,
  onShareNotice,
  onRefreshCollab,
  onLoadCollabRevision,
  onApplyCollabRevision,
  onAdapter,
  onPlaybackError,
}: SongToolsColumnProps) {
  const t = useT();

  return (
    <aside
      data-testid="song-tools-column"
      className="song-tools contents lg:sticky lg:top-5 lg:col-start-2 lg:row-start-1 lg:flex lg:min-w-0 lg:flex-col lg:gap-5"
      aria-label={t('song.toolsColumnAria')}
    >
      <div data-testid="song-player-column" className="order-1 lg:order-none">
        <section
          className="rounded-xl border border-line bg-panel p-3 shadow-sm"
          aria-label={t('song.playerAria')}
        >
          <PlayerHost
            song={song}
            audioUrl={audioUrl}
            forceFake={forceFake}
            variant="compact"
            pitch={pitch}
            karaoke={karaoke}
            overrideUrl={null}
            mix={mixActive ? stemMix : null}
            stemGains={stemGains}
            onAdapter={onAdapter}
            onPlaybackError={onPlaybackError}
          />
        </section>
      </div>

      <div data-testid="song-audio" className="order-2 lg:order-none">
        <AudioControls
          adapter={adapter}
          rate={rate}
          onRateChange={onRateChange}
          pitch={pitch}
          onPitchChange={onPitchChange}
          pitchAvailable={
            !mixActive &&
            (song.source.type === 'youtube' || typeof adapter?.setPitch === 'function')
          }
          karaoke={karaoke}
          onKaraokeChange={onKaraokeChange}
          karaokeAvailable={!mixActive && typeof adapter?.setKaraoke === 'function'}
        >
          {videoId && stems.status?.available ? (
            <StemsPanel
              status={stems.status}
              job={stems.job}
              busy={stems.busy}
              checking={stems.checking}
              error={stems.error ?? stemError}
              midiBusy={stemMidiBusy}
              mixActive={mixActive}
              mixBusy={mixBusy}
              gains={stemGains}
              canUninstall={Boolean(stems.setup?.managed)}
              uninstalling={uninstalling}
              onSeparate={() => void stems.separate()}
              onCancel={() => void stems.cancel()}
              onToggleMix={onToggleMix}
              onGainChange={onStemGainChange}
              onDownloadStem={onDownloadStem}
              onDownloadMidi={onDownloadStemMidi}
              onRetry={() => void stems.separate()}
              onUninstall={onUninstallStems}
            />
          ) : videoId && stems.setup?.supported ? (
            <StemsInstallPrompt installed={stems.setup.installed} onOpenSetup={onOpenStems} />
          ) : null}
        </AudioControls>
      </div>
      <div data-testid="song-active-chord" className="order-2 lg:order-none">
        <ActiveChordDiagram
          segments={segments}
          clock={clock}
          instrument={instrument}
          notation={notation}
          accidental={accidental}
        />
      </div>

      {song.sections !== undefined || sections.length > 0 ? (
        <div data-testid="song-sections" className="order-2 lg:order-none">
          <SectionsPanel
            sections={song.sections ?? sections}
            currentTime={currentTime}
            onSeek={onSeek}
            onChange={onSectionsChange}
          />
        </div>
      ) : null}

      {collabShare ? (
        <div className="order-2 lg:order-none">
          <CollabPanel
            share={collabShare}
            song={song}
            currentUid={collabUid}
            language={language}
            loading={collabLoading}
            onCopyLink={() => {
              const url = `${window.location.origin}${window.location.pathname}#/collab/${collabShare.id}`;
              void navigator.clipboard
                .writeText(url)
                .then(() => onShareNotice({ message: t('collab.linkCopied'), tone: 'success' }))
                .catch(() =>
                  onShareNotice({ message: t('collab.linkReady', { url }), tone: 'warning' }),
                );
            }}
            onRefresh={onRefreshCollab}
            onLoadRevision={onLoadCollabRevision}
            onApply={onApplyCollabRevision}
          />
        </div>
      ) : null}
    </aside>
  );
}
