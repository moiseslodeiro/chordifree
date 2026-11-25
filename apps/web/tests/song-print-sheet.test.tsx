import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SongPrintSheet } from '../src/components/SongPrintSheet';
import type { Song } from '../src/types';

const song: Song = {
  id: 'song-1',
  title: 'Demo sincronizada',
  source: { type: 'youtube', videoId: 'dQw4w9WgXcQ' },
  duration: 65,
  segments: [],
  detectedSegments: [],
  analyzerVersion: 'test',
  transpose: 0,
  notation: 'spanish',
  accidentalPreference: 'sharp',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  lyrics: 'Primera línea',
  lyricChordOffsets: { 0: 0.5 },
};

describe('SongPrintSheet', () => {
  it('prints metadata, lyrics, chords and the app version', () => {
    render(
      <SongPrintSheet
        song={song}
        keyLabel="Sol mayor"
        capo={2}
        capoAvailable
        bpm={120}
        printLyrics={[
          {
            index: 0,
            text: 'Primera línea',
            start: 0,
            end: 4,
            spans: [{ start: 0, end: 4 }],
            anchor: null,
            chords: [{ time: 0, end: 4, segmentIndex: 0, offset: 0, label: 'Sol' }],
          },
        ]}
        printRows={[{ time: '00:08', chord: 'Sol', degree: 'I' }]}
      />,
    );

    const sheet = screen.getByTestId('print-sheet');
    expect(sheet).toHaveTextContent('Demo sincronizada');
    expect(sheet).toHaveTextContent('Sol mayor');
    expect(sheet).toHaveTextContent('Capo 2');
    expect(sheet).toHaveTextContent('120 BPM');
    expect(sheet).toHaveTextContent('01:05');
    expect(sheet).toHaveTextContent('Primera línea');
    expect(sheet).toHaveTextContent('Sol');
    expect(sheet).toHaveTextContent('I');
    expect(sheet).toHaveTextContent('00:08');
    expect(sheet).toHaveTextContent(/v\d+\.\d+\.\d+/);
  });

  it('omits the lyrics section when the song has none', () => {
    render(
      <SongPrintSheet
        song={{ ...song, lyrics: '' }}
        keyLabel="Sol mayor"
        capo={0}
        capoAvailable
        bpm={null}
        printLyrics={[]}
        printRows={[]}
      />,
    );

    expect(screen.queryByText('Letra y acordes')).not.toBeInTheDocument();
  });
});
