import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import {
  MAX_SHARE_URL,
  buildShareMessage,
  buildShareUrl,
  canShareLinks,
  emailShareUrl,
  encodeSongForShare,
  telegramShareUrl,
  whatsappShareUrl,
} from '../lib/share';
import { downloadSong } from '../storage/backup';
import type { Song } from '../types';
import { NoticeBanner } from './ErrorBanner';

type ShareTarget = 'whatsapp' | 'telegram' | 'email';
export type ShareNotice = { message: string; tone: 'success' | 'warning' };

interface SongShareDialogProps {
  song: Song;
  getChordPro: () => string;
  notice: ShareNotice | null;
  onNotice: (notice: ShareNotice | null) => void;
  onClose: () => void;
}

/**
 * Share sheet for the current song: quick links, clipboard, JSON file,
 * share link and the native share API. It traps focus while open.
 */
export function SongShareDialog({
  song,
  getChordPro,
  notice,
  onNotice,
  onClose,
}: SongShareDialogProps) {
  const t = useT();
  const [shareLink, setShareLink] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => element.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (!canShareLinks()) {
      setShareLink(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const token = await encodeSongForShare(song);
        const url = buildShareUrl(token);
        if (!cancelled) setShareLink(url.length <= MAX_SHARE_URL ? url : null);
      } catch {
        if (!cancelled) setShareLink(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [song]);

  const copyChordSheet = async () => {
    try {
      await navigator.clipboard.writeText(getChordPro());
      onNotice({ message: t('share.copySheetDone'), tone: 'success' });
    } catch {
      onNotice({ message: t('share.failed'), tone: 'warning' });
    }
  };

  const downloadShareFile = () => {
    downloadSong(song);
    onNotice({ message: t('share.fileDone'), tone: 'success' });
  };

  const copyShareLink = async () => {
    if (!shareLink) {
      onNotice({ message: t('share.tooLong'), tone: 'warning' });
      return;
    }
    try {
      await navigator.clipboard.writeText(shareLink);
      onNotice({ message: t('share.linkDone'), tone: 'success' });
    } catch {
      onNotice({ message: t('share.failed'), tone: 'warning' });
    }
  };

  const shareTo = (target: ShareTarget) => {
    const message = buildShareMessage(song.title, getChordPro(), shareLink);
    if (target === 'email') {
      window.location.href = emailShareUrl(song.title, message);
      return;
    }
    const url =
      target === 'whatsapp' ? whatsappShareUrl(message) : telegramShareUrl(message, shareLink);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const nativeShare = async () => {
    if (typeof navigator.share !== 'function') return;
    try {
      await navigator.share({ title: song.title, text: getChordPro() });
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return;
      onNotice({ message: t('share.failed'), tone: 'warning' });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 px-4 pb-10 pt-[10vh]"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="mx-auto w-full max-w-lg rounded-2xl border border-line bg-panel p-6 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{t('share.eyebrow')}</p>
            <h2 id="share-title" className="display mt-2 text-2xl">
              {t('share.title')}
            </h2>
          </div>
          <button ref={closeRef} type="button" className="btn btn-ghost" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>

        {notice ? (
          <NoticeBanner
            message={notice.message}
            tone={notice.tone}
            onDismiss={() => onNotice(null)}
          />
        ) : null}

        <div className="mt-6 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-ink">{t('share.quickTitle')}</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink3">{t('share.quickBody')}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <button type="button" className="btn" onClick={() => shareTo('whatsapp')}>
                {t('share.whatsapp')}
              </button>
              <button type="button" className="btn" onClick={() => shareTo('telegram')}>
                {t('share.telegram')}
              </button>
              <button type="button" className="btn" onClick={() => shareTo('email')}>
                {t('share.email')}
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink3">{t('share.quickNote')}</p>
          </div>

          <div className="border-t border-line pt-5">
            <h3 className="text-sm font-semibold text-ink">{t('share.copySheetTitle')}</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink3">{t('share.copySheetBody')}</p>
            <button type="button" className="btn mt-3" onClick={() => void copyChordSheet()}>
              {t('share.copySheetAction')}
            </button>
          </div>

          <div className="border-t border-line pt-5">
            <h3 className="text-sm font-semibold text-ink">{t('share.fileTitle')}</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink3">{t('share.fileBody')}</p>
            <button type="button" className="btn mt-3" onClick={downloadShareFile}>
              {t('share.fileAction')}
            </button>
          </div>

          {canShareLinks() ? (
            <div className="border-t border-line pt-5">
              <h3 className="text-sm font-semibold text-ink">{t('share.linkTitle')}</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink3">{t('share.linkBody')}</p>
              <button type="button" className="btn mt-3" onClick={() => void copyShareLink()}>
                {t('share.linkAction')}
              </button>
            </div>
          ) : (
            <p className="border-t border-line pt-5 text-xs leading-relaxed text-ink3">
              {t('share.linkUnavailable')}
            </p>
          )}

          {typeof navigator.share === 'function' ? (
            <div className="border-t border-line pt-5">
              <button type="button" className="btn" onClick={() => void nativeShare()}>
                {t('share.native')}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
