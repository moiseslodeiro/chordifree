import { useId, useState, type ReactNode } from 'react';

interface CollapsibleCardProps {
  title: string;
  /** Short status shown next to the title (active section, plugin name…). */
  meta?: ReactNode;
  /** Controls that stay outside the toggle button (they can contain buttons). */
  actions?: ReactNode;
  defaultOpen?: boolean;
  testId?: string;
  children: ReactNode;
}

/**
 * Card with a [+]/[-] disclosure. Kept as a plain component instead of
 * `<details>` so the marker is identical in every browser and the card can
 * carry header actions.
 */
export function CollapsibleCard({
  title,
  meta,
  actions,
  defaultOpen = false,
  testId,
  children,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section
      className="overflow-hidden rounded-xl border border-line bg-panel shadow-sm"
      aria-label={title}
      data-testid={testId}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="font-mono text-[0.62rem] font-medium uppercase tracking-[0.16em] text-ink3">
            {title}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            {meta ? <span className="truncate text-[0.68rem] text-ink3">{meta}</span> : null}
            <span className="collapsible-marker" aria-hidden="true">
              {open ? '[-]' : '[+]'}
            </span>
          </span>
        </button>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
      {open ? (
        <div id={panelId} className="border-t border-line">
          {children}
        </div>
      ) : null}
    </section>
  );
}
