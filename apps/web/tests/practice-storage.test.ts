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

describe('práctica persistida', () => {
  it('devuelve los valores por defecto cuando no hay datos', () => {
    expect(loadPractice(createMemoryStorage(), 'song-1')).toEqual(DEFAULT_PRACTICE);
  });

  it('guarda y carga el estado de cada canción por separado', () => {
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

  it('corrige rangos invertidos, velocidades y BPM fuera de rango', () => {
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

  it('descarta datos ilegibles y los pone en cuarentena', () => {
    const storage = createMemoryStorage();
    storage.setItem(KEYS.practice('song-1'), '{no es json');

    expect(loadPractice(storage, 'song-1')).toEqual(DEFAULT_PRACTICE);
    expect(storage.getItem(KEYS.practice('song-1'))).toBeNull();
  });

  it('elimina la práctica al borrar una canción', () => {
    const storage = createMemoryStorage();
    savePractice(storage, 'song-1', { ...DEFAULT_PRACTICE, loopA: 0, loopB: 8 });
    removePractice(storage, 'song-1');
    expect(loadPractice(storage, 'song-1')).toEqual(DEFAULT_PRACTICE);
  });
});
