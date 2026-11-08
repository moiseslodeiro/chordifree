import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeSegments, parseChord } from '@chordifree/chords';
import type { AppConfig } from '../config';
import { ApiError } from '../errors';
import type { AnalysisResult, RawAnalysis, RawSegment } from '../types';
import type { AnalyzerClient } from './analyzer';
import { removeDirectory, type MediaTools } from './media';

export interface AnalysisDeps {
  config: AppConfig;
  tools: MediaTools;
  analyzer: AnalyzerClient;
}

export type ProgressReporter = (progress: number) => void;

const DEFAULT_BEATS_PER_BAR = 4;

/** Descarta pulsos inválidos y garantiza una lista estrictamente creciente. */
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
        `El video supera la duración máxima de ${Math.round(deps.config.maxDurationSeconds / 60)} minutos`,
      );
    }

    report(25);
    const downloaded = await deps.tools.downloadYoutube(videoId, workspace);

    report(45);
    const wav = join(workspace, 'audio.wav');
    await deps.tools.convertToWav(downloaded, wav);

    report(65);
    const raw = await deps.analyzer.analyze(wav);

    report(90);
    const result: AnalysisResult = {
      source: { type: 'youtube', videoId, ...(metadata.title ? { title: metadata.title } : {}) },
      duration: raw.duration,
      segments: toSegments(raw),
      beats: sanitizeBeats(raw.beats, raw.duration),
      beatsPerBar: sanitizeBeatsPerBar(raw.beatsPerBar),
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
        `El audio supera la duración máxima de ${Math.round(deps.config.maxDurationSeconds / 60)} minutos`,
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
