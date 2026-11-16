import type { VocalRegion } from '@chordifree/contracts';

export type {
  AnalysisResult,
  AnalysisSource,
  VocalRegion,
  YoutubeSearchResult,
} from '@chordifree/contracts';

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

export interface AudioProbe {
  duration: number;
  codec: string;
  channels: number;
}
