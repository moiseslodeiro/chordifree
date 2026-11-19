/** Nearest ancestor that scrolls vertically and actually has overflow. */
function scrollableParent(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement;
  while (parent) {
    const style = getComputedStyle(parent);
    const overflow = parent.style.overflowY || style.overflowY;
    if (
      /(auto|scroll|overlay)/.test(overflow) &&
      parent.scrollHeight > parent.clientHeight + 1
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

/**
 * Keeps the active row in the upper part of its scroll container so the next
 * rows are always visible. The chord and beat grids scroll inside their own
 * `max-h-*` boxes, so scrolling the window would not move them.
 */
export function keepLookaheadVisible(element: HTMLElement | null, rows = 2): void {
  if (!element || typeof window === 'undefined') return;
  const rect = element.getBoundingClientRect();
  const rowHeight = rect.height > 0 ? rect.height : 48;
  const followDistance = rowHeight * (rows + 1);
  const container = scrollableParent(element);

  if (container) {
    const box = container.getBoundingClientRect();
    const anchor = box.top + Math.min(box.height * 0.25, followDistance);
    const bottomLimit = box.bottom - followDistance;
    if (rect.bottom > bottomLimit || rect.top < box.top) {
      container.scrollBy({ top: rect.top - anchor, behavior: 'smooth' });
    }
    return;
  }

  const viewport = window.innerHeight;
  const anchor = Math.max(96, viewport * 0.25);
  const bottomLimit = viewport - followDistance;
  if (rect.bottom > bottomLimit || rect.top < 0) {
    window.scrollBy({ top: rect.top - anchor, behavior: 'smooth' });
  }
}
