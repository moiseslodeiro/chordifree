import { useState, type ReactNode } from 'react';
import { useT } from '../i18n';
import { useIsMobile } from '../hooks/useIsMobile';

interface PracticePanelProps {
  children: ReactNode;
  onOpenChange?: (open: boolean) => void;
}

/**
 * One disclosure for the practice controls. Open on desktop, collapsed on
 * mobile so the timeline stays within reach.
 */
export function PracticePanel({ children, onOpenChange }: PracticePanelProps) {
  const t = useT();
  const mobile = useIsMobile();
  const [open, setOpen] = useState(!mobile);

  return (
    <details
      className="practice-panel overflow-hidden rounded-xl border border-line bg-panel shadow-sm"
      open={open}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        setOpen(next);
        onOpenChange?.(next);
      }}
    >
      <summary
        data-testid="practice-summary"
        className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-5"
      >
        <span className="font-display text-base font-bold leading-none text-ink">
          {t('practice.eyebrow')}
        </span>
        <span className="eyebrow">{t('practice.summary')}</span>
      </summary>
      <div className="space-y-3 border-t border-line px-4 py-4 sm:px-5">{children}</div>
    </details>
  );
}
