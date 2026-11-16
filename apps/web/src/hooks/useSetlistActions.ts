import { useCallback, useState } from 'react';
import {
  addSongToSetlist,
  createSetlist,
  loadSetlists,
  moveSongInSetlist,
  removeSongFromSetlist,
  renameSetlist,
  saveSetlists,
} from '../storage/setlists';
import type { StorageLike } from '../storage/keys';
import type { Setlist } from '../types';

export interface SetlistActionsOptions {
  storage: StorageLike;
  onSaveError: () => void;
}

export interface SetlistActions {
  setlists: Setlist[];
  replaceSetlists: (setlists: Setlist[]) => void;
  createList: (name: string) => Setlist;
  deleteList: (id: string) => void;
  renameList: (id: string, name: string) => void;
  addSong: (id: string, songId: string) => void;
  removeSong: (id: string, songId: string) => void;
  moveSong: (id: string, songId: string, direction: -1 | 1) => void;
  addSongToNewList: (name: string, songId: string) => Setlist;
}

export function useSetlistActions({ storage, onSaveError }: SetlistActionsOptions): SetlistActions {
  const [setlists, setSetlists] = useState<Setlist[]>(() => loadSetlists(storage));

  const updateSetlists = useCallback(
    (updater: (current: Setlist[]) => Setlist[]) => {
      setSetlists((current) => {
        const next = updater(current);
        try {
          saveSetlists(storage, next);
        } catch {
          onSaveError();
        }
        return next;
      });
    },
    [onSaveError, storage],
  );

  const replaceSetlists = useCallback(
    (next: Setlist[]) => {
      setSetlists(next);
      try {
        saveSetlists(storage, next);
      } catch {
        // The local copy remains usable.
      }
    },
    [storage],
  );

  const createList = useCallback(
    (name: string) => {
      const created = createSetlist(name);
      updateSetlists((current) => [...current, created]);
      return created;
    },
    [updateSetlists],
  );

  const deleteList = useCallback(
    (id: string) => {
      updateSetlists((current) => current.filter((setlist) => setlist.id !== id));
    },
    [updateSetlists],
  );

  const renameList = useCallback(
    (id: string, name: string) => {
      updateSetlists((current) =>
        current.map((setlist) => (setlist.id === id ? renameSetlist(setlist, name) : setlist)),
      );
    },
    [updateSetlists],
  );

  const addSong = useCallback(
    (id: string, songId: string) => {
      updateSetlists((current) =>
        current.map((setlist) => (setlist.id === id ? addSongToSetlist(setlist, songId) : setlist)),
      );
    },
    [updateSetlists],
  );

  const removeSong = useCallback(
    (id: string, songId: string) => {
      updateSetlists((current) =>
        current.map((setlist) =>
          setlist.id === id ? removeSongFromSetlist(setlist, songId) : setlist,
        ),
      );
    },
    [updateSetlists],
  );

  const moveSong = useCallback(
    (id: string, songId: string, direction: -1 | 1) => {
      updateSetlists((current) =>
        current.map((setlist) =>
          setlist.id === id ? moveSongInSetlist(setlist, songId, direction) : setlist,
        ),
      );
    },
    [updateSetlists],
  );

  const addSongToNewList = useCallback(
    (name: string, songId: string) => {
      const created = addSongToSetlist(createSetlist(name), songId);
      updateSetlists((current) => [...current, created]);
      return created;
    },
    [updateSetlists],
  );

  return {
    setlists,
    replaceSetlists,
    createList,
    deleteList,
    renameList,
    addSong,
    removeSong,
    moveSong,
    addSongToNewList,
  };
}
