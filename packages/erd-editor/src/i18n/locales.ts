/** One display language: its code, its name in itself, its name in English and whether it reads right to left. */
export type LocaleInfo = {
  readonly code: string;
  readonly label: string;
  readonly english: string;
  readonly rtl?: true;
};

/**
 * Every display language the editor offers, in its picker's order: English,
 * then the rest by their own names, as the owner decisions of 2026-10-06 list
 * them. The English name is what the palette also finds a language by.
 */
export const LOCALES = [
  { code: 'en', label: 'English', english: 'English' },
  { code: 'id-ID', label: 'Bahasa Indonesia', english: 'Indonesian' },
  { code: 'de-DE', label: 'Deutsch', english: 'German' },
  { code: 'es-ES', label: 'Español', english: 'Spanish' },
  { code: 'eu-ES', label: 'Euskara', english: 'Basque' },
  { code: 'fr-FR', label: 'Français', english: 'French' },
  { code: 'it-IT', label: 'Italiano', english: 'Italian' },
  { code: 'nl-NL', label: 'Nederlands', english: 'Dutch' },
  { code: 'pl-PL', label: 'Polski', english: 'Polish' },
  { code: 'pt-PT', label: 'Português', english: 'Portuguese' },
  {
    code: 'pt-BR',
    label: 'Português Brasileiro',
    english: 'Brazilian Portuguese',
  },
  { code: 'ro-RO', label: 'Română', english: 'Romanian' },
  { code: 'sk-SK', label: 'Slovenčina', english: 'Slovak' },
  { code: 'sl-SI', label: 'Slovenščina', english: 'Slovenian' },
  { code: 'sv-SE', label: 'Svenska', english: 'Swedish' },
  { code: 'tr-TR', label: 'Türkçe', english: 'Turkish' },
  { code: 'ru-RU', label: 'Русский', english: 'Russian' },
  { code: 'uk-UA', label: 'Українська', english: 'Ukrainian' },
  { code: 'he-IL', label: 'עברית', english: 'Hebrew', rtl: true },
  { code: 'ar-SA', label: 'العربية', english: 'Arabic', rtl: true },
  { code: 'fa-IR', label: 'فارسی', english: 'Persian', rtl: true },
  { code: 'ja-JP', label: '日本語', english: 'Japanese' },
  { code: 'zh-CN', label: '简体中文', english: 'Simplified Chinese' },
  { code: 'zh-TW', label: '繁體中文', english: 'Traditional Chinese' },
  { code: 'ko-KR', label: '한국어', english: 'Korean' },
] as const satisfies ReadonlyArray<LocaleInfo>;

export type LocaleCode = (typeof LOCALES)[number]['code'];

export const LocaleCodeList: ReadonlyArray<LocaleCode> = LOCALES.map(
  locale => locale.code
);

/** The option that follows the host's or the browser's language rather than naming one. */
export const SYSTEM_LOCALE = 'system';

export type LocaleOption = LocaleCode | typeof SYSTEM_LOCALE;

const LocaleOptionSet = new Set<string>([SYSTEM_LOCALE, ...LocaleCodeList]);

export const hasLocaleOption = (value: string): value is LocaleOption =>
  LocaleOptionSet.has(value);

export type TextDirection = 'ltr' | 'rtl';

const LocaleInfoMap = new Map<LocaleCode, LocaleInfo>(
  LOCALES.map(locale => [locale.code, locale])
);

export function localeInfoOf(code: LocaleCode): LocaleInfo {
  return LocaleInfoMap.get(code) ?? LOCALES[0];
}

export function directionOf(code: LocaleCode): TextDirection {
  return localeInfoOf(code).rtl ? 'rtl' : 'ltr';
}
