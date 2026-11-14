import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeSegments, parseChord } from '@chordifree/chords';
import type { AppConfig } from '../config';
import { ApiError } from '../errors';
import type { AnalysisResult, RawAnalysis, RawSegment } from '../types';
import type { AnalyzerClient } from './analyzer';
import type { TemporaryAudioCache } from './audio-cache';
import { removeDirectory, type MediaTools } from './media';

export interface AnalysisDeps {
  config: AppConfig;
  tools: MediaTools;
  analyzer: AnalyzerClient;
  audioCache: TemporaryAudioCache;
}

export type ProgressReporter = (progress: number) => void;

const DEFAULT_BEATS_PER_BAR = 4;

/** Discards invalid beats and guarantees a strictly increasing list. */
export function sanitizeBeats(beats: number[] | undefined, duration: number): number[] {
  if (!Array.isArray(beats) || !Number.isFinite(duration) || duration <= 0) return [];
  const values = beats
    .filter((beat) => Number.isFinite(beat) && beat >= 0 && beat <= duration)
    .map((beat) => Math.round(beat * 1000) / 1000)
    .sort((a, b) => a - b);
  return values.filter((value, index) => index === 0 || value > values[index - 1]!);
}

export function sanitizeBeatsPerBar(_value: number | undefined): number {
  return DEFAULT_BEATS_PER_BAR;
}

/** Valid vocal regions, sorted and within the duration. */
export function sanitizeVocalRegions(
  regions: Array<{ start: number; end: number }> | undefined,
  duration: number,
): Array<{ start: number; end: number }> {
  if (!Array.isArray(regions) || !Number.isFinite(duration) || duration <= 0) return [];
  return regions
    .filter(
      (region) =>
        region &&
        Number.isFinite(region.start) &&
        Number.isFinite(region.end) &&
        region.end > region.start,
    )
    .map((region) => ({
      start: Math.max(0, Math.round(region.start * 1000) / 1000),
      end: Math.min(duration, Math.round(region.end * 1000) / 1000),
    }))
    .filter((region) => region.end > region.start)
    .sort((a, b) => a.start - b.start);
}

function toSegments(raw: RawAnalysis) {
  const segments = raw.segments.map((segment: RawSegment) => ({
    start: segment.start,
    end: segment.end,
    chord: segment.label ? parseChord(segment.label) : null,
    ...(segment.confidence !== undefined ? { confidence: segment.confidence } : {}),
  }));
  return normalizeSegments(segments, raw.duration);
}

async function createWorkspace(config: AppConfig): Promise<string> {
  return mkdtemp(join(config.tempDir, 'chordifree-'));
}

export async function analyzeYoutube(
  videoId: string,
  deps: AnalysisDeps,
  report: ProgressReporter = () => {},
): Promise<AnalysisResult> {
  const workspace = await createWorkspace(deps.config);
  try {
    report(10);
    const metadata = await deps.tools.probeYoutube(videoId);
    if (metadata.duration > deps.config.maxDurationSeconds) {
      throw new ApiError(
        'DURATION_EXCEEDED',
        `The video exceeds the maximum duration of ${Math.round(deps.config.maxDurationSeconds / 60)} minutes`,
      );
    }

    report(25);
    const downloaded = await deps.tools.downloadYoutube(videoId, workspace);

    report(45);
    const wav = join(workspace, 'audio.wav');
    await deps.tools.convertToWav(downloaded, wav);

    // Keep the downloaded audio for the temporary pitch-shifted player. It is
    // optional: a failure here must not fail the analysis.
    await deps.audioCache.store(videoId, downloaded).catch(() => undefined);

    report(65);
    const raw = await deps.analyzer.analyze(wav);

    report(90);
    const result: AnalysisResult = {
      source: { type: 'youtube', videoId, ...(metadata.title ? { title: metadata.title } : {}) },
      duration: raw.duration,
      segments: toSegments(raw),
      beats: sanitizeBeats(raw.beats, raw.duration),
      beatsPerBar: sanitizeBeatsPerBar(raw.beatsPerBar),
      vocalRegions: sanitizeVocalRegions(raw.vocalRegions, raw.duration),
      analyzerVersion: raw.analyzerVersion,
      createdAt: new Date().toISOString(),
    };
    report(100);
    return result;
  } finally {
    await removeDirectory(workspace).catch(() => undefined);
  }
}

export async function analyzeUpload(
  filename: string,
  payload: Buffer,
  deps: AnalysisDeps,
  report: ProgressReporter = () => {},
): Promise<AnalysisResult> {
  const workspace = await createWorkspace(deps.config);
  try {
    report(10);
    const extension = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '.bin';
    const source = join(workspace, `upload${extension}`);
    await writeFile(source, payload);

    report(20);
    const probe = await deps.tools.probeAudio(source);
    if (probe.duration > deps.config.maxDurationSeconds) {
      throw new ApiError(
        'DURATION_EXCEEDED',
        `The audio exceeds the maximum duration of ${Math.round(deps.config.maxDurationSeconds / 60)} minutes`,
      );
    }

    report(45);
    const wav = join(workspace, 'audio.wav');
    await deps.tools.convertToWav(source, wav);

    report(65);
    const raw = await deps.analyzer.analyze(wav);

    report(90);
    const result: AnalysisResult = {
      source: { type: 'upload', filename },
      duration: raw.duration,
      segments: toSegments(raw),
      beats: sanitizeBeats(raw.beats, raw.duration),
      beatsPerBar: sanitizeBeatsPerBar(raw.beatsPerBar),
      vocalRegions: sanitizeVocalRegions(raw.vocalRegions, raw.duration),
      analyzerVersion: raw.analyzerVersion,
      createdAt: new Date().toISOString(),
    };
    report(100);
    return result;
  } finally {
    await removeDirectory(workspace).catch(() => undefined);
  }
}

export function defaultTempDir(): string {
  return tmpdir();
}
