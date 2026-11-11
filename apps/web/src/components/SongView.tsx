import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  chordDegree,
  chordEquals,
  estimateKey,
  formatChord,
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
import { useT } from '../i18n';
import { buildChordPro, downloadChordPro } from '../lib/chordpro';
import {
  MAX_SHARE_URL,
  buildShareMessage,
  buildShareUrl,
  canShareLinks,
  emailShareUrl,
  encodeSongForShare,
  telegramShareUrl,
  whatsappShareUrl,
} from '../lib/share';
import { downloadSong } from '../storage/backup';
import { extendBeats, tempoFromBeats } from '../grid/beats';
import { barRangeAt } from '../practice/range';
import { usePracticeSession } from '../practice/usePracticeSession';
import { PlaybackClock } from '../sync/clock';
import {
  supportsCapo,
  type AppNotice,
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
import { LyricsEditor } from './LyricsEditor';
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
  notice: AppNotice | null;
  onDismissNotice: () => void;
  onChange: (song: Song) => void;
  onSave: (song: Song) => void;
  onReanalyze: () => void;
  reanalyzing: boolean;
  reanalyzeProgress: number | null;
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
  onReanalyze,
  reanalyzing,
  reanalyzeProgress,
  onBack,
  onOpenLibrary,
  onPreferences,
}: SongViewProps) {
  const t = useT();
  const [adapter, setAdapter] = useState<PlayerAdapter | null>(null);
  const [clock, setClock] = useState<PlaybackClock | null>(null);
  const [editing, setEditing] = useState(false);
  const [editingLyrics, setEditingLyrics] = useState(false);
  const [lyricsDraft, setLyricsDraft] = useState('');
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailsDraft, setDetailsDraft] = useState({ title: '', artist: '' });
  const [markMode, setMarkMode] = useState<'a' | 'b' | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState<{
    message: string;
    tone: 'success' | 'warning';
  } | null>(null);
  const shareCloseRef = useRef<HTMLButtonElement>(null);
  const shareDialogRef = useRef<HTMLDivElement>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [performance, setPerformance] = useState(false);
  const { practice, updatePractice } = usePracticeSession(song.id);
  const { loopA, loopB, loopEnabled, rate, bpm: manualBpm } = practice;

  useEffect(() => {
    setEditingLyrics(false);
    setLyricsDraft('');
  }, [song.id]);

  useEffect(() => {
    if (!shareOpen) return;
    shareCloseRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShareOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = shareDialogRef.current;
      if (!dialog) return;
      const focusables = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => element.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [shareOpen]);

  useEffect(() => {
    if (!shareOpen || !canShareLinks()) {
      setShareLink(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const token = await encodeSongForShare(song);
        const url = buildShareUrl(token);
        if (!cancelled) setShareLink(url.length <= MAX_SHARE_URL ? url : null);
      } catch {
        if (!cancelled) setShareLink(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareOpen, song]);

  useEffect(() => {
    document.body.classList.toggle('performance-mode', performance);
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setPerformance(false);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.body.classList.remove('performance-mode');
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [performance]);

  const togglePerformance = () => {
    if (performance) {
      setPerformance(false);
      if (document.fullscreenElement) {
        const exit = document.exitFullscreen;
        if (exit) void exit.call(document).catch(() => undefined);
      }
      return;
    }
    setPerformance(true);
    const request = document.documentElement.requestFullscreen;
    if (request) void request.call(document.documentElement).catch(() => undefined);
  };

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
  /** The piano does not support a capo: the capo is ignored when showing shapes. */
  const capoAvailable = supportsCapo(instrument);
  const effectiveCapo = capoAvailable ? capo : 0;

  /** Chords shown: with a capo, shapes are shifted down `capo` semitones. */
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
    return reduceChordSegments(
      simplified,
      beats,
      reduceChordsMax ? 'max' : 'normal',
      beatsPerBar,
    );
  }, [shapeSegments, simplifyChords, reduceChords, reduceChordsMax, beats, beatsPerBar]);

  /** Lyrics keep the real timings: maximum reduction only affects the grid. */
  const lyricsSegments = useMemo(() => {
    const simplified =
      simplifyChords || reduceChords
        ? shapeSegments.map((segment) => ({
            ...segment,
            chord: segment.chord ? simplifyChord(segment.chord) : null,
          }))
        : shapeSegments;
    if (!reduceChords) return simplified;
    return reduceChordSegments(simplified, beats, 'normal', beatsPerBar);
  }, [shapeSegments, simplifyChords, reduceChords, beats, beatsPerBar]);

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

  /** Chord changes for the printable sheet, with time and degree. */
  const printRows = useMemo(() => {
    const rows: Array<{ time: string; chord: string; degree: string | null }> = [];
    let previous: ChordSegment['chord'] = null;
    for (const segment of displaySegments) {
      if (!segment.chord) {
        previous = null;
        continue;
      }
      if (previous && chordEquals(previous, segment.chord)) continue;
      previous = segment.chord;
      rows.push({
        time: formatTime(segment.start),
        chord: formatChord(segment.chord, song.notation, accidental),
        degree: estimatedKey ? chordDegree(segment.chord, estimatedKey) : null,
      });
    }
    return rows;
  }, [displaySegments, song.notation, accidental, estimatedKey]);

  const artist = useMemo(() => {
    if (song.artist?.trim()) return song.artist.trim();
    const separator = song.title.indexOf(' - ');
    if (separator <= 0) return null;
    return song.title.slice(0, separator).trim() || null;
  }, [song.artist, song.title]);

  const openDetails = () => {
    setDetailsDraft({ title: song.title, artist: artist ?? '' });
    setEditingDetails(true);
  };

  const applyDetails = (event: FormEvent) => {
    event.preventDefault();
    const title = detailsDraft.title.trim() || song.title;
    const artistValue = detailsDraft.artist.trim();
    const updated: Song = { ...song, title, updatedAt: new Date().toISOString() };
    if (artistValue) updated.artist = artistValue;
    else delete updated.artist;
    onChange(updated);
    setEditingDetails(false);
  };

  useEffect(() => {
    clock?.setSegments(displaySegments);
  }, [clock, displaySegments]);

  useEffect(() => {
    clock?.setBeats(beats);
  }, [clock, beats]);

  const seek = (time: number) => {
    setMarkMode(null);
    adapter?.seekTo(time);
    clock?.tickOnce();
  };

  /**
   * With A or B armed, the click only sets that loop endpoint and does not play.
   * Without mark mode, the click seeks to the point and starts playing from there.
   */
  const selectBar = (time: number) => {
    if (markMode !== null) {
      const range = barRangeAt(time, beats, beatsPerBar, song.duration);
      if (markMode === 'a') {
        updatePractice({
          loopA: range.start,
          loopB: loopB !== null && loopB <= range.start ? null : loopB,
        });
      } else {
        updatePractice({
          loopB: range.end,
          loopA: loopA === null || loopA >= range.end ? range.start : loopA,
        });
      }
      setMarkMode(null);
      return;
    }

    seek(time);
    adapter?.play();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'BUTTON' ||
          target.tagName === 'A' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        if (adapter?.isPlaying()) adapter.pause();
        else adapter?.play();
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const delta = event.key === 'ArrowLeft' ? -5 : 5;
        const next = Math.max(
          0,
          Math.min(song.duration, (adapter?.getCurrentTime() ?? 0) + delta),
        );
        adapter?.seekTo(next);
        clock?.tickOnce();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [adapter, clock, song.duration]);

  useEffect(() => {
    if (markMode === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMarkMode(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [markMode]);

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

  const openLyricsEditor = () => {
    setLyricsDraft(song.lyrics ?? '');
    setEditingLyrics(true);
  };

  const closeLyricsEditor = () => {
    setEditingLyrics(false);
    setLyricsDraft('');
  };

  const saveLyrics = () => {
    const updated: Song = {
      ...song,
      lyrics: lyricsDraft.trim().length > 0 ? lyricsDraft : undefined,
      updatedAt: new Date().toISOString(),
    };
    onChange(updated);
    onSave(updated);
    setEditingLyrics(false);
    setLyricsDraft('');
  };

  const deleteLyrics = () => {
    const updated: Song = {
      ...song,
      lyrics: undefined,
      updatedAt: new Date().toISOString(),
    };
    onChange(updated);
    onSave(updated);
    setEditingLyrics(false);
    setLyricsDraft('');
  };

  const chordProContent = () =>
    buildChordPro({
      title: song.title,
      artist,
      key: estimatedKey,
      tempo: bpm,
      lyrics: song.lyrics,
      segments: lyricsSegments,
      beats,
      beatsPerBar,
      duration: song.duration,
      notation: song.notation,
      accidental,
      vocalRegions: song.vocalRegions,
    });

  const exportChordProFile = () => {
    const content = chordProContent();
    const base = song.title.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'chordifree';
    downloadChordPro(`${base}.cho`, content);
  };

  const copyChordSheet = async () => {
    try {
      await navigator.clipboard.writeText(chordProContent());
      setShareNotice({ message: t('share.copySheetDone'), tone: 'success' });
    } catch {
      setShareNotice({ message: t('share.failed'), tone: 'warning' });
    }
  };

  const downloadShareFile = () => {
    downloadSong(song);
    setShareNotice({ message: t('share.fileDone'), tone: 'success' });
  };

  const copyShareLink = async () => {
    if (!shareLink) {
      setShareNotice({ message: t('share.tooLong'), tone: 'warning' });
      return;
    }
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareNotice({ message: t('share.linkDone'), tone: 'success' });
    } catch {
      setShareNotice({ message: t('share.failed'), tone: 'warning' });
    }
  };

  const shareTo = (target: 'whatsapp' | 'telegram' | 'email') => {
    const message = buildShareMessage(song.title, chordProContent(), shareLink);
    if (target === 'email') {
      window.location.href = emailShareUrl(song.title, message);
      return;
    }
    const url =
      target === 'whatsapp'
        ? whatsappShareUrl(message)
        : telegramShareUrl(message, shareLink);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const nativeShare = async () => {
    if (typeof navigator.share !== 'function') return;
    try {
      await navigator.share({ title: song.title, text: chordProContent() });
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return;
      setShareNotice({ message: t('share.failed'), tone: 'warning' });
    }
  };

  const sourceLabel =
    song.source.type === 'youtube'
      ? t('song.sourceYoutube', { id: song.source.videoId })
      : song.source.type === 'sheet'
        ? t('song.sourceSheet', { name: song.source.filename })
        : t('song.sourceUpload', { name: song.source.filename });

  return (
    <div className="space-y-5">
      {performance ? <h1 className="sr-only">{song.title}</h1> : null}
      {notice ? (
        <NoticeBanner message={notice.message} tone={notice.tone} onDismiss={onDismissNotice} />
      ) : null}

      <header className="song-header border-b border-line pb-5">
        <nav className="flex flex-wrap items-center gap-5" aria-label={t('song.navAria')}>
          <button
            type="button"
            className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-ink3 transition hover:text-accent"
            onClick={onBack}
          >
            {t('song.back')}
          </button>
          <button
            type="button"
            className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-ink3 transition hover:text-accent"
            onClick={onOpenLibrary}
          >
            {t('song.library')}
          </button>
        </nav>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="eyebrow">{t('song.eyebrow')}</p>
            <h1 className="display mt-2 truncate text-2xl sm:text-3xl">{song.title}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink3">
              <span className="badge">{sourceLabel}</span>
              <span className="tabular-nums">{formatTime(song.duration)}</span>
              <span aria-hidden="true">·</span>
              <span>{t('song.analyzer', { version: song.analyzerVersion })}</span>
              {saved ? null : (
                <span className="badge border-accent/50 text-accent">
                  {t('song.unsaved')}
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {!editingLyrics ? (
              <button type="button" className="btn" onClick={() => setEditing((value) => !value)}>
                {editing ? t('song.exitEdit') : t('song.editChords')}
              </button>
            ) : null}
            {!editing && !editingLyrics ? (
              <button type="button" className="btn" onClick={openDetails}>
                {t('song.editDetails')}
              </button>
            ) : null}
            {!editing && !editingLyrics ? (
              <button type="button" className="btn" onClick={togglePerformance}>
                {performance ? t('song.exitPerformance') : t('song.performance')}
              </button>
            ) : null}
            {!editing && !editingLyrics ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setShareNotice(null);
                  setShareLink(null);
                  setShareOpen(true);
                }}
              >
                {t('song.share')}
              </button>
            ) : null}
            {!editing && !editingLyrics && printRows.length > 0 ? (
              <>
                <button type="button" className="btn" onClick={() => window.print()}>
                  {t('song.print')}
                </button>
                <button type="button" className="btn" onClick={exportChordProFile}>
                  {t('song.chordpro')}
                </button>
              </>
            ) : null}
            {!editing && !editingLyrics && song.source.type === 'youtube' ? (
              <button
                type="button"
                className="btn"
                disabled={reanalyzing}
                onClick={() => {
                  if (window.confirm(t('song.reanalyzeConfirm'))) {
                    onReanalyze();
                  }
                }}
              >
                {reanalyzing
                  ? `${t('song.reanalyzing')}${
                      reanalyzeProgress !== null ? ` ${reanalyzeProgress}%` : '…'
                    }`
                  : t('song.reanalyze')}
              </button>
            ) : null}
            {!editingLyrics ? (
              <button type="button" className="btn btn-primary" onClick={() => onSave(song)}>
                {saved ? t('song.save') : t('song.saveToLibrary')}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {editingDetails ? (
        <form
          className="song-details-form grid gap-4 rounded-xl border border-line bg-panel-2/40 p-4 sm:grid-cols-2 sm:p-5"
          onSubmit={applyDetails}
        >
          <label className="block">
            <span className="eyebrow block">{t('song.detailsTitle')}</span>
            <input
              className="field mt-2"
              value={detailsDraft.title}
              onChange={(event) =>
                setDetailsDraft((current) => ({ ...current, title: event.target.value }))
              }
              autoFocus
            />
          </label>
          <label className="block">
            <span className="eyebrow block">{t('song.detailsArtist')}</span>
            <input
              className="field mt-2"
              value={detailsDraft.artist}
              onChange={(event) =>
                setDetailsDraft((current) => ({ ...current, artist: event.target.value }))
              }
            />
          </label>
          <p className="text-xs leading-relaxed text-ink3 sm:col-span-2">
            {t('song.detailsHint')}
          </p>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" className="btn btn-primary">
              {t('song.detailsApply')}
            </button>
            <button type="button" className="btn" onClick={() => setEditingDetails(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </form>
      ) : null}

      {adapter && clock ? (
        <div className="song-controls space-y-2">
          <Transport
            adapter={adapter}
            clock={clock}
            duration={song.duration}
            loopA={loopA}
            loopB={loopB}
            loopEnabled={loopEnabled}
          />
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
            markMode={markMode}
            onMarkModeChange={setMarkMode}
            rate={rate}
            onRateChange={(value) => updatePractice({ rate: value })}
            manualBpm={manualBpm}
            onManualBpmChange={(value) => updatePractice({ bpm: value })}
          />
        </div>
      ) : (
        <div className="song-controls rounded-xl border border-line px-4 py-3 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink3">
          {t('song.controlsUnavailable')}
        </div>
      )}

      <section
        className="song-toolbar flex flex-wrap items-stretch overflow-hidden rounded-xl border border-line bg-panel shadow-sm"
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
          {editingLyrics ? (
            <LyricsEditor
              value={lyricsDraft}
              initialValue={song.lyrics ?? ''}
              canDelete={Boolean(song.lyrics)}
              canAnchor={Boolean(adapter)}
              getCurrentTime={() => adapter?.getCurrentTime() ?? null}
              onChange={setLyricsDraft}
              onSave={saveLyrics}
              onCancel={closeLyricsEditor}
              onDelete={deleteLyrics}
            />
          ) : editing ? (
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
              lyricsSegments={lyricsSegments}
              notation={song.notation}
              accidental={accidental}
              clock={clock}
              onSeek={seek}
              onSelectBar={selectBar}
              markMode={markMode}
              beats={beats}
              beatsPerBar={beatsPerBar}
              duration={song.duration}
              loopA={loopA}
              loopB={loopB}
              vocalRegions={song.vocalRegions}
              lyrics={song.lyrics}
              onEditLyrics={openLyricsEditor}
              view={gridView}
              onViewChange={(view) => onPreferences({ gridView: view })}
            />
          )}
        </div>

        <aside
          data-testid="song-tools-column"
          className="song-tools order-1 space-y-5 lg:order-none lg:sticky lg:top-5"
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

      <section className="print-sheet" data-testid="print-sheet" aria-hidden="true">
        <header className="print-sheet-header">
          <p className="print-brand">chordifree</p>
          <h1>{song.title}</h1>
          <p className="print-meta">
            {[
              keyLabel ?? t('song.unknownKey'),
              capoAvailable && capo > 0 ? t('song.capoValue', { value: capo }) : null,
              bpm ? `${bpm} BPM` : null,
              formatTime(song.duration),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </header>

        <ol className="print-chords" aria-label="Cambios de acorde">
          {printRows.map((row, index) => (
            <li key={`${row.time}-${row.chord}-${index}`}>
              <span className="print-time">{row.time}</span>
              <span className="print-chord">{row.chord}</span>
              {row.degree ? <span className="print-degree">{row.degree}</span> : null}
            </li>
          ))}
        </ol>

        <footer className="print-footer">
          {song.source.type === 'youtube'
            ? t('song.printYoutube', { id: song.source.videoId })
            : song.source.type === 'sheet'
              ? t('song.printSheet', { name: song.source.filename })
              : t('song.printAudio', { name: song.source.filename })}{' '}
          · {t('song.generatedOn', { date: new Date().toLocaleDateString() })}
        </footer>
      </section>

      {performance ? (
        <button
          type="button"
          className="btn btn-secondary fixed bottom-4 right-4 z-[60]"
          onClick={togglePerformance}
        >
          {t('song.exitPerformance')}
        </button>
      ) : null}

      {shareOpen ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 px-4 pb-10 pt-[10vh]"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShareOpen(false);
          }}
        >
          <div
            ref={shareDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-title"
            className="mx-auto w-full max-w-lg rounded-2xl border border-line bg-panel p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{t('share.eyebrow')}</p>
                <h2 id="share-title" className="display mt-2 text-2xl">
                  {t('share.title')}
                </h2>
              </div>
              <button
                ref={shareCloseRef}
                type="button"
                className="btn btn-ghost"
                onClick={() => setShareOpen(false)}
              >
                {t('common.close')}
              </button>
            </div>

            {shareNotice ? (
              <div className="mt-4">
                <NoticeBanner
                  message={shareNotice.message}
                  tone={shareNotice.tone}
                  onDismiss={() => setShareNotice(null)}
                />
              </div>
            ) : null}

            <div className="mt-6 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-ink">{t('share.quickTitle')}</h3>
                <p className="mt-1 text-xs leading-relaxed text-ink3">{t('share.quickBody')}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => shareTo('whatsapp')}
                  >
                    {t('share.whatsapp')}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => shareTo('telegram')}
                  >
                    {t('share.telegram')}
                  </button>
                  <button type="button" className="btn" onClick={() => shareTo('email')}>
                    {t('share.email')}
                  </button>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink3">{t('share.quickNote')}</p>
              </div>

              <div className="border-t border-line pt-5">
                <h3 className="text-sm font-semibold text-ink">{t('share.copySheetTitle')}</h3>
                <p className="mt-1 text-xs leading-relaxed text-ink3">
                  {t('share.copySheetBody')}
                </p>
                <button type="button" className="btn mt-3" onClick={() => void copyChordSheet()}>
                  {t('share.copySheetAction')}
                </button>
              </div>

              <div className="border-t border-line pt-5">
                <h3 className="text-sm font-semibold text-ink">{t('share.fileTitle')}</h3>
                <p className="mt-1 text-xs leading-relaxed text-ink3">{t('share.fileBody')}</p>
                <button type="button" className="btn mt-3" onClick={downloadShareFile}>
                  {t('share.fileAction')}
                </button>
              </div>

              {canShareLinks() ? (
                <div className="border-t border-line pt-5">
                  <h3 className="text-sm font-semibold text-ink">{t('share.linkTitle')}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink3">{t('share.linkBody')}</p>
                  <button type="button" className="btn mt-3" onClick={() => void copyShareLink()}>
                    {t('share.linkAction')}
                  </button>
                </div>
              ) : (
                <p className="border-t border-line pt-5 text-xs leading-relaxed text-ink3">
                  {t('share.linkUnavailable')}
                </p>
              )}

              {typeof navigator.share === 'function' ? (
                <div className="border-t border-line pt-5">
                  <button type="button" className="btn" onClick={() => void nativeShare()}>
                    {t('share.native')}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
