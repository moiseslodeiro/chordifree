import { useCallback, useEffect, useState } from 'react';
import { getProfile, saveProfile } from '../lib/api';
import type { UserProfile } from '../types';

export interface ProfileController {
  profile: UserProfile | null;
  loading: boolean;
  /** True until the user confirms or changes the nickname from their Google name. */
  needsNickname: boolean;
  save: (nickname: string) => Promise<UserProfile | null>;
}

export function useProfile(enabled: boolean): ProfileController {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getProfile()
      .then((next) => {
        if (!cancelled) setProfile(next);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const save = useCallback(async (nickname: string) => {
    const next = await saveProfile(nickname);
    setProfile(next);
    return next;
  }, []);

  return {
    profile,
    loading,
    needsNickname: enabled && profile !== null && !profile.custom,
    save,
  };
}
