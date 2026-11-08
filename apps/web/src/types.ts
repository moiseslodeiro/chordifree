import type { AccidentalPreference, ChordSegment, Notation } from '@chordifree/chords';

export type AnalysisSource =
  { type: 'youtube'; videoId: string; title?: string } | { type: 'upload'; filename: string };

export interface AnalysisResult {
  source: AnalysisSource;
  duration: number;
  segments: ChordSegment[];
  beats?: number[];
  beatsPerBar?: number;
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
  source: AnalysisSource;
  duration: number;
  segments: ChordSegment[];
  detectedSegments: ChordSegment[];
  beats?: number[];
  beatsPerBar?: number;
  /** Cejilla virtual: los acordes se muestran transportados -capo semitonos. */
  capo?: number;
  /** Letra opcional en texto plano, con saltos de línea significativos. */
  lyrics?: string;
  analyzerVersion: string;
  transpose: number;
  notation: Notation;
  accidentalPreference: AccidentalPreference;
  createdAt: string;
  updatedAt: string;
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
}

export type Instrument = 'guitar' | 'piano' | 'ukelele';
export type GridView = 'beats' | 'list' | 'lyrics';
export type Theme = 'light' | 'dark';

/** La cejilla solo tiene sentido en instrumentos de cuerda. */
export function supportsCapo(instrument: Instrument): boolean {
  return instrument === 'guitar' || instrument === 'ukelele';
}

export function sourceKey(source: AnalysisSource): string {
  return source.type === 'youtube' ? `yt:${source.videoId}` : `upload:${source.filename}`;
}

export function defaultTitle(source: AnalysisSource): string {
  return source.type === 'youtube' ? `Video ${source.videoId}` : source.filename;
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
    capo: 0,
    analyzerVersion: result.analyzerVersion,
    transpose: preferences.transpose,
    notation: preferences.notation,
    accidentalPreference: preferences.accidentalPreference,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
