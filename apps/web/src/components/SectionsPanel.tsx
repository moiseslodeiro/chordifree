import { useEffect, useRef, useState, type FormEvent } from 'react';
import { formatTime } from '@chordifree/chords';
import { useT } from '../i18n';
import type { MessageKey } from '../i18n/messages';
import { activeSectionAt, SECTION_LABELS, type SectionLabel } from '../sections/detect';
import type { SongSection } from '../types';

interface SectionsPanelProps {
  sections: SongSection[];
  currentTime: number;
  onSeek: (time: number) => void;
  onChange: (sections: SongSection[]) => void;
}

/** Label shown to the user: the known ones translated, custom ones as-is. */
function displayLabel(label: string, t: (key: MessageKey) => string): string {
  const known = label as SectionLabel;
  if (!(SECTION_LABELS as readonly string[]).includes(known)) return label;
  return t(`sections.${known}` as MessageKey);
}

/**
 * Song structure list in the tools rail: click to jump, rename or remove each
 * section, and navigate with the previous/next buttons while playing.
 */
export function SectionsPanel({ sections, currentTime, onSeek, onChange }: SectionsPanelProps) {
  const t = useT();
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing === null) return;
    const timer = window.setTimeout(() => inputRef.current?.select(), 30);
    return () => window.clearTimeout(timer);
  }, [editing]);

  const startEdit = (index: number) => {
    setEditing(index);
    setDraft(sections[index]?.label ?? '');
  };

  const saveEdit = (index: number, label: string) => {
    const trimmed = label.trim();
    if (!trimmed || index < 0 || index >= sections.length) {
      setEditing(null);
      return;
    }
    onChange(
      sections.map((section, at) => (at === index ? { ...section, label: trimmed } : section)),
    );
    setEditing(null);
  };

  const remove = (index: number) => {
    onChange(sections.filter((_, at) => at !== index));
    setEditing(null);
  };

  const active = activeSectionAt(sections, currentTime);
  return (
    <details
      className="sections-panel overflow-hidden rounded-xl border border-line bg-panel shadow-sm"
      data-testid="sections-panel"
    >
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span className="font-mono text-[0.62rem] font-medium uppercase tracking-[0.16em] text-ink3">
          {t('sections.title')}
        </span>
        <span className="eyebrow">
          {active ? displayLabel(active.label, t) : t('sections.count', { count: sections.length })}
        </span>
      </summary>
      <div className="border-t border-line px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-ink3">{t('sections.auto')}</p>
          <div className="flex gap-1">
            <button
              type="button"
              className="tool-chip"
              aria-label={t('sections.previous')}
              disabled={sections.length === 0}
              onClick={() => {
                const previous = [...sections]
                  .filter((section) => section.start < currentTime - 1)
                  .pop();
                if (previous) onSeek(previous.start);
              }}
            >
              ‹
            </button>
            <button
              type="button"
              className="tool-chip"
              aria-label={t('sections.next')}
              disabled={sections.length === 0}
              onClick={() => {
                const next = sections.find((section) => section.start > currentTime + 0.05);
                if (next) onSeek(next.start);
              }}
            >
              ›
            </button>
          </div>
        </div>

        {sections.length === 0 ? (
          <p className="mt-3 text-xs text-ink3">{t('sections.empty')}</p>
        ) : (
          <ol className="mt-3 space-y-1">
            {sections.map((section, index) => {
              const active = currentTime >= section.start && currentTime < section.end;
              return (
                <li key={`${section.start}-${section.end}`}>
                  {editing === index ? (
                    <form
                      className="flex flex-wrap items-center gap-1"
                      onSubmit={(event: FormEvent) => {
                        event.preventDefault();
                        saveEdit(index, draft);
                      }}
                    >
                      <input
                        ref={inputRef}
                        className="field min-w-0 flex-1 px-2 py-1 text-xs"
                        value={draft}
                        maxLength={40}
                        placeholder={t('sections.customPlaceholder')}
                        onChange={(event) => setDraft(event.target.value)}
                        onBlur={() => saveEdit(index, draft)}
                      />
                      <button type="button" className="tool-chip" onClick={() => remove(index)}>
                        ✕
                      </button>
                    </form>
                  ) : (
                    <div
                      className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                        active ? 'bg-accent/10' : 'hover:bg-panel-2/60'
                      }`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => onSeek(section.start)}
                        aria-current={active || undefined}
                        aria-label={`${displayLabel(section.label, t)} · ${formatTime(section.start)}`}
                      >
                        <span
                          className={`block truncate text-xs font-semibold ${
                            active ? 'text-accent' : 'text-ink'
                          }`}
                        >
                          {displayLabel(section.label, t)}
                        </span>
                        <span className="block font-mono text-[0.58rem] tabular-nums text-ink3">
                          {formatTime(section.start)} – {formatTime(section.end)}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="tool-chip shrink-0"
                        aria-label={`${t('sections.rename')}: ${displayLabel(section.label, t)}`}
                        onClick={() => startEdit(index)}
                      >
                        ✎
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </details>
  );
}
