import { useEffect } from 'react';
import type { PlayerAdapter } from '../player/types';
import type { PlaybackClock } from '../sync/clock';

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A']);
const SEEK_SECONDS = 5;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return EDITABLE_TAGS.has(target.tagName) || target.isContentEditable;
}

function togglePlayback(event: KeyboardEvent, adapter: PlayerAdapter | null): boolean {
  if (event.code !== 'Space') return false;
  event.preventDefault();
  if (adapter?.isPlaying()) adapter.pause();
  else adapter?.play();
  return true;
}

function seekWithArrows(
  event: KeyboardEvent,
  adapter: PlayerAdapter | null,
  clock: PlaybackClock | null,
  duration: number,
): void {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  const delta = event.key === 'ArrowLeft' ? -SEEK_SECONDS : SEEK_SECONDS;
  const current = adapter?.getCurrentTime() ?? 0;
  adapter?.seekTo(Math.max(0, Math.min(duration, current + delta)));
  clock?.tickOnce();
}

/**
 * Global playback shortcuts: Space toggles play and the arrows seek five
 * seconds. They are ignored while a form control has focus.
 */
export function useSongKeyboard(
  adapter: PlayerAdapter | null,
  clock: PlaybackClock | null,
  duration: number,
): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) return;
      if (togglePlayback(event, adapter)) return;
      seekWithArrows(event, adapter, clock, duration);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [adapter, clock, duration]);
}
