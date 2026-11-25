import type { Accidental, Chord, Notation } from '@chordifree/chords';
import { useT } from '../i18n';
import type { PlayerAdapter } from '../player/types';
import type { MicStatus } from '../practice/useMicPractice';
import type { PlaybackClock } from '../sync/clock';
import { MicPractice, MicToggle } from './MicPractice';
import { PracticeBar } from './PracticeBar';
import { PracticePanel } from './PracticePanel';
import { Transport } from './Transport';

interface SongPracticeControlsProps {
  adapter: PlayerAdapter | null;
  clock: PlaybackClock | null;
  duration: number;
  beats: number[];
  beatsPerBar: number;
  loopA: number | null;
  loopB: number | null;
  loopEnabled: boolean;
  markMode: 'a' | 'b' | null;
  onMarkModeChange: (mode: 'a' | 'b' | null) => void;
  manualBpm: number;
  onLoopAChange: (value: number | null) => void;
  onLoopBChange: (value: number | null) => void;
  onLoopEnabledChange: (value: boolean) => void;
  onBpmChange: (value: number) => void;
  micEnabled: boolean;
  onMicEnabledChange: (value: boolean) => void;
  micStatus: MicStatus;
  micTarget: Chord | null;
  micDetected: Chord | null;
  micHit: boolean;
  micHitCount: number;
  totalChords: number;
  notation: Notation;
  accidental: Accidental;
  onMicReset: () => void;
}

/** Transport, loop practice and the optional microphone helper. */
export function SongPracticeControls({
  adapter,
  clock,
  duration,
  beats,
  beatsPerBar,
  loopA,
  loopB,
  loopEnabled,
  markMode,
  onMarkModeChange,
  manualBpm,
  onLoopAChange,
  onLoopBChange,
  onLoopEnabledChange,
  onBpmChange,
  micEnabled,
  onMicEnabledChange,
  micStatus,
  micTarget,
  micDetected,
  micHit,
  micHitCount,
  totalChords,
  notation,
  accidental,
  onMicReset,
}: SongPracticeControlsProps) {
  const t = useT();

  if (!adapter || !clock) {
    return (
      <div className="song-controls rounded-xl border border-line px-4 py-3 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink3">
        {t('song.controlsUnavailable')}
      </div>
    );
  }

  return (
    <div className="song-controls space-y-2">
      <Transport
        adapter={adapter}
        clock={clock}
        duration={duration}
        loopA={loopA}
        loopB={loopB}
        loopEnabled={loopEnabled}
      />
      <PracticePanel
        onOpenChange={(open) => {
          if (!open) onMicEnabledChange(false);
        }}
      >
        <PracticeBar
          adapter={adapter}
          clock={clock}
          beats={beats}
          beatsPerBar={beatsPerBar}
          duration={duration}
          loopA={loopA}
          loopB={loopB}
          loopEnabled={loopEnabled}
          onLoopAChange={onLoopAChange}
          onLoopBChange={onLoopBChange}
          onLoopEnabledChange={onLoopEnabledChange}
          markMode={markMode}
          onMarkModeChange={onMarkModeChange}
          manualBpm={manualBpm}
          onManualBpmChange={onBpmChange}
          embedded
          trailing={
            <MicToggle enabled={micEnabled} onToggle={() => onMicEnabledChange(!micEnabled)} />
          }
        />
        {micEnabled ? (
          <MicPractice
            status={micStatus}
            target={micTarget}
            detected={micDetected}
            hit={micHit}
            hitCount={micHitCount}
            totalChords={totalChords}
            notation={notation}
            accidental={accidental}
            onReset={onMicReset}
          />
        ) : null}
      </PracticePanel>
    </div>
  );
}
