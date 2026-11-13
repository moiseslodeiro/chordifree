import { describe, expect, it } from 'vitest';
import type { ChordSegment, EstimatedKey } from '@chordifree/chords';
import {
  buildMusicXml,
  clefFor,
  keySignatureFifths,
  midiToPitch,
  type ScoreInput,
} from '../src/lib/score';

const SEGMENTS: ChordSegment[] = [
  { start: 0, end: 2, chord: { root: 7, quality: 'major' } },
  { start: 2, end: 4, chord: { root: 0, quality: 'major' } },
];
const BEATS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];

function input(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    title: 'Demo',
    artist: 'Chordifree',
    instrument: 'guitar',
    key: { tonic: 7, mode: 'major' },
    segments: SEGMENTS,
    beats: BEATS,
    beatsPerBar: 4,
    duration: 4,
    notation: 'english',
    accidental: 'sharp',
    tempo: 120,
    ...overrides,
  };
}

function parse(xml: string): Document {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  expect(document.querySelector('parsererror')).toBeNull();
  return document;
}

describe('score export', () => {
  it('calcula la armadura con el círculo de quintas', () => {
    expect(keySignatureFifths(null)).toBe(0);
    expect(keySignatureFifths({ tonic: 0, mode: 'major' })).toBe(0);
    expect(keySignatureFifths({ tonic: 7, mode: 'major' })).toBe(1);
    expect(keySignatureFifths({ tonic: 5, mode: 'major' })).toBe(-1);
    expect(keySignatureFifths({ tonic: 9, mode: 'minor' })).toBe(0);
    expect(keySignatureFifths({ tonic: 4, mode: 'minor' })).toBe(1);
    expect(keySignatureFifths({ tonic: 2, mode: 'minor' })).toBe(-1);
    expect(keySignatureFifths({ tonic: 3, mode: 'major' })).toBe(-3);
  });

  it('usa pentagrama doble para el piano y octava baja para la guitarra', () => {
    expect(clefFor('piano')).toEqual({ sign: 'G', line: 2, staves: 2 });
    expect(clefFor('guitar')).toEqual({
      sign: 'G',
      line: 2,
      octaveChange: -1,
      staves: 1,
    });
    expect(clefFor('ukelele')).toEqual({ sign: 'G', line: 2, staves: 1 });
  });

  it('escribe la clave de sol y la de fa en el piano', () => {
    const xml = buildMusicXml(input({ instrument: 'piano' }));
    expect(xml).toContain('<staves>2</staves>');
    expect(xml).toContain('<clef number="1"><sign>G</sign><line>2</line></clef>');
    expect(xml).toContain('<clef number="2"><sign>F</sign><line>4</line></clef>');
    expect(xml).toContain('<backup><duration>16</duration></backup>');
  });

  it('marca la guitarra una octava por debajo de lo escrito', () => {
    const xml = buildMusicXml(input({ instrument: 'guitar' }));
    expect(xml).toContain('<clef-octave-change>-1</clef-octave-change>');
    expect(xml).not.toContain('<staves>2</staves>');
    expect(xml).toContain('<part-name>Guitar</part-name>');
  });

  it('usa clave de sol sin octava para el ukelele', () => {
    const xml = buildMusicXml(input({ instrument: 'ukelele' }));
    expect(xml).toContain('<sign>G</sign>');
    expect(xml).not.toContain('clef-octave-change');
    expect(xml).toContain('<part-name>Ukulele</part-name>');
  });

  it('genera MusicXML válido con acordes y compases', () => {
    const document = parse(buildMusicXml(input()));
    expect(document.documentElement.tagName).toBe('score-partwise');
    expect(document.querySelectorAll('measure')).toHaveLength(2);
    expect(document.querySelectorAll('harmony kind')).toHaveLength(2);
    expect(document.querySelector('harmony kind')?.textContent).toContain('major');
    expect(document.querySelector('harmony kind')?.getAttribute('text')).toBe('G');
  });

  it('completa cada compás con la duración correcta en ambos pentagramas', () => {
    const document = parse(buildMusicXml(input({ instrument: 'piano', beatsPerBar: 4 })));
    for (const measure of Array.from(document.querySelectorAll('measure'))) {
      const notes = Array.from(measure.querySelectorAll('note'));
      const staffOne = notes.filter(
        (note) => !note.querySelector('chord') && note.querySelector('staff')?.textContent !== '2',
      );
      const staffTwo = notes.filter((note) => note.querySelector('staff')?.textContent === '2');
      const total = (list: Element[]) =>
        list.reduce((sum, note) => sum + Number(note.querySelector('duration')?.textContent ?? 0), 0);
      expect(total(staffOne)).toBe(16);
      expect(total(staffTwo)).toBe(16);
    }
  });

  it('respeta la tonalidad y el compás', () => {
    const document = parse(
      buildMusicXml(
        input({
          key: { tonic: 5, mode: 'major' } as EstimatedKey,
          beatsPerBar: 3,
          accidental: 'flat',
        }),
      ),
    );
    expect(document.querySelector('fifths')?.textContent).toBe('-1');
    expect(document.querySelector('time beats')?.textContent).toBe('3');
    expect(document.querySelector('time beat-type')?.textContent).toBe('4');
  });

  it('incluye tempo y capo como indicaciones', () => {
    const xml = buildMusicXml(input({ tempo: 96, capo: 2 }));
    expect(xml).toContain('<per-minute>96</per-minute>');
    expect(xml).toContain('Capo 2');
  });

  it('escapa el título y el artista', () => {
    const xml = buildMusicXml(input({ title: 'AC/DC & <friends>', artist: "O'Neil" }));
    const document = parse(xml);
    expect(document.querySelector('work-title')?.textContent).toBe('AC/DC & <friends>');
    expect(document.querySelector('creator')?.textContent).toBe("O'Neil");
  });

  it('exporta una partitura aunque la canción no tenga pulsos', () => {
    const xml = buildMusicXml(input({ beats: [] }));
    const document = parse(xml);
    expect(document.querySelectorAll('measure').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('harmony').length).toBeGreaterThan(0);
  });

  it('escribe las alteraciones según la preferencia', () => {
    expect(midiToPitch(61, false)).toEqual({ step: 'C', alter: 1, octave: 4 });
    expect(midiToPitch(61, true)).toEqual({ step: 'D', alter: -1, octave: 4 });
    expect(midiToPitch(60, false)).toEqual({ step: 'C', alter: 0, octave: 4 });
    expect(midiToPitch(72, false)).toEqual({ step: 'C', alter: 0, octave: 5 });
  });
});
