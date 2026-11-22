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

  it('scrolls the row inside its own scroll container', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    const container = document.createElement('div');
    container.style.overflowY = 'auto';
    Object.defineProperty(container, 'scrollHeight', { configurable: true, value: 1200 });
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 480 });
    const scrollBy = vi.fn();
    container.scrollBy = scrollBy;
    container.getBoundingClientRect = () =>
      ({
        top: 200,
        bottom: 680,
        height: 480,
        left: 0,
        right: 0,
        width: 0,
        x: 0,
        y: 200,
        toJSON: () => ({}),
      }) as DOMRect;
    const element = row(650);
    Object.defineProperty(element, 'parentElement', { configurable: true, value: container });

    keepLookaheadVisible(element);
    expect(scrollBy).toHaveBeenCalledWith({ top: 330, behavior: 'smooth' });
  });

  it('scrolls back when the row is above the viewport', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    const scrollBy = vi.fn();
    window.scrollBy = scrollBy;

    keepLookaheadVisible(row(-50));
    expect(scrollBy).toHaveBeenCalledWith({ top: -250, behavior: 'smooth' });
  });
});
