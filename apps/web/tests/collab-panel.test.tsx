import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../src/i18n';
import { CollabPanel } from '../src/components/CollabPanel';
import { NicknameDialog } from '../src/components/NicknameDialog';
import type { CollabRevision, CollabShare, Song } from '../src/types';

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 'song-1',
    title: 'My song',
    source: { type: 'youtube', videoId: 'dQw4w9WgXcQ' },
    duration: 120,
    segments: [{ start: 0, end: 4, chord: { root: 0, quality: 'major' } }],
    detectedSegments: [],
    analyzerVersion: 'essentia-1.6',
    transpose: 0,
    notation: 'english',
    accidentalPreference: 'sharp',
    createdAt: '2026-11-18T10:00:00.000Z',
    updatedAt: '2026-11-18T10:00:00.000Z',
    ...overrides,
  };
}

const share: CollabShare = {
  id: 'share-1',
  songId: 'song-1',
  ownerUid: 'u1',
  ownerNickname: 'Me',
  currentRevisionId: 'rev-2',
  createdAt: '2026-11-18T10:00:00.000Z',
  updatedAt: '2026-11-18T11:00:00.000Z',
  revisions: [
    {
      id: 'rev-2',
      authorUid: 'u1',
      authorNickname: 'Me',
      createdAt: '2026-11-18T11:00:00.000Z',
    },
    {
      id: 'rev-1',
      authorUid: 'u2',
      authorNickname: 'Fulanito',
      createdAt: '2026-11-18T10:30:00.000Z',
    },
  ],
};

describe('CollabPanel', () => {
  beforeEach(() => setLanguage('en'));

  it('shows the latest change by another user and loads a revision', async () => {
    const otherShare: CollabShare = {
      ...share,
      currentRevisionId: 'rev-1',
      revisions: [
        {
          id: 'rev-2',
          authorUid: 'u2',
          authorNickname: 'Fulanito',
          createdAt: '2026-11-18T11:00:00.000Z',
        },
        {
          id: 'rev-1',
          authorUid: 'u1',
          authorNickname: 'Me',
          createdAt: '2026-11-18T10:30:00.000Z',
        },
      ],
    };
    const revision: CollabRevision = {
      ...otherShare.revisions[0]!,
      song: makeSong({
        segments: [{ start: 0, end: 4, chord: { root: 9, quality: 'minor' } }],
      }),
    };
    const onLoadRevision = vi.fn(async () => revision);
    const onApply = vi.fn();
    render(
      <CollabPanel
        share={otherShare}
        song={makeSong()}
        currentUid="u1"
        language="en"
        loading={false}
        onCopyLink={vi.fn()}
        onRefresh={vi.fn()}
        onLoadRevision={onLoadRevision}
        onApply={onApply}
      />,
    );

    expect(screen.getByText('Fulanito made changes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View changes' }));

    expect(await screen.findByText('Chords')).toBeInTheDocument();
    expect(screen.getByText('Am')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Load this version' }));
    expect(onApply).toHaveBeenCalledWith(revision);
  });

  it('opens a revision from the history', async () => {
    const revision: CollabRevision = {
      ...share.revisions[1]!,
      song: makeSong({ lyrics: 'new line' }),
    };
    const onLoadRevision = vi.fn(async () => revision);
    render(
      <CollabPanel
        share={share}
        song={makeSong({ lyrics: 'old line' })}
        currentUid="u1"
        language="en"
        loading={false}
        onCopyLink={vi.fn()}
        onRefresh={vi.fn()}
        onLoadRevision={onLoadRevision}
        onApply={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Fulanito/ }));
    expect(await screen.findByText('Lyrics')).toBeInTheDocument();
    expect(screen.getByText('new line')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load this version' })).toBeInTheDocument();
  });
});

describe('NicknameDialog', () => {
  beforeEach(() => setLanguage('en'));

  it('validates the nickname and saves it', async () => {
    const onSave = vi.fn(async () => undefined);
    const onClose = vi.fn();
    render(<NicknameDialog open initial="Moi" required onSave={onSave} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: 'A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save nickname' }));
    expect(await screen.findByText('Use at least 2 characters.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: 'Fulanito' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save nickname' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Fulanito'));
    expect(onClose).toHaveBeenCalled();
  });
});
