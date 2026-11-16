import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useT } from '../i18n';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm>(async () => false);

export function useConfirm(): Confirm {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const confirm = useCallback<Confirm>((next) => {
    return new Promise<boolean>((resolve) => {
      resolver.current?.(false);
      resolver.current = resolve;
      setOptions(next);
    });
  }, []);

  useEffect(() => {
    const element = dialog.current;
    if (!options || !element) return;
    if (!element.open) element.showModal();
  }, [options]);

  const finish = (accepted: boolean) => {
    const resolve = resolver.current;
    resolver.current = null;
    setOptions(null);
    resolve?.(accepted);
    dialog.current?.close(accepted ? 'confirm' : 'cancel');
  };

  const onClose = () => {
    const accepted = dialog.current?.returnValue === 'confirm';
    const resolve = resolver.current;
    resolver.current = null;
    setOptions(null);
    resolve?.(accepted);
    if (dialog.current) dialog.current.returnValue = '';
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <dialog
        ref={dialog}
        className="confirm-dialog w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-line bg-panel p-6 text-ink shadow-2xl"
        aria-labelledby={titleId}
        aria-describedby={options?.description ? descriptionId : undefined}
        onClose={onClose}
      >
        {options ? (
          <form method="dialog" onSubmit={(event) => event.preventDefault()}>
            <h2 id={titleId} className="display text-2xl">
              {options.title}
            </h2>
            {options.description ? (
              <p id={descriptionId} className="mt-3 text-sm leading-relaxed text-ink2">
                {options.description}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="submit"
                value="cancel"
                className="btn"
                autoFocus
                onClick={() => finish(false)}
              >
                {options.cancelLabel ?? t('common.cancel')}
              </button>
              <button
                type="submit"
                value="confirm"
                className={options.tone === 'danger' ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={() => finish(true)}
              >
                {options.confirmLabel ?? t('common.delete')}
              </button>
            </div>
          </form>
        ) : null}
      </dialog>
    </ConfirmContext.Provider>
  );
}
