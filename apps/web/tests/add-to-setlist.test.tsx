import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddToSetlistDialog } from '../src/components/AddToSetlistDialog';
import type { Setlist } from '../src/types';

function setlist(id: string, name: string, songIds: string[] = []): Setlist {
  return {
    id,
    name,
    songIds,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function renderDialog(overrides: Partial<Parameters<typeof AddToSetlistDialog>[0]> = {}) {
  const onAdd = vi.fn();
  const onCreate = vi.fn();
  const onClose = vi.fn();
  render(
    <AddToSetlistDialog
      songId="song-1"
      songTitle="Demo"
      setlists={[setlist('a', 'Favoritas'), setlist('b', 'Ensayo')]}
      onAdd={onAdd}
      onCreate={onCreate}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onAdd, onCreate, onClose };
}

describe('AddToSetlistDialog', () => {
  it('adds the song to an existing setlist', () => {
    const { onAdd, onClose } = renderDialog();
    const dialog = screen.getByRole('dialog', { name: 'Añadir a una lista' });
    fireEvent.click(within(dialog).getByRole('button', { name: /Ensayo/ }));

    expect(onAdd).toHaveBeenCalledWith('b');
    expect(onClose).toHaveBeenCalled();
  });

  it('creates a setlist and adds the song', () => {
    const { onCreate, onClose } = renderDialog();
    fireEvent.change(screen.getByLabelText('O crea una nueva'), {
      target: { value: 'Directo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear y añadir' }));

    expect(onCreate).toHaveBeenCalledWith('Directo');
    expect(onClose).toHaveBeenCalled();
  });

  it('marks setlists that already contain the song', () => {
    renderDialog({ setlists: [setlist('a', 'Favoritas', ['song-1']), setlist('b', 'Ensayo')] });
    expect(screen.getByRole('button', { name: /Favoritas/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Ya está/ })).toBeDisabled();
  });

  it('offers to create the first setlist', () => {
    renderDialog({ setlists: [] });
    expect(screen.getByText('Todavía no tienes listas. Crea una abajo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear y añadir' })).toBeDisabled();
  });
});
