import { observable, useProvider } from '@dineug/r-html';

import { localeContext } from '@/components/localeContext';
import type { LocaleCode } from '@/i18n/locales';
import { en } from '@/i18n/messages/en';
import { messagesOf } from '@/i18n/messages/index';
import {
  createI18n,
  type I18n,
  type Messages,
  type PluralMessage,
} from '@/i18n/translate';

/**
 * English with every value tagged, plural forms included and placeholders
 * kept, so a spec tells a string read through t() from a literal left behind.
 *
 * @example
 * pseudoMessages('xx')['common.close']; // 'xx:Close'
 */
export function pseudoMessages(tag: string): Messages {
  const tagged = Object.entries(en).map(([key, value]) => [
    key,
    typeof value === 'string'
      ? `${tag}:${value}`
      : Object.fromEntries(
          Object.entries(value as PluralMessage).map(([form, text]) => [
            form,
            `${tag}:${text}`,
          ])
        ),
  ]);

  return Object.fromEntries(tagged) as Messages;
}

/**
 * A language as the element holds it: observable and shallow, so assigning
 * another language into it re-renders whatever reads it.
 *
 * @example
 * Object.assign(i18n, createI18n('ko-KR', pseudoMessages('ko')));
 */
export function createTestI18n(locale: LocaleCode, messages?: Messages): I18n {
  const i18n = createI18n(locale, messages ?? messagesOf(locale));
  return observable({ ...i18n }, { shallow: true });
}

/** Provides a language on an element, as the editor's root does; destroy it when done. */
export function provideI18n(el: HTMLElement, i18n: I18n) {
  // useProvider takes a bare HTMLElement at runtime but types only a component
  // context, hence the cast; it is r-html's, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  return useProvider(el as any, localeContext, i18n);
}
