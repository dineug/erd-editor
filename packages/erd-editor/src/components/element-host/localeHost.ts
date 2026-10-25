import { observable, onBeforeMount, watch } from '@dineug/r-html';
import { isPromise, isString } from 'es-toolkit';

import {
  hasLocaleOption,
  LocaleCode,
  LocaleOption,
  SYSTEM_LOCALE,
} from '@/i18n/locales';
import { resolveLocale } from '@/i18n/resolveLocale';
import { createI18n, I18n, Messages } from '@/i18n/translate';
import { Unsubscribe } from '@/internal-types';

/** The language every source hands over at once. */
const ENGLISH: LocaleCode = 'en';

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
  /**
   * The dictionary of a language, which the one I18n object takes in place, or
   * the promise of one a source still loads. English comes at once, and stands
   * while another language loads and in place of one that fails to.
   */
  messagesOf: (code: LocaleCode) => Messages | Promise<Messages>;
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

  /** English, which every source hands over at once. */
  const english = (): Messages => {
    const messages = messagesOf(ENGLISH);
    if (isPromise(messages)) {
      throw new Error('A dictionary source hands English over at once');
    }
    return messages;
  };

  // Resolved here and again just before each mount, so a language a host sets
  // before appending the element, or a fallback changed by then, is in its
  // first render. A language still loading starts the element in English.
  const initialLocale = resolveCurrentLocale();
  const initialMessages = messagesOf(initialLocale);
  const i18n = observable<I18n>(
    {
      ...(isPromise(initialMessages)
        ? createI18n(ENGLISH, english())
        : createI18n(initialLocale, initialMessages)),
    },
    { shallow: true }
  );

  // The language last resolved, which a dictionary landing for an earlier one
  // never replaces, nor one landing once the host is destroyed.
  let wanted: LocaleCode = initialLocale;
  let stopped = false;

  /**
   * Assigns the language into the object every component already reads, never
   * a new one through the provider, which a component mounted later would miss.
   */
  const show = (code: LocaleCode, messages: Messages) => {
    Object.assign(i18n, createI18n(code, messages));
  };

  /**
   * Shows a dictionary once it lands, if it is still the one wanted, and
   * English if it fails to, which is then the one wanted, so asking for that
   * language again loads it again.
   */
  const land = (code: LocaleCode, loading: Promise<Messages>) =>
    loading.then(
      messages => {
        if (!stopped && wanted === code) show(code, messages);
      },
      () => {
        if (stopped || wanted !== code) return;
        wanted = ENGLISH;
        show(ENGLISH, english());
      }
    );

  /** Resolves once the dictionary of the language last resolved has landed or failed. */
  let settled: Promise<void> = isPromise(initialMessages)
    ? land(initialLocale, initialMessages)
    : Promise.resolve();

  /**
   * Puts the language resolved now in force, at once for a dictionary at hand,
   * and resolves once its dictionary has landed or failed; once the host is
   * destroyed it asks for no dictionary and changes nothing.
   */
  const applyLocale = (): Promise<void> => {
    if (stopped) return settled;

    const code = resolveCurrentLocale();
    if (code === wanted) return settled;

    wanted = code;
    const messages = messagesOf(code);
    if (isPromise(messages)) {
      settled = land(code, messages);
    } else {
      show(code, messages);
      settled = Promise.resolve();
    }
    return settled;
  };

  onBeforeMount(applyLocale);

  const unsubscribes: Unsubscribe[] = [
    watch(localeState).subscribe(applyLocale),
    watch(languages.state).subscribe(applyLocale),
  ];

  // Both apply before they return a dictionary at hand, so a host that names
  // the language before it appends the element paints it from the first frame.
  // Each resolves as applyLocale does, whether or not a later call replaced it.
  const setLocale = (locale: LocaleOption): Promise<void> => {
    if (!isString(locale) || !hasLocaleOption(locale)) return settled;

    localeState.option = locale;
    return applyLocale();
  };

  const setSystemLocale = (locale: string | null): Promise<void> => {
    const tag = isString(locale) ? locale.trim() : '';
    localeState.systemTag = tag || null;
    return applyLocale();
  };

  return {
    i18n,
    localeState,
    resolveLocaleOption,
    resolveSystemLocale,
    applyLocale,
    setLocale,
    setSystemLocale,
    /** Stops following the option, the tag and the languages handed in, drops a dictionary still loading and applies no language more. */
    destroy: () => {
      stopped = true;
      unsubscribes.forEach(unsubscribe => unsubscribe());
    },
  };
}
