import { isString } from 'es-toolkit';

import { directionOf, LocaleCode, TextDirection } from '@/i18n/locales';
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

/** The names a message of a dictionary interpolates, every plural form's and count included. */
export type MessageParamsOf<S, K extends keyof S> = K extends keyof S
  ? ParamsOfValue<S[K]>
  : never;

export type MessageArgsOf<S, K extends keyof S> = [
  MessageParamsOf<S, K>,
] extends [never]
  ? []
  : [params: { readonly [P in MessageParamsOf<S, K>]: string | number }];

export type PlainMessageKeyOf<S> = {
  [K in keyof S]: [MessageParamsOf<S, K>] extends [never] ? K : never;
}[keyof S];

export type TranslateOf<S> = <K extends keyof S & string>(
  key: K,
  ...args: MessageArgsOf<S, K>
) => string;

/** Every key the English dictionary holds, the one every other dictionary is checked against. */
export type MessageKey = keyof typeof en;

export type Messages = {
  readonly [K in MessageKey]: (typeof en)[K] extends string
    ? string
    : PluralMessage;
};

export type MessageArgs<K extends MessageKey> = MessageArgsOf<typeof en, K>;

/** The keys t() takes with no parameters: the type every label map and labelKey uses. */
export type PlainMessageKey = PlainMessageKeyOf<typeof en>;

export type Translate = TranslateOf<typeof en>;

/**
 * The language the editor's own text is shown in. It is never frozen, so the
 * element can assign a new language into the object every component already
 * reads, and a component mounted later reads the new one too.
 */
export type I18n = {
  locale: LocaleCode;
  dir: TextDirection;
  messages: Messages;
  t: Translate;
};

/** What the export worker is handed to draw a scene in the reader's language. */
export type LocaleMessages = Pick<I18n, 'locale' | 'messages'>;

export type MessageValues = Readonly<Record<string, string | number>>;

const PLACEHOLDER = /\{(\w+)\}/g;

const FIRST_STRONG_ISOLATE = '\u2068';

const POP_DIRECTIONAL_ISOLATE = '\u2069';

/**
 * Writes each named value into its placeholder, leaving a name it is not given
 * as typed. An isolated value is wrapped in FSI and PDI, so a name or a number
 * keeps its own direction inside a right-to-left sentence.
 */
export function formatMessage(
  template: string,
  params?: MessageValues,
  isolate = false
): string {
  if (!params) return template;

  return template.replace(PLACEHOLDER, (placeholder, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(params, name)) {
      return placeholder;
    }

    const value = String(params[name]);
    return isolate
      ? `${FIRST_STRONG_ISOLATE}${value}${POP_DIRECTIONAL_ISOLATE}`
      : value;
  });
}

/**
 * A language with its dictionary and the t() that reads it. A plural picks the
 * form its count falls in by the language's own rules, built once here, and
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

  return { locale, dir, messages, t: t as Translate };
}
