import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DisplayControls } from '../src/components/DisplayControls';

function renderControls(overrides: Partial<Parameters<typeof DisplayControls>[0]> = {}) {
  const onChange = vi.fn();
  const view = render(
    <DisplayControls
      simplifyChords={false}
      reduceChords={false}
      reduceChordsMax={false}
      instrument="guitar"
      capo={0}
      onChange={onChange}
      {...overrides}
    />,
  );
  return { onChange, unmount: view.unmount };
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

  it('cambia el capo desde el selector etiquetado', () => {
    const { onChange } = renderControls({ capo: 2 });
    const select = screen.getByLabelText('Capo');
    expect(select).toHaveValue('2');
    fireEvent.change(select, { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith({ capo: 5 });
  });

  it('oculta el capo en piano y lo mantiene en instrumentos de cuerda', () => {
    const piano = renderControls({ instrument: 'piano', capo: 3 });
    expect(screen.queryByLabelText('Capo')).not.toBeInTheDocument();
    piano.unmount();

    renderControls({ instrument: 'ukelele', capo: 2 });
    expect(screen.getByLabelText('Capo')).toHaveValue('2');
  });

  it('anuncia el estado actual de simplificación y reducción', () => {
    renderControls({ simplifyChords: true, reduceChords: true, instrument: 'guitar', capo: 3 });
    expect(
      screen.getByText(
        'Simplificación activada. Reducción activada. Instrumento: Guitarra. Capo: traste 3.',
      ),
    ).toBeInTheDocument();
  });
});
