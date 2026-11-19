import { describe, expect, it } from 'vitest';
import { bassNote, buildMidi, chordNotes, voiceChord } from '../src/lib/midi';
import type { Chord, ChordSegment } from '@chordifree/chords';
import type { Song } from '../src/types';

const C: Chord = { root: 0, quality: 'major' };
const G: Chord = { root: 7, quality: 'major' };
const Am7: Chord = { root: 9, quality: 'm7', bass: 0 };

function makeSong(segments: ChordSegment[], overrides: Partial<Song> = {}): Song {
  return {
    id: 'song-1',
    title: 'My song',
    source: { type: 'youtube', videoId: 'dQw4w9WgXcQ' },
    duration: 4,
    segments,
    detectedSegments: [],
    beats: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
    beatsPerBar: 4,
    analyzerVersion: 'essentia-test',
    transpose: 0,
    notation: 'english',
    accidentalPreference: 'sharp',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

interface NoteEvent {
  tick: number;
  on: boolean;
  note: number;
  channel: number;
}

/** Minimal SMF reader for the events this project writes (no running status). */
function parse(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number, length: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + length));
  expect(text(0, 4)).toBe('MThd');
  const format = view.getUint16(8);
  const tracks = view.getUint16(10);
  const division = view.getUint16(12);

  let offset = 14;
  const metas: Array<{ type: number; data: number[] }> = [];
  const notes: NoteEvent[] = [];
  let trackCount = 0;

  const readVar = (): number => {
    let value = 0;
    for (;;) {
      const byte = bytes[offset++]!;
      value = (value << 7) | (byte & 0x7f);
      if ((byte & 0x80) === 0) return value;
    }
  };

  while (offset + 8 <= bytes.length && text(offset, 4) === 'MTrk') {
    trackCount += 1;
    const length = view.getUint32(offset + 4);
    offset += 8;
    const end = offset + length;
    let tick = 0;
    while (offset < end) {
      tick += readVar();
      const status = bytes[offset++]!;
      if (status === 0xff) {
        const type = bytes[offset++]!;
        const len = readVar();
        metas.push({ type, data: [...bytes.slice(offset, offset + len)] });
        offset += len;
      } else if ((status & 0xf0) === 0x90 || (status & 0xf0) === 0x80) {
        const note = bytes[offset++]!;
        const velocity = bytes[offset++]!;
        const channel = status & 0x0f;
        if ((status & 0xf0) === 0x90 && velocity > 0) {
          notes.push({ tick, on: true, note, channel });
        }
        if ((status & 0xf0) === 0x80) notes.push({ tick, on: false, note, channel });
      } else if ((status & 0xf0) === 0xc0) {
        offset += 1;
      } else {
        throw new Error(`Unsupported status 0x${status.toString(16)}`);
      }
    }
  }

  return { format, tracks, division, trackCount, metas, notes };
}

describe('buildMidi', () => {
  it('writes a format-1 file with tempo, meter and the chord notes', () => {
    const midi = parse(
      buildMidi(
        makeSong([
          { start: 0, end: 2, chord: C },
          { start: 2, end: 4, chord: G },
        ]),
        120,
      ),
    );

    expect(midi.format).toBe(1);
    expect(midi.tracks).toBe(5);
    expect(midi.trackCount).toBe(5);
    expect(midi.division).toBe(480);

    const tempo = midi.metas.find((entry) => entry.type === 0x51);
    expect(tempo?.data).toEqual([0x07, 0xa1, 0x20]);
    const meter = midi.metas.find((entry) => entry.type === 0x58);
    expect(meter?.data).toEqual([4, 2, 24, 8]);

    const chords = midi.notes.filter((note) => note.on && note.channel === 0);
    expect(chords.filter((note) => note.tick === 0).map((note) => note.note)).toEqual([60, 64, 67]);
    // Comping repeats the chord on every beat.
    expect(chords.filter((note) => note.tick === 960).length).toBeGreaterThan(0);

    const pad = midi.notes.filter((note) => note.on && note.channel === 2);
    expect(pad.length).toBeGreaterThan(0);

    const bass = midi.notes.filter((note) => note.on && note.channel === 1);
    expect(bass.map((note) => [note.tick, note.note])).toEqual([
      [0, 36],
      [960, 36],
      [1920, 43],
      [2880, 43],
    ]);

    const drums = midi.notes.filter((note) => note.on && note.channel === 9);
    expect(drums.some((note) => note.note === 36)).toBe(true);
    expect(drums.some((note) => note.note === 38)).toBe(true);
    expect(drums.some((note) => note.note === 42)).toBe(true);
    // Hats on the offbeat as well.
    expect(drums.filter((note) => note.note === 42 && note.tick === 240).length).toBe(1);

    const off = midi.notes.filter((note) => !note.on && note.channel === 0);
    expect(off.length).toBeGreaterThan(0);
  });

  it('includes the slash bass and falls back to 120 bpm', () => {
    const midi = parse(buildMidi(makeSong([{ start: 0, end: 2, chord: Am7 }]), Number.NaN));
    expect(midi.metas.find((entry) => entry.type === 0x51)?.data).toEqual([0x07, 0xa1, 0x20]);
    // The slash bass lives in the bass track, the chord keeps its own voicing.
    expect(
      midi.notes
        .filter((note) => note.on && note.channel === 0 && note.tick === 0)
        .map((note) => note.note),
    ).toEqual([60, 64, 67, 69]);
    expect(
      midi.notes
        .filter((note) => note.on && note.channel === 1)
        .map((note) => [note.tick, note.note]),
    ).toEqual([
      [0, 36],
      [960, 36],
    ]);
  });

  it('voices the next chord close to the previous one', () => {
    const first = voiceChord(C);
    const next = voiceChord(G, first);
    const movement = next.reduce(
      (total, note) => total + Math.min(...first.map((other) => Math.abs(other - note))),
      0,
    );
    expect(first).toEqual([60, 64, 67]);
    // An inversion near the previous chord, not a jump to G4 B4 D5.
    expect(movement).toBeLessThan(12);
  });

  it('writes section markers into the meta track', () => {
    const midi = parse(
      buildMidi(
        makeSong([{ start: 0, end: 4, chord: C }], {
          sections: [
            { label: 'intro', start: 0, end: 2 },
            { label: 'chorus', start: 2, end: 4 },
          ],
        }),
        120,
      ),
    );
    const markers = midi.metas
      .filter((entry) => entry.type === 0x06)
      .map((entry) => String.fromCharCode(...entry.data));
    expect(markers).toEqual(['intro', 'chorus']);
  });

  it('keeps the time signature from the song', () => {
    const midi = parse(
      buildMidi(makeSong([{ start: 0, end: 2, chord: C }], { beatsPerBar: 3 }), 90),
    );
    expect(midi.metas.find((entry) => entry.type === 0x58)?.data?.[0]).toBe(3);
  });

  it('skips silent segments', () => {
    const midi = parse(
      buildMidi(
        makeSong([
          { start: 0, end: 2, chord: null },
          { start: 2, end: 4, chord: C },
        ]),
        120,
      ),
    );
    const chordNotes = midi.notes.filter((note) => note.on && note.channel === 0);
    expect([...new Set(chordNotes.map((note) => note.note))]).toEqual([60, 64, 67]);
    expect(Math.min(...chordNotes.map((note) => note.tick))).toBe(1920);
  });
});

describe('bassNote', () => {
  it('uses the slash bass when present', () => {
    expect(bassNote(C)).toBe(36);
    expect(bassNote(G)).toBe(43);
    expect(bassNote(Am7)).toBe(36);
  });
});

describe('chordNotes', () => {
  it('spells the quality intervals from the root octave', () => {
    expect(chordNotes(C)).toEqual([60, 64, 67]);
    expect(chordNotes(Am7)).toEqual([69, 72, 76, 79, 48]);
  });
});
