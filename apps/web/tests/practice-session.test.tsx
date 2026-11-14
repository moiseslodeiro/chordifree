import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePracticeSession } from '../src/practice/usePracticeSession';
import { getStorage } from '../src/storage/keys';
import { DEFAULT_PRACTICE, savePractice } from '../src/storage/practice';

describe('practice session opening', () => {
  it('starts at the original tempo and pitch while keeping the A-B range', () => {
    savePractice(getStorage(), 'song-1', {
      ...DEFAULT_PRACTICE,
      loopA: 8,
      loopB: 16,
      loopEnabled: true,
      rate: 1.25,
      pitch: 5,
      bpm: 120,
    });

    const { result } = renderHook(() => usePracticeSession('song-1'));

    expect(result.current.practice).toEqual({
      loopA: 8,
      loopB: 16,
      loopEnabled: true,
      rate: 1,
      bpm: 120,
      pitch: 0,
    });
  });
});
