import { useRef, useState } from 'react';
import { formatTime } from '@chordifree/chords';
import { useT } from '../i18n';
import { ApiClientError } from '../lib/api';
import { splitLyricLines } from '../lyrics/align';

interface LyricsEditorProps {
  value: string;
  initialValue: string;
  canDelete: boolean;
  canAnchor: boolean;
  getCurrentTime: () => number | null;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onFindLyrics?: () => Promise<string | null>;
}

const ANCHOR_PATTERN = /^\s*\[\d{1,3}:[0-5]\d\]\s?/;

export function LyricsEditor({
  value,
  initialValue,
  canDelete,
  canAnchor,
  getCurrentTime,
  onChange,
  onSave,
  onCancel,
  onDelete,
  onFindLyrics,
}: LyricsEditorProps) {
  const t = useT();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [finding, setFinding] = useState(false);
  const [findError, setFindError] = useState<string | null>(null);
  const lines = splitLyricLines(value).filter((line) => line.trim().length > 0).length;
  const dirty = value !== initialValue;

  const findLyrics = async () => {
    if (!onFindLyrics || finding) return;
    setFinding(true);
    setFindError(null);
    try {
      const lyrics = await onFindLyrics();
      if (lyrics?.trim()) onChange(lyrics);
      else setFindError(t('lyrics.notFound'));
    } catch (error) {
      setFindError(
        error instanceof ApiClientError && error.status === 404
          ? t('lyrics.notFound')
          : t('lyrics.findFailed'),
      );
    } finally {
      setFinding(false);
    }
  };

  const currentTime = () => {
    const time = getCurrentTime();
    return time !== null && Number.isFinite(time) && time >= 0 ? time : null;
  };

  const insertAnchorAt = (lineStart: number) => {
    const time = currentTime();
    if (time === null) return;
    const lineEnd = value.indexOf('\n', lineStart);
    const end = lineEnd === -1 ? value.length : lineEnd;
    const rawLine = value.slice(lineStart, end);
    const prefix = rawLine.match(ANCHOR_PATTERN)?.[0] ?? '';
    const text = rawLine.slice(prefix.length);
    const anchor = `[${formatTime(time)}] `;
    const next = value.slice(0, lineStart) + anchor + text + value.slice(end);

    onChange(next);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      const cursor = lineStart + anchor.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const anchorCurrentLine = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursor = textarea.selectionStart ?? 0;
    insertAnchorAt(value.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1);
  };

  const anchorFirstLine = () => {
    let start = 0;
    while (start <= value.length) {
      const end = value.indexOf('\n', start);
      const line = value.slice(start, end === -1 ? value.length : end);
      if (line.replace(ANCHOR_PATTERN, '').trim().length > 0) {
        insertAnchorAt(start);
        return;
      }
      if (end === -1) return;
      start = end + 1;
    }
  };

  return (
    <section
      className="rounded-xl border border-line bg-panel p-4 shadow-sm sm:p-5"
      aria-label="Editor de letra"
    >
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <p className="eyebrow">{t('lyrics.editorEyebrow')}</p>
          <h2 className="mt-1 font-display text-2xl leading-none text-ink">{t('lyrics.editorTitle')}</h2>
        </div>
        <span className="badge" aria-live="polite">
          {t('lyrics.lineCount', {
            count: lines,
            label: lines === 1 ? t('lyrics.line') : t('lyrics.lines'),
          })}
          {dirty ? ' · sin guardar' : ''}
        </span>
      </header>

      <label htmlFor="lyrics-editor" className="sr-only">
        {t('lyrics.editorLabel')}
      </label>
      <textarea
        ref={textareaRef}
        id="lyrics-editor"
        className="field mt-4 min-h-[20rem] resize-y font-sans text-sm leading-relaxed"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('lyrics.placeholder')}
        spellCheck
      />
      <p className="mt-2 text-xs leading-relaxed text-ink3">
        {t('lyrics.help')}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {onFindLyrics ? (
          <button
            type="button"
            className="btn"
            onClick={() => void findLyrics()}
            disabled={finding}
          >
            {finding ? t('lyrics.finding') : t('lyrics.find')}
          </button>
        ) : null}
        <button type="button" className="btn btn-primary" onClick={onSave} disabled={!dirty}>
          {t('lyrics.save')}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          {t('lyrics.cancel')}
        </button>
        <button
          type="button"
          className="btn"
          onClick={anchorFirstLine}
          disabled={!canAnchor}
          title={t('lyrics.anchorStartTitle')}
        >
          {t('lyrics.anchorStart')}
        </button>
        <button
          type="button"
          className="btn"
          onClick={anchorCurrentLine}
          disabled={!canAnchor}
          title={t('lyrics.anchorLineTitle')}
        >
          {t('lyrics.anchorLine')}
        </button>
        {canDelete ? (
          <button type="button" className="btn btn-danger" onClick={onDelete}>
            {t('lyrics.delete')}
          </button>
        ) : null}
      </div>
      {onFindLyrics ? (
        <p className="mt-2 text-xs leading-relaxed text-ink3">{t('lyrics.providerNote')}</p>
      ) : null}
      {findError ? (
        <p className="mt-2 text-xs text-warning" role="status">
          {findError}
        </p>
      ) : null}
    </section>
  );
}
