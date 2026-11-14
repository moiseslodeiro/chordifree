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
      onChange={onChange}
      {...overrides}
    />,
  );
  return { onChange };
}

describe('NotationControls', () => {
  it('switches between English and Spanish notation', () => {
    const { onChange } = renderControls();
    expect(screen.getByRole('button', { name: 'Inglesa' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Española' }));
    expect(onChange).toHaveBeenCalledWith({ notation: 'spanish' });
  });

  it('raises, lowers and resets the transposition', () => {
    const { onChange } = renderControls({ transpose: 3 });
    fireEvent.click(screen.getByRole('button', { name: 'Subir un semitono' }));
    expect(onChange).toHaveBeenCalledWith({ transpose: 4 });
    fireEvent.click(screen.getByRole('button', { name: 'Bajar un semitono' }));
    expect(onChange).toHaveBeenCalledWith({ transpose: 2 });
    fireEvent.click(screen.getByRole('button', { name: /Restablecer/ }));
    expect(onChange).toHaveBeenCalledWith({ transpose: 0 });
  });

  it('limits transposition to the -11..+11 range', () => {
    renderControls({ transpose: 11 });
    expect(screen.getByRole('button', { name: 'Subir un semitono' })).toBeDisabled();
  });

  it('changes the enharmonic preference with symbol buttons', () => {
    const { onChange } = renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'Bemoles' }));
    expect(onChange).toHaveBeenCalledWith({ accidentalPreference: 'flat' });
    fireEvent.click(screen.getByRole('button', { name: 'Sostenidos' }));
    expect(onChange).toHaveBeenCalledWith({ accidentalPreference: 'sharp' });
    fireEvent.click(screen.getByRole('button', { name: 'Auto' }));
    expect(onChange).toHaveBeenCalledWith({ accidentalPreference: 'auto' });
  });
});
