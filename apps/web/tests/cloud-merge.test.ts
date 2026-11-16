import { describe, expect, it } from 'vitest';
import type { Setlist, Song } from '@chordifree/contracts';
import { mergeSetlists, mergeSnapshot, mergeSongs } from '../src/sync/cloud';

function song(id: string, videoId: string, updatedAt: string, title = id): Song {
  return {
    id,
    title,
    source: { type: 'youtube', videoId },
    duration: 10,
    segments: [],
    detectedSegments: [],
    beats: [],
    beatsPerBar: 4,
    vocalRegions: [],
    capo: 0,
    analyzerVersion: 'test',
    transpose: 0,
    notation: 'english',
    accidentalPreference: 'auto',
    createdAt: updatedAt,
    updatedAt,
  };
}

function setlist(id: string, updatedAt: string, name = id): Setlist {
  return {
    id,
    name,
    songIds: [],
    createdAt: updatedAt,
    updatedAt,
  };
}

describe('cloud merge', () => {
  it('keeps local-only songs and adds remote-only songs', () => {
    const local = [song('local', 'aaaaaaaaaaa', '2026-01-01T00:00:00.000Z')];
    const remote = [song('remote', 'bbbbbbbbbbb', '2026-01-01T00:00:00.000Z')];
    expect(mergeSongs(local, remote).map((item) => item.id).sort()).toEqual(['local', 'remote']);
  });

  it('uses updatedAt and the source key, not the local id', () => {
    const local = [song('local-id', 'aaaaaaaaaaa', '2026-01-02T00:00:00.000Z', 'newer')];
    const remote = [song('remote-id', 'aaaaaaaaaaa', '2026-01-01T00:00:00.000Z', 'older')];
    const merged = mergeSongs(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe('local-id');
    expect(merged[0]?.title).toBe('newer');
  });

  it('lets remote win when updatedAt is equal', () => {
    const local = [song('local-id', 'aaaaaaaaaaa', '2026-01-01T00:00:00.000Z', 'local')];
    const remote = [song('remote-id', 'aaaaaaaaaaa', '2026-01-01T00:00:00.000Z', 'remote')];
    expect(mergeSongs(local, remote)[0]?.id).toBe('remote-id');
  });

  it('merges setlists by id and updatedAt', () => {
    const local = [setlist('one', '2026-01-02T00:00:00.000Z', 'local winner')];
    const remote = [
      setlist('one', '2026-01-01T00:00:00.000Z', 'remote older'),
      setlist('two', '2026-01-01T00:00:00.000Z'),
    ];
    const merged = mergeSetlists(local, remote);
    expect(merged.find((item) => item.id === 'one')?.name).toBe('local winner');
    expect(merged.map((item) => item.id).sort()).toEqual(['one', 'two']);
  });

  it('merges a snapshot without mutating the inputs', () => {
    const local = { songs: [song('a', 'aaaaaaaaaaa', '2026-01-01T00:00:00.000Z')], setlists: [] };
    const remote = {
      songs: [song('b', 'bbbbbbbbbbb', '2026-01-01T00:00:00.000Z')],
      setlists: [setlist('one', '2026-01-01T00:00:00.000Z')],
    };
    const merged = mergeSnapshot(local, remote);
    expect(merged.songs).toHaveLength(2);
    expect(merged.setlists).toHaveLength(1);
    expect(local.songs).toHaveLength(1);
    expect(remote.songs).toHaveLength(1);
  });
});
