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
  vocalRegions?: VocalRegion[];
  analyzerVersion: string;
  createdAt: string;
}

export interface VocalRegion {
  start: number;
  end: number;
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
  vocalRegions?: VocalRegion[];
  analyzerVersion: string;
}

export interface YoutubeMetadata {
  duration: number;
  title?: string;
}

export interface YoutubeSearchResult {
  videoId: string;
  title: string;
  uploader?: string;
  duration?: number;
  thumbnail: string;
}

export interface AudioProbe {
  duration: number;
  codec: string;
  channels: number;
}
