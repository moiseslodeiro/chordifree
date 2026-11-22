import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../src/i18n';
import { SectionsPanel } from '../src/components/SectionsPanel';
import type { SongSection } from '../src/types';

const sections: SongSection[] = [
  { label: 'intro', start: 0, end: 16 },
  { label: 'verse', start: 16, end: 40 },
  { label: 'chorus', start: 40, end: 64 },
];

describe('SectionsPanel', () => {
  beforeEach(() => setLanguage('es'));

  it('lists the sections, highlights the active one and seeks on click', () => {
    const onSeek = vi.fn();
    render(
      <SectionsPanel sections={sections} currentTime={45} onSeek={onSeek} onChange={vi.fn()} />,
    );
    fireEvent.click(screen.getByText('Secciones'));

    expect(screen.getByText('Intro')).toBeInTheDocument();
    expect(screen.getByText('Estrofa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Estribillo · 00:40' })).toBeInTheDocument();

    const active = screen.getByRole('button', { name: 'Estribillo · 00:40' });
    expect(active).toHaveAttribute('aria-current');

    fireEvent.click(screen.getByRole('button', { name: 'Estrofa · 00:16' }));
    expect(onSeek).toHaveBeenCalledWith(16);
  });

  it('renames a section through the editor', () => {
    const onChange = vi.fn();
    render(
      <SectionsPanel sections={sections} currentTime={0} onSeek={vi.fn()} onChange={onChange} />,
    );
    fireEvent.click(screen.getByText('Secciones'));

    fireEvent.click(screen.getByRole('button', { name: 'Renombrar sección: Estrofa' }));
    const input = screen.getByPlaceholderText('Nombre de la sección');
    fireEvent.change(input, { target: { value: 'Puente' } });
    fireEvent.submit(input.closest('form')!);

    expect(onChange).toHaveBeenCalledWith([
      { label: 'intro', start: 0, end: 16 },
      { label: 'Puente', start: 16, end: 40 },
      { label: 'chorus', start: 40, end: 64 },
    ]);
  });

  it('removes a section from the editor', () => {
    const onChange = vi.fn();
    render(
      <SectionsPanel sections={sections} currentTime={0} onSeek={vi.fn()} onChange={onChange} />,
    );
    fireEvent.click(screen.getByText('Secciones'));

    fireEvent.click(screen.getByRole('button', { name: 'Renombrar sección: Intro' }));
    fireEvent.click(screen.getByRole('button', { name: '✕' }));

    expect(onChange).toHaveBeenCalledWith([
      { label: 'verse', start: 16, end: 40 },
      { label: 'chorus', start: 40, end: 64 },
    ]);
  });

  it('jumps with the previous and next buttons', () => {
    const onSeek = vi.fn();
    render(
      <SectionsPanel sections={sections} currentTime={20} onSeek={onSeek} onChange={vi.fn()} />,
    );
    fireEvent.click(screen.getByText('Secciones'));

    fireEvent.click(screen.getByRole('button', { name: 'Sección siguiente' }));
    expect(onSeek).toHaveBeenLastCalledWith(40);

    // Inside the verse, previous restarts the verse itself.
    fireEvent.click(screen.getByRole('button', { name: 'Sección anterior' }));
    expect(onSeek).toHaveBeenLastCalledWith(16);
  });
});
