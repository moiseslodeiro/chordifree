import { describe, expect, it } from 'vitest';
import { normalizeLyricsText } from '../src/lyrics/normalize';

describe('normalizeLyricsText', () => {
  it('drops empty and whitespace-only lines', () => {
    expect(normalizeLyricsText('First line\n\n   \nSecond line\n')).toBe('First line\nSecond line');
  });

  it('normalizes CRLF and trims each line', () => {
    expect(normalizeLyricsText('  First line  \r\n\r\nSecond line\r\n')).toBe(
      'First line\nSecond line',
    );
  });

  it('returns an empty string when there is no content', () => {
    expect(normalizeLyricsText('\n\n  \n')).toBe('');
  });
});
