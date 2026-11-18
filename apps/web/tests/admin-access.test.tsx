import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminAccess } from '../src/components/AdminAccess';

vi.mock('../src/auth/AuthProvider', () => ({
  useAuth: () => ({ admin: true, mode: 'google', status: 'authenticated' }),
}));

function response(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AdminAccess', () => {
  it('lists analyzed songs with the account that started the analysis', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/admin/access') {
        return response({
          entries: [{ email: 'friend@example.com', addedAt: '2026-11-18T10:00:00.000Z' }],
        });
      }
      if (url.startsWith('/api/admin/analyses')) {
        return response({
          entries: [
            {
              id: 'run-1',
              uid: 'friend',
              email: 'friend@example.com',
              nickname: 'Fulanito',
              kind: 'youtube',
              videoId: 'dQw4w9WgXcQ',
              title: 'Canción de prueba',
              duration: 120,
              chords: 2,
              analyzerVersion: 'essentia-test',
              createdAt: '2026-11-18T11:00:00.000Z',
            },
            {
              id: 'run-2',
              uid: 'admin',
              email: 'admin@example.com',
              nickname: 'Admin',
              kind: 'upload',
              filename: 'ensayo.wav',
              duration: 90,
              chords: 4,
              analyzerVersion: 'essentia-test',
              createdAt: '2026-11-18T12:00:00.000Z',
            },
          ],
        });
      }
      return response({});
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminAccess onBack={vi.fn()} />);

    expect(await screen.findByText('Análisis recientes')).toBeInTheDocument();
    expect(await screen.findByText('Canción de prueba')).toBeInTheDocument();
    expect(screen.getByText(/por Fulanito · friend@example.com/)).toBeInTheDocument();
    expect(screen.getByText('ensayo.wav')).toBeInTheDocument();
    expect(screen.getByText(/por Admin · admin@example.com/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/analyses?limit=100',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });
});
