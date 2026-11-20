import { useT } from '../i18n';
import type { MessageKey } from '../i18n/messages';
import type { StemInstallStep, StemSetupStatus } from '../lib/api';

interface StemsSetupProps {
  setup: StemSetupStatus;
  busy: boolean;
  available: boolean;
  onInstall: () => void;
  onCancel: () => void;
  onRefresh: () => void;
  onUninstall: () => void;
}

const STEP_KEYS: Record<StemInstallStep, MessageKey> = {
  python: 'stemsSetup.stepPython',
  files: 'stemsSetup.stepFiles',
  venv: 'stemsSetup.stepVenv',
  pip: 'stemsSetup.stepPip',
  verify: 'stemsSetup.stepVerify',
  done: 'stemsSetup.stepDone',
};

/**
 * Local plugin installer. It is only rendered when the server exposes a
 * managed setup directory (desktop and local installs), never on the hosted
 * instance.
 */
export function StemsSetup({
  setup,
  busy,
  available,
  onInstall,
  onCancel,
  onRefresh,
  onUninstall,
}: StemsSetupProps) {
  const t = useT();
  const job = setup.job;
  const running = job?.status === 'running';
  const failed = job?.status === 'error';
  const cancelled = job?.status === 'cancelled';
  const done = job?.status === 'done';
  const progress = Math.max(0, Math.min(100, job?.progress ?? 0));

  return (
    <section
      className="rounded-2xl border border-line bg-panel p-6 shadow-lg sm:p-8"
      aria-label={t('stemsSetup.title')}
      data-testid="stems-setup"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{t('stemsSetup.eyebrow')}</p>
          <h2 className="display mt-2 text-2xl">{t('stemsSetup.title')}</h2>
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-ink2">
            {t('stemsSetup.description')}
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onRefresh} disabled={busy}>
          {t('stemsSetup.refresh')}
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-panel-2/40 px-3 py-2 text-xs">
        <span
          aria-hidden="true"
          className={`inline-block size-2 rounded-full ${setup.python ? 'bg-positive' : 'bg-warning'}`}
        />
        {setup.python ? (
          <span className="text-ink2">
            {t('stemsSetup.pythonFound', {
              version: setup.python.version,
              command: setup.python.command,
            })}
          </span>
        ) : (
          <span className="text-ink2">
            {t('stemsSetup.pythonMissing')}{' '}
            <a
              className="link"
              href="https://www.python.org/downloads/"
              target="_blank"
              rel="noopener noreferrer"
            >
              python.org
            </a>
          </span>
        )}
        {setup.pluginDir ? (
          <span className="ml-auto font-mono text-[0.6rem] uppercase tracking-[0.08em] text-ink3">
            {setup.pluginDir}
          </span>
        ) : null}
      </div>

      {running ? (
        <div className="mt-5 space-y-3" role="status" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium text-ink">{t(STEP_KEYS[job?.step ?? 'python'])}</span>
            <span className="font-mono text-xs tabular-nums text-ink3">{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-ink2">{job?.message}</p>
          {job?.detail ? (
            <p className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[0.62rem] text-ink3">
              {job.detail}
            </p>
          ) : null}
          <button type="button" className="btn min-h-0 px-3 py-1.5 text-xs" onClick={onCancel}>
            {t('stemsSetup.cancel')}
          </button>
        </div>
      ) : done || setup.installed ? (
        <div className="mt-5 space-y-3">
          <p className="note note-success text-sm" role="status">
            {t('stemsSetup.installed')}
          </p>
          <p className="text-xs leading-relaxed text-ink2">
            {available ? t('stemsSetup.installedHint') : t('stemsSetup.notResponding')}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn min-h-0 px-3 py-1.5 text-xs" onClick={onRefresh}>
              {t('stemsSetup.refresh')}
            </button>
            {setup.managed ? (
              <button
                type="button"
                className="btn btn-danger min-h-0 px-3 py-1.5 text-xs"
                onClick={onUninstall}
                disabled={busy}
              >
                {t('stemsSetup.uninstall')}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {failed || cancelled || setup.error ? (
            <p className="note note-warning text-xs leading-relaxed" role="alert">
              {failed
                ? t('stemsSetup.failed', {
                    message: job?.error?.message ?? job?.message ?? '',
                  })
                : t('stemsSetup.retryHint')}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-primary min-h-0 px-4 py-2 text-sm"
              onClick={onInstall}
              disabled={busy || !setup.python || running}
            >
              {busy ? t('stemsSetup.starting') : t('stemsSetup.install')}
            </button>
            <span className="text-xs text-ink3">{t('stemsSetup.size')}</span>
          </div>
        </div>
      )}

      <p className="mt-5 border-t border-line pt-4 text-[0.65rem] leading-relaxed text-ink3">
        {t('stemsSetup.privacy')}
      </p>
    </section>
  );
}
