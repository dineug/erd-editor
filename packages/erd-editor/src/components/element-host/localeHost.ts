import { observable, onBeforeMount, watch } from '@dineug/r-html';
import { isString } from 'es-toolkit';

import {
  hasLocaleOption,
  LocaleCode,
  LocaleOption,
  SYSTEM_LOCALE,
} from '@/i18n/locales';
import { resolveLocale } from '@/i18n/resolveLocale';
import { createI18n, I18n, Messages } from '@/i18n/translate';
import { Unsubscribe } from '@/internal-types';

export type LocaleState = {
  /** The option a host or a pick last set; null until either sets one. */
  option: LocaleOption | null;
  /** What system means once a host names its own language; null reads the tags handed in. */
  systemTag: string | null;
};

/** The tags system reads where a host names none, as useNavigatorLanguages keeps them. */
export type SystemLanguages = {
  readonly state: { readonly languages: ReadonlyArray<string> };
};

export type LocaleHostOptions = {
  /** The dictionary of a language, which the one I18n object takes in place. */
  messagesOf: (code: LocaleCode) => Messages;
  /** An observable source, so a change of its tags applies again under system. */
  languages: SystemLanguages;
  /** The option in force while no host or pick has set one. */
  fallbackOption: () => LocaleOption;
};

/**
 * An element's display language: the option, what system resolves to and the
 * one I18n object every component reads, with the setters a host calls. A
 * component calls it at setup, so the language is resolved again before mount.
 */
export function useLocaleHost({
  messagesOf,
  languages,
  fallbackOption,
}: LocaleHostOptions) {
  const localeState = observable<LocaleState>({
    option: null,
    systemTag: null,
  });

  const resolveLocaleOption = (): LocaleOption =>
    localeState.option ?? fallbackOption();

  const resolveSystemLocale = (): LocaleCode =>
    resolveLocale(localeState.systemTag ?? languages.state.languages);

  const resolveCurrentLocale = (): LocaleCode => {
    const option = resolveLocaleOption();
    return option === SYSTEM_LOCALE ? resolveSystemLocale() : option;
  };

  // Resolved here and again just before each mount, so a language a host sets
  // before appending the element, or a fallback changed by then, is in its
  // first render.
  const initialLocale = resolveCurrentLocale();
  const i18n = observable<I18n>(
    { ...createI18n(initialLocale, messagesOf(initialLocale)) },
    { shallow: true }
  );

  /**
   * Assigns the language into the object every component already reads, never
   * a new one through the provider, which a component mounted later would miss.
   */
  const applyLocale = () => {
    const code = resolveCurrentLocale();
    if (code === i18n.locale) return;

    Object.assign(i18n, createI18n(code, messagesOf(code)));
  };

  onBeforeMount(applyLocale);

  const unsubscribes: Unsubscribe[] = [
    watch(localeState).subscribe(applyLocale),
    watch(languages.state).subscribe(applyLocale),
  ];

  // Both apply before they return, so a host that names the language before it
  // appends the element paints it in that language from the first frame.
  const setLocale = (locale: LocaleOption) => {
    if (!isString(locale) || !hasLocaleOption(locale)) return;

    localeState.option = locale;
    applyLocale();
  };

  const setSystemLocale = (locale: string | null) => {
    const tag = isString(locale) ? locale.trim() : '';
    localeState.systemTag = tag || null;
    applyLocale();
  };

  return {
    i18n,
    localeState,
    resolveLocaleOption,
    resolveSystemLocale,
    applyLocale,
    setLocale,
    setSystemLocale,
    /** Stops following the option, the tag and the languages handed in. */
    destroy: () => unsubscribes.forEach(unsubscribe => unsubscribe()),
  };
}
