import type { Accidental, ChordSegment, EstimatedKey } from '@chordifree/chords';
import type { PlayerAdapter } from '../player/types';
import type { PlaybackClock } from '../sync/clock';
import type { GridView, Song } from '../types';
import { ChordGrid } from './ChordGrid';
import { EditorPanel } from './EditorPanel';
import { LyricsEditor } from './LyricsEditor';
import { SongInfoPanel } from './SongInfoPanel';

interface PracticeHitRange {
  start: number;
  end: number;
}

export interface SongGridColumnProps {
  song: Song;
  adapter: PlayerAdapter | null;
  clock: PlaybackClock | null;
  editing: boolean;
  editingLyrics: boolean;
  lyricsDraft: string;
  accidental: Accidental;
  displaySegments: ChordSegment[];
  lyricsSegments: ChordSegment[];
  transposedSegments: ChordSegment[];
  estimatedKey: EstimatedKey | null;
  gridView: GridView;
  beats: number[];
  beatsPerBar: number;
  loopA: number | null;
  loopB: number | null;
  markMode: 'a' | 'b' | null;
  practiceHits: ReadonlySet<number>;
  practiceHitRanges: PracticeHitRange[];
  keyLabel: string | null;
  relativeKeyLabel: string | null;
  effectiveCapo: number;
  capoKeyLabel: string | null;
  capoAvailable: boolean;
  bpm: number | null;
  artist: string | null;
  chordList: string[];
  onLyricsDraftChange: (value: string) => void;
  onSaveLyrics: () => void;
  onCancelLyrics: () => void;
  onDeleteLyrics: () => void;
  onFindLyrics: () => Promise<string | null>;
  onSaveEdits: (segments: ChordSegment[]) => void;
  onDiscardEdits: () => void;
  onSeek: (time: number) => void;
  onSelectBar: (time: number) => void;
  onOpenLyricsEditor: () => void;
  onGridChange: (view: GridView) => void;
  onLyricChordOffsetChange: (segmentIndex: number, offset: number) => void;
  onLyricChordLineChange: (segmentIndex: number, lineIndex: number | null) => void;
  onResetLyricChordOffsets: () => void;
  onMeterChange: (beatsPerBar: number) => void;
}

/** Left column: lyrics editor, chord editor or grid, plus song details. */
export function SongGridColumn({
  song,
  adapter,
  clock,
  editing,
  editingLyrics,
  lyricsDraft,
  accidental,
  displaySegments,
  lyricsSegments,
  transposedSegments,
  estimatedKey,
  gridView,
  beats,
  beatsPerBar,
  loopA,
  loopB,
  markMode,
  practiceHits,
  practiceHitRanges,
  keyLabel,
  relativeKeyLabel,
  effectiveCapo,
  capoKeyLabel,
  capoAvailable,
  bpm,
  artist,
  chordList,
  onLyricsDraftChange,
  onSaveLyrics,
  onCancelLyrics,
  onDeleteLyrics,
  onFindLyrics,
  onSaveEdits,
  onDiscardEdits,
  onSeek,
  onSelectBar,
  onOpenLyricsEditor,
  onGridChange,
  onLyricChordOffsetChange,
  onLyricChordLineChange,
  onResetLyricChordOffsets,
  onMeterChange,
}: SongGridColumnProps) {
  return (
    <div data-testid="song-grid-column" className="order-2 min-w-0 lg:col-start-1 lg:row-start-1">
      {editingLyrics ? (
        <LyricsEditor
          value={lyricsDraft}
          initialValue={song.lyrics ?? ''}
          canDelete={Boolean(song.lyrics)}
          canAnchor={Boolean(adapter)}
          getCurrentTime={() => adapter?.getCurrentTime() ?? null}
          onChange={onLyricsDraftChange}
          onSave={onSaveLyrics}
          onCancel={onCancelLyrics}
          onDelete={onDeleteLyrics}
          onFindLyrics={onFindLyrics}
        />
      ) : editing ? (
        <EditorPanel
          song={song}
          notation={song.notation}
          accidental={accidental}
          onSave={onSaveEdits}
          onDiscard={onDiscardEdits}
        />
      ) : (
        <ChordGrid
          segments={displaySegments}
          lyricsSegments={lyricsSegments}
          lyricChordOffsets={song.lyricChordOffsets}
          lyricChordLines={song.lyricChordLines}
          onLyricChordOffsetChange={onLyricChordOffsetChange}
          onLyricChordLineChange={onLyricChordLineChange}
          onResetLyricChordOffsets={onResetLyricChordOffsets}
          notation={song.notation}
          accidental={accidental}
          clock={clock}
          onSeek={onSeek}
          onSelectBar={onSelectBar}
          markMode={markMode}
          beats={beats}
          beatsPerBar={beatsPerBar}
          duration={song.duration}
          loopA={loopA}
          loopB={loopB}
          vocalRegions={song.vocalRegions}
          lyrics={song.lyrics}
          onEditLyrics={onOpenLyricsEditor}
          view={gridView}
          onViewChange={onGridChange}
          practiceHits={practiceHits}
          practiceHitRanges={practiceHitRanges}
        />
      )}

      <div data-testid="song-info-column" className="mt-5">
        <SongInfoPanel
          details={{
            keyLabel,
            relativeKeyLabel,
            capo: effectiveCapo,
            capoKeyLabel,
            showCapo: capoAvailable,
            bpm,
            beatsPerBar,
            duration: song.duration,
            artist,
            chords: chordList,
            showChords: false,
            onChangeMeter: onMeterChange,
          }}
          harmony={{
            segments: transposedSegments,
            harmonyKey: estimatedKey,
            notation: song.notation,
            accidental,
            capo: effectiveCapo,
          }}
        />
      </div>
    </div>
  );
}
