import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { ApiError } from '../errors';
import type { RawAnalysis } from '../types';

const RawSegmentSchema = z.object({
  start: z.number(),
  end: z.number(),
  label: z.string().nullable(),
  confidence: z.number().optional(),
});

const RawAnalysisSchema = z.object({
  segments: z.array(RawSegmentSchema),
  duration: z.number().positive(),
  beats: z.array(z.number()).optional().catch(undefined),
  beatsPerBar: z.number().optional().catch(undefined),
  analyzerVersion: z.string(),
});

export interface AnalyzerClient {
  health(): Promise<{ ok: boolean; version?: string }>;
  analyze(filePath: string): Promise<RawAnalysis>;
}

export function createAnalyzerClient(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): AnalyzerClient {
  const base = baseUrl.replace(/\/$/, '');

  return {
    async health() {
      try {
        const response = await fetchImpl(`${base}/health`, {
          signal: AbortSignal.timeout(5_000),
        });
        if (!response.ok) return { ok: false };
        const body = (await response.json()) as { analyzerVersion?: string };
        return { ok: true, version: body.analyzerVersion };
      } catch {
        return { ok: false };
      }
    },

    async analyze(filePath: string): Promise<RawAnalysis> {
      try {
        const payload = await readFile(filePath);
        const form = new FormData();
        form.append('file', new Blob([payload], { type: 'audio/wav' }), 'audio.wav');
        const response = await fetchImpl(`${base}/analyze`, {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(180_000),
        });
        if (!response.ok) {
          throw new Error(`El analizador respondió ${response.status}`);
        }
        const parsed = RawAnalysisSchema.safeParse(await response.json());
        if (!parsed.success) {
          throw new Error('Respuesta del analizador inválida');
        }
        return parsed.data;
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError('ANALYSIS_FAILED', 'No se pudo analizar el audio');
      }
    },
  };
}
