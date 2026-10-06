import { en } from '@/i18n/messages/en';
import { createI18n } from '@/i18n/translate';

/**
 * English, the language every string is written in first: what a component
 * reads where nothing provides a language, and what a function outside the
 * components falls back to when its caller passes none.
 */
export const sourceI18n = createI18n('en', en);
