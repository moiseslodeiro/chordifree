import { useCallback, useRef, useState } from 'react';
import type { AnalysisResult, AnalysisView } from '../types';
import { ApiClientError, pollAnalysis } from './api';

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

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
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
        setState({ phase: 'polling', view: created, error: null });
        const result = await pollAnalysis(created.id, {
          signal: controller.signal,
          onUpdate: (view) => setState({ phase: 'polling', view, error: null }),
        });
        setState({
          phase: 'done',
          view: { ...created, status: 'done', progress: 100, result },
          error: null,
        });
        return result;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return null;
        const apiError =
          error instanceof ApiClientError
            ? { code: error.code, message: error.message }
            : {
                code: 'ANALYSIS_FAILED',
                message: error instanceof Error ? error.message : 'Error inesperado',
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
