import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionMenu } from '../src/components/ActionMenu';

describe('ActionMenu', () => {
  it('opens the menu and runs an action', () => {
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

  it('closes with Escape and returns focus to the trigger', async () => {
    render(<ActionMenu label="Más acciones" items={[{ label: 'Una', onSelect: vi.fn() }]} />);
    const trigger = screen.getByRole('button', { name: /Más acciones/ });
    fireEvent.click(trigger);
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('moves through items with the arrow keys', async () => {
    render(
      <ActionMenu
        label="Más acciones"
        items={[
          { label: 'Una', onSelect: vi.fn() },
          { label: 'Dos', onSelect: vi.fn() },
        ]}
      />,
    );
    const trigger = screen.getByRole('button', { name: /Más acciones/ });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const first = screen.getByRole('menuitem', { name: 'Una' });
    const second = screen.getByRole('menuitem', { name: 'Dos' });
    await waitFor(() => expect(first).toHaveFocus());
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(second).toHaveFocus();
    fireEvent.keyDown(second, { key: 'ArrowUp' });
    expect(first).toHaveFocus();
  });
});
