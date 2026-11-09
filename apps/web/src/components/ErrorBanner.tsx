import { useT } from '../i18n';

interface ErrorBannerProps {
  message: string;
  code?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, code, onRetry, onDismiss }: ErrorBannerProps) {
  const t = useT();
  return (
    <div
      role="alert"
      className="note note-danger flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="font-medium text-ink">{message}</p>
        {code ? (
          <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink3">
            {code}
          </p>
        ) : null}
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
    <div role="status" className={`flex items-center justify-between gap-3 ${TONES[tone]}`}>
      <span>{message}</span>
      {onDismiss ? (
        <button type="button" className="btn btn-ghost shrink-0" onClick={onDismiss}>
          {t('common.close')}
        </button>
      ) : null}
    </div>
  );
}
