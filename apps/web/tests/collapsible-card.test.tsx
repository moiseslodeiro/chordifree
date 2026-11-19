import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CollapsibleCard } from '../src/components/CollapsibleCard';

describe('CollapsibleCard', () => {
  it('starts collapsed, shows [+], and expands with [-]', () => {
    render(
      <CollapsibleCard title="Secciones" meta="3 secciones" testId="card">
        <p>contenido</p>
      </CollapsibleCard>,
    );

    expect(screen.getByText('[+]')).toBeInTheDocument();
    expect(screen.queryByText('contenido')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: /Secciones/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(screen.getByText('contenido')).toBeInTheDocument();
    expect(screen.getByText('[-]')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens by default and keeps header actions outside the toggle', () => {
    const action = vi.fn();
    render(
      <CollapsibleCard
        title="Colaboración"
        defaultOpen
        actions={
          <button type="button" onClick={action}>
            Copiar enlace
          </button>
        }
      >
        <p>contenido</p>
      </CollapsibleCard>,
    );

    expect(screen.getByText('contenido')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace' }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.getByText('contenido')).toBeInTheDocument();
  });
});
