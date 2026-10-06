import { atom, useAtomValue, useSetAtom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';

import {
  applyPickedLocale,
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  LocalePreference,
  parseLocalePreference,
} from '@/utils/locale';

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
 * The display language every editor of the app shows, kept in localStorage
 * and so shared with the other tabs, which follow a pick made in one of them.
 */
export const localeAtom = atomWithStorage<LocalePreference>(
  LOCALE_STORAGE_KEY,
  DEFAULT_LOCALE,
  localeStorage,
  { getOnInit: true }
);

const applyPickedLocaleAtom = atom(null, (get, set, detail: unknown) => {
  set(localeAtom, applyPickedLocale(get(localeAtom), detail));
});

/** The preference, system included, as the editor's setLocale takes it. */
export const useLocalePreference = () => useAtomValue(localeAtom);

/** Takes the detail of the editor's changeLocale event. */
export const useApplyPickedLocale = () => useSetAtom(applyPickedLocaleAtom);
