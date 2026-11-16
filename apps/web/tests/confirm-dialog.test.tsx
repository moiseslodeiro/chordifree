import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmProvider, useConfirm } from '../src/components/ConfirmDialog';

function Harness({ onResult }: { onResult: (value: boolean) => void }) {
  const confirm = useConfirm();
  return (
    <button
      type="button"
      onClick={() => {
        void confirm({
          title: 'Delete this?',
          description: 'This cannot be undone.',
          confirmLabel: 'Delete',
          tone: 'danger',
        }).then(onResult);
      }}
    >
      Open
    </button>
  );
}

function renderHarness() {
  const onResult = vi.fn();
  render(
    <ConfirmProvider>
      <Harness onResult={onResult} />
    </ConfirmProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  return { onResult, dialog: screen.getByRole('dialog') };
}

describe('ConfirmDialog', () => {
  it('is a native labelled modal with a safe cancel action', () => {
    const { dialog } = renderHarness();
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(dialog).toHaveAttribute('aria-describedby');
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeVisible();
  });

  it('resolves true only when the confirm action is chosen', async () => {
    const { onResult, dialog } = renderHarness();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });

  it('resolves false when the cancel action is chosen', async () => {
    const { onResult, dialog } = renderHarness();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });
});
