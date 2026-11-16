import { useT } from '../i18n';
import { useAuth } from './AuthProvider';
import { GoogleSignIn } from './GoogleSignIn';

export function AuthScreen() {
  const t = useT();
  const auth = useAuth();

  return (
    <div className="grid min-h-screen place-items-center bg-paper px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-xl sm:p-8">
        <img src="/brand-light.png" alt="Chordifree" width="328" height="54" className="h-12 w-auto" />
        <p className="eyebrow mt-6">{t('auth.eyebrow')}</p>
        <h1 className="display mt-2 text-3xl">
          {auth.status === 'denied' ? t('auth.restrictedTitle') : t('auth.signInTitle')}
        </h1>

        {auth.status === 'loading' ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-ink2" role="status">
            <span className="inline-block size-2 animate-pulse rounded-full bg-accent" aria-hidden="true" />
            {t('auth.loading')}
          </p>
        ) : null}

        {auth.status === 'signed-out' ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-ink2">{t('auth.signInBody')}</p>
            {auth.expired ? (
              <p className="note note-warning mt-4 text-sm leading-relaxed">
                {t('auth.sessionExpired')}
              </p>
            ) : null}
            <div className="mt-6">
              {auth.config?.clientId ? (
                <GoogleSignIn clientId={auth.config.clientId} onCredential={(value) => void auth.signIn(value)} />
              ) : (
                <p className="note note-warning text-sm leading-relaxed">
                  {t('auth.googleUnavailable')}
                </p>
              )}
            </div>
          </>
        ) : null}

        {auth.status === 'denied' ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-ink2">
              {t('auth.restrictedBody', { email: auth.user?.email ?? '' })}
            </p>
            <button type="button" className="btn mt-6" onClick={auth.signOut}>
              {t('auth.signOut')}
            </button>
          </>
        ) : null}

        {auth.status === 'error' ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-ink2">{t('auth.error')}</p>
            <button type="button" className="btn btn-primary mt-6" onClick={auth.retry}>
              {t('common.retry')}
            </button>
          </>
        ) : null}

        <p className="mt-8 border-t border-line pt-4 text-xs leading-relaxed text-ink3">
          {t('auth.signInBody')}
        </p>
      </div>
    </div>
  );
}
