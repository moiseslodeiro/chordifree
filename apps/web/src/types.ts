import type { AccidentalPreference, ChordSegment, Notation } from '@chordifree/chords';

export type AnalysisSource =
  | { type: 'youtube'; videoId: string; title?: string }
  | { type: 'upload'; filename: string }
  | { type: 'sheet'; filename: string };

export type AppNoticeTone = 'info' | 'warning' | 'success';

export interface AppNotice {
  message: string;
  tone: AppNoticeTone;
}

export interface AnalysisResult {
  source: AnalysisSource;
  duration: number;
  segments: ChordSegment[];
  beats?: number[];
  beatsPerBar?: number;
  vocalRegions?: Array<{ start: number; end: number }>;
  analyzerVersion: string;
  createdAt: string;
}

export type AnalysisStatus = 'queued' | 'processing' | 'done' | 'error';

export interface AnalysisView {
  id: string;
  status: AnalysisStatus;
  progress: number;
  source?: AnalysisSource;
  result?: AnalysisResult;
  error?: { code: string; message: string };
}

export interface LyricsResult {
  lyrics: string;
  syncedLyrics?: string;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  source: 'lrclib';
}

export interface Song {
  id: string;
  title: string;
  /** Optional artist, separate from the title once the user edits details. */
  artist?: string;
  source: AnalysisSource;
  duration: number;
  segments: ChordSegment[];
  detectedSegments: ChordSegment[];
  beats?: number[];
  beatsPerBar?: number;
  /** Detected regions with sung vocals, used to align the lyrics. */
  vocalRegions?: Array<{ start: number; end: number }>;
  /** Virtual capo: chords are shown transposed -capo semitones. */
  capo?: number;
  /** Optional plain-text lyrics, with significant line breaks. */
  lyrics?: string;
  analyzerVersion: string;
  transpose: number;
  notation: Notation;
  accidentalPreference: AccidentalPreference;
  createdAt: string;
  updatedAt: string;
}

export interface Setlist {
  id: string;
  name: string;
  songIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SongHistory {
  /** ISO timestamp of the last time the song was opened. */
  lastOpenedAt: string;
  /** Number of times the song has been opened. */
  openCount: number;
}

export interface SongSummary {
  id: string;
  title: string;
  source: AnalysisSource;
  duration: number;
  updatedAt: string;
}

export interface Preferences {
  notation: Notation;
  accidentalPreference: AccidentalPreference;
  transpose: number;
  simplifyChords: boolean;
  reduceChords: boolean;
  reduceChordsMax: boolean;
  instrument: Instrument;
  gridView: GridView;
  theme: Theme;
  language: Language;
}

export type Instrument = 'guitar' | 'piano' | 'ukelele';
export type GridView = 'beats' | 'list' | 'bars' | 'lyrics';
export type Theme = 'light' | 'dark';
export type Language = 'en' | 'es';

/** The capo only makes sense on string instruments. */
export function supportsCapo(instrument: Instrument): boolean {
  return instrument === 'guitar' || instrument === 'ukelele';
}

export function sourceKey(source: AnalysisSource): string {
  if (source.type === 'youtube') return `yt:${source.videoId}`;
  return `${source.type}:${source.filename}`;
}

export function defaultTitle(source: AnalysisSource): string {
  if (source.type === 'youtube') return `Video ${source.videoId}`;
  return source.filename.replace(/\.(cho|pro|crd|txt)$/i, '');
}

export function songFromResult(result: AnalysisResult, preferences: Preferences): Song {
  const timestamp = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title:
      result.source.type === 'youtube' && result.source.title
        ? result.source.title
        : defaultTitle(result.source),
    source: result.source,
    duration: result.duration,
    segments: result.segments,
    detectedSegments: result.segments,
    beats: result.beats ?? [],
    beatsPerBar: result.beatsPerBar ?? 4,
    vocalRegions: result.vocalRegions ?? [],
    capo: 0,
    analyzerVersion: result.analyzerVersion,
    transpose: preferences.transpose,
    notation: preferences.notation,
    accidentalPreference: preferences.accidentalPreference,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
