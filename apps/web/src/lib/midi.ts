import type { Chord, ChordSegment, Quality } from '@chordifree/chords';
import type { Song } from '../types';
import { CHORD_INTERVALS } from './score';

/** Standard MIDI File constants. */
const TICKS_PER_QUARTER = 480;
const DEFAULT_BPM = 120;
/** General MIDI channel 10 (zero-based 9) is the drum kit. */
const DRUM_CHANNEL = 9;

interface MidiEvent {
  tick: number;
  /** Note-offs sort before note-ons at the same tick. */
  off: boolean;
  data: number[];
}

interface NoteSpec {
  note: number;
  start: number;
  end: number;
  velocity?: number;
}

function clampBpm(bpm: number | null | undefined): number {
  if (!Number.isFinite(bpm ?? NaN)) return DEFAULT_BPM;
  return Math.max(20, Math.min(300, Math.round(bpm!)));
}

/** MIDI variable-length quantity. */
function variableLength(value: number): number[] {
  let buffer = Math.max(0, Math.floor(value)) & 0x7f;
  const bytes = [buffer];
  let rest = Math.max(0, Math.floor(value)) >> 7;
  while (rest > 0) {
    buffer = (rest & 0x7f) | 0x80;
    bytes.unshift(buffer);
    rest >>= 7;
  }
  return bytes;
}

function meta(type: number, payload: number[]): number[] {
  return [0xff, type, ...variableLength(payload.length), ...payload];
}

function be32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

/** MTrk chunk: the length is a 32-bit big-endian integer, not a varint. */
function track(events: number[]): number[] {
  return [...[0x4d, 0x54, 0x72, 0x6b], ...be32(events.length), ...events];
}

function ticksAt(seconds: number, bpm: number): number {
  return Math.max(0, Math.round((Math.max(0, seconds) * bpm * TICKS_PER_QUARTER) / 60));
}

function noteEvents(notes: NoteSpec[], bpm: number, channel: number, velocity = 90): MidiEvent[] {
  const events: MidiEvent[] = [];
  for (const spec of notes) {
    const start = ticksAt(spec.start, bpm);
    const end = Math.max(start + 1, ticksAt(spec.end, bpm));
    const level = spec.velocity ?? velocity;
    events.push({ tick: start, off: false, data: [0x90 | channel, spec.note & 0x7f, level] });
    events.push({ tick: end, off: true, data: [0x80 | channel, spec.note & 0x7f, 0] });
  }
  return events.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    if (a.off !== b.off) return a.off ? -1 : 1;
    return (a.data[1] ?? 0) - (b.data[1] ?? 0);
  });
}

function encodeTrack(
  name: string,
  program: number | null,
  channel: number,
  events: MidiEvent[],
): number[] {
  const bytes: number[] = [];
  bytes.push(0x00, ...meta(0x03, [...new TextEncoder().encode(name)]));
  if (program !== null) bytes.push(0x00, 0xc0 | channel, program);
  let lastTick = 0;
  for (const event of events) {
    bytes.push(...variableLength(event.tick - lastTick), ...event.data);
    lastTick = event.tick;
  }
  bytes.push(0x00, 0xff, 0x2f, 0x00);
  return track(bytes);
}

/** Notes of the chord, including its slash bass when the analyzer found one. */
export function chordNotes(chord: Chord): number[] {
  const intervals = CHORD_INTERVALS[chord.quality as Quality] ?? CHORD_INTERVALS.major;
  const notes = intervals.map((interval) => 60 + chord.root + interval);
  if (chord.bass !== undefined) notes.push(48 + chord.bass);
  return [...new Set(notes)];
}

/** Root of the chord in the bass octave: slash bass when present. */
export function bassNote(chord: Chord): number {
  return 36 + (chord.bass ?? chord.root);
}

function chordPitchClasses(chord: Chord): number[] {
  const intervals = CHORD_INTERVALS[chord.quality as Quality] ?? CHORD_INTERVALS.major;
  return [...new Set(intervals.map((interval) => (chord.root + interval) % 12))];
}

function voiceDistance(previous: number[], next: number[]): number {
  if (previous.length === 0) return 0;
  return next.reduce(
    (total, note) => total + Math.min(...previous.map((other) => Math.abs(other - note))),
    0,
  );
}

/**
 * Picks the inversion closest to the previous chord so the progression does not
 * jump around. Triads and seventh chords are voiced between C4 and B5.
 */
export function voiceChord(chord: Chord, previous: number[] = []): number[] {
  const pitchClasses = chordPitchClasses(chord);
  if (pitchClasses.length === 0) return [];
  let best: number[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let rotation = 0; rotation < pitchClasses.length; rotation += 1) {
    const rotated = [...pitchClasses.slice(rotation), ...pitchClasses.slice(0, rotation)];
    const notes: number[] = [];
    let cursor = 60;
    for (const pitchClass of rotated) {
      let note = pitchClass;
      while (note < cursor) note += 12;
      notes.push(note);
      cursor = note + 1;
    }
    const score = voiceDistance(previous, notes) + Math.abs(notes[0]! - 60) * 0.4;
    if (score < bestScore) {
      best = notes;
      bestScore = score;
    }
  }
  return best ?? [];
}

function beatGrid(song: Song, bpm: number): number[] {
  if (song.beats && song.beats.length > 0) return song.beats;
  const interval = 60 / bpm;
  return Array.from(
    { length: Math.max(1, Math.ceil(song.duration / interval)) },
    (_, index) => index * interval,
  );
}

function sectionEnergy(song: Song, time: number): number {
  const section = song.sections?.find((item) => time >= item.start && time < item.end);
  if (!section) return 0;
  if (section.label === 'chorus') return 10;
  if (section.label === 'intro' || section.label === 'outro') return -8;
  return 0;
}

function segmentAt(segments: ChordSegment[], time: number): ChordSegment | null {
  return segments.find((segment) => time >= segment.start && time < segment.end) ?? null;
}

/** Rhythmic piano comping: the chord is re-struck on every beat. */
function compingSpecs(song: Song, beats: number[], beatsPerBar: number): NoteSpec[] {
  const beatDuration = beats.length > 1 ? beats[1]! - beats[0]! : 0.5;
  const specs: NoteSpec[] = [];
  let voicing: number[] = [];
  let currentChord: Chord | null = null;
  for (const [index, time] of beats.entries()) {
    const segment = segmentAt(song.segments, time);
    if (!segment?.chord) {
      voicing = [];
      currentChord = null;
      continue;
    }
    if (segment.chord !== currentChord) {
      voicing = voiceChord(segment.chord, voicing);
      currentChord = segment.chord;
    }
    const downbeat = index % beatsPerBar === 0;
    const velocity = (downbeat ? 92 : 68) + sectionEnergy(song, time);
    const end = Math.min(segment.end, time + beatDuration * 0.55);
    for (const note of voicing) {
      specs.push({ note, start: time, end, velocity });
    }
  }
  return specs;
}

/** One sustained chord per segment, an octave below the piano comping. */
function padSpecs(song: Song): NoteSpec[] {
  const specs: NoteSpec[] = [];
  let voicing: number[] = [];
  for (const segment of song.segments) {
    if (!segment.chord) {
      voicing = [];
      continue;
    }
    voicing = voiceChord(segment.chord, voicing).map((note) => note - 12);
    for (const note of voicing) {
      specs.push({
        note,
        start: segment.start,
        end: segment.end,
        velocity: 44 + sectionEnergy(song, segment.start) / 2,
      });
    }
  }
  return specs;
}

/** Root on the first and third beat of every bar. */
function bassSpecs(song: Song, beats: number[], beatsPerBar: number): NoteSpec[] {
  const beatDuration = beats.length > 1 ? beats[1]! - beats[0]! : 0.5;
  const specs: NoteSpec[] = [];
  for (const [index, time] of beats.entries()) {
    const inBar = index % beatsPerBar;
    if (inBar !== 0 && inBar !== 2) continue;
    const segment = segmentAt(song.segments, time);
    if (!segment?.chord) continue;
    specs.push({
      note: bassNote(segment.chord),
      start: time,
      end: Math.min(segment.end, time + beatDuration * 0.85),
      velocity: (inBar === 0 ? 96 : 80) + sectionEnergy(song, time),
    });
  }
  return specs;
}

/**
 * Backbeat from the detected grid: hats on eighths, kick on 1 and 3, snare on
 * 2 and 4, and a crash on every section start. It is an arrangement, not a
 * transcription of the original drummer.
 */
function drumSpecs(song: Song, beats: number[], beatsPerBar: number): NoteSpec[] {
  const beatDuration = beats.length > 1 ? beats[1]! - beats[0]! : 0.5;
  const specs: NoteSpec[] = [];
  const crashTimes = new Set((song.sections ?? []).map((section) => section.start.toFixed(2)));
  for (const [index, time] of beats.entries()) {
    const inBar = index % beatsPerBar;
    const energy = sectionEnergy(song, time);
    // Hat on the beat and on the offbeat.
    specs.push({ note: 42, start: time, end: time + 0.06, velocity: 58 + energy });
    specs.push({
      note: 42,
      start: time + beatDuration / 2,
      end: time + beatDuration / 2 + 0.06,
      velocity: 40 + energy,
    });
    if (inBar === 0) {
      specs.push({ note: 36, start: time, end: time + 0.08, velocity: 100 + energy });
    }
    if (inBar === 2) {
      specs.push({ note: 36, start: time, end: time + 0.08, velocity: 84 + energy });
    }
    if (inBar === 1 || inBar === 3) {
      specs.push({ note: 38, start: time, end: time + 0.08, velocity: 92 + energy });
    }
    if (crashTimes.has(time.toFixed(2))) {
      specs.push({ note: 49, start: time, end: time + 0.1, velocity: 96 + energy });
    }
  }
  return specs;
}

/**
 * Builds a format-1 Standard MIDI File: tempo/meter and section markers, a
 * piano comping track, a pad, bass and drums. It is a playable arrangement of
 * the detected harmony, not a transcription: the original melody and the real
 * drum and bass performances are not available from the analyzer.
 *
 * Chord notation follows the song's current tuning (capo and transposition
 * applied by the caller).
 */
export function buildMidi(song: Song, bpm: number | null | undefined): Uint8Array {
  const tempo = clampBpm(bpm);
  const beatsPerBar = Math.max(1, Math.min(16, Math.round(song.beatsPerBar ?? 4)));
  const beats = beatGrid(song, tempo);

  const metaTrack: number[] = [];
  metaTrack.push(0x00, ...meta(0x03, [...new TextEncoder().encode('Chordifree')]));
  metaTrack.push(0x00, ...meta(0x58, [beatsPerBar, 2, 24, 8]));
  const microseconds = Math.round(60_000_000 / tempo);
  metaTrack.push(
    0x00,
    ...meta(0x51, [(microseconds >> 16) & 0xff, (microseconds >> 8) & 0xff, microseconds & 0xff]),
  );
  let lastMarkerTick = 0;
  for (const section of [...(song.sections ?? [])].sort((a, b) => a.start - b.start)) {
    const tick = ticksAt(section.start, tempo);
    metaTrack.push(
      ...variableLength(tick - lastMarkerTick),
      ...meta(0x06, [...new TextEncoder().encode(section.label)]),
    );
    lastMarkerTick = tick;
  }
  metaTrack.push(0x00, 0xff, 0x2f, 0x00);

  const chunks = [
    track(metaTrack),
    encodeTrack('Chords', 0, 0, noteEvents(compingSpecs(song, beats, beatsPerBar), tempo, 0)),
    encodeTrack('Pad', 48, 2, noteEvents(padSpecs(song), tempo, 2)),
    encodeTrack('Bass', 33, 1, noteEvents(bassSpecs(song, beats, beatsPerBar), tempo, 1)),
    encodeTrack(
      'Drums',
      null,
      DRUM_CHANNEL,
      noteEvents(drumSpecs(song, beats, beatsPerBar), tempo, DRUM_CHANNEL, 100),
    ),
  ];

  const header = [
    0x4d,
    0x54,
    0x68,
    0x64,
    0x00,
    0x00,
    0x00,
    0x06,
    0x00,
    0x01,
    (chunks.length >> 8) & 0xff,
    chunks.length & 0xff,
    (TICKS_PER_QUARTER >> 8) & 0xff,
    TICKS_PER_QUARTER & 0xff,
  ];

  return new Uint8Array([...header, ...chunks.flat()]);
}

export function downloadMidi(filename: string, bytes: Uint8Array): void {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
