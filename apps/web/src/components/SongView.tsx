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
import type { CollabRevision, CollabShare, Setlist, SongSection } from '../types';
import { useT } from '../i18n';
import { useConfirm } from './ConfirmDialog';
import { fetchLyrics } from '../lib/api';
import { buildChordPro, downloadChordPro } from '../lib/chordpro';
import { buildMusicXml, downloadMusicXml } from '../lib/score';
import { buildMidi, downloadMidi, type MidiOverrides } from '../lib/midi';
import { downloadStem, getStemNotes, prepareStemAudio, uninstallStems } from '../lib/api';
import { useStems } from '../hooks/useStems';
import { extendBeats, tempoFromBeats } from '../grid/beats';
import { detectSections } from '../sections/detect';
import { barRangeAt } from '../practice/range';
import { useMicPractice } from '../practice/useMicPractice';
import { usePracticeSession } from '../practice/usePracticeSession';
import { useIsMobile } from '../hooks/useIsMobile';
import { buildLyricLines } from '../lyrics/lines';
import { PlaybackClock } from '../sync/clock';
import { usePlaybackIndex, usePlaybackTime } from '../sync/hooks';
import {
  supportsCapo,
  type AppNotice,
  type GridView,
  type Instrument,
  type Preferences,
  type Song,
} from '../types';
import { AddToSetlistDialog } from './AddToSetlistDialog';
import { ActiveChordDiagram } from './ActiveChordDiagram';
import { ChordGrid } from './ChordGrid';
import { CollabPanel } from './CollabPanel';
import { DisplayControls } from './DisplayControls';
import { EditorPanel } from './EditorPanel';
import { ErrorBanner, NoticeBanner } from './ErrorBanner';
import { LyricsEditor } from './LyricsEditor';
import { MicPractice, MicToggle } from './MicPractice';
import { MoreSettings } from './MoreSettings';
import { AudioControls } from './AudioControls';
import { SectionsPanel } from './SectionsPanel';
import { StemsPanel } from './StemsPanel';
import { SongHeader } from './SongHeader';
import { SongPrintSheet } from './SongPrintSheet';
import { SongShareDialog, type ShareNotice } from './SongShareDialog';
import { StemsInstallPrompt } from './StemsInstallPrompt';
import { NotationControls } from './NotationControls';
import { PlayerHost } from './PlayerHost';
import { PracticeBar } from './PracticeBar';
import { PracticePanel } from './PracticePanel';
import { SongInfoPanel } from './SongInfoPanel';
import { Transport } from './Transport';

interface SongViewProps {
  song: Song;
  audioUrl: string | null;
  forceFake: boolean;
  saved: boolean;
  dirty: boolean;
  simplifyChords: boolean;
  reduceChords: boolean;
  reduceChordsMax: boolean;
  instrument: Instrument;
  gridView: GridView;
  notice: AppNotice | null;
  onDismissNotice: () => void;
  onChange: (song: Song) => void;
  onSave: (song: Song) => void;
  setlists: Setlist[];
  onAddToSetlist: (setlistId: string) => void;
  onCreateSetlistWithSong: (name: string) => void;
  onReanalyze: () => void;
  reanalyzing: boolean;
  reanalyzeProgress: number | null;
  onBack: () => void;
  onOpenLibrary: () => void;
  onOpenStems: () => void;
  onPreferences: (patch: Partial<Preferences>) => void;
  language: Preferences['language'];
  collabShare: CollabShare | null;
  collabLoading: boolean;
  collabUid: string | null;
  canCollaborate: boolean;
  onShareCollab: (song: Song) => Promise<string | null>;
  onLoadCollabRevision: (revisionId: string) => Promise<CollabRevision | null>;
  onApplyCollabRevision: (revision: CollabRevision) => void;
  onRefreshCollab: () => void;
}

export function SongView({
  song,
  audioUrl,
  forceFake,
  saved,
  dirty,
  simplifyChords,
  reduceChords,
  reduceChordsMax,
  instrument,
  gridView,
  notice,
  onDismissNotice,
  onChange,
  onSave,
  setlists,
  onAddToSetlist,
  onCreateSetlistWithSong,
  onReanalyze,
  reanalyzing,
  reanalyzeProgress,
  onBack,
  onOpenLibrary,
  onOpenStems,
  onPreferences,
  language,
  collabShare,
  collabLoading,
  collabUid,
  canCollaborate,
  onShareCollab,
  onLoadCollabRevision,
  onApplyCollabRevision,
  onRefreshCollab,
}: SongViewProps) {
  const t = useT();
  const confirm = useConfirm();
  const mobile = useIsMobile();
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
  const [shareNotice, setShareNotice] = useState<ShareNotice | null>(null);
  const [karaoke, setKaraoke] = useState(false);
  const videoId = song.source.type === 'youtube' ? song.source.videoId : null;
  const stems = useStems(videoId, song.title);
  const [mixActive, setMixActive] = useState(false);
  const [mixBusy, setMixBusy] = useState(false);
  const [stemMix, setStemMix] = useState<{
    stems: Array<{ name: string; url: string }>;
  } | null>(null);
  const [stemGains, setStemGains] = useState<Record<string, number>>({});
  const [stemMidiBusy, setStemMidiBusy] = useState(false);
  const [stemError, setStemError] = useState<string | null>(null);
  const [uninstalling, setUninstalling] = useState(false);
  const stemUrlsRef = useRef<string[]>([]);
  const [addToSetlistOpen, setAddToSetlistOpen] = useState(false);
  const [performance, setPerformance] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const { practice, updatePractice } = usePracticeSession(song.id);
  const { loopA, loopB, loopEnabled, rate, bpm: manualBpm, pitch } = practice;

  useEffect(() => {
    setEditingLyrics(false);
    setLyricsDraft('');
    setMicEnabled(false);
  }, [song.id]);

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
    return reduceChordSegments(simplified, beats, reduceChordsMax ? 'max' : 'normal', beatsPerBar);
  }, [shapeSegments, simplifyChords, reduceChords, reduceChordsMax, beats, beatsPerBar]);

  /** Sounding chords for the microphone: the timeline shows capo shapes. */
  const practiceSegments = useMemo(
    () =>
      displaySegments.map((segment) => ({
        ...segment,
        chord: segment.chord ? transposeChord(segment.chord, effectiveCapo) : null,
      })),
    [displaySegments, effectiveCapo],
  );
  const practiceIndex = usePlaybackIndex(clock);
  const currentTime = usePlaybackTime(clock) ?? 0;
  const micPractice = useMicPractice({
    enabled: micEnabled,
    songId: song.id,
    segments: practiceSegments,
    currentIndex: practiceIndex,
  });
  const practiceTarget =
    practiceIndex >= 0 ? (practiceSegments[practiceIndex]?.chord ?? null) : null;
  const totalPracticeChords = useMemo(
    () => practiceSegments.filter((segment) => segment.chord !== null).length,
    [practiceSegments],
  );
  const practiceHitRanges = useMemo(() => {
    const ranges: Array<{ start: number; end: number }> = [];
    for (const index of micPractice.hits) {
      const segment = practiceSegments[index];
      if (segment) ranges.push({ start: segment.start, end: segment.end });
    }
    return ranges;
  }, [micPractice.hits, practiceSegments]);

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

  /** Sections are auto-detected once, then owned by the user. */
  const sections = useMemo(() => song.sections ?? detectSections(song), [song]);

  const printLyrics = useMemo(
    () =>
      buildLyricLines({
        lyrics: song.lyrics ?? '',
        segments: lyricsSegments,
        beats,
        beatsPerBar,
        duration: song.duration,
        notation: song.notation,
        accidental,
        vocalRegions: song.vocalRegions,
        chordLines: song.lyricChordLines,
      }).filter((line) => line.text.trim().length > 0 || line.chords.length > 0),
    [
      song.lyrics,
      song.vocalRegions,
      song.lyricChordLines,
      lyricsSegments,
      beats,
      beatsPerBar,
      song.duration,
      song.notation,
      accidental,
    ],
  );

  const keyLabel = keyName(estimatedKey);
  const relativeKeyLabel = keyName(estimatedKey ? relativeKey(estimatedKey) : null);
  const capoKeyLabel = keyName(estimatedKey ? transposeKey(estimatedKey, -effectiveCapo) : null);

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

  const lyricsQueryTitle = useMemo(() => {
    if (song.artist?.trim()) return song.title;
    const separator = song.title.indexOf(' - ');
    return separator > 0 ? song.title.slice(separator + 3).trim() || song.title : song.title;
  }, [song.artist, song.title]);

  const findLyrics = async () => {
    const result = await fetchLyrics({
      title: lyricsQueryTitle,
      ...(artist ? { artist } : {}),
      duration: song.duration,
    });
    return result.lyrics;
  };

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

  useEffect(() => {
    for (const url of stemUrlsRef.current) URL.revokeObjectURL(url);
    stemUrlsRef.current = [];
    setStemMix(null);
    setMixActive(false);
    setStemGains({});
    setStemError(null);
  }, [song.id]);

  useEffect(
    () => () => {
      for (const url of stemUrlsRef.current) URL.revokeObjectURL(url);
    },
    [],
  );

  useEffect(() => {
    if (!stems.job || stems.job.status !== 'done') return;
    setStemGains((current) => {
      const next = { ...current };
      for (const stem of stems.job!.stems) {
        if (next[stem] === undefined) next[stem] = 1;
      }
      return next;
    });
  }, [stems.job]);

  const toggleMix = async (active: boolean) => {
    if (!active) {
      for (const url of stemUrlsRef.current) URL.revokeObjectURL(url);
      stemUrlsRef.current = [];
      setStemMix(null);
      setMixActive(false);
      return;
    }
    const job = stems.job;
    if (!job || job.status !== 'done' || mixBusy) return;
    setMixBusy(true);
    setStemError(null);
    try {
      const urls = await Promise.all(
        job.stems.map(async (stem) => ({
          name: stem,
          url: await prepareStemAudio(job.id, stem),
        })),
      );
      for (const url of stemUrlsRef.current) URL.revokeObjectURL(url);
      stemUrlsRef.current = urls.map((entry) => entry.url);
      setStemMix({ stems: urls });
      setMixActive(true);
    } catch {
      setStemError(t('stems.loadFailed'));
    } finally {
      setMixBusy(false);
    }
  };

  const changeStemGain = (stem: string, value: number) => {
    setStemGains((current) => ({
      ...current,
      [stem]: Math.max(0, Math.min(1, value)),
    }));
  };

  const uninstallPlugin = async () => {
    const accepted = await confirm({
      title: t('stemsSetup.uninstall'),
      description: t('stemsSetup.uninstallConfirm'),
      confirmLabel: t('stemsSetup.uninstall'),
      tone: 'danger',
    });
    if (!accepted) return;
    setUninstalling(true);
    setStemError(null);
    try {
      if (mixActive) await toggleMix(false);
      await uninstallStems();
      await stems.refresh();
    } catch {
      setStemError(t('stems.uninstallFailed'));
    } finally {
      setUninstalling(false);
    }
  };

  const downloadStemByName = (stem: string) => {
    if (!stems.job) return;
    const base =
      song.title.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'chordifree';
    void downloadStem(stems.job.id, stem, `${base}-${stem}.wav`).catch(() =>
      setStemError(t('stems.loadFailed')),
    );
  };

  const downloadStemMidi = async () => {
    if (!stems.job?.midi?.length) return;
    setStemMidiBusy(true);
    setStemError(null);
    try {
      const overrides: MidiOverrides = {};
      for (const stem of stems.job.midi) {
        const notes = await getStemNotes(stems.job.id, stem);
        if (stem === 'bass') overrides.bass = notes;
        if (stem === 'drums') overrides.drums = notes;
      }
      const base =
        song.title.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'chordifree';
      downloadMidi(
        `${base}-stems.mid`,
        buildMidi({ ...song, segments: practiceSegments, sections }, bpm, overrides),
      );
    } catch {
      setStemError(t('stems.loadFailed'));
    } finally {
      setStemMidiBusy(false);
    }
  };

  const seek = (time: number) => {
    setMarkMode(null);
    adapter?.seekTo(time);
    clock?.tickOnce();
  };

  const updateSections = (next: SongSection[]) => {
    onChange({ ...song, sections: next });
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
        const next = Math.max(0, Math.min(song.duration, (adapter?.getCurrentTime() ?? 0) + delta));
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

  const changeMeter = (beatsPerBar: number) => {
    if (beatsPerBar === song.beatsPerBar) return;
    const updated: Song = { ...song, beatsPerBar, updatedAt: new Date().toISOString() };
    onChange(updated);
    if (saved) onSave(updated);
  };

  const updateLyricChordOffset = (segmentIndex: number, offset: number) => {
    const offsets = { ...(song.lyricChordOffsets ?? {}) };
    const key = String(segmentIndex);
    if (Math.abs(offset) < 0.05) delete offsets[key];
    else offsets[key] = offset;
    const updated: Song = {
      ...song,
      ...(Object.keys(offsets).length > 0
        ? { lyricChordOffsets: offsets }
        : { lyricChordOffsets: undefined }),
      updatedAt: new Date().toISOString(),
    };
    onChange(updated);
    if (saved) onSave(updated);
  };

  const updateLyricChordLine = (segmentIndex: number, lineIndex: number | null) => {
    const lines = { ...(song.lyricChordLines ?? {}) };
    const key = String(segmentIndex);
    if (lineIndex === null) delete lines[key];
    else lines[key] = lineIndex;
    const updated: Song = {
      ...song,
      ...(Object.keys(lines).length > 0
        ? { lyricChordLines: lines }
        : { lyricChordLines: undefined }),
      updatedAt: new Date().toISOString(),
    };
    onChange(updated);
    if (saved) onSave(updated);
  };

  const resetLyricChordOffsets = () => {
    const { lyricChordOffsets: _offsets, lyricChordLines: _lines, ...rest } = song;
    const updated: Song = { ...rest, updatedAt: new Date().toISOString() };
    onChange(updated);
    if (saved) onSave(updated);
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

  const scoreContent = () =>
    buildMusicXml({
      title: song.title,
      artist,
      instrument,
      key: estimatedKey,
      segments: displaySegments,
      beats,
      beatsPerBar,
      duration: song.duration,
      notation: song.notation,
      accidental,
      tempo: bpm,
      capo: effectiveCapo,
    });

  const exportScoreFile = () => {
    const content = scoreContent();
    const base =
      song.title.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'chordifree';
    downloadMusicXml(`${base}.musicxml`, content);
  };

  const exportMidiFile = () => {
    const base =
      song.title.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'chordifree';
    downloadMidi(`${base}.mid`, buildMidi({ ...song, segments: practiceSegments, sections }, bpm));
  };

  const exportChordProFile = () => {
    const content = chordProContent();
    const base =
      song.title.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'chordifree';
    downloadChordPro(`${base}.cho`, content);
  };

  const sourceLabel =
    song.source.type === 'youtube'
      ? t('song.sourceYoutube', { id: song.source.videoId })
      : song.source.type === 'sheet'
        ? t('song.sourceSheet', { name: song.source.filename })
        : t('song.sourceUpload', { name: song.source.filename });

  return (
    <div className="song-view space-y-5">
      {performance ? <h1 className="sr-only">{song.title}</h1> : null}
      {notice ? (
        <NoticeBanner message={notice.message} tone={notice.tone} onDismiss={onDismissNotice} />
      ) : null}

      <SongHeader
        song={song}
        sourceLabel={sourceLabel}
        saved={saved}
        dirty={dirty}
        editing={editing}
        editingLyrics={editingLyrics}
        performance={performance}
        reanalyzing={reanalyzing}
        reanalyzeProgress={reanalyzeProgress}
        canCollaborate={canCollaborate}
        hasPrintRows={printRows.length > 0}
        onBack={onBack}
        onOpenLibrary={onOpenLibrary}
        onToggleEditing={() => setEditing((value) => !value)}
        onOpenDetails={openDetails}
        onOpenSetlist={() => setAddToSetlistOpen(true)}
        onTogglePerformance={togglePerformance}
        onOpenShare={() => {
          setShareNotice(null);
          setShareOpen(true);
        }}
        onShareNotice={setShareNotice}
        onShareCollab={onShareCollab}
        onExportScore={exportScoreFile}
        onExportMidi={exportMidiFile}
        onExportChordPro={exportChordProFile}
        onReanalyze={onReanalyze}
        onSave={onSave}
      />

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
          <p className="text-xs leading-relaxed text-ink3 sm:col-span-2">{t('song.detailsHint')}</p>
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
          <PracticePanel
            onOpenChange={(open) => {
              if (!open) setMicEnabled(false);
            }}
          >
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
              manualBpm={manualBpm}
              onManualBpmChange={(value) => updatePractice({ bpm: value })}
              embedded
              trailing={
                <MicToggle enabled={micEnabled} onToggle={() => setMicEnabled((value) => !value)} />
              }
            />
            {micEnabled ? (
              <MicPractice
                status={micPractice.status}
                target={practiceTarget}
                detected={micPractice.detected}
                hit={micPractice.hit}
                hitCount={micPractice.hits.size}
                totalChords={totalPracticeChords}
                notation={song.notation}
                accidental={accidental}
                onReset={micPractice.reset}
              />
            ) : null}
          </PracticePanel>
        </div>
      ) : (
        <div className="song-controls rounded-xl border border-line px-4 py-3 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink3">
          {t('song.controlsUnavailable')}
        </div>
      )}

      <section
        className="song-toolbar flex flex-wrap items-stretch overflow-hidden rounded-xl border border-line bg-panel shadow-sm"
        aria-label={t('song.toolbarAria')}
      >
        <NotationControls
          notation={song.notation}
          accidentalPreference={song.accidentalPreference}
          transpose={song.transpose}
          hideAdvanced={mobile}
          onChange={changePreferences}
        />
        <DisplayControls
          simplifyChords={simplifyChords}
          reduceChords={reduceChords}
          reduceChordsMax={reduceChordsMax}
          instrument={instrument}
          capo={capo}
          hideAdvanced={mobile}
          onChange={changePreferences}
        />
      </section>

      {mobile ? (
        <MoreSettings
          accidentalPreference={song.accidentalPreference}
          instrument={instrument}
          capo={capo}
          onChange={changePreferences}
        />
      ) : null}

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
        <div
          data-testid="song-grid-column"
          className="order-2 min-w-0 lg:col-start-1 lg:row-start-1"
        >
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
              onFindLyrics={findLyrics}
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
              lyricChordOffsets={song.lyricChordOffsets}
              lyricChordLines={song.lyricChordLines}
              onLyricChordOffsetChange={updateLyricChordOffset}
              onLyricChordLineChange={updateLyricChordLine}
              onResetLyricChordOffsets={resetLyricChordOffsets}
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
              practiceHits={micPractice.hits}
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
                onChangeMeter: changeMeter,
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
                onAdapter={handleAdapter}
                onPlaybackError={setPlaybackError}
              />
            </section>
          </div>

          <div data-testid="song-audio" className="order-2 lg:order-none">
            <AudioControls
              adapter={adapter}
              rate={rate}
              onRateChange={(value) => updatePractice({ rate: value })}
              pitch={pitch}
              onPitchChange={(value) => updatePractice({ pitch: value })}
              pitchAvailable={
                !mixActive &&
                (song.source.type === 'youtube' || typeof adapter?.setPitch === 'function')
              }
              karaoke={karaoke}
              onKaraokeChange={setKaraoke}
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
                  onToggleMix={(active) => void toggleMix(active)}
                  onGainChange={changeStemGain}
                  onDownloadStem={downloadStemByName}
                  onDownloadMidi={() => void downloadStemMidi()}
                  onRetry={() => void stems.separate()}
                  onUninstall={() => void uninstallPlugin()}
                />
              ) : videoId && stems.setup?.supported ? (
                <StemsInstallPrompt installed={stems.setup.installed} onOpenSetup={onOpenStems} />
              ) : null}
            </AudioControls>
          </div>
          <div data-testid="song-active-chord" className="order-2 lg:order-none">
            <ActiveChordDiagram
              segments={displaySegments}
              clock={clock}
              instrument={instrument}
              notation={song.notation}
              accidental={accidental}
            />
          </div>

          {song.sections !== undefined || sections.length > 0 ? (
            <div data-testid="song-sections" className="order-2 lg:order-none">
              <SectionsPanel
                sections={song.sections ?? sections}
                currentTime={currentTime}
                onSeek={seek}
                onChange={updateSections}
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
                    .then(() =>
                      setShareNotice({ message: t('collab.linkCopied'), tone: 'success' }),
                    )
                    .catch(() =>
                      setShareNotice({
                        message: t('collab.linkReady', { url }),
                        tone: 'warning',
                      }),
                    );
                }}
                onRefresh={onRefreshCollab}
                onLoadRevision={onLoadCollabRevision}
                onApply={onApplyCollabRevision}
              />
            </div>
          ) : null}
        </aside>
      </div>

      <SongPrintSheet
        song={song}
        keyLabel={keyLabel}
        capo={capo}
        capoAvailable={capoAvailable}
        bpm={bpm}
        printLyrics={printLyrics}
        printRows={printRows}
      />

      {performance ? (
        <button
          type="button"
          className="btn btn-secondary fixed bottom-4 right-4 z-[60]"
          onClick={togglePerformance}
        >
          {t('song.exitPerformance')}
        </button>
      ) : null}

      {addToSetlistOpen ? (
        <AddToSetlistDialog
          songId={song.id}
          songTitle={song.title}
          setlists={setlists}
          onAdd={onAddToSetlist}
          onCreate={onCreateSetlistWithSong}
          onClose={() => setAddToSetlistOpen(false)}
        />
      ) : null}

      {shareOpen ? (
        <SongShareDialog
          song={song}
          getChordPro={chordProContent}
          notice={shareNotice}
          onNotice={setShareNotice}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
    </div>
  );
}
