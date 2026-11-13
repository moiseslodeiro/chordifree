import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseChord, type ChordSegment } from '@chordifree/chords';
import { EditorPanel } from '../src/components/EditorPanel';
import type { Song } from '../src/types';

const segments: ChordSegment[] = [
  { start: 0, end: 4, chord: parseChord('C') },
  { start: 4, end: 8, chord: parseChord('G') },
];

function song(overrides: Partial<Song> = {}): Song {
  return {
    id: 'song-1',
    title: 'Demo',
    source: { type: 'youtube', videoId: 'dQw4w9WgXcQ' },
    duration: 8,
    segments,
    detectedSegments: segments,
    analyzerVersion: 'essentia-1.0',
    transpose: 0,
    notation: 'english',
    accidentalPreference: 'auto',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderEditor(overrides: Partial<Song> = {}) {
  const onSave = vi.fn();
  const onDiscard = vi.fn();
  render(
    <EditorPanel
      song={song(overrides)}
      notation="english"
      accidental="sharp"
      onSave={onSave}
      onDiscard={onDiscard}
    />,
  );
  return { onSave, onDiscard };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EditorPanel', () => {
  it('changes a chord and saves the result', () => {
    const { onSave } = renderEditor();
    const fields = screen.getAllByLabelText('Acorde del segmento');
    fireEvent.change(fields[0]!, { target: { value: 'A7' } });
    fireEvent.blur(fields[0]!);

    expect(screen.getAllByLabelText('Acorde del segmento')[0]).toHaveValue('A7');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    const saved = onSave.mock.calls[0]?.[0] as ChordSegment[];
    expect(saved[0]?.chord).toMatchObject({ root: 9, quality: '7' });
    expect(saved[1]?.chord).toMatchObject({ root: 7 });
  });

  it('rejects H7 and keeps the previous chord', () => {
    const { onSave } = renderEditor();
    const field = screen.getAllByLabelText('Acorde del segmento')[0]!;
    fireEvent.change(field, { target: { value: 'H7' } });
    fireEvent.blur(field);

    expect(screen.getByText(/Acorde no reconocido: H7/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const saved = onSave.mock.calls[0]?.[0] as ChordSegment[];
    expect(saved[0]?.chord).toMatchObject({ root: 0, quality: 'major' });
  });

  it('marks a segment as a rest', () => {
    const { onSave } = renderEditor();
    fireEvent.click(screen.getAllByRole('button', { name: 'Silencio' })[0]!);
    expect(screen.getAllByLabelText('Acorde del segmento')[0]).toHaveValue('—');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const saved = onSave.mock.calls[0]?.[0] as ChordSegment[];
    expect(saved[0]?.chord).toBeNull();
  });

  it('splits and merges adjacent segments again', () => {
    renderEditor();
    fireEvent.click(screen.getAllByRole('button', { name: 'Dividir' })[0]!);
    expect(screen.getAllByLabelText('Acorde del segmento')).toHaveLength(3);

    fireEvent.click(screen.getAllByRole('button', { name: 'Fusionar' })[0]!);
    expect(screen.getAllByLabelText('Acorde del segmento')).toHaveLength(2);
  });

  it('does not offer merging when there is no next segment', () => {
    renderEditor();
    const mergeButtons = screen.getAllByRole('button', { name: 'Fusionar' });
    expect(mergeButtons[0]).toBeEnabled();
    expect(mergeButtons[1]).toBeDisabled();
  });

  it('undoes and redoes changes', () => {
    renderEditor();
    const field = screen.getAllByLabelText('Acorde del segmento')[0]!;
    fireEvent.change(field, { target: { value: 'Am' } });
    fireEvent.blur(field);

    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(screen.getAllByLabelText('Acorde del segmento')[0]).toHaveValue('C');

    fireEvent.click(screen.getByRole('button', { name: 'Rehacer' }));
    expect(screen.getAllByLabelText('Acorde del segmento')[0]).toHaveValue('Am');
  });

  it('restores the original detection after confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderEditor();
    const field = screen.getAllByLabelText('Acorde del segmento')[0]!;
    fireEvent.change(field, { target: { value: 'D' } });
    fireEvent.blur(field);

    fireEvent.click(screen.getByRole('button', { name: 'Restaurar detección' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(screen.getAllByLabelText('Acorde del segmento')[0]).toHaveValue('C');
  });

  it('does not restore when confirmation is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderEditor();
    const field = screen.getAllByLabelText('Acorde del segmento')[0]!;
    fireEvent.change(field, { target: { value: 'D' } });
    fireEvent.blur(field);

    fireEvent.click(screen.getByRole('button', { name: 'Restaurar detección' }));
    expect(screen.getAllByLabelText('Acorde del segmento')[0]).toHaveValue('D');
  });

  it('discards changes and exits the editor', () => {
    const { onDiscard } = renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('edits in the original tuning when there is a transpose', () => {
    const { onSave } = renderEditor({ transpose: 2 });
    const field = screen.getAllByLabelText('Acorde del segmento')[0]!;
    expect(field).toHaveValue('D');
    fireEvent.change(field, { target: { value: 'E' } });
    fireEvent.blur(field);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    const saved = onSave.mock.calls[0]?.[0] as ChordSegment[];
    expect(saved[0]?.chord).toMatchObject({ root: 2 });
  });

  it('shows an error when attempting an invalid time range', () => {
    renderEditor();
    const endInputs = screen.getAllByLabelText(/Fin/);
    fireEvent.change(endInputs[0]!, { target: { value: '0.05' } });
    fireEvent.blur(endInputs[0]!);
    expect(screen.getByText(/demasiado corto|no puede/)).toBeInTheDocument();
  });
});
