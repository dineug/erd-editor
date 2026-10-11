import { isString } from 'es-toolkit';

import {
  directionOf,
  type LocaleCode,
  type TextDirection,
} from '@/i18n/locales';
import type { en } from '@/i18n/messages/en';

/** A message that shows a number: one form per plural category of its language, other always there. */
export type PluralMessage = { readonly other: string } & Partial<
  Record<Exclude<Intl.LDMLPluralRule, 'other'>, string>
>;

type PlaceholdersOf<S extends string> =
  S extends `${string}{${infer Name}}${infer Rest}`
    ? Name | PlaceholdersOf<Rest>
    : never;

type ParamsOfValue<V> = V extends string
  ? PlaceholdersOf<V>
  : V extends Readonly<Record<string, string>>
    ? PlaceholdersOf<V[keyof V]> | 'count'
    : never;

type English = typeof en;

/** Every key the English dictionary holds, the one every other dictionary is checked against. */
export type MessageKey = keyof English;

type MessageParams<K extends MessageKey> = K extends MessageKey
  ? ParamsOfValue<English[K]>
  : never;

export type MessageArgs<K extends MessageKey> = [MessageParams<K>] extends [
  never,
]
  ? []
  : [params: { readonly [P in MessageParams<K>]: string | number }];

/** The keys t() takes with no parameters: the type every label map uses. */
export type PlainMessageKey = {
  [K in MessageKey]: [MessageParams<K>] extends [never] ? K : never;
}[MessageKey];

export type Messages = {
  readonly [K in MessageKey]: English[K] extends string
    ? string
    : PluralMessage;
};

export type Translate = <K extends MessageKey>(
  key: K,
  ...args: MessageArgs<K>
) => string;

/** The language the app's own text is shown in, with the t() that reads it. */
export type I18n = {
  readonly locale: LocaleCode;
  readonly dir: TextDirection;
  readonly t: Translate;
};

export type MessageValues = Readonly<Record<string, string | number>>;

const PLACEHOLDER = /\{(\w+)\}/g;

const FIRST_STRONG_ISOLATE = '⁨';

const POP_DIRECTIONAL_ISOLATE = '⁩';

/** A text wrapped in FSI and PDI, which keeps its own direction inside a sentence. */
export function isolate(value: string): string {
  return `${FIRST_STRONG_ISOLATE}${value}${POP_DIRECTIONAL_ISOLATE}`;
}

/**
 * Writes each named value into its placeholder, leaving a name it is not given
 * as typed. An isolated value is wrapped in FSI and PDI, so a name or a number
 * keeps its own direction inside a right-to-left sentence.
 */
export function formatMessage(
  template: string,
  params?: MessageValues,
  isolated = false
): string {
  if (!params) return template;

  return template.replace(PLACEHOLDER, (placeholder, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(params, name)) {
      return placeholder;
    }

    const value = String(params[name]);
    return isolated ? isolate(value) : value;
  });
}

/**
 * A language with its dictionary and the t() that reads it, as the editor's
 * own: a plural picks the form its count falls in by the language's rules and
 * falls back to other where the dictionary lacks that form.
 */
export function createI18n(locale: LocaleCode, messages: Messages): I18n {
  const dir = directionOf(locale);
  const rules = new Intl.PluralRules(locale);
  const lookup = messages as Readonly<Record<string, string | PluralMessage>>;

  const t = (key: string, params?: MessageValues) => {
    const message = lookup[key];
    const template = isString(message)
      ? message
      : (message[rules.select(Number(params?.count))] ?? message.other);

    return formatMessage(template, params, dir === 'rtl');
  };

  return { locale, dir, t: t as Translate };
}

/** Text read in the language it renders in, so a notice kept in state follows a switch. */
export type Localized = (i18n: I18n) => string;

/** A message as Localized, read where it renders. */
export function localized<K extends MessageKey>(
  key: K,
  ...args: MessageArgs<K>
): Localized {
  return i18n => i18n.t(key, ...args);
}
