import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LyricsEditor } from '../src/components/LyricsEditor';
import { ApiClientError } from '../src/lib/api';

function Harness({
  initial = '',
  canDelete = true,
  canAnchor = true,
  getCurrentTime = () => 75,
  onSave = vi.fn(),
  onCancel = vi.fn(),
  onDelete = vi.fn(),
  onFindLyrics,
}: {
  initial?: string;
  canDelete?: boolean;
  canAnchor?: boolean;
  getCurrentTime?: () => number | null;
  onSave?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onFindLyrics?: () => Promise<string | null>;
}) {
  const [value, setValue] = useState(initial);
  return (
    <LyricsEditor
      value={value}
      initialValue={initial}
      canDelete={canDelete}
      canAnchor={canAnchor}
      getCurrentTime={getCurrentTime}
      onChange={setValue}
      onSave={onSave}
      onCancel={onCancel}
      onDelete={onDelete}
      {...(onFindLyrics ? { onFindLyrics } : {})}
    />
  );
}

describe('LyricsEditor', () => {
  it('shows the text, the line count and the unsaved-changes notice', () => {
    render(<Harness initial={'Uno\n\nDos'} />);

    expect(screen.getByLabelText('Letra de la canción')).toHaveValue('Uno\n\nDos');
    expect(screen.getByText('2 líneas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar letra' })).toBeDisabled();
  });

  it('allows editing and saving only when there are changes', () => {
    const onSave = vi.fn();
    render(<Harness initial="Uno" onSave={onSave} />);

    const field = screen.getByLabelText('Letra de la canción');
    fireEvent.change(field, { target: { value: 'Uno\nDos' } });

    expect(screen.getByText('2 líneas · sin guardar')).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Guardar letra' });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('cancels without saving and allows deleting when lyrics are saved', () => {
    const onCancel = vi.fn();
    const onDelete = vi.fn();
    render(<Harness initial="Uno" onCancel={onCancel} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar letra' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('hides delete when there are no previous lyrics', () => {
    render(<Harness initial="" canDelete={false} />);
    expect(screen.queryByRole('button', { name: 'Eliminar letra' })).not.toBeInTheDocument();
  });

  it('anchors the cursor line to the current time', () => {
    render(<Harness initial={'Uno\nDos'} />);

    const field = screen.getByLabelText('Letra de la canción') as HTMLTextAreaElement;
    field.setSelectionRange(5, 5);
    fireEvent.click(screen.getByRole('button', { name: 'Anclar línea' }));

    expect(field).toHaveValue('Uno\n[01:15] Dos');
  });

  it('replaces an existing anchor instead of duplicating it', () => {
    render(<Harness initial={'[00:10] Uno\nDos'} />);

    const field = screen.getByLabelText('Letra de la canción') as HTMLTextAreaElement;
    field.setSelectionRange(8, 8);
    fireEvent.click(screen.getByRole('button', { name: 'Anclar línea' }));

    expect(field).toHaveValue('[01:15] Uno\nDos');
  });

  it('anchors the first line with text to the current time', () => {
    render(<Harness initial={'\nUno\nDos'} />);

    fireEvent.click(screen.getByRole('button', { name: 'Anclar inicio' }));
    expect(screen.getByLabelText('Letra de la canción')).toHaveValue('\n[01:15] Uno\nDos');
  });

  it('fills the draft with the found lyrics without saving it', async () => {
    const onFindLyrics = vi.fn().mockResolvedValue('Nueva letra');
    const onSave = vi.fn();
    render(<Harness canDelete={false} onSave={onSave} onFindLyrics={onFindLyrics} />);

    fireEvent.click(screen.getByRole('button', { name: 'Buscar letra' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Letra de la canción')).toHaveValue('Nueva letra'),
    );
    expect(onFindLyrics).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows a notice when there are no lyrics or the provider fails', async () => {
    const notFound = vi
      .fn()
      .mockRejectedValue(new ApiClientError('LYRICS_NOT_FOUND', 'No lyrics', 404));
    render(<Harness canDelete={false} onFindLyrics={notFound} />);

    fireEvent.click(screen.getByRole('button', { name: 'Buscar letra' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'No se encontró la letra de esta canción.',
    );

    const failure = vi.fn().mockRejectedValue(new Error('offline'));
    render(<Harness canDelete={false} onFindLyrics={failure} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Buscar letra' })[1]!);
    expect(await screen.findByText('No se pudo obtener la letra. Inténtalo más tarde.')).toBeInTheDocument();
  });

  it('disables anchoring without a player', () => {
    render(<Harness canAnchor={false} />);
    expect(screen.getByRole('button', { name: 'Anclar línea' })).toBeDisabled();
  });
});
