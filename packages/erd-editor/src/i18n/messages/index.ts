import type { LocaleCode } from '@/i18n/locales';
import { en } from '@/i18n/messages/en';
import type { Messages } from '@/i18n/translate';

const MESSAGES: Readonly<Partial<Record<LocaleCode, Messages>>> = { en };

/**
 * The dictionary of a display language, English where none is written yet.
 * Only the element and the specs import it, so the export worker, which is
 * handed the dictionary it draws in, never bundles every language.
 */
export function messagesOf(code: LocaleCode): Messages {
  return MESSAGES[code] ?? en;
}
