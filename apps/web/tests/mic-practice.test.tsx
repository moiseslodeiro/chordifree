import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../src/i18n';
import { MicPractice } from '../src/components/MicPractice';

const cMajor = { root: 0, quality: 'major' } as const;

describe('MicPractice', () => {
  beforeEach(() => {
    setLanguage('en');
  });

  it('shows the target, the detected chord and the green hit state', () => {
    render(
      <MicPractice
        status="listening"
        target={cMajor}
        detected={cMajor}
        hit
        hitCount={2}
        totalChords={4}
        notation="english"
        accidental="sharp"
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByText('Listening')).toBeInTheDocument();
    expect(screen.getByText('Detected: C')).toBeInTheDocument();
    expect(screen.getByText('✓ Correct')).toBeInTheDocument();
    expect(screen.getByText('2 of 4 chords')).toBeInTheDocument();
  });

  it('explains a denied permission and allows resetting hits', () => {
    const onReset = vi.fn();
    render(
      <MicPractice
        status="denied"
        target={null}
        detected={null}
        hit={false}
        hitCount={1}
        totalChords={4}
        notation="english"
        accidental="sharp"
        onReset={onReset}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/Allow microphone access/);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
