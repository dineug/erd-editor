import { atom, createStore, useAtomValue, useSetAtom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';

import { loadMessages } from '@/i18n/messages';
import { sourceI18n } from '@/i18n/source';
import { createI18n, type I18n } from '@/i18n/translate';
import {
  applyPickedLocale,
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  LocalePreference,
  parseLocalePreference,
  resolveDisplayLocale,
} from '@/utils/locale';
import { reportError } from '@/utils/reportError';

type Store = ReturnType<typeof createStore>;

const jsonStorage = createJSONStorage<unknown>();

const localeStorage = {
  getItem: (key: string, initialValue: LocalePreference) =>
    parseLocalePreference(jsonStorage.getItem(key, initialValue)),
  setItem: (key: string, value: LocalePreference) =>
    jsonStorage.setItem(key, value),
  removeItem: (key: string) => jsonStorage.removeItem(key),
  subscribe: (
    key: string,
    callback: (value: LocalePreference) => void,
    initialValue: LocalePreference
  ) =>
    jsonStorage.subscribe?.(
      key,
      value => callback(parseLocalePreference(value)),
      initialValue
    ),
};

/**
 * The display language the app and every editor of it show, kept in
 * localStorage and so shared with the other tabs, which follow a pick made in
 * one of them.
 */
export const localeAtom = atomWithStorage<LocalePreference>(
  LOCALE_STORAGE_KEY,
  DEFAULT_LOCALE,
  localeStorage,
  { getOnInit: true }
);

const readNavigatorLanguages = (): ReadonlyArray<string> => [
  ...(globalThis.navigator?.languages ?? []),
];

const navigatorLanguagesAtom = atom(readNavigatorLanguages());

navigatorLanguagesAtom.onMount = setLanguages => {
  const update = () => setLanguages(readNavigatorLanguages());
  update();
  window.addEventListener('languagechange', update);
  return () => window.removeEventListener('languagechange', update);
};

/** The language the app's own text is in: the pick, else the browser's. */
export const displayLocaleAtom = atom(get =>
  resolveDisplayLocale(get(localeAtom), get(navigatorLanguagesAtom))
);

/** The language shown, which stays the last one loaded until the next arrives. */
export const i18nAtom = atom<I18n>(sourceI18n);

const applyPickedLocaleAtom = atom(null, (get, set, detail: unknown) => {
  set(localeAtom, applyPickedLocale(get(localeAtom), detail));
});

/**
 * Shows the language in force once its dictionary has loaded, unless another
 * was asked for meanwhile. A failed load rejects and keeps what is shown.
 */
export async function loadDisplayLanguage(store: Store): Promise<void> {
  const locale = store.get(displayLocaleAtom);
  if (store.get(i18nAtom).locale === locale) return;

  const messages = await loadMessages(locale);
  if (store.get(displayLocaleAtom) !== locale) return;

  store.set(i18nAtom, createI18n(locale, messages));
}

/**
 * Keeps the language shown on the language in force and the page's lang and
 * dir on the language shown, for as long as the app runs. The promise settles
 * once the first language is in, so the first render shows it.
 */
export function watchDisplayLanguage(
  store: Store,
  root: HTMLElement
): Promise<void> {
  const apply = () => {
    const { locale, dir } = store.get(i18nAtom);
    root.lang = locale;
    root.dir = dir;
  };

  apply();
  store.sub(i18nAtom, apply);
  store.sub(displayLocaleAtom, () => {
    loadDisplayLanguage(store).catch(reportError);
  });

  return loadDisplayLanguage(store);
}

/** The preference, system included, as the editor's setLocale takes it. */
export const useLocalePreference = () => useAtomValue(localeAtom);

/** Stores a pick from the app's own language menu. */
export const useSetLocalePreference = () => useSetAtom(localeAtom);

/** Takes the detail of the editor's changeLocale event. */
export const useApplyPickedLocale = () => useSetAtom(applyPickedLocaleAtom);

/** The language the app's own text is shown in, with its t(). */
export const useI18n = () => useAtomValue(i18nAtom);

/** The language System stands for now, named beside it in the language menu. */
export const useSystemLocale = () =>
  resolveDisplayLocale('system', useAtomValue(navigatorLanguagesAtom));
