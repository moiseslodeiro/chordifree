import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NotationControls } from '../src/components/NotationControls';

function renderControls(overrides: Partial<Parameters<typeof NotationControls>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <NotationControls
      notation="english"
      accidentalPreference="auto"
      transpose={0}
      keyLabel="C mayor"
      onChange={onChange}
      {...overrides}
    />,
  );
  return { onChange };
}

describe('NotationControls', () => {
  it('cambia entre notación inglesa y española', () => {
    const { onChange } = renderControls();
    expect(screen.getByRole('button', { name: 'Inglesa' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Española' }));
    expect(onChange).toHaveBeenCalledWith({ notation: 'spanish' });
  });

  it('sube, baja y restablece la trasposición', () => {
    const { onChange } = renderControls({ transpose: 3 });
    fireEvent.click(screen.getByRole('button', { name: 'Subir un semitono' }));
    expect(onChange).toHaveBeenCalledWith({ transpose: 4 });
    fireEvent.click(screen.getByRole('button', { name: 'Bajar un semitono' }));
    expect(onChange).toHaveBeenCalledWith({ transpose: 2 });
    fireEvent.click(screen.getByRole('button', { name: /Restablecer/ }));
    expect(onChange).toHaveBeenCalledWith({ transpose: 0 });
  });

  it('limita la trasposición al rango -11..+11', () => {
    renderControls({ transpose: 11 });
    expect(screen.getByRole('button', { name: 'Subir un semitono' })).toBeDisabled();
  });

  it('cambia la preferencia enarmónica', () => {
    const { onChange } = renderControls();
    fireEvent.change(screen.getByLabelText('Alteraciones'), { target: { value: 'flat' } });
    expect(onChange).toHaveBeenCalledWith({ accidentalPreference: 'flat' });
  });

  it('muestra la tonalidad estimada', () => {
    renderControls({ keyLabel: 'Fa mayor' });
    expect(screen.getByText('Tonalidad estimada: Fa mayor')).toBeInTheDocument();
  });
});
