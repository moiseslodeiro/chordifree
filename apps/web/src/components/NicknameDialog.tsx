import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useT } from '../i18n';

interface NicknameDialogProps {
  open: boolean;
  initial: string;
  /** First login: the user has not confirmed a nickname yet. */
  required?: boolean;
  onSave: (nickname: string) => Promise<void>;
  onClose: () => void;
}

export function NicknameDialog({
  open,
  initial,
  required = false,
  onSave,
  onClose,
}: NicknameDialogProps) {
  const t = useT();
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValue(initial);
    setError(null);
    const timer = window.setTimeout(() => inputRef.current?.select(), 50);
    return () => window.clearTimeout(timer);
  }, [initial, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !required) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, open, required]);

  if (!open) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nickname = value.trim();
    if (nickname.length < 2) {
      setError(t('nickname.tooShort'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(nickname);
      onClose();
    } catch {
      setError(t('nickname.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 px-4 pb-10 pt-[10vh]"
      role="presentation"
      onClick={(event) => {
        if (!required && event.target === event.currentTarget) onClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="nickname-title"
        className="mx-auto w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-2xl"
        onSubmit={(event) => void submit(event)}
      >
        <p className="eyebrow">{t('nickname.eyebrow')}</p>
        <h2 id="nickname-title" className="display mt-2 text-xl text-ink">
          {t('nickname.title')}
        </h2>
        <p className="mt-2 text-sm text-ink2">{t('nickname.body')}</p>

        <label className="mt-4 block text-xs font-medium text-ink2" htmlFor="nickname-input">
          {t('nickname.label')}
        </label>
        <input
          id="nickname-input"
          ref={inputRef}
          className="field mt-1 w-full"
          value={value}
          maxLength={32}
          autoComplete="nickname"
          onChange={(event) => setValue(event.target.value)}
          disabled={busy}
        />

        {error ? (
          <p className="mt-2 text-xs text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {!required ? (
            <button type="button" className="btn" onClick={onClose} disabled={busy}>
              {t('common.cancel')}
            </button>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {t('nickname.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
