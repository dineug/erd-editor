import type { LocaleCode } from '@/i18n/locales';
import { arSA } from '@/i18n/messages/ar-SA';
import { deDE } from '@/i18n/messages/de-DE';
import { en } from '@/i18n/messages/en';
import { esES } from '@/i18n/messages/es-ES';
import { euES } from '@/i18n/messages/eu-ES';
import { faIR } from '@/i18n/messages/fa-IR';
import { frFR } from '@/i18n/messages/fr-FR';
import { heIL } from '@/i18n/messages/he-IL';
import { idID } from '@/i18n/messages/id-ID';
import { itIT } from '@/i18n/messages/it-IT';
import { jaJP } from '@/i18n/messages/ja-JP';
import { koKR } from '@/i18n/messages/ko-KR';
import { nlNL } from '@/i18n/messages/nl-NL';
import { plPL } from '@/i18n/messages/pl-PL';
import { ptBR } from '@/i18n/messages/pt-BR';
import { ptPT } from '@/i18n/messages/pt-PT';
import { roRO } from '@/i18n/messages/ro-RO';
import { ruRU } from '@/i18n/messages/ru-RU';
import { skSK } from '@/i18n/messages/sk-SK';
import { slSI } from '@/i18n/messages/sl-SI';
import { svSE } from '@/i18n/messages/sv-SE';
import { trTR } from '@/i18n/messages/tr-TR';
import { ukUA } from '@/i18n/messages/uk-UA';
import { zhCN } from '@/i18n/messages/zh-CN';
import { zhTW } from '@/i18n/messages/zh-TW';
import type { Messages } from '@/i18n/translate';

/**
 * Every display language's dictionary, by its code. Only the element and the
 * specs import it, so the export worker, which is handed the dictionary it
 * draws in, never bundles every language.
 */
export const MESSAGES: Readonly<Record<LocaleCode, Messages>> = {
  en,
  'id-ID': idID,
  'de-DE': deDE,
  'es-ES': esES,
  'eu-ES': euES,
  'fr-FR': frFR,
  'it-IT': itIT,
  'nl-NL': nlNL,
  'pl-PL': plPL,
  'pt-PT': ptPT,
  'pt-BR': ptBR,
  'ro-RO': roRO,
  'sk-SK': skSK,
  'sl-SI': slSI,
  'sv-SE': svSE,
  'tr-TR': trTR,
  'ru-RU': ruRU,
  'uk-UA': ukUA,
  'he-IL': heIL,
  'ar-SA': arSA,
  'fa-IR': faIR,
  'ja-JP': jaJP,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'ko-KR': koKR,
};

/** The dictionary of a display language. */
export function messagesOf(code: LocaleCode): Messages {
  return MESSAGES[code];
}
