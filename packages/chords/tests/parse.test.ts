import { describe, expect, it } from 'vitest';
import { parseChord, parseChordInput, parsePitchClass } from '../src/parse';

describe('parseChord', () => {
  it('parsea acordes en notación inglesa', () => {
    expect(parseChord('C')).toMatchObject({ root: 0, quality: 'major' });
    expect(parseChord('Am')).toMatchObject({ root: 9, quality: 'minor' });
    expect(parseChord('F#m7')).toMatchObject({ root: 6, quality: 'm7' });
    expect(parseChord('Bbmaj7')).toMatchObject({ root: 10, quality: 'maj7' });
    expect(parseChord('Cdim7')).toMatchObject({ root: 0, quality: 'dim7' });
    expect(parseChord('C:maj7')).toMatchObject({ root: 0, quality: 'maj7' });
  });

  it('parsea acordes en notación española', () => {
    expect(parseChord('Do')).toMatchObject({ root: 0, quality: 'major' });
    expect(parseChord('Lam')).toMatchObject({ root: 9, quality: 'minor' });
    expect(parseChord('Fa#')).toMatchObject({ root: 6, quality: 'major' });
    expect(parseChord('Sol#m7b5')).toMatchObject({ root: 8, quality: 'm7b5' });
    expect(parseChord('Sibmaj7')).toMatchObject({ root: 10, quality: 'maj7' });
  });

  it('interpreta bajos invertidos y acordes compuestos', () => {
    expect(parseChord('C/G')).toMatchObject({ root: 0, quality: 'major', bass: 7 });
    expect(parseChord('Cmaj7/E')).toMatchObject({ root: 0, quality: 'maj7', bass: 4 });
    expect(parseChord('C6/9')).toMatchObject({ root: 0, quality: '6/9' });
    expect(parseChord('C6/9')?.bass).toBeUndefined();
  });

  it('trata N, - y vacío como silencio', () => {
    expect(parseChord('N')).toBeNull();
    expect(parseChord('-')).toBeNull();
    expect(parseChord('   ')).toBeNull();
  });

  it('rechaza etiquetas desconocidas', () => {
    expect(parseChord('H7')).toBeNull();
    expect(parseChord('Cxyz')).toBeNull();
    expect(parseChord('C/')).toBeNull();
  });

  it('distingue silencio válido de entrada inválida', () => {
    expect(parseChordInput('N')).toEqual({ ok: true, chord: null });
    expect(parseChordInput('A7')).toMatchObject({ ok: true, chord: { root: 9, quality: '7' } });
    expect(parseChordInput('H7')).toMatchObject({ ok: false });
  });

  it('parsea clases de altura sueltas', () => {
    expect(parsePitchClass('C')).toBe(0);
    expect(parsePitchClass('Bb')).toBe(10);
    expect(parsePitchClass('Sol#')).toBe(8);
    expect(parsePitchClass('H')).toBeNull();
  });
});
