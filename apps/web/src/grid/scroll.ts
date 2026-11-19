/**
 * Scrolls the page so the active row keeps the next rows visible instead of
 * sitting at the bottom edge. Used by the auto-scroll of the timeline.
 */
export function keepLookaheadVisible(element: HTMLElement | null, rows = 2): void {
  if (!element || typeof window === 'undefined') return;
  const rect = element.getBoundingClientRect();
  const rowHeight = rect.height > 0 ? rect.height : 48;
  const viewport = window.innerHeight;
  const anchor = Math.max(96, viewport * 0.25);
  const bottomLimit = viewport - rowHeight * (rows + 1);
  if (rect.bottom > bottomLimit || rect.top < 0) {
    window.scrollBy({ top: rect.top - anchor, behavior: 'smooth' });
  }
}
