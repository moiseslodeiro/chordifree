import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionMenu } from '../src/components/ActionMenu';

describe('ActionMenu', () => {
  it('abre el menú y ejecuta una acción', () => {
    const onSelect = vi.fn();
    render(
      <ActionMenu
        label="Más acciones"
        items={[
          { label: 'Compartir', onSelect },
          { label: 'Deshabilitada', onSelect: vi.fn(), disabled: true },
        ]}
      />,
    );

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Más acciones/ }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Deshabilitada' })).toBeDisabled();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Compartir' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('cierra con Escape', () => {
    render(<ActionMenu label="Más acciones" items={[{ label: 'Una', onSelect: vi.fn() }]} />);
    fireEvent.click(screen.getByRole('button', { name: /Más acciones/ }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
