import {
  formatChord,
  mod12,
  type Accidental,
  type Chord,
  type ChordSegment,
  type EstimatedKey,
  type Notation,
  type Quality,
} from '@chordifree/chords';
import { buildBeatGrid } from '../grid/beats';
import type { Instrument } from '../types';

/**
 * Instrument-specific notation settings. Guitar music is written an octave
 * above its sounding pitch, which is expressed with `clef-octave-change`.
 * The piano needs a grand staff (treble + bass).
 */
export interface ScoreClef {
  sign: 'G' | 'F';
  line: number;
  octaveChange?: number;
  staves: 1 | 2;
}

export function clefFor(instrument: Instrument): ScoreClef {
  if (instrument === 'piano') return { sign: 'G', line: 2, staves: 2 };
  if (instrument === 'guitar') return { sign: 'G', line: 2, octaveChange: -1, staves: 1 };
  return { sign: 'G', line: 2, staves: 1 };
}

/**
 * Number of sharps (positive) or flats (negative) of the estimated key.
 * The circle of fifths is used so relative major/minor share the signature.
 */
export function keySignatureFifths(key: EstimatedKey | null): number {
  if (!key) return 0;
  const majorTonic = key.mode === 'major' ? key.tonic : mod12(key.tonic + 3);
  const raw = (majorTonic * 7) % 12;
  return raw > 6 ? raw - 12 : raw;
}

const CHORD_INTERVALS: Record<Quality, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  power: [0, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  '7sus4': [0, 5, 7, 10],
  add9: [0, 4, 7, 14],
  '9': [0, 4, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  '11': [0, 4, 7, 10, 14, 17],
  m11: [0, 3, 7, 10, 14, 17],
  '13': [0, 4, 7, 10, 14, 21],
  m13: [0, 3, 7, 10, 14, 21],
  '6/9': [0, 4, 7, 9, 14],
};

const HARMONY_KIND: Record<Quality, string> = {
  major: 'major',
  minor: 'minor',
  dim: 'diminished',
  aug: 'augmented',
  sus2: 'suspended-second',
  sus4: 'suspended-fourth',
  power: 'power',
  '6': 'major-sixth',
  m6: 'minor-sixth',
  '7': 'dominant',
  maj7: 'major-seventh',
  m7: 'minor-seventh',
  dim7: 'diminished-seventh',
  m7b5: 'half-diminished',
  '7sus4': 'suspended-fourth',
  add9: 'major',
  '9': 'dominant-ninth',
  maj9: 'major-ninth',
  m9: 'minor-ninth',
  '11': 'dominant-11th',
  m11: 'minor-11th',
  '13': 'dominant-13th',
  m13: 'minor-13th',
  '6/9': 'major-sixth',
};

const PART_NAME: Record<Instrument, string> = {
  piano: 'Piano',
  guitar: 'Guitar',
  ukelele: 'Ukulele',
};

const SHARP_SPELLING = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'] as const;
const FLAT_SPELLING = ['C', 'D', 'D', 'E', 'E', 'F', 'G', 'G', 'A', 'A', 'B', 'B'] as const;
const SHARP_ALTER = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0] as const;
const FLAT_ALTER = [0, -1, 0, -1, 0, 0, -1, 0, -1, 0, -1, 0] as const;

interface Pitch {
  step: string;
  alter: number;
  octave: number;
}

/** MIDI note to a spelled pitch, following the key's accidentals. */
export function midiToPitch(midi: number, useFlats: boolean): Pitch {
  const rounded = Math.round(midi);
  const pitchClass = mod12(rounded);
  return {
    step: (useFlats ? FLAT_SPELLING : SHARP_SPELLING)[pitchClass]!,
    alter: (useFlats ? FLAT_ALTER : SHARP_ALTER)[pitchClass]!,
    octave: Math.floor(rounded / 12) - 1,
  };
}

export interface ScoreInput {
  title: string;
  artist?: string | null;
  instrument: Instrument;
  key: EstimatedKey | null;
  segments: ChordSegment[];
  beats: number[];
  beatsPerBar: number;
  duration: number;
  notation: Notation;
  accidental: Accidental;
  tempo?: number | null;
  capo?: number;
}

interface ScoreEvent {
  chord: Chord | null;
  beats: number;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fallbackBeats(duration: number): number[] {
  const end = Number.isFinite(duration) && duration > 0 ? duration : 8;
  const beats: number[] = [];
  for (let time = 0; time < end && beats.length < 100_000; time += 0.5) {
    beats.push(Number(time.toFixed(3)));
  }
  return beats;
}

/** Merge consecutive beat cells into events of one or more whole beats. */
function eventsForBar(chords: Array<Chord | null>, beatsPerBar: number): ScoreEvent[] {
  const events: ScoreEvent[] = [];
  for (const chord of chords) {
    const previous = events.at(-1);
    if (previous && sameChord(previous.chord, chord)) {
      previous.beats += 1;
    } else {
      events.push({ chord, beats: 1 });
    }
  }
  let total = events.reduce((sum, event) => sum + event.beats, 0);
  while (total < beatsPerBar) {
    events.push({ chord: null, beats: beatsPerBar - total });
    total = beatsPerBar;
  }
  return events;
}

function sameChord(a: Chord | null, b: Chord | null): boolean {
  if (a === null || b === null) return a === b;
  return a.root === b.root && a.quality === b.quality && a.bass === b.bass;
}

function splitBeats(beats: number): number[] {
  const chunks: number[] = [];
  let remaining = beats;
  while (remaining > 4) {
    chunks.push(4);
    remaining -= 4;
  }
  if (remaining > 0) chunks.push(remaining);
  return chunks;
}

function noteType(beats: number): { type: string; dot: boolean } {
  if (beats >= 4) return { type: 'whole', dot: false };
  if (beats === 3) return { type: 'half', dot: true };
  if (beats === 2) return { type: 'half', dot: false };
  return { type: 'quarter', dot: false };
}

function pitchXml(pitch: Pitch): string {
  const alter = pitch.alter === 0 ? '' : `<alter>${pitch.alter}</alter>`;
  return `<pitch><step>${pitch.step}</step>${alter}<octave>${pitch.octave}</octave></pitch>`;
}

function tieXml(start: boolean, stop: boolean): string {
  return [start ? '<tie type="start"/>' : '', stop ? '<tie type="stop"/>' : ''].join('');
}

function tiedNotationsXml(start: boolean, stop: boolean): string {
  const notations = [
    start ? '<tied type="start"/>' : '',
    stop ? '<tied type="stop"/>' : '',
  ].join('');
  return notations ? `<notations>${notations}</notations>` : '';
}

function renderPitched(
  midiNotes: number[],
  beats: number,
  staff: number,
  useFlats: boolean,
): string {
  const chunks = splitBeats(beats);
  return chunks
    .map((chunk, chunkIndex) => {
      const start = chunkIndex < chunks.length - 1;
      const stop = chunkIndex > 0;
      const { type } = noteType(chunk);
      const tie = tieXml(start, stop);
      const notations = tiedNotationsXml(start, stop);
      return midiNotes
        .map((midi, noteIndex) => {
          const chord = noteIndex > 0 ? '<chord/>' : '';
          return `<note>${chord}${pitchXml(midiToPitch(midi, useFlats))}<duration>${chunk * 4}</duration>${tie}<type>${type}</type>${staff === 2 ? '<staff>2</staff>' : ''}${notations}</note>`;
        })
        .join('');
    })
    .join('');
}

function renderRest(beats: number, staff: number): string {
  return splitBeats(beats)
    .map((chunk) => {
      const { type } = noteType(chunk);
      return `<note><rest/><duration>${chunk * 4}</duration><type>${type}</type>${staff === 2 ? '<staff>2</staff>' : ''}</note>`;
    })
    .join('');
}

function harmonyXml(chord: Chord, notation: Notation, accidental: Accidental, useFlats: boolean): string {
  const label = formatChord(chord, notation, accidental);
  const root = midiToPitch(60 + chord.root, useFlats);
  const rootXml = `<root><root-step>${root.step}</root-step>${
    root.alter === 0 ? '' : `<root-alter>${root.alter}</root-alter>`
  }</root>`;
  const bass =
    chord.bass === undefined
      ? ''
      : (() => {
          const pitch = midiToPitch(60 + chord.bass, useFlats);
          return `<bass><bass-step>${pitch.step}</bass-step>${
            pitch.alter === 0 ? '' : `<bass-alter>${pitch.alter}</bass-alter>`
          }</bass>`;
        })();
  return `<harmony>${rootXml}<kind text="${escapeXml(label)}">${HARMONY_KIND[chord.quality]}</kind>${bass}</harmony>`;
}

function chordNotes(chord: Chord, instrument: Instrument): { treble: number[]; bass: number[] } {
  const intervals = CHORD_INTERVALS[chord.quality] ?? CHORD_INTERVALS.major;
  if (instrument === 'piano') {
    return {
      treble: intervals.map((interval) => 60 + chord.root + interval).sort((a, b) => a - b),
      bass: [36 + chord.root],
    };
  }
  if (instrument === 'guitar') {
    // Written an octave above the sounding pitch.
    return {
      treble: intervals.map((interval) => 48 + chord.root + interval + 12).sort((a, b) => a - b),
      bass: [],
    };
  }
  return {
    treble: intervals.map((interval) => 60 + chord.root + interval).sort((a, b) => a - b),
    bass: [],
  };
}

function clefXml(clef: ScoreClef, number?: number): string {
  const numberAttr = number === undefined ? '' : ` number="${number}"`;
  const octave =
    clef.octaveChange === undefined
      ? ''
      : `<clef-octave-change>${clef.octaveChange}</clef-octave-change>`;
  return `<clef${numberAttr}><sign>${clef.sign}</sign><line>${clef.line}</line>${octave}</clef>`;
}

export function buildMusicXml(input: ScoreInput): string {
  const size = Number.isFinite(input.beatsPerBar) && input.beatsPerBar > 0
    ? Math.floor(input.beatsPerBar)
    : 4;
  const clef = clefFor(input.instrument);
  const fifths = keySignatureFifths(input.key);
  const useFlats = input.accidental === 'flat' || fifths < 0;
  const measureBeats = input.beats.length > 0 ? input.beats : fallbackBeats(input.duration);
  const bars = buildBeatGrid(input.segments, measureBeats, size, input.duration);

  const parts: string[] = [];

  bars.forEach((bar, index) => {
    const events = eventsForBar(
      bar.cells.map((cell) => cell?.chord ?? null),
      size,
    );
    const content: string[] = [];

    if (index === 0) {
      content.push(
        `<attributes><divisions>4</divisions><key><fifths>${fifths}</fifths></key><time><beats>${size}</beats><beat-type>4</beat-type></time>${
          clef.staves === 2 ? '<staves>2</staves>' : ''
        }${clefXml(clef, clef.staves === 2 ? 1 : undefined)}${
          clef.staves === 2 ? clefXml({ sign: 'F', line: 4, staves: 2 }, 2) : ''
        }</attributes>`,
      );

      if (input.tempo && Number.isFinite(input.tempo)) {
        const tempo = Math.round(input.tempo);
        content.push(
          `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${tempo}</per-minute></metronome></direction-type><sound tempo="${tempo}"/></direction>`,
        );
      }
      if (input.capo && input.capo > 0) {
        content.push(
          `<direction placement="above"><direction-type><words>Capo ${input.capo}</words></direction-type></direction>`,
        );
      }
    }

    let staffOne = '';
    let staffTwo = '';
    for (const event of events) {
      if (!event.chord) {
        staffOne += renderRest(event.beats, 1);
        if (clef.staves === 2) staffTwo += renderRest(event.beats, 2);
        continue;
      }
      content.push(harmonyXml(event.chord, input.notation, input.accidental, useFlats));
      const notes = chordNotes(event.chord, input.instrument);
      staffOne += renderPitched(notes.treble, event.beats, 1, useFlats);
      if (clef.staves === 2) {
        staffTwo += notes.bass.length
          ? renderPitched(notes.bass, event.beats, 2, useFlats)
          : renderRest(event.beats, 2);
      }
    }

    if (clef.staves === 2) {
      content.push(staffOne, `<backup><duration>${size * 4}</duration></backup>`, staffTwo);
    } else {
      content.push(staffOne);
    }

    const implicit = events.reduce((sum, event) => sum + event.beats, 0) < size ? ' implicit="yes"' : '';
    parts.push(`<measure number="${index + 1}"${implicit}>${content.join('')}</measure>`);
  });

  const title = escapeXml(input.title || 'Untitled');
  const artist = input.artist ? `<creator type="composer">${escapeXml(input.artist)}</creator>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>${title}</work-title></work>
  <identification>${artist}<encoding><software>Chordifree</software><encoding-date>${new Date().toISOString().slice(0, 10)}</encoding-date></encoding></identification>
  <part-list><score-part id="P1"><part-name>${PART_NAME[input.instrument]}</part-name></score-part></part-list>
  <part id="P1">${parts.join('')}</part>
</score-partwise>
`;
}

export function downloadMusicXml(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/vnd.recordare.musicxml+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
