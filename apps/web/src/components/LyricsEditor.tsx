import { useRef } from 'react';
import { formatTime } from '@chordifree/chords';
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
}: LyricsEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lines = splitLyricLines(value).filter((line) => line.trim().length > 0).length;
  const dirty = value !== initialValue;

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
          <p className="eyebrow">Letra de la canción</p>
          <h2 className="mt-1 font-display text-2xl leading-none text-ink">Letra</h2>
        </div>
        <span className="badge" aria-live="polite">
          {lines} {lines === 1 ? 'línea' : 'líneas'}
          {dirty ? ' · sin guardar' : ''}
        </span>
      </header>

      <label htmlFor="lyrics-editor" className="sr-only">
        Letra de la canción
      </label>
      <textarea
        ref={textareaRef}
        id="lyrics-editor"
        className="field mt-4 min-h-[20rem] resize-y font-sans text-sm leading-relaxed"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={'Pega aquí la letra…\n\nUsa líneas vacías para separar estrofas.'}
        spellCheck
      />
      <p className="mt-2 text-xs leading-relaxed text-ink3">
        Para saltar una intro o un interludio, usa «Anclar inicio» si la letra empieza después
        de la introducción, o coloca el cursor en una línea y pulsa «Anclar línea». También
        puedes escribir `[mm:ss]` al inicio. Los acordes se reparten entre las líneas no vacías;
        la alineación es aproximada.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={onSave} disabled={!dirty}>
          Guardar letra
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn"
          onClick={anchorFirstLine}
          disabled={!canAnchor}
          title="Insertar el tiempo actual al inicio de la primera línea con texto"
        >
          Anclar inicio
        </button>
        <button
          type="button"
          className="btn"
          onClick={anchorCurrentLine}
          disabled={!canAnchor}
          title="Insertar el tiempo actual al inicio de la línea del cursor"
        >
          Anclar línea
        </button>
        {canDelete ? (
          <button type="button" className="btn btn-danger" onClick={onDelete}>
            Eliminar letra
          </button>
        ) : null}
      </div>
    </section>
  );
}
