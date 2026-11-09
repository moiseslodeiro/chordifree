import { useEffect, useState, useCallback, useSyncExternalStore } from 'react';
import type { PlaybackClock } from './clock';

export function usePlaybackIndex(clock: PlaybackClock | null): number {
  const subscribe = useCallback(
    (listener: () => void) => (clock ? clock.subscribe(listener) : () => undefined),
    [clock],
  );
  const getSnapshot = useCallback(() => (clock ? clock.getIndex() : -1), [clock]);
  return useSyncExternalStore(subscribe, getSnapshot, () => -1);
}

export function useIsRowActive(clock: PlaybackClock | null, index: number): boolean {
  const subscribe = useCallback(
    (listener: () => void) => (clock ? clock.subscribe(listener) : () => undefined),
    [clock],
  );
  const getSnapshot = useCallback(
    () => (clock ? clock.getIndex() === index : false),
    [clock, index],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function useBeatIndex(clock: PlaybackClock | null): number {
  const subscribe = useCallback(
    (listener: () => void) => (clock ? clock.subscribe(listener) : () => undefined),
    [clock],
  );
  const getSnapshot = useCallback(() => (clock ? clock.getBeatIndex() : -1), [clock]);
  return useSyncExternalStore(subscribe, getSnapshot, () => -1);
}

export function useIsBeatActive(clock: PlaybackClock | null, index: number): boolean {
  const subscribe = useCallback(
    (listener: () => void) => (clock ? clock.subscribe(listener) : () => undefined),
    [clock],
  );
  const getSnapshot = useCallback(
    () => (clock ? clock.getBeatIndex() === index : false),
    [clock, index],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * Playback time at a low frequency to move the lyrics
 * highlight without depending on the segment or beat changing.
 */
export function usePlaybackTime(clock: PlaybackClock | null, intervalMs = 250): number | null {
  const [time, setTime] = useState<number | null>(() => (clock ? clock.getTime() : null));

  useEffect(() => {
    if (!clock) {
      setTime(null);
      return;
    }
    const update = () => setTime(clock.getTime());
    update();
    const timer = window.setInterval(update, intervalMs);
    return () => window.clearInterval(timer);
  }, [clock, intervalMs]);

  return time;
}
