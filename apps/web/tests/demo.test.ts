import { describe, expect, it } from 'vitest';
import { createDemoSong } from '../src/demo';
import { buildBeatRows } from '../src/grid/beats';
import { DEFAULT_PREFERENCES } from '../src/storage/preferences';

describe('demo song', () => {
  it('places each chord on its own bar', () => {
    const song = createDemoSong(DEFAULT_PREFERENCES);
    const rows = buildBeatRows(
      song.segments,
      song.beats ?? [],
      song.beatsPerBar ?? 4,
      2,
      song.duration,
    );

    expect(rows).toHaveLength(2);
    const chords = rows.flatMap((row) =>
      row.cells.map((cell) => cell?.chord?.root ?? null),
    );
    expect(chords).toEqual([
      0, 0, 0, 0, 7, 7, 7, 7,
      9, 9, 9, 9, 5, 5, 5, 5,
    ]);
    expect(rows[0]?.cells[4]?.change).toBe(true);
    expect(rows[1]?.cells[0]?.change).toBe(true);
    expect(rows[1]?.cells[4]?.change).toBe(true);
  });
});
