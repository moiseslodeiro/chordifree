import { useCallback, useRef, useState } from 'react';
import { t } from '../i18n';
import { localizeApiError } from '../i18n/errors';
import type { AnalysisResult, AnalysisView } from '../types';
import { ApiClientError, deleteAnalysis, pollAnalysis } from './api';

export type RunnerPhase = 'idle' | 'starting' | 'polling' | 'done' | 'error';

export interface RunnerState {
  phase: RunnerPhase;
  view: AnalysisView | null;
  error: { code: string; message: string } | null;
}

const initialState: RunnerState = { phase: 'idle', view: null, error: null };

export interface AnalysisRunner {
  state: RunnerState;
  run: (start: (signal: AbortSignal) => Promise<AnalysisView>) => Promise<AnalysisResult | null>;
  cancel: () => void;
  reset: () => void;
}

export function useAnalysisRunner(): AnalysisRunner {
  const [state, setState] = useState<RunnerState>(initialState);
  const controllerRef = useRef<AbortController | null>(null);
  const viewIdRef = useRef<string | null>(null);

  const cancel = useCallback(() => {
    const id = viewIdRef.current;
    viewIdRef.current = null;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState(initialState);
    if (id) void deleteAnalysis(id).catch(() => undefined);
  }, []);

  const reset = useCallback(() => {
    cancel();
    setState(initialState);
  }, [cancel]);

  const run = useCallback(
    async (start: (signal: AbortSignal) => Promise<AnalysisView>) => {
      cancel();
      const controller = new AbortController();
      controllerRef.current = controller;
      setState({ phase: 'starting', view: null, error: null });

      try {
        const created = await start(controller.signal);
        viewIdRef.current = created.id;
        setState({ phase: 'polling', view: created, error: null });
        const result = await pollAnalysis(created.id, {
          signal: controller.signal,
          onUpdate: (view) => setState({ phase: 'polling', view, error: null }),
        });
        viewIdRef.current = null;
        setState({
          phase: 'done',
          view: { ...created, status: 'done', progress: 100, result },
          error: null,
        });
        return result;
      } catch (error) {
        viewIdRef.current = null;
        if (error instanceof DOMException && error.name === 'AbortError') return null;
        const apiError =
          error instanceof ApiClientError
            ? {
                code: error.code,
                message: localizeApiError(error.code, error.message),
              }
            : {
                code: 'ANALYSIS_FAILED',
                message: error instanceof Error ? error.message : t('error.unexpected'),
              };
        setState({ phase: 'error', view: null, error: apiError });
        return null;
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    },
    [cancel],
  );

  return { state, run, cancel, reset };
}
