import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../src/i18n';
import { AudioControls } from '../src/components/AudioControls';
import { FakePlayerAdapter } from '../src/player/fake';

function setup(overrides: Partial<Parameters<typeof AudioControls>[0]> = {}) {
  const adapter = new FakePlayerAdapter(0, false);
  const props = {
    adapter,
    rate: 1,
    onRateChange: vi.fn((value: number) => adapter.setPlaybackRate(value)),
    pitch: 0,
    onPitchChange: vi.fn(),
    pitchAvailable: true,
    karaoke: false,
    onKaraokeChange: vi.fn(),
    karaokeAvailable: true,
    ...overrides,
  };
  render(<AudioControls {...props} />);
  return { adapter, props };
}

describe('AudioControls', () => {
  it('changes the playback rate and applies it to the adapter', () => {
    const { adapter } = setup();
    const select = screen.getByRole('combobox', { name: 'Velocidad de reproducción' });
    expect(adapter.getPlaybackRate()).toBe(1);

    fireEvent.change(select, { target: { value: '0.75' } });
    expect(adapter.getPlaybackRate()).toBe(0.75);
  });

  it('reports pitch and karaoke changes', () => {
    const { props } = setup();
    fireEvent.change(screen.getByRole('combobox', { name: 'Tono del audio en semitonos' }), {
      target: { value: '2' },
    });
    expect(props.onPitchChange).toHaveBeenCalledWith(2);

    const karaoke = screen.getByRole('button', { name: 'Karaoke' });
    expect(karaoke).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(karaoke);
    expect(props.onKaraokeChange).toHaveBeenCalledWith(true);
  });

  it('hides karaoke when the player cannot process it', () => {
    setup({ karaokeAvailable: false });
    expect(screen.queryByRole('button', { name: 'Karaoke' })).not.toBeInTheDocument();
  });

  it('renders the stems block in the audio card', () => {
    setLanguage('es');
    render(
      <AudioControls
        adapter={null}
        rate={1}
        onRateChange={vi.fn()}
        pitch={0}
        onPitchChange={vi.fn()}
        pitchAvailable={false}
        karaoke={false}
        onKaraokeChange={vi.fn()}
        karaokeAvailable={false}
      >
        <p>stems block</p>
      </AudioControls>,
    );
    expect(screen.getByText('stems block')).toBeInTheDocument();
  });
});
