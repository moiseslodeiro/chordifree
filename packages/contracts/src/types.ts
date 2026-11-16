import type {
  AccidentalPreference,
  ChordSegment,
  Notation,
} from '@chordifree/chords';

export type AnalysisSource =
  | { type: 'youtube'; videoId: string; title?: string }
  | { type: 'upload'; filename: string }
  | { type: 'sheet'; filename: string };

export interface VocalRegion {
  start: number;
  end: number;
}

export interface AnalysisResult {
  source: AnalysisSource;
  duration: number;
  segments: ChordSegment[];
  beats?: number[];
  beatsPerBar?: number;
  vocalRegions?: VocalRegion[];
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
  vocalRegions?: VocalRegion[];
  /** Virtual capo: chords are shown transposed -capo semitones. */
  capo?: number;
  /** Optional plain-text lyrics, with significant line breaks. */
  lyrics?: string;
  /** Visual horizontal offsets for lyric chord labels, in em, keyed by segment index. */
  lyricChordOffsets?: Record<string, number>;
  /** Visual lyric line overrides, keyed by segment index. */
  lyricChordLines?: Record<string, number>;
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

export interface CloudLibrarySnapshot {
  songs: Song[];
  setlists: Setlist[];
  updatedAt?: string;
}

export type CloudLibraryPayload = Omit<CloudLibrarySnapshot, 'updatedAt'>;

export interface YoutubeSearchResult {
  videoId: string;
  title: string;
  uploader?: string;
  duration?: number;
  thumbnail: string;
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

export interface AuthUser {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface AccessEntry {
  email: string;
  addedAt: string;
  addedBy?: string;
}

export interface AuthConfig {
  mode: 'none' | 'google';
  clientId?: string;
}

export interface AuthMe {
  user: AuthUser;
  allowed: boolean;
  admin: boolean;
}

export interface DeleteAccountResult {
  deleted: boolean;
  songs: number;
  setlists: number;
  accessRemoved: boolean;
}
