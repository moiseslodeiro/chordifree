import { useT } from '../i18n';

interface AppFooterProps {
  desktop: boolean;
  onCheckUpdates: () => void;
}

export function AppFooter({ desktop, onCheckUpdates }: AppFooterProps) {
  const t = useT();

  return (
    <footer
      data-testid="site-footer"
      className="mt-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line pb-2 pt-4 font-mono text-[0.56rem] uppercase tracking-[0.12em] text-ink3"
    >
      <span title={t('footer.quoteTranslation')}>{t('footer.tagline')}</span>
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label={t('footer.links')}>
        {desktop ? (
          <button
            type="button"
            className="transition hover:text-accent"
            onClick={() => void onCheckUpdates()}
          >
            {t('update.check')}
          </button>
        ) : null}
        <a
          className="transition hover:text-accent"
          href="https://github.com/moiseslodeiro/chordifree"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('footer.github')}
        </a>
        <span>{`v${__APP_VERSION__}`}</span>
        <a
          className="transition hover:text-accent"
          href="https://www.gnu.org/licenses/agpl-3.0.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('footer.license')}
        </a>
        <a
          className="transition hover:text-accent"
          href="https://essentia.upf.edu/"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('footer.essentia')}
        </a>
      </nav>
    </footer>
  );
}
