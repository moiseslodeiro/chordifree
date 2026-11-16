import { useCallback, useEffect, useState } from 'react';
import { useT } from '../i18n';
import {
  clearAudioCache as clearServerAudioCache,
  getAudioCacheStats,
  type AudioCacheStats,
} from '../lib/api';
import type { AppNotice } from '../types';

export interface AudioCacheState {
  stats: AudioCacheStats | null;
  clear: () => void;
}

export function useAudioCache(
  active: boolean,
  onNotice: (notice: AppNotice) => void,
): AudioCacheState {
  const t = useT();
  const [stats, setStats] = useState<AudioCacheStats | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    void getAudioCacheStats(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setStats(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setStats(null);
      });
    return () => controller.abort();
  }, [active, refresh]);

  const clear = useCallback(() => {
    void clearServerAudioCache()
      .then(({ removed }) => {
        setStats((current) => (current ? { ...current, entries: 0, bytes: 0 } : current));
        onNotice({
          message: t('app.audioCacheCleared', { count: removed }),
          tone: 'info',
        });
      })
      .catch(() => {
        onNotice({ message: t('app.audioCacheClearFailed'), tone: 'warning' });
        setRefresh((value) => value + 1);
      });
  }, [onNotice, t]);

  return { stats, clear };
}
