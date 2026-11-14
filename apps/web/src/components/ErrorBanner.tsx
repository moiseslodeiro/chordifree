import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n';

const TOAST_DURATION_MS = 5_000;
let toastRoot: HTMLElement | null = null;

function getToastRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  if (!toastRoot?.isConnected) {
    toastRoot = document.createElement('div');
    toastRoot.className = 'toast-viewport';
    toastRoot.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastRoot);
  }
  return toastRoot;
}

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
              <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink3">
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

export function NoticeBanner({ message, tone = 'info', onDismiss }: NoticeBannerProps) {
  const t = useT();
  const dismissRef = useRef(onDismiss);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    setVisible(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
      dismissRef.current?.();
    }, TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  const root = getToastRoot();
  if (!visible || !root) return null;

  const dismiss = () => {
    setVisible(false);
    dismissRef.current?.();
  };

  return createPortal(
    <div role="status" className={`toast toast-${tone}`}>
      <NoticeIcon tone={tone} />
      <span className="min-w-0 flex-1">{message}</span>
      <button
        type="button"
        className="toast-close"
        aria-label={t('common.close')}
        onClick={dismiss}
      >
        ×
      </button>
    </div>,
    root,
  );
}
