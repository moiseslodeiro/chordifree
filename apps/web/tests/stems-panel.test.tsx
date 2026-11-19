import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../src/i18n';
import { StemsPanel } from '../src/components/StemsPanel';
import type { StemJobView, StemsStatus } from '../src/lib/api';

const available: StemsStatus = {
  available: true,
  name: 'demucs-2stems',
  version: '4.0.1',
  stems: ['vocals', 'no_vocals'],
};

const done: StemJobView = {
  id: 'job-1',
  videoId: 'dQw4w9WgXcQ',
  status: 'done',
  stems: ['vocals', 'no_vocals'],
  createdAt: '2026-11-19T10:00:00.000Z',
  updatedAt: '2026-11-19T10:02:00.000Z',
};

function renderPanel(overrides: Partial<Parameters<typeof StemsPanel>[0]> = {}) {
  const props = {
    status: available,
    job: null,
    busy: false,
    error: null,
    selected: null,
    loadingStem: null,
    onSeparate: vi.fn(),
    onSelect: vi.fn(),
    onDownload: vi.fn(),
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

  it('starts the separation', () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Separar pistas' }));
    expect(props.onSeparate).toHaveBeenCalledTimes(1);
  });

  it('shows the progress while the plugin works', () => {
    renderPanel({ job: { ...done, status: 'processing', stems: [] }, busy: true });
    expect(screen.getByText(/Separando/)).toBeInTheDocument();
  });

  it('plays and downloads a finished stem', () => {
    const props = renderPanel({ job: done, selected: 'no_vocals' });
    expect(screen.getByRole('button', { name: 'Original' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Instrumental' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Voz' }));
    expect(props.onSelect).toHaveBeenCalledWith('vocals');

    fireEvent.click(screen.getByRole('button', { name: 'Descargar Instrumental' }));
    expect(props.onDownload).toHaveBeenCalledWith('no_vocals');
  });

  it('reports a failure and allows retrying', () => {
    const props = renderPanel({ error: 'demucs exited with code 1' });
    expect(screen.getByRole('alert')).toHaveTextContent(/demucs exited/);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });
});
