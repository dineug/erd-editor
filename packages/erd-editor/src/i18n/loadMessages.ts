import type { LocaleCode } from '@/i18n/locales';
import { en } from '@/i18n/messages/en';
import type { Messages } from '@/i18n/translate';

/** A display language the viewer loads once a page asks for it: every one but English, which it holds from the start. */
export type LoadedLocaleCode = Exclude<LocaleCode, 'en'>;

/**
 * One literal import() per language, so a bundler splits each dictionary into
 * a chunk of its own. A template import() would have the bundler take in every
 * module beside them, messages/index.ts and the specs among them.
 */
const LOADERS: Readonly<Record<LoadedLocaleCode, () => Promise<Messages>>> = {
  'id-ID': () => import('@/i18n/messages/id-ID').then(module => module.idID),
  'de-DE': () => import('@/i18n/messages/de-DE').then(module => module.deDE),
  'es-ES': () => import('@/i18n/messages/es-ES').then(module => module.esES),
  'eu-ES': () => import('@/i18n/messages/eu-ES').then(module => module.euES),
  'fr-FR': () => import('@/i18n/messages/fr-FR').then(module => module.frFR),
  'it-IT': () => import('@/i18n/messages/it-IT').then(module => module.itIT),
  'nl-NL': () => import('@/i18n/messages/nl-NL').then(module => module.nlNL),
  'pl-PL': () => import('@/i18n/messages/pl-PL').then(module => module.plPL),
  'pt-PT': () => import('@/i18n/messages/pt-PT').then(module => module.ptPT),
  'pt-BR': () => import('@/i18n/messages/pt-BR').then(module => module.ptBR),
  'ro-RO': () => import('@/i18n/messages/ro-RO').then(module => module.roRO),
  'sk-SK': () => import('@/i18n/messages/sk-SK').then(module => module.skSK),
  'sl-SI': () => import('@/i18n/messages/sl-SI').then(module => module.slSI),
  'sv-SE': () => import('@/i18n/messages/sv-SE').then(module => module.svSE),
  'tr-TR': () => import('@/i18n/messages/tr-TR').then(module => module.trTR),
  'ru-RU': () => import('@/i18n/messages/ru-RU').then(module => module.ruRU),
  'uk-UA': () => import('@/i18n/messages/uk-UA').then(module => module.ukUA),
  'he-IL': () => import('@/i18n/messages/he-IL').then(module => module.heIL),
  'ar-SA': () => import('@/i18n/messages/ar-SA').then(module => module.arSA),
  'fa-IR': () => import('@/i18n/messages/fa-IR').then(module => module.faIR),
  'ja-JP': () => import('@/i18n/messages/ja-JP').then(module => module.jaJP),
  'zh-CN': () => import('@/i18n/messages/zh-CN').then(module => module.zhCN),
  'zh-TW': () => import('@/i18n/messages/zh-TW').then(module => module.zhTW),
  'ko-KR': () => import('@/i18n/messages/ko-KR').then(module => module.koKR),
};

const loading = new Map<LoadedLocaleCode, Promise<Messages>>();

/**
 * The dictionary of a language but English, loaded once for every viewer of
 * the page. A load that fails is forgotten, so the next one asked tries again.
 */
export function loadMessages(code: LoadedLocaleCode): Promise<Messages> {
  const known = loading.get(code);
  if (known) return known;

  const promise = LOADERS[code]();
  loading.set(code, promise);
  promise.catch(() => loading.delete(code));
  return promise;
}

/** The dictionary source the viewer hands its locale host: English at once, any other language as it loads. */
export const lazyMessagesOf = (
  code: LocaleCode
): Messages | Promise<Messages> => (code === 'en' ? en : loadMessages(code));
