import { describe, expect, it } from 'vitest';
import { sanitizeBeatsPerBar } from '../src/services/analysis';

describe('sanitizeBeatsPerBar', () => {
  it('keeps the meter detected by the analyzer', () => {
    expect(sanitizeBeatsPerBar(3)).toBe(3);
    expect(sanitizeBeatsPerBar(6)).toBe(6);
  });

  it('falls back to four when the value is missing or invalid', () => {
    expect(sanitizeBeatsPerBar(undefined)).toBe(4);
    expect(sanitizeBeatsPerBar(Number.NaN)).toBe(4);
    expect(sanitizeBeatsPerBar(1)).toBe(4);
    expect(sanitizeBeatsPerBar(13)).toBe(4);
  });
});
