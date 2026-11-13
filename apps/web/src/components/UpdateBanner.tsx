import { useT } from '../i18n';

interface UpdateBannerProps {
  version: string;
  onDownload: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({ version, onDownload, onDismiss }: UpdateBannerProps) {
  const t = useT();
  return (
    <div
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm"
      role="status"
    >
      <p className="text-ink">{t('update.available', { version })}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary min-h-0 px-3 py-1.5" onClick={onDownload}>
          {t('update.download')}
        </button>
        <button type="button" className="btn btn-ghost min-h-0 px-3 py-1.5" onClick={onDismiss}>
          {t('update.dismiss')}
        </button>
      </div>
    </div>
  );
}
