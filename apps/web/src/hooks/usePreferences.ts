import { useCallback, useEffect, useState } from 'react';
import { setLanguage, useT } from '../i18n';
import { parseHash } from '../routing';
import { StorageQuotaError, type StorageLike } from '../storage/keys';
import { loadPreferences, savePreferences } from '../storage/preferences';
import type { AppNotice, Preferences } from '../types';

export interface PreferencesState {
  preferences: Preferences;
  updatePreferences: (patch: Partial<Preferences>) => void;
  resetGridView: () => void;
}

export function usePreferences(
  storage: StorageLike,
  onNotice: (notice: AppNotice) => void,
): PreferencesState {
  const t = useT();
  const [preferences, setPreferences] = useState<Preferences>(() => {
    const loaded = loadPreferences(storage);
    return parseHash().name === 'song' ? { ...loaded, gridView: 'beats' } : loaded;
  });

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', preferences.theme === 'dark' ? '#090b0f' : '#f6f7f9');
  }, [preferences.theme]);

  useEffect(() => {
    document.documentElement.lang = preferences.language;
    setLanguage(preferences.language);
  }, [preferences.language]);

  const updatePreferences = useCallback(
    (patch: Partial<Preferences>) => {
      setPreferences((previous) => {
        const next = { ...previous, ...patch };
        try {
          savePreferences(storage, next);
        } catch (error) {
          onNotice({
            message:
              error instanceof StorageQuotaError
                ? t('app.preferencesQuota')
                : t('app.preferencesFailed'),
            tone: 'warning',
          });
        }
        return next;
      });
    },
    [onNotice, storage, t],
  );

  const resetGridView = useCallback(() => {
    setPreferences((current) => {
      if (current.gridView === 'beats') return current;
      const next: Preferences = { ...current, gridView: 'beats' };
      try {
        savePreferences(storage, next);
      } catch {
        // The in-memory preference is still reset.
      }
      return next;
    });
  }, [storage]);

  return { preferences, updatePreferences, resetGridView };
}
