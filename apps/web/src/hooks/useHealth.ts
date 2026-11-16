import { useEffect, useState } from 'react';
import { getHealth } from '../lib/api';

export interface HealthState {
  status: 'ok' | 'down' | 'unknown';
  version: string;
}

export function useHealth(): HealthState {
  const [health, setHealth] = useState<HealthState>({
    status: 'unknown',
    version: 'essentia-1.6',
  });

  useEffect(() => {
    const controller = new AbortController();
    void getHealth(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setHealth({
        status: result.analyzer,
        version: result.analyzerVersion || 'essentia-1.6',
      });
    });
    return () => controller.abort();
  }, []);

  return health;
}
