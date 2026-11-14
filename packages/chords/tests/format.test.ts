import { describe, expect, it } from 'vitest';
import { formatChord, formatChordOrSilence, formatTime, formatTimeWithMs } from '../src/format';
import { parseChord } from '../src/parse';

const chord = (label: string) => {
  const parsed = parseChord(label);
  if (!parsed) throw new Error(`No se pudo parsear ${label}`);
  return parsed;
};

describe('formatChord', () => {
  it('formats in English notation', () => {
    expect(formatChord(chord('Am'))).toBe('Am');
    expect(formatChord(chord('Cmaj7'))).toBe('Cmaj7');
    expect(formatChord(chord('C/G'))).toBe('C/G');
    expect(formatChord(chord('C6/9'))).toBe('C6/9');
  });

  it('formats in Spanish notation without translating qualities', () => {
    expect(formatChord(chord('Am'), 'spanish')).toBe('Lam');
    expect(formatChord(chord('Cmaj7'), 'spanish')).toBe('Domaj7');
    expect(formatChord(chord('F#'), 'spanish')).toBe('Fa♯');
    expect(formatChord(chord('C/G'), 'spanish')).toBe('Do/Sol');
  });

  it('uses the flat symbol when requested', () => {
    expect(formatChord(chord('A#'), 'english', 'flat')).toBe('B♭');
    expect(formatChord(chord('A#'), 'spanish', 'flat')).toBe('Si♭');
  });

  it('shows a dash for silence', () => {
    expect(formatChordOrSilence(null)).toBe('—');
    expect(formatChordOrSilence(chord('D'))).toBe('D');
  });
});

describe('formatTime', () => {
  it('formats minutes and seconds', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(84)).toBe('01:24');
    expect(formatTime(3599)).toBe('59:59');
    expect(formatTime(-3)).toBe('00:00');
  });

  it('includes tenths when precision is requested', () => {
    expect(formatTimeWithMs(84.25)).toBe('01:24.3');
  });
});
