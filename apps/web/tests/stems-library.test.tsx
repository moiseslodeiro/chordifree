import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../src/i18n';
import { StemsLibrary } from '../src/components/StemsLibrary';
import { ConfirmProvider } from '../src/components/ConfirmDialog';
import type { StemInstallJobView, StemSetupStatus } from '../src/lib/api';

afterEach(() => {
  FakeAudio.instances = [];
  vi.unstubAllGlobals();
});

const cachedEntry = {
  key: 'abc',
  videoId: 'dQw4w9WgXcQ',
  title: 'Demo',
  plugin: 'demucs-4stems@4.1.0',
  stems: ['vocals', 'instrumental'],
  midi: [],
  createdAt: '2026-11-19T10:00:00.000Z',
  bytes: 2048,
};

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function audioResponse(): Response {
  return {
    ok: true,
    status: 200,
    blob: async () => new Blob(['wav'], { type: 'audio/wav' }),
  } as Response;
}

class FakeAudio {
  static instances: FakeAudio[] = [];
  src: string;
  volume = 1;
  currentTime = 0;
  paused = true;
  ended = false;
  playbackRate = 1;
  preservesPitch = true;
  readyState = 4;
  preload = '';
  private readonly listeners = new Map<string, Set<() => void>>();

  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }

  addEventListener(event: string, listener: () => void): void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
  }

  removeEventListener(event: string, listener: () => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  play(): Promise<void> {
    this.paused = false;
    this.emit('play');
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
    this.emit('pause');
  }

  load(): void {}

  removeAttribute(): void {
    this.src = '';
  }

  private emit(event: string): void {
    for (const listener of this.listeners.get(event) ?? []) listener();
  }
}

describe('StemsLibrary', () => {
  it('lists jobs and cached stems with cancel and remove actions', async () => {
    setLanguage('es');
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/stems') {
        return response({ available: true, name: 'demucs-4stems', version: '4.1.0' });
      }
      if (url === '/api/stems/setup') {
        return response({ supported: false, installed: false, managed: false });
      }
      if (url === '/api/stems/jobs' && !init?.method) {
        return response({
          jobs: [
            {
              id: 'job-1',
              videoId: 'dQw4w9WgXcQ',
              title: 'Demo',
              status: 'processing',
              stems: [],
              createdAt: '2026-11-19T10:00:00.000Z',
              updatedAt: '2026-11-19T10:00:00.000Z',
            },
          ],
        });
      }
      if (url === '/api/stems/jobs/job-1/cancel') {
        return response({ id: 'job-1', status: 'cancelled' });
      }
      if (url === '/api/stems/cache') {
        return response({
          entries: [
            {
              key: 'abc',
              videoId: 'dQw4w9WgXcQ',
              title: 'Demo',
              plugin: 'demucs-4stems@4.1.0',
              stems: ['vocals', 'drums', 'bass', 'other'],
              midi: ['bass'],
              createdAt: '2026-11-19T10:00:00.000Z',
              bytes: 2048,
            },
          ],
        });
      }
      if (url === '/api/stems/cache/dQw4w9WgXcQ') {
        return response({ removed: 1 });
      }
      return response({});
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<StemsLibrary onBack={vi.fn()} />);

    expect(await screen.findAllByText('Demo')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Reproducir mezcla' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reproducir Voz' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reproducir Batería' })).toBeVisible();
    expect(screen.getByText(/Separando/)).toBeInTheDocument();
    expect(screen.getByText(/MIDI/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/stems/jobs/job-1/cancel',
        expect.objectContaining({ method: 'POST' }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/stems/cache/dQw4w9WgXcQ',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
  });

  it('uninstalls a managed plugin from the header', async () => {
    setLanguage('es');
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/stems/setup' && init?.method === 'DELETE')
        return response({ removed: true });
      if (url === '/api/stems') {
        return response({ available: true, name: 'demucs-4stems', version: '4.1.0' });
      }
      if (url === '/api/stems/setup') {
        return response({
          supported: true,
          installed: true,
          managed: true,
          pluginDir: '/tmp/chordifree/stems',
          python: { command: 'python3.12', version: '3.12.3' },
        });
      }
      if (url === '/api/stems/jobs') return response({ jobs: [] });
      if (url === '/api/stems/cache') return response({ entries: [] });
      return response({});
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ConfirmProvider>
        <StemsLibrary onBack={vi.fn()} />
      </ConfirmProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Desinstalar plugin' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Desinstalar plugin' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/stems/setup',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
  });

  it('installs and cancels the local plugin from the setup panel', async () => {
    setLanguage('es');
    const job: StemInstallJobView = {
      id: 'install-1',
      status: 'running',
      step: 'pip',
      progress: 42,
      message: 'Descargando torch y torchaudio',
      startedAt: '2026-11-19T10:00:00.000Z',
      updatedAt: '2026-11-19T10:00:00.000Z',
    };
    let setup: StemSetupStatus = {
      supported: true,
      installed: false,
      managed: false,
      pluginDir: '/home/demo/.config/chordifree/stems',
      python: { command: 'python3', version: '3.12.3' },
    };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/stems') return response({ available: false });
      if (url === '/api/stems/setup' && !init?.method) return response(setup);
      if (url === '/api/stems/setup/install') {
        setup = { ...setup, job };
        return response(job);
      }
      if (url === '/api/stems/setup/cancel') {
        setup = { ...setup, job: { ...job, status: 'cancelled' } };
        return response(setup.job);
      }
      if (url === '/api/stems/jobs') return response({ jobs: [] });
      if (url === '/api/stems/cache') return response({ entries: [] });
      return response({});
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<StemsLibrary onBack={vi.fn()} />);

    expect(await screen.findByRole('button', { name: 'Instalar plugin' })).toBeVisible();
    expect(screen.getByText(/Python 3.12.3 detectado/)).toBeInTheDocument();
    expect(screen.getByText(/1,5 GB/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Instalar plugin' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/stems/setup/install',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    expect(await screen.findByText('Descargando torch y torchaudio')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar instalación' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/stems/setup/cancel',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('plays the cached mix or a single stem', async () => {
    setLanguage('es');
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/stems') {
        return response({ available: true, name: 'demucs-4stems', version: '4.1.0' });
      }
      if (url === '/api/stems/setup') {
        return response({ supported: false, installed: false, managed: false });
      }
      if (url === '/api/stems/jobs' && !init?.method) return response({ jobs: [] });
      if (url === '/api/stems/cache') return response({ entries: [cachedEntry] });
      if (url === '/api/stems/dQw4w9WgXcQ') {
        return response({
          id: 'job-cache',
          videoId: 'dQw4w9WgXcQ',
          title: 'Demo',
          status: 'done',
          stems: ['vocals', 'instrumental'],
          createdAt: cachedEntry.createdAt,
          updatedAt: cachedEntry.createdAt,
        });
      }
      if (url.startsWith('/api/stems/jobs/job-cache/')) return audioResponse();
      return response({});
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('Audio', FakeAudio);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:stem'),
      revokeObjectURL: vi.fn(),
    });

    render(<StemsLibrary onBack={vi.fn()} />);

    const mix = await screen.findByRole('button', { name: 'Reproducir mezcla' });
    fireEvent.click(mix);
    await waitFor(() => expect(mix).toHaveAttribute('aria-pressed', 'true'));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/stems/dQw4w9WgXcQ',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(FakeAudio.instances).toHaveLength(2);
    expect(FakeAudio.instances.every((audio) => !audio.paused)).toBe(true);

    fireEvent.click(mix);
    await waitFor(() => expect(mix).toHaveAttribute('aria-pressed', 'false'));

    const vocals = screen.getByRole('button', { name: 'Reproducir Voz' });
    fireEvent.click(vocals);
    await waitFor(() => expect(vocals).toHaveAttribute('aria-pressed', 'true'));
    expect(FakeAudio.instances.at(-1)?.src).toBe('blob:stem');
    expect(mix).toHaveAttribute('aria-pressed', 'false');
  });
});
