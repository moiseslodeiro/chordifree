import { afterEach, describe, expect, it, vi } from 'vitest';
import { keepLookaheadVisible } from '../src/grid/scroll';

function row(top: number, height = 40): HTMLElement {
  return {
    getBoundingClientRect: () => ({
      top,
      bottom: top + height,
      height,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }),
  } as HTMLElement;
}

describe('keepLookaheadVisible', () => {
  const originalHeight = window.innerHeight;
  const originalScroll = window.scrollBy;

  afterEach(() => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight });
    window.scrollBy = originalScroll;
  });

  it('scrolls when the next rows would be below the viewport', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    const scrollBy = vi.fn();
    window.scrollBy = scrollBy;

    keepLookaheadVisible(row(700));
    expect(scrollBy).toHaveBeenCalledWith({ top: 500, behavior: 'smooth' });
  });

  it('keeps the position when the active row already leaves room', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    const scrollBy = vi.fn();
    window.scrollBy = scrollBy;

    keepLookaheadVisible(row(200));
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it('scrolls back when the row is above the viewport', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    const scrollBy = vi.fn();
    window.scrollBy = scrollBy;

    keepLookaheadVisible(row(-50));
    expect(scrollBy).toHaveBeenCalledWith({ top: -250, behavior: 'smooth' });
  });
});
