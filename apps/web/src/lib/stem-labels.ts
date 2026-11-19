import type { MessageKey } from '../i18n/messages';

const STEM_LABELS: Record<string, MessageKey> = {
  vocals: 'stems.vocals',
  no_vocals: 'stems.instrumental',
  instrumental: 'stems.instrumental',
  drums: 'stems.drums',
  bass: 'stems.bass',
  other: 'stems.other',
};

/** Human name for a stem returned by any plugin. */
export function stemLabel(stem: string, t: (key: MessageKey) => string): string {
  const key = STEM_LABELS[stem];
  return key ? t(key) : stem;
}
