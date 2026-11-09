import { useCallback, useSyncExternalStore } from 'react';
import { messages, type Language, type MessageKey } from './messages';

export type { Language, MessageKey };

let currentLanguage: Language = 'en';
const listeners = new Set<() => void>();

export function getLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(language: Language): void {
  if (language === currentLanguage) return;
  currentLanguage = language;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

export function translate(
  language: Language,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const table = messages[language] ?? messages.en;
  return interpolate(table[key] ?? messages.en[key] ?? key, params);
}

/** Translation outside React, using the current language. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  return translate(currentLanguage, key, params);
}

export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, getLanguage, () => 'en');
}

export function useT(): (key: MessageKey, params?: Record<string, string | number>) => string {
  const language = useLanguage();
  return useCallback(
    (key: MessageKey, params?: Record<string, string | number>) =>
      translate(language, key, params),
    [language],
  );
}

export function pluralKey(
  count: number,
  singular: MessageKey,
  plural: MessageKey,
): MessageKey {
  return count === 1 ? singular : plural;
}
