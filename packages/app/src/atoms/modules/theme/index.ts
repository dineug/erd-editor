import { atom, useAtomValue, useSetAtom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';

import {
  AppearancePreference,
  applyPresetTheme,
  DEFAULT_THEME,
  isSystemDark,
  parseThemeState,
  resolveTheme,
  THEME_STORAGE_KEY,
  ThemeState,
  watchSystemDark,
} from '@/utils/theme';

const jsonStorage = createJSONStorage<unknown>();

const themeStorage = {
  getItem: (key: string, initialValue: ThemeState) =>
    parseThemeState(jsonStorage.getItem(key, initialValue)),
  setItem: (key: string, value: ThemeState) => jsonStorage.setItem(key, value),
  removeItem: (key: string) => jsonStorage.removeItem(key),
  subscribe: (
    key: string,
    callback: (value: ThemeState) => void,
    initialValue: ThemeState
  ) =>
    jsonStorage.subscribe?.(
      key,
      value => callback(parseThemeState(value)),
      initialValue
    ),
};

/**
 * The stored preference, read on init rather than on mount so the first render
 * already agrees with what the pre-paint script in index.html put on screen.
 */
export const themeAtom = atomWithStorage<ThemeState>(
  THEME_STORAGE_KEY,
  DEFAULT_THEME,
  themeStorage,
  { getOnInit: true }
);

const systemDarkAtom = atom(isSystemDark());

systemDarkAtom.onMount = setSystemDark => {
  setSystemDark(isSystemDark());
  return watchSystemDark(setSystemDark);
};

/** What Radix, the editor and the root element all render. */
export const resolvedThemeAtom = atom(get =>
  resolveTheme(get(themeAtom), get(systemDarkAtom))
);

const setAppearanceAtom = atom(
  null,
  (get, set, appearance: AppearancePreference) => {
    set(themeAtom, { ...get(themeAtom), appearance });
  }
);

const applyPresetThemeAtom = atom(null, (get, set, preset: unknown) => {
  set(
    themeAtom,
    applyPresetTheme(get(themeAtom), preset, get(resolvedThemeAtom).appearance)
  );
});

export const useResolvedTheme = () => useAtomValue(resolvedThemeAtom);

export const useAppearancePreference = () => useAtomValue(themeAtom).appearance;

export const useSetAppearance = () => useSetAtom(setAppearanceAtom);

/** Takes the detail of the editor's changePresetTheme event. */
export const useApplyPresetTheme = () => useSetAtom(applyPresetThemeAtom);
