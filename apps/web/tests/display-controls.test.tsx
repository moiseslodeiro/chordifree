import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DisplayControls } from '../src/components/DisplayControls';

function renderControls(overrides: Partial<Parameters<typeof DisplayControls>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <DisplayControls
      simplifyChords={false}
      reduceChords={false}
      reduceChordsMax={false}
      instrument="guitar"
      onChange={onChange}
      {...overrides}
    />,
  );
  return { onChange };
}

describe('DisplayControls', () => {
  it('activa y desactiva la simplificación con un botón operable', () => {
    const { onChange } = renderControls();
    const button = screen.getByRole('button', { name: /Simplificar acordes/ });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledWith({ simplifyChords: true });
  });

  it('activa y desactiva la reducción de forma independiente', () => {
    const { onChange } = renderControls();
    const button = screen.getByRole('button', { name: /Reducir acordes/ });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledWith({ reduceChords: true });
  });

  it('activa la reducción máxima sobre la reducción normal', () => {
    const { onChange } = renderControls({ reduceChords: true });
    const button = screen.getByRole('button', { name: 'Reducir al máximo' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledWith({ reduceChords: true, reduceChordsMax: true });
  });

  it('desactiva también la reducción máxima al apagar la reducción', () => {
    const { onChange } = renderControls({ reduceChords: true, reduceChordsMax: true });
    fireEvent.click(screen.getByRole('button', { name: /Reducir acordes/ }));
    expect(onChange).toHaveBeenCalledWith({ reduceChords: false, reduceChordsMax: false });
  });

  it('cambia el instrumento desde el selector etiquetado', () => {
    const { onChange } = renderControls();
    const select = screen.getByLabelText('Instrumento');
    expect(select).toHaveValue('guitar');
    fireEvent.change(select, { target: { value: 'piano' } });
    expect(onChange).toHaveBeenCalledWith({ instrument: 'piano' });
  });

  it('anuncia el estado actual de simplificación y reducción', () => {
    renderControls({ simplifyChords: true, reduceChords: true, instrument: 'piano' });
    expect(
      screen.getByText('Simplificación activada. Reducción activada. Instrumento: Piano.'),
    ).toBeInTheDocument();
  });
});
