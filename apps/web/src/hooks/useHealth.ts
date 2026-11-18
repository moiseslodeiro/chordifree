import { useEffect, useState } from 'react';
import { getHealth } from '../lib/api';

export interface HealthState {
  status: 'ok' | 'down' | 'unknown';
  version: string;
  extractor: 'ok' | 'down' | 'unknown';
  extractorVersion?: string;
}

export function useHealth(): HealthState {
  const [health, setHealth] = useState<HealthState>({
    status: 'unknown',
    version: 'essentia-1.6',
    extractor: 'unknown',
  });

  useEffect(() => {
    const controller = new AbortController();
    void getHealth(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setHealth({
        status: result.analyzer,
        version: result.analyzerVersion || 'essentia-1.6',
        extractor: result.extractor ?? 'unknown',
        ...(result.extractorVersion ? { extractorVersion: result.extractorVersion } : {}),
      });
    });
    return () => controller.abort();
  }, []);

  return health;
}
