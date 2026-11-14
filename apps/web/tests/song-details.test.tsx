import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SongDetails } from '../src/components/SongDetails';

describe('SongDetails', () => {
  it('shows key, relative key and capo', () => {
    render(
      <SongDetails
        keyLabel="Re mayor"
        relativeKeyLabel="Si menor"
        capo={2}
        capoKeyLabel="Do mayor"
        bpm={120}
        beatsPerBar={4}
        duration={90}
        artist="Artista"
        chords={['Re', 'La']}
      />,
    );

    expect(screen.getByText('Re mayor')).toBeInTheDocument();
    expect(screen.getByText('Si menor')).toBeInTheDocument();
    expect(screen.getByText('Traste 2 · Do mayor')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
  });

  it('lets the user correct the meter', () => {
    const onChangeMeter = vi.fn();
    render(
      <SongDetails
        keyLabel="Do mayor"
        relativeKeyLabel="La menor"
        capo={0}
        capoKeyLabel="Do mayor"
        bpm={120}
        beatsPerBar={4}
        duration={90}
        artist={null}
        chords={[]}
        onChangeMeter={onChangeMeter}
      />,
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Compás' }), {
      target: { value: '3' },
    });

    expect(onChangeMeter).toHaveBeenCalledWith(3);
  });

  it('indicates when there is no capo', () => {
    render(
      <SongDetails
        keyLabel="Do mayor"
        relativeKeyLabel="La menor"
        capo={0}
        capoKeyLabel="Do mayor"
        bpm={null}
        beatsPerBar={4}
        duration={90}
        artist={null}
        chords={[]}
      />,
    );

    expect(screen.getByText('Sin capo')).toBeInTheDocument();
    expect(screen.getByText('No se detectaron acordes.')).toBeInTheDocument();
  });

  it('hides the capo when the instrument does not support it', () => {
    render(
      <SongDetails
        keyLabel="Do mayor"
        relativeKeyLabel="La menor"
        capo={0}
        capoKeyLabel="Do mayor"
        showCapo={false}
        bpm={null}
        beatsPerBar={4}
        duration={90}
        artist={null}
        chords={[]}
      />,
    );

    expect(screen.queryByText('Capo')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin capo')).not.toBeInTheDocument();
  });
});
