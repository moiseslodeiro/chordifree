import { fireEvent, render, screen, within } from '@testing-library/react';
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
  it('toggles simplification independently from reduction', () => {
    const { onChange } = renderControls();
    const button = screen.getByRole('button', { name: 'Simplificar acordes' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledWith({ simplifyChords: true });
  });

  it('chooses the reduction level independently from simplification', () => {
    const { onChange } = renderControls();
    const group = screen.getByRole('group', { name: 'Reducción de acordes' });
    expect(within(group).getByRole('button', { name: 'Sin reducir' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(within(group).getByRole('button', { name: 'Normal' }));
    expect(onChange).toHaveBeenCalledWith({ reduceChords: true, reduceChordsMax: false });

    fireEvent.click(within(group).getByRole('button', { name: 'Máxima' }));
    expect(onChange).toHaveBeenCalledWith({ reduceChords: true, reduceChordsMax: true });

    fireEvent.click(within(group).getByRole('button', { name: 'Sin reducir' }));
    expect(onChange).toHaveBeenCalledWith({ reduceChords: false, reduceChordsMax: false });
  });

  it('reflects the active simplification and reduction chips', () => {
    renderControls({ simplifyChords: true, reduceChords: true, reduceChordsMax: true });
    expect(screen.getByRole('button', { name: 'Simplificar acordes' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Máxima' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('changes the instrument from the labeled selector', () => {
    const { onChange } = renderControls();
    const select = screen.getByLabelText('Instrumento');
    expect(select).toHaveValue('guitar');
    fireEvent.change(select, { target: { value: 'piano' } });
    expect(onChange).toHaveBeenCalledWith({ instrument: 'piano' });
  });

  it('changes the capo from the labeled selector', () => {
    const { onChange } = renderControls({ capo: 2 });
    const select = screen.getByLabelText('Capo');
    expect(select).toHaveValue('2');
    fireEvent.change(select, { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith({ capo: 5 });
  });

  it('hides the capo on piano and keeps it for string instruments', () => {
    const piano = renderControls({ instrument: 'piano', capo: 3 });
    expect(screen.queryByLabelText('Capo')).not.toBeInTheDocument();
    piano.unmount();

    renderControls({ instrument: 'ukelele', capo: 2 });
    expect(screen.getByLabelText('Capo')).toHaveValue('2');
  });

  it('announces the current simplification and reduction state', () => {
    renderControls({ simplifyChords: true, reduceChords: true, instrument: 'guitar', capo: 3 });
    expect(
      screen.getByText(
        'Simplificación activada. Reducción activada. Instrumento: Guitarra. Capo: traste 3.',
      ),
    ).toBeInTheDocument();
  });
});
