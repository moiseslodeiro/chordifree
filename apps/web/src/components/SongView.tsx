import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  estimateKey,
  formatChordOrSilence,
  formatTime,
  noteName,
  reduceChordSegments,
  relativeKey,
  resolveAccidental,
  simplifyChord,
  transposeChord,
  transposeKey,
  type Accidental,
  type ChordSegment,
  type Notation,
  type AccidentalPreference,
  type EstimatedKey,
} from '@chordifree/chords';
import type { PlayerAdapter } from '../player/types';
import { extendBeats, tempoFromBeats } from '../grid/beats';
import { usePracticeSession } from '../practice/usePracticeSession';
import { PlaybackClock } from '../sync/clock';
import {
  supportsCapo,
  type GridView,
  type Instrument,
  type Preferences,
  type Song,
} from '../types';
import { ActiveChordDiagram } from './ActiveChordDiagram';
import { ChordGrid } from './ChordGrid';
import { DisplayControls } from './DisplayControls';
import { EditorPanel } from './EditorPanel';
import { ErrorBanner, NoticeBanner } from './ErrorBanner';
import { HarmonicAnalysis } from './HarmonicAnalysis';
import { NotationControls } from './NotationControls';
import { PlayerHost } from './PlayerHost';
import { PracticeBar } from './PracticeBar';
import { SongDetails } from './SongDetails';
import { Transport } from './Transport';

interface SongViewProps {
  song: Song;
  audioUrl: string | null;
  forceFake: boolean;
  saved: boolean;
  simplifyChords: boolean;
  reduceChords: boolean;
  reduceChordsMax: boolean;
  instrument: Instrument;
  gridView: GridView;
  notice: string | null;
  onDismissNotice: () => void;
  onChange: (song: Song) => void;
  onSave: (song: Song) => void;
  onBack: () => void;
  onOpenLibrary: () => void;
  onPreferences: (patch: Partial<Preferences>) => void;
}

export function SongView({
  song,
  audioUrl,
  forceFake,
  saved,
  simplifyChords,
  reduceChords,
  reduceChordsMax,
  instrument,
  gridView,
  notice,
  onDismissNotice,
  onChange,
  onSave,
  onBack,
  onOpenLibrary,
  onPreferences,
}: SongViewProps) {
  const [adapter, setAdapter] = useState<PlayerAdapter | null>(null);
  const [clock, setClock] = useState<PlaybackClock | null>(null);
  const [editing, setEditing] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const { practice, updatePractice } = usePracticeSession(song.id);
  const { loopA, loopB, loopEnabled, rate, bpm: manualBpm } = practice;

  const handleAdapter = useCallback((next: PlayerAdapter | null) => {
    setAdapter(next);
    setClock((previous) => {
      previous?.destroy();
      return next ? new PlaybackClock(next) : null;
    });
  }, []);

  const transposedSegments = useMemo(
    () =>
      song.segments.map((segment) => ({
        ...segment,
        chord: segment.chord ? transposeChord(segment.chord, song.transpose) : null,
      })),
    [song.segments, song.transpose],
  );

  const capo = song.capo ?? 0;
  /** El piano no admite cejilla: el capo se ignora al mostrar las formas. */
  const capoAvailable = supportsCapo(instrument);
  const effectiveCapo = capoAvailable ? capo : 0;

  /** Acordes que se muestran: con cejilla, las formas bajan `capo` semitonos. */
  const shapeSegments = useMemo(
    () =>
      effectiveCapo === 0
        ? transposedSegments
        : transposedSegments.map((segment) => ({
            ...segment,
            chord: segment.chord ? transposeChord(segment.chord, -effectiveCapo) : null,
          })),
    [transposedSegments, effectiveCapo],
  );

  const beats = useMemo(
    () => extendBeats(song.beats ?? [], song.duration),
    [song.beats, song.duration],
  );
  const beatsPerBar = song.beatsPerBar ?? 4;
  const bpm = useMemo(() => tempoFromBeats(song.beats ?? []), [song.beats]);

  const displaySegments = useMemo(() => {
    const simplified =
      simplifyChords || reduceChords
        ? shapeSegments.map((segment) => ({
            ...segment,
            chord: segment.chord ? simplifyChord(segment.chord) : null,
          }))
        : shapeSegments;
    if (!reduceChords) return simplified;
    return reduceChordSegments(simplified, beats, reduceChordsMax ? 'max' : 'normal');
  }, [shapeSegments, simplifyChords, reduceChords, reduceChordsMax, beats]);

  const estimatedKey = useMemo(() => estimateKey(transposedSegments), [transposedSegments]);
  const accidental: Accidental = resolveAccidental(estimatedKey, song.accidentalPreference);

  const keyName = useCallback(
    (key: EstimatedKey | null) => {
      if (!key) return null;
      const keyAccidental = resolveAccidental(key, song.accidentalPreference);
      return `${noteName(key.tonic, song.notation, keyAccidental)} ${
        key.mode === 'major' ? 'mayor' : 'menor'
      }`;
    },
    [song.notation, song.accidentalPreference],
  );

  const keyLabel = keyName(estimatedKey);
  const relativeKeyLabel = keyName(estimatedKey ? relativeKey(estimatedKey) : null);
  const capoKeyLabel = keyName(
    estimatedKey ? transposeKey(estimatedKey, -effectiveCapo) : null,
  );

  const chordList = useMemo(() => {
    const seen = new Set<string>();
    const chords: string[] = [];
    for (const segment of displaySegments) {
      if (!segment.chord) continue;
      const label = formatChordOrSilence(segment.chord, song.notation, accidental);
      if (seen.has(label)) continue;
      seen.add(label);
      chords.push(label);
    }
    return chords;
  }, [displaySegments, song.notation, accidental]);

  const artist = useMemo(() => {
    const separator = song.title.indexOf(' - ');
    if (separator <= 0) return null;
    return song.title.slice(0, separator).trim() || null;
  }, [song.title]);

  useEffect(() => {
    clock?.setSegments(displaySegments);
  }, [clock, displaySegments]);

  useEffect(() => {
    clock?.setBeats(beats);
  }, [clock, beats]);

  const seek = (time: number) => {
    adapter?.seekTo(time);
    clock?.tickOnce();
  };

  const changePreferences = (patch: {
    notation?: Notation;
    accidentalPreference?: AccidentalPreference;
    transpose?: number;
    simplifyChords?: boolean;
    reduceChords?: boolean;
    reduceChordsMax?: boolean;
    instrument?: Instrument;
    gridView?: GridView;
    capo?: number;
  }) => {
    const songPatch: Partial<
      Pick<Song, 'notation' | 'accidentalPreference' | 'transpose' | 'capo'>
    > = {};
    if (patch.notation !== undefined) songPatch.notation = patch.notation;
    if (patch.accidentalPreference !== undefined) {
      songPatch.accidentalPreference = patch.accidentalPreference;
    }
    if (patch.transpose !== undefined) songPatch.transpose = patch.transpose;
    if (patch.capo !== undefined) songPatch.capo = Math.max(0, Math.min(7, patch.capo));
    if (Object.keys(songPatch).length > 0) onChange({ ...song, ...songPatch });
    onPreferences(patch);
  };

  const saveEdited = (segments: ChordSegment[]) => {
    const updated: Song = {
      ...song,
      segments,
      updatedAt: new Date().toISOString(),
    };
    onChange(updated);
    onSave(updated);
    setEditing(false);
  };

  const sourceLabel =
    song.source.type === 'youtube'
      ? `YouTube · ${song.source.videoId}`
      : `Audio subido · ${song.source.filename}`;

  return (
    <div className="space-y-5">
      {notice ? <NoticeBanner message={notice} tone="warning" onDismiss={onDismissNotice} /> : null}

      <header className="border-b border-line pb-5">
        <nav className="flex flex-wrap items-center gap-5" aria-label="Navegación">
          <button
            type="button"
            className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-ink3 transition hover:text-accent"
            onClick={onBack}
          >
            ← Inicio
          </button>
          <button
            type="button"
            className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-ink3 transition hover:text-accent"
            onClick={onOpenLibrary}
          >
            Biblioteca
          </button>
        </nav>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="eyebrow">Partitura sincronizada</p>
            <h1 className="display mt-2 truncate text-2xl sm:text-3xl">{song.title}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink3">
              <span className="badge">{sourceLabel}</span>
              <span className="tabular-nums">{formatTime(song.duration)}</span>
              <span aria-hidden="true">·</span>
              <span>Analizador {song.analyzerVersion}</span>
              {saved ? null : (
                <span className="badge border-accent/50 text-accent">sin guardar</span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={() => setEditing((value) => !value)}>
              {editing ? 'Salir de edición' : 'Editar acordes'}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => onSave(song)}>
              {saved ? 'Guardar cambios' : 'Guardar en biblioteca'}
            </button>
          </div>
        </div>
      </header>

      {adapter && clock ? (
        <div className="space-y-2">
          <Transport adapter={adapter} clock={clock} duration={song.duration} />
          <PracticeBar
            adapter={adapter}
            clock={clock}
            beats={beats}
            beatsPerBar={beatsPerBar}
            duration={song.duration}
            loopA={loopA}
            loopB={loopB}
            loopEnabled={loopEnabled}
            onLoopAChange={(value) => updatePractice({ loopA: value })}
            onLoopBChange={(value) => updatePractice({ loopB: value })}
            onLoopEnabledChange={(value) => updatePractice({ loopEnabled: value })}
            rate={rate}
            onRateChange={(value) => updatePractice({ rate: value })}
            manualBpm={manualBpm}
            onManualBpmChange={(value) => updatePractice({ bpm: value })}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-line px-4 py-3 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink3">
          Los controles de reproducción aparecerán cuando el reproductor esté disponible.
        </div>
      )}

      <section
        className="flex flex-wrap items-stretch overflow-hidden rounded-xl border border-line bg-panel shadow-sm"
        aria-label="Barra de herramientas"
      >
        <NotationControls
          notation={song.notation}
          accidentalPreference={song.accidentalPreference}
          transpose={song.transpose}
          keyLabel={keyLabel}
          onChange={changePreferences}
        />
        <DisplayControls
          simplifyChords={simplifyChords}
          reduceChords={reduceChords}
          reduceChordsMax={reduceChordsMax}
          instrument={instrument}
          capo={capo}
          onChange={changePreferences}
        />
      </section>

      {playbackError ? (
        <ErrorBanner
          message={playbackError}
          code="PLAYBACK_ERROR"
          onDismiss={() => setPlaybackError(null)}
        />
      ) : null}

      <div
        data-testid="song-layout"
        className="grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start"
      >
        <div data-testid="song-grid-column" className="order-2 min-w-0 lg:order-none">
          {editing ? (
            <EditorPanel
              song={song}
              notation={song.notation}
              accidental={accidental}
              onSave={saveEdited}
              onDiscard={() => setEditing(false)}
            />
          ) : (
            <ChordGrid
              segments={displaySegments}
              notation={song.notation}
              accidental={accidental}
              clock={clock}
              onSeek={seek}
              beats={beats}
              beatsPerBar={beatsPerBar}
              duration={song.duration}
              loopA={loopA}
              loopB={loopB}
              view={gridView}
              onViewChange={(view) => onPreferences({ gridView: view })}
            />
          )}
        </div>

        <aside
          data-testid="song-tools-column"
          className="order-1 space-y-5 lg:order-none lg:sticky lg:top-5"
          aria-label="Video y herramientas"
        >
          <section
            className="rounded-xl border border-line bg-panel p-3 shadow-sm"
            aria-label="Reproductor"
          >
            <PlayerHost
              song={song}
              audioUrl={audioUrl}
              forceFake={forceFake}
              variant="compact"
              onAdapter={handleAdapter}
              onPlaybackError={setPlaybackError}
            />
          </section>

          <ActiveChordDiagram
            segments={displaySegments}
            clock={clock}
            instrument={instrument}
            notation={song.notation}
            accidental={accidental}
          />

          <SongDetails
            keyLabel={keyLabel}
            relativeKeyLabel={relativeKeyLabel}
            capo={effectiveCapo}
            capoKeyLabel={capoKeyLabel}
            showCapo={capoAvailable}
            bpm={bpm}
            beatsPerBar={beatsPerBar}
            duration={song.duration}
            artist={artist}
            chords={chordList}
          />

          <HarmonicAnalysis
            segments={transposedSegments}
            harmonyKey={estimatedKey}
            notation={song.notation}
            accidental={accidental}
            capo={effectiveCapo}
          />
        </aside>
      </div>
    </div>
  );
}
