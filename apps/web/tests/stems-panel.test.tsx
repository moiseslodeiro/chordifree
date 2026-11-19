import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../src/i18n';
import { StemsPanel } from '../src/components/StemsPanel';
import type { StemJobView, StemsStatus } from '../src/lib/api';

const available: StemsStatus = {
  available: true,
  name: 'demucs-4stems',
  version: '4.1.0',
  stems: ['vocals', 'drums', 'bass', 'other'],
};

const done: StemJobView = {
  id: 'job-1',
  videoId: 'dQw4w9WgXcQ',
  status: 'done',
  stems: ['vocals', 'instrumental'],
  createdAt: '2026-11-19T10:00:00.000Z',
  updatedAt: '2026-11-19T10:02:00.000Z',
};

function renderPanel(overrides: Partial<Parameters<typeof StemsPanel>[0]> = {}) {
  const props = {
    status: available,
    job: null,
    busy: false,
    error: null,
    midiBusy: false,
    mixActive: false,
    mixBusy: false,
    gains: {},
    onSeparate: vi.fn(),
    onCancel: vi.fn(),
    onToggleMix: vi.fn(),
    onGainChange: vi.fn(),
    onDownloadStem: vi.fn(),
    onDownloadMidi: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
  render(<StemsPanel {...props} />);
  return props;
}

describe('StemsPanel', () => {
  beforeEach(() => setLanguage('es'));

  it('renders nothing without the plugin', () => {
    renderPanel({ status: { available: false } });
    expect(screen.queryByTestId('stems-panel')).not.toBeInTheDocument();
  });

  it('starts the separation and allows cancelling it', () => {
    const props = renderPanel({ job: { ...done, status: 'processing', stems: [] }, busy: true });
    expect(screen.getByText(/Separando/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar separación' }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('starts a new separation', () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Separar pistas' }));
    expect(props.onSeparate).toHaveBeenCalledTimes(1);
  });

  it('mixes the stems with independent volumes', () => {
    const props = renderPanel({
      job: done,
      mixActive: true,
      gains: { vocals: 0.5, instrumental: 0 },
    });

    expect(screen.getByRole('button', { name: 'Original' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Mezclar pistas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const vocals = screen.getByRole('slider', { name: 'Volumen de Voz' });
    expect(vocals).toHaveValue('50');
    fireEvent.change(vocals, { target: { value: '30' } });
    expect(props.onGainChange).toHaveBeenCalledWith('vocals', 0.3);

    const instrumental = screen.getByRole('slider', { name: 'Volumen de Instrumental' });
    expect(instrumental).toHaveValue('0');

    fireEvent.click(screen.getByRole('button', { name: 'Descargar Voz' }));
    expect(props.onDownloadStem).toHaveBeenCalledWith('vocals');
  });

  it('switches between the original and the mix', () => {
    const props = renderPanel({ job: done });
    fireEvent.click(screen.getByRole('button', { name: 'Mezclar pistas' }));
    expect(props.onToggleMix).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Original' }));
    expect(props.onToggleMix).toHaveBeenCalledWith(false);
  });

  it('hides the volume sliders until the mix is active', () => {
    renderPanel({ job: done });
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.getByText(/Elige «Mezclar pistas»/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Descargar Voz' })).toBeInTheDocument();
  });

  it('offers a MIDI built from the transcribed stems', () => {
    const props = renderPanel({ job: { ...done, midi: ['bass', 'drums'] } });
    const midi = screen.getByRole('button', { name: 'MIDI desde stems' });
    expect(midi).toHaveAttribute('title', 'Incluye las pistas transcritas: Bajo, Batería');
    fireEvent.click(midi);
    expect(props.onDownloadMidi).toHaveBeenCalledTimes(1);
  });

  it('reports a failure and allows retrying', () => {
    const props = renderPanel({ error: 'demucs exited with code 1' });
    expect(screen.getByRole('alert')).toHaveTextContent(/demucs exited/);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });
});
