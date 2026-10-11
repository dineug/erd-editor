import type { LocaleCode } from '@dineug/erd-editor';

export type { LocaleCode };

/** One display language: its code, its name in itself and whether it reads right to left. */
export type LocaleInfo = {
  readonly code: LocaleCode;
  readonly label: string;
  readonly rtl?: true;
};

/**
 * The editor's display languages in its picker's order, copied since the editor
 * exports their type alone. The codes are its LocaleCode, and every code but
 * English needs a dictionary in messages/index.ts, so tsc holds the two lists.
 */
export const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'id-ID', label: 'Bahasa Indonesia' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'es-ES', label: 'Español' },
  { code: 'eu-ES', label: 'Euskara' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'it-IT', label: 'Italiano' },
  { code: 'nl-NL', label: 'Nederlands' },
  { code: 'pl-PL', label: 'Polski' },
  { code: 'pt-PT', label: 'Português' },
  { code: 'pt-BR', label: 'Português Brasileiro' },
  { code: 'ro-RO', label: 'Română' },
  { code: 'sk-SK', label: 'Slovenčina' },
  { code: 'sl-SI', label: 'Slovenščina' },
  { code: 'sv-SE', label: 'Svenska' },
  { code: 'tr-TR', label: 'Türkçe' },
  { code: 'ru-RU', label: 'Русский' },
  { code: 'uk-UA', label: 'Українська' },
  { code: 'he-IL', label: 'עברית', rtl: true },
  { code: 'ar-SA', label: 'العربية', rtl: true },
  { code: 'fa-IR', label: 'فارسی', rtl: true },
  { code: 'ja-JP', label: '日本語' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'ko-KR', label: '한국어' },
] as const satisfies ReadonlyArray<LocaleInfo>;

export const LocaleCodeList: ReadonlyArray<LocaleCode> = LOCALES.map(
  locale => locale.code
);

export type TextDirection = 'ltr' | 'rtl';

const LocaleInfoMap = new Map<LocaleCode, LocaleInfo>(
  LOCALES.map(locale => [locale.code, locale])
);

/** Whether a stored string names one of the languages. */
export const isLocaleCode = (value: string): value is LocaleCode =>
  LocaleInfoMap.has(value as LocaleCode);

export function localeInfoOf(code: LocaleCode): LocaleInfo {
  return LocaleInfoMap.get(code) ?? LOCALES[0];
}

export function directionOf(code: LocaleCode): TextDirection {
  return localeInfoOf(code).rtl ? 'rtl' : 'ltr';
}
