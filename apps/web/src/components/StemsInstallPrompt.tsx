import { useT } from '../i18n';

interface StemsInstallPromptProps {
  installed: boolean;
  onOpenSetup: () => void;
}

/**
 * Small card inside the song's Audio section when the local stems plugin is
 * not available. It links to the setup screen; the heavy install never runs
 * from the song view.
 */
export function StemsInstallPrompt({ installed, onOpenSetup }: StemsInstallPromptProps) {
  const t = useT();
  return (
    <section
      className="rounded-xl border border-dashed border-line bg-panel-2/40 p-3"
      aria-label={t('stems.installPromptTitle')}
      data-testid="stems-install-prompt"
    >
      <p className="eyebrow">{t('stems.eyebrow')}</p>
      <h2 className="mt-1 text-sm font-semibold text-ink">
        {installed ? t('stems.notRespondingTitle') : t('stems.installPromptTitle')}
      </h2>
      <p className="mt-2 text-xs leading-relaxed text-ink3">
        {installed ? t('stems.notRespondingBody') : t('stems.installPromptBody')}
      </p>
      <button type="button" className="btn mt-3 min-h-0 px-3 py-1.5 text-xs" onClick={onOpenSetup}>
        {installed ? t('stems.openSetup') : t('stems.installPromptAction')}
      </button>
    </section>
  );
}
