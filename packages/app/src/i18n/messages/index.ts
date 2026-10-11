import type { LocaleCode } from '@/i18n/locales';
import { en } from '@/i18n/messages/en';
import type { Messages } from '@/i18n/translate';

type Loader = () => Promise<Messages>;

/**
 * Each language but English as a chunk of its own, loaded once picked, so a
 * page carries English and the one language it shows. A code the editor adds
 * fails tsc here until it has a dictionary.
 */
export const LOADERS: Readonly<Record<Exclude<LocaleCode, 'en'>, Loader>> = {
  'id-ID': () => import('./id-ID').then(module => module.idID),
  'de-DE': () => import('./de-DE').then(module => module.deDE),
  'es-ES': () => import('./es-ES').then(module => module.esES),
  'eu-ES': () => import('./eu-ES').then(module => module.euES),
  'fr-FR': () => import('./fr-FR').then(module => module.frFR),
  'it-IT': () => import('./it-IT').then(module => module.itIT),
  'nl-NL': () => import('./nl-NL').then(module => module.nlNL),
  'pl-PL': () => import('./pl-PL').then(module => module.plPL),
  'pt-PT': () => import('./pt-PT').then(module => module.ptPT),
  'pt-BR': () => import('./pt-BR').then(module => module.ptBR),
  'ro-RO': () => import('./ro-RO').then(module => module.roRO),
  'sk-SK': () => import('./sk-SK').then(module => module.skSK),
  'sl-SI': () => import('./sl-SI').then(module => module.slSI),
  'sv-SE': () => import('./sv-SE').then(module => module.svSE),
  'tr-TR': () => import('./tr-TR').then(module => module.trTR),
  'ru-RU': () => import('./ru-RU').then(module => module.ruRU),
  'uk-UA': () => import('./uk-UA').then(module => module.ukUA),
  'he-IL': () => import('./he-IL').then(module => module.heIL),
  'ar-SA': () => import('./ar-SA').then(module => module.arSA),
  'fa-IR': () => import('./fa-IR').then(module => module.faIR),
  'ja-JP': () => import('./ja-JP').then(module => module.jaJP),
  'zh-CN': () => import('./zh-CN').then(module => module.zhCN),
  'zh-TW': () => import('./zh-TW').then(module => module.zhTW),
  'ko-KR': () => import('./ko-KR').then(module => module.koKR),
};

/** A language's dictionary: English at once, any other from its chunk. */
export function loadMessages(code: LocaleCode): Promise<Messages> {
  return code === 'en' ? Promise.resolve(en) : LOADERS[code]();
}
