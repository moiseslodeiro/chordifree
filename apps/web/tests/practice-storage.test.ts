import { describe, expect, it } from 'vitest';
import { createMemoryStorage, KEYS } from '../src/storage/keys';
import {
  DEFAULT_BPM,
  DEFAULT_PRACTICE,
  loadPractice,
  normalizePractice,
  removePractice,
  savePractice,
} from '../src/storage/practice';

describe('persisted practice', () => {
  it('returns the defaults when there is no data', () => {
    expect(loadPractice(createMemoryStorage(), 'song-1')).toEqual(DEFAULT_PRACTICE);
  });

  it('saves and loads the state of each song separately', () => {
    const storage = createMemoryStorage();
    savePractice(storage, 'song-1', {
      loopA: 8,
      loopB: 16,
      loopEnabled: true,
      rate: 1.25,
      bpm: 120,
    });
    savePractice(storage, 'song-2', {
      loopA: 0,
      loopB: 4,
      loopEnabled: false,
      rate: 0.75,
      bpm: 80,
    });

    expect(loadPractice(storage, 'song-1')).toEqual({
      loopA: 8,
      loopB: 16,
      loopEnabled: true,
      rate: 1.25,
      bpm: 120,
    });
    expect(loadPractice(storage, 'song-2')).toEqual({
      loopA: 0,
      loopB: 4,
      loopEnabled: false,
      rate: 0.75,
      bpm: 80,
    });
  });

  it('fixes inverted ranges and out-of-range rates and BPM', () => {
    expect(
      normalizePractice({
        loopA: 8,
        loopB: 8,
        loopEnabled: true,
        rate: 2,
        bpm: 500,
      }),
    ).toEqual({
      loopA: 8,
      loopB: null,
      loopEnabled: false,
      rate: 1,
      bpm: 240,
    });

    expect(
      normalizePractice({
        loopA: -1,
        loopB: 4,
        loopEnabled: true,
        rate: 1.25,
        bpm: 'rápido',
      }),
    ).toEqual({
      loopA: null,
      loopB: 4,
      loopEnabled: false,
      rate: 1.25,
      bpm: DEFAULT_BPM,
    });
  });

  it('discards unreadable data and quarantines it', () => {
    const storage = createMemoryStorage();
    storage.setItem(KEYS.practice('song-1'), '{no es json');

    expect(loadPractice(storage, 'song-1')).toEqual(DEFAULT_PRACTICE);
    expect(storage.getItem(KEYS.practice('song-1'))).toBeNull();
  });

  it('removes practice state when deleting a song', () => {
    const storage = createMemoryStorage();
    savePractice(storage, 'song-1', { ...DEFAULT_PRACTICE, loopA: 0, loopB: 8 });
    removePractice(storage, 'song-1');
    expect(loadPractice(storage, 'song-1')).toEqual(DEFAULT_PRACTICE);
  });
});
