import type { ChordSegment } from '@chordifree/chords';

export type AnalysisSource =
  | { type: 'youtube'; videoId: string; title?: string }
  | { type: 'upload'; filename: string };

export interface AnalysisResult {
  source: AnalysisSource;
  duration: number;
  segments: ChordSegment[];
  beats?: number[];
  beatsPerBar?: number;
  analyzerVersion: string;
  createdAt: string;
}

export interface RawSegment {
  start: number;
  end: number;
  label: string | null;
  confidence?: number;
}

export interface RawAnalysis {
  segments: RawSegment[];
  duration: number;
  beats?: number[];
  beatsPerBar?: number;
  analyzerVersion: string;
}

export interface YoutubeMetadata {
  duration: number;
  title?: string;
}

export interface AudioProbe {
  duration: number;
  codec: string;
  channels: number;
}
