import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UpdateBanner } from '../src/components/UpdateBanner';

describe('UpdateBanner', () => {
  it('shows the version and allows downloading or dismissing', () => {
    const onDownload = vi.fn();
    const onDismiss = vi.fn();
    render(<UpdateBanner version="0.2.0" onDownload={onDownload} onDismiss={onDismiss} />);

    expect(screen.getByRole('status')).toHaveTextContent('Hay una nueva versión disponible: 0.2.0');

    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    expect(onDownload).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
