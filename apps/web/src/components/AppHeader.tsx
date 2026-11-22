import type { AuthValue } from '../auth/AuthProvider';
import { useT } from '../i18n';
import type { Route } from '../routing';
import type { Preferences } from '../types';
import { ActionMenu } from './ActionMenu';

interface AppHeaderProps {
  auth: AuthValue;
  desktop: boolean;
  preferences: Preferences;
  nickname: string | null;
  stemsAvailable: boolean;
  onEditNickname: () => void;
  onNavigate: (route: Route) => void;
  onPreferences: (patch: Partial<Preferences>) => void;
  onDeleteCloudData: () => void;
}

export function AppHeader({
  auth,
  desktop,
  preferences,
  nickname,
  stemsAvailable,
  onEditNickname,
  onNavigate,
  onPreferences,
  onDeleteCloudData,
}: AppHeaderProps) {
  const t = useT();

  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-line pb-4 sm:items-end">
      <button
        type="button"
        className="flex flex-col items-start gap-1.5 text-left"
        onClick={() => onNavigate({ name: 'home' })}
      >
        <img src="/brand-light.png" alt="chordifree" className="brand-light h-8 w-auto sm:h-9" />
        <img src="/brand-dark.png" alt="chordifree" className="brand-dark h-8 w-auto sm:h-9" />
        <span className="hidden font-mono text-[0.56rem] uppercase leading-none tracking-[0.16em] text-ink3 sm:block sm:text-[0.62rem]">
          {t('app.tagline')}
        </span>
      </button>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {auth.mode === 'google' ? (
          <span className="badge hidden sm:inline-flex">{t('auth.eyebrow')}</span>
        ) : desktop ? null : (
          <span className="badge hidden sm:inline-flex">{t('app.localOnly')}</span>
        )}
        <button
          type="button"
          className="btn min-h-0 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.12em]"
          onClick={() => onNavigate({ name: 'library' })}
        >
          {t('nav.library')}
        </button>
        <button
          type="button"
          className="btn min-h-0 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.12em]"
          onClick={() => onNavigate({ name: 'setlists' })}
        >
          {t('nav.setlists')}
        </button>
        {stemsAvailable ? (
          <button
            type="button"
            className="btn min-h-0 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.12em]"
            onClick={() => onNavigate({ name: 'stems' })}
          >
            {t('nav.stems')}
          </button>
        ) : null}
        <div className="flex items-center gap-1" role="group" aria-label={t('app.language')}>
          <button
            type="button"
            className={preferences.language === 'en' ? 'tool-chip-active' : 'tool-chip'}
            aria-pressed={preferences.language === 'en'}
            onClick={() => onPreferences({ language: 'en' })}
          >
            EN
          </button>
          <button
            type="button"
            className={preferences.language === 'es' ? 'tool-chip-active' : 'tool-chip'}
            aria-pressed={preferences.language === 'es'}
            onClick={() => onPreferences({ language: 'es' })}
          >
            ES
          </button>
        </div>
        <button
          type="button"
          className="btn min-h-0 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.12em]"
          aria-pressed={preferences.theme === 'dark'}
          onClick={() =>
            onPreferences({
              theme: preferences.theme === 'light' ? 'dark' : 'light',
            })
          }
        >
          {preferences.theme === 'light' ? t('app.themeLight') : t('app.themeDark')}
        </button>
        {auth.mode === 'google' ? (
          <ActionMenu
            label={nickname ?? auth.user?.name ?? auth.user?.email ?? t('auth.signInTitle')}
            items={[
              ...(auth.admin
                ? [{ label: t('auth.admin'), onSelect: () => onNavigate({ name: 'admin' }) }]
                : []),
              ...(stemsAvailable
                ? [
                    {
                      label: t('stemsLibrary.manage'),
                      onSelect: () => onNavigate({ name: 'stems' }),
                    },
                  ]
                : []),
              { label: t('nickname.edit'), onSelect: onEditNickname },
              { label: t('auth.deleteData'), onSelect: onDeleteCloudData },
              { label: t('auth.signOut'), onSelect: auth.signOut },
            ]}
          />
        ) : null}
      </div>
    </header>
  );
}
