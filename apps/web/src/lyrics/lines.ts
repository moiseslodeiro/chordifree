import {
  formatChord,
  type Accidental,
  type ChordSegment,
  type Notation,
} from '@chordifree/chords';
import { alignLyrics, buildChordChanges, type AlignedChord, type LyricLine } from './align';
import { detectInstrumentalSpans, harmonyBars } from './sections';

export interface BuildLyricLinesInput {
  lyrics: string;
  segments: ChordSegment[];
  beats: number[];
  beatsPerBar: number;
  duration: number;
  notation: Notation;
  accidental: Accidental;
  vocalRegions?: Array<{ start: number; end: number }>;
  /** Manual line overrides, keyed by segment index. */
  chordLines?: Record<string, number>;
}

/**
 * Aligns the lyrics with the chord timeline and applies the manual line
 * overrides saved with the song. Shared by the interactive lyric view and the
 * printable lead sheet so both show the same positions.
 */
/** Left padding of the chord row, matching the interactive lyric view. */
export function chordRowMargin(chords: AlignedChord[]): string | undefined {
  const first = chords[0];
  if (!first || first.offset <= 0) return undefined;
  return `${Math.min(22, first.offset * 22)}%`;
}

export function buildLyricLines(input: BuildLyricLinesInput): LyricLine[] {
  const changes = buildChordChanges(input.segments, (chord) =>
    formatChord(chord, input.notation, input.accidental),
  );
  const instrumental = detectInstrumentalSpans(
    harmonyBars(input.segments, input.beats, input.beatsPerBar, input.duration),
    input.duration,
  );
  const aligned = alignLyrics(input.lyrics, changes, input.duration, {
    instrumental,
    vocalRegions: input.vocalRegions,
  });

  if (!input.chordLines || Object.keys(input.chordLines).length === 0) {
    return aligned;
  }

  const copy = aligned.map((line) => ({ ...line, chords: [...line.chords] }));
  const byIndex = new Map(copy.map((line) => [line.index, line] as const));
  const overrides = new Map<string, number>();
  for (const [key, target] of Object.entries(input.chordLines)) {
    const line = byIndex.get(target);
    if (line && line.text.trim().length > 0) overrides.set(key, target);
  }
  if (overrides.size === 0) return aligned;

  const moved = new Map<number, AlignedChord[]>();
  for (const line of copy) {
    line.chords = line.chords.filter((chord) => {
      const target = overrides.get(String(chord.segmentIndex));
      if (target === undefined || target === line.index) return true;
      const list = moved.get(target) ?? [];
      list.push(chord);
      moved.set(target, list);
      return false;
    });
  }

  for (const [target, chords] of moved) {
    const line = byIndex.get(target);
    if (!line) continue;
    const start = line.spans[0]?.start ?? line.start;
    const end = line.spans[line.spans.length - 1]?.end ?? line.end;
    for (const chord of chords) {
      const offset =
        end > start ? Math.max(0, Math.min(1, (chord.time - start) / (end - start))) : 0;
      line.chords.push({ ...chord, offset });
    }
    line.chords.sort((a, b) => a.time - b.time || a.segmentIndex - b.segmentIndex);
  }
  return copy;
}
