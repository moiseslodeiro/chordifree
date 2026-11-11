import type { ReactNode } from 'react';
import { useT } from '../i18n';

type NoticeTone = 'info' | 'warning' | 'success' | 'danger';

function NoticeIcon({ tone }: { tone: NoticeTone }) {
  const paths: Record<NoticeTone, ReactNode> = {
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 10v6M12 7h.01" />
      </>
    ),
    success: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    ),
    warning: (
      <>
        <path d="M12 3 2.8 19h18.4L12 3Z" />
        <path d="M12 9v4M12 16h.01" />
      </>
    ),
    danger: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6M12 16h.01" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`note-icon note-icon-${tone}`}
    >
      {paths[tone]}
    </svg>
  );
}

interface ErrorBannerProps {
  message: string;
  code?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, code, onRetry, onDismiss }: ErrorBannerProps) {
  const t = useT();
  return (
    <div role="alert" className="note note-danger">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <NoticeIcon tone="danger" />
          <div className="min-w-0">
            <p className="font-medium text-ink">{message}</p>
            {code ? (
              <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink3">
                {code}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {onRetry ? (
            <button type="button" className="btn" onClick={onRetry}>
              {t('common.retry')}
            </button>
          ) : null}
          {onDismiss ? (
            <button type="button" className="btn btn-ghost" onClick={onDismiss}>
              {t('common.close')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface NoticeBannerProps {
  message: string;
  tone?: 'info' | 'warning' | 'success';
  onDismiss?: () => void;
}

const TONES: Record<NonNullable<NoticeBannerProps['tone']>, string> = {
  info: 'note note-info',
  warning: 'note note-warning',
  success: 'note note-success',
};

export function NoticeBanner({ message, tone = 'info', onDismiss }: NoticeBannerProps) {
  const t = useT();
  return (
    <div role="status" className={`${TONES[tone]} flex items-center gap-3`}>
      <NoticeIcon tone={tone} />
      <span className="min-w-0 flex-1">{message}</span>
      {onDismiss ? (
        <button type="button" className="btn btn-ghost shrink-0" onClick={onDismiss}>
          {t('common.close')}
        </button>
      ) : null}
    </div>
  );
}
