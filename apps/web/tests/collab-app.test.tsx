import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { setLanguage } from '../src/i18n';
import type { CollabShare, Song } from '../src/types';

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const shareId = 'a'.repeat(32);

const song: Song = {
  id: 'song-1',
  title: 'Compartida',
  source: { type: 'youtube', videoId: 'dQw4w9WgXcQ' },
  duration: 60,
  segments: [
    { start: 0, end: 4, chord: { root: 0, quality: 'major' } },
    { start: 4, end: 8, chord: { root: 9, quality: 'minor' } },
  ],
  detectedSegments: [],
  analyzerVersion: 'essentia-1.6',
  transpose: 0,
  notation: 'english',
  accidentalPreference: 'sharp',
  createdAt: '2026-11-18T10:00:00.000Z',
  updatedAt: '2026-11-18T10:00:00.000Z',
};

const share: CollabShare = {
  id: shareId,
  songId: 'song-1',
  ownerUid: 'u1',
  ownerNickname: 'Moi',
  currentRevisionId: 'rev-2',
  createdAt: '2026-11-18T10:00:00.000Z',
  updatedAt: '2026-11-18T11:00:00.000Z',
  revisions: [
    {
      id: 'rev-2',
      authorUid: 'u2',
      authorNickname: 'Fulanito',
      createdAt: '2026-11-18T11:00:00.000Z',
    },
  ],
};

function Root() {
  const auth = useAuth();
  if (auth.status !== 'authenticated') return null;
  return <App />;
}

function renderApp() {
  return render(
    <AuthProvider>
      <Root />
    </AuthProvider>,
  );
}

function stubApi(profile = { nickname: 'Moi', custom: true }) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/auth/config') return response({ mode: 'google', clientId: 'client-id' });
    if (url === '/api/config') {
      return response({ features: { cloudLibrary: true, youtube: 'direct' } });
    }
    if (url === '/api/auth/me') {
      return response({
        user: { uid: 'u1', email: 'moi@example.com', name: 'Moi' },
        allowed: true,
        admin: false,
      });
    }
    if (url === '/api/profile') {
      if (init?.method === 'PUT') {
        return response({ nickname: 'Fulanito', custom: true });
      }
      return response(profile);
    }
    if (url === '/api/health') {
      return response({ status: 'ok', analyzer: 'ok', analyzerVersion: 'essentia-1.6' });
    }
    if (url === '/api/youtube/audio-cache' || url.startsWith('/api/youtube/audio-cache?')) {
      return response({ entries: 0, bytes: 0, ttlMinutes: 60 });
    }
    if (url === '/api/cloud/library') return response({ songs: [], setlists: [] });
    if (url === `/api/collab/${shareId}`) return response(share);
    if (url === `/api/collab/${shareId}/revisions/rev-2`) {
      return response({ ...share.revisions[0], song: { ...song, collabId: shareId } });
    }
    return response({});
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  setLanguage('es');
  window.sessionStorage.setItem('chordifree:id-token', 'token');
  window.location.hash = `#/collab/${shareId}`;
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe('collaborative songs', () => {
  it('opens a shared link and shows the changes made by another user', async () => {
    stubApi();
    renderApp();

    expect(await screen.findByRole('heading', { name: 'Compartida' })).toBeInTheDocument();
    expect(await screen.findByText('Fulanito ha hecho cambios')).toBeInTheDocument();
    expect(screen.getByText('Colaboración')).toBeInTheDocument();
  });

  it('asks for a nickname after the first sign-in', async () => {
    stubApi({ nickname: 'Moi', custom: false });
    window.location.hash = '#/';
    renderApp();

    expect(await screen.findByText('¿Cómo te llamamos?')).toBeInTheDocument();
    const input = screen.getByLabelText('Nombre');
    fireEvent.change(input, { target: { value: 'Fulanito' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }));

    await waitFor(() => expect(screen.queryByText('¿Cómo te llamamos?')).not.toBeInTheDocument());
  });
});
