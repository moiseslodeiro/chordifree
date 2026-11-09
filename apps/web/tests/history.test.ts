import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../src/storage/keys';
import { loadHistory, markOpened, saveHistory } from '../src/storage/history';

const first = new Date('2026-01-01T10:00:00.000Z');
const second = new Date('2026-01-02T10:00:00.000Z');

describe('practice history', () => {
  it('counts opens and persists the latest timestamp', () => {
    const storage = createMemoryStorage();
    const one = markOpened({}, 'song-a', first);
    const two = markOpened(one, 'song-a', second);

    expect(two['song-a']).toEqual({
      lastOpenedAt: second.toISOString(),
      openCount: 2,
    });

    saveHistory(storage, two);
    expect(loadHistory(storage)).toEqual(two);
  });

  it('keeps different songs independent', () => {
    const history = markOpened(markOpened({}, 'song-a', first), 'song-b', second);
    expect(history['song-a']?.openCount).toBe(1);
    expect(history['song-b']?.openCount).toBe(1);
  });
});
