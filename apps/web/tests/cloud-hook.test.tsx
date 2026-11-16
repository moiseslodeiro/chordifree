import { act, renderHook, waitFor } from '@testing-library/react';
import type { Song } from '@chordifree/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../src/i18n';

const api = vi.hoisted(() => ({
  getCloudLibrary: vi.fn(),
  saveCloudLibrary: vi.fn(),
}));

vi.mock('../src/lib/api', () => api);

import { useCloudLibrary } from '../src/sync/useCloudLibrary';

function song(id: string, videoId: string): Song {
  return {
    id,
    title: id,
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
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const options = {
  enabled: true,
  songs: [],
  setlists: [],
  getSongs: () => [],
  onMerge: vi.fn(),
  onNotice: vi.fn(),
};

beforeEach(() => {
  setLanguage('en');
  api.getCloudLibrary.mockReset();
  api.saveCloudLibrary.mockReset();
  api.saveCloudLibrary.mockResolvedValue(undefined);
  options.onMerge.mockReset();
  options.onNotice.mockReset();
});

describe('useCloudLibrary', () => {
  it('merges the remote snapshot and saves it', async () => {
    const remote = song('remote', 'aaaaaaaaaaa');
    api.getCloudLibrary.mockResolvedValue({ songs: [remote], setlists: [] });

    const { result } = renderHook(() => useCloudLibrary(options));

    await waitFor(() => expect(result.current.status).toBe('saved'));
    expect(options.onMerge).toHaveBeenCalledWith({ songs: [remote], setlists: [] });
    expect(api.saveCloudLibrary).toHaveBeenCalledWith({ songs: [remote], setlists: [] });
  });

  it('reports a sync failure without touching the local library', async () => {
    api.getCloudLibrary.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useCloudLibrary(options));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(options.onMerge).not.toHaveBeenCalled();
  });

  it('does nothing when cloud sync is disabled', () => {
    const { result } = renderHook(() => useCloudLibrary({ ...options, enabled: false }));
    expect(result.current.status).toBe('idle');
    expect(api.getCloudLibrary).not.toHaveBeenCalled();
  });

  it('syncs manually and notifies success', async () => {
    api.getCloudLibrary.mockResolvedValue({ songs: [], setlists: [] });
    const { result } = renderHook(() => useCloudLibrary(options));
    await waitFor(() => expect(result.current.status).toBe('saved'));

    await act(async () => {
      result.current.syncNow();
    });

    await waitFor(() =>
      expect(options.onNotice).toHaveBeenCalledWith('Saved to your account', 'success'),
    );
  });
});
