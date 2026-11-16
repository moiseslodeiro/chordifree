import { useCallback, useEffect, useState } from 'react';
import { useT } from '../i18n';
import type { UpdateInfo } from '../lib/platform';

export interface DesktopUpdatesState {
  updateInfo: UpdateInfo | null;
  updateNotice: string | null;
  dismissUpdate: () => void;
  dismissNotice: () => void;
  checkForUpdatesNow: () => Promise<void>;
}

export function useDesktopUpdates(desktop: boolean): DesktopUpdatesState {
  const t = useT();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateNotice, setUpdateNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!desktop) return;
    const bridge = window.chordifreeDesktop;
    if (!bridge) return;
    const unsubscribe = bridge.onUpdateAvailable?.((info) => setUpdateInfo(info));
    void bridge
      .checkForUpdates?.()
      .then((result) => {
        if (result?.status === 'update' && result.version && result.url) {
          setUpdateInfo({ version: result.version, url: result.url });
        }
      })
      .catch(() => undefined);
    return () => unsubscribe?.();
  }, [desktop]);

  const checkForUpdatesNow = useCallback(async () => {
    const bridge = window.chordifreeDesktop;
    if (!bridge?.checkForUpdates) {
      setUpdateNotice(t('update.disabled'));
      return;
    }
    try {
      const result = await bridge.checkForUpdates();
      if (result.status === 'update' && result.version && result.url) {
        setUpdateInfo({ version: result.version, url: result.url });
        setUpdateNotice(null);
      } else if (result.status === 'current') {
        setUpdateNotice(t('update.current'));
      } else if (result.status === 'disabled') {
        setUpdateNotice(t('update.disabled'));
      } else {
        setUpdateNotice(t('update.failed'));
      }
    } catch {
      setUpdateNotice(t('update.failed'));
    }
  }, [t]);

  return {
    updateInfo,
    updateNotice,
    dismissUpdate: () => setUpdateInfo(null),
    dismissNotice: () => setUpdateNotice(null),
    checkForUpdatesNow,
  };
}
