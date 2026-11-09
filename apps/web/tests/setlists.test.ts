import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../src/storage/keys';
import {
  addSongToSetlist,
  createSetlist,
  loadSetlists,
  moveSongInSetlist,
  removeSongFromSetlist,
  renameSetlist,
  saveSetlists,
} from '../src/storage/setlists';

const now = new Date('2026-01-01T00:00:00.000Z');

describe('setlists storage', () => {
  it('creates, renames and persists a setlist', () => {
    const storage = createMemoryStorage();
    const setlist = createSetlist('Rehearsal', now);
    const renamed = renameSetlist(setlist, 'Gig', now);
    const withSongs = addSongToSetlist(
      addSongToSetlist(renamed, 'song-a', now),
      'song-b',
      now,
    );

    expect(withSongs.songIds).toEqual(['song-a', 'song-b']);
    saveSetlists(storage, [withSongs]);
    expect(loadSetlists(storage)).toEqual([withSongs]);
  });

  it('removes and reorders songs', () => {
    const setlist = createSetlist('Set', now);
    const withSongs = addSongToSetlist(
      addSongToSetlist(addSongToSetlist(setlist, 'a', now), 'b', now),
      'c',
      now,
    );

    expect(moveSongInSetlist(withSongs, 'c', -1, now).songIds).toEqual(['a', 'c', 'b']);
    expect(removeSongFromSetlist(withSongs, 'b', now).songIds).toEqual(['a', 'c']);
  });

  it('does not duplicate songs', () => {
    const setlist = addSongToSetlist(createSetlist('Set', now), 'a', now);
    expect(addSongToSetlist(setlist, 'a', now).songIds).toEqual(['a']);
  });
});
