/**
 * Every display language the editor offers, code to native name, in its
 * picker's order: English, then the rest by name. Hosts list it after Auto.
 */
export const LocaleLabel = {
  en: 'English',
  'id-ID': 'Bahasa Indonesia',
  'de-DE': 'Deutsch',
  'es-ES': 'Español',
  'eu-ES': 'Euskara',
  'fr-FR': 'Français',
  'it-IT': 'Italiano',
  'nl-NL': 'Nederlands',
  'pl-PL': 'Polski',
  'pt-PT': 'Português',
  'pt-BR': 'Português Brasileiro',
  'ro-RO': 'Română',
  'sk-SK': 'Slovenčina',
  'sl-SI': 'Slovenščina',
  'sv-SE': 'Svenska',
  'tr-TR': 'Türkçe',
  'ru-RU': 'Русский',
  'uk-UA': 'Українська',
  'he-IL': 'עברית',
  'ar-SA': 'العربية',
  'fa-IR': 'فارسی',
  'ja-JP': '日本語',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'ko-KR': '한국어',
} as const;
export type Locale = keyof typeof LocaleLabel;

/** What a host's setting holds: auto follows the host's own language, the editor's System. */
export type LocaleSetting = Locale | 'auto';
