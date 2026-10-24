import { observable, watch } from '@dineug/r-html';
import { isString } from 'es-toolkit';
import { get } from 'es-toolkit/compat';

import { useDarkMode } from '@/hooks/useDarkMode';
import { Unsubscribe } from '@/internal-types';
import {
  AccentColor,
  AccentColorList,
  Appearance,
  AppearanceList,
  AppearanceOptionList,
  createTheme,
  GrayColor,
  GrayColorList,
  ResolvedThemeOptions,
  SYSTEM_APPEARANCE,
  ThemeOptions,
} from '@/themes/radix-ui-theme';
import { Theme, ThemeTokens } from '@/themes/tokens';
import { arrayHas } from '@/utils/arrayHas';

const defaultThemeOptions: ResolvedThemeOptions = {
  grayColor: GrayColor.slate,
  accentColor: AccentColor.indigo,
  appearance: Appearance.dark,
} as const;

const hasGrayColor = arrayHas<string>(GrayColorList);
const hasAccentColor = arrayHas<string>(AccentColorList);
const hasAppearance = arrayHas<string>(AppearanceList);
const hasAppearanceOption = arrayHas<string>(AppearanceOptionList);

export type ThemeState = {
  options: ThemeOptions;
  /** What system shows once a host names it; null follows the OS color scheme. */
  systemAppearance: Appearance | null;
  preset: Theme;
  custom: Partial<Theme>;
};

/**
 * An element's theme: the preset its options build, the tokens a host lays
 * over it and the light or dark system shows, with the setters a host calls.
 * A component calls it at setup, since it follows the OS color scheme from mount.
 */
export function useThemeHost() {
  const themeState = observable<ThemeState>({
    options: { ...defaultThemeOptions },
    systemAppearance: null,
    preset: createTheme(defaultThemeOptions),
    custom: {},
  });

  const theme = observable<Theme>(
    {
      ...themeState.preset,
      ...themeState.custom,
    },
    { shallow: true }
  );

  const darkMode = useDarkMode();

  const resolveAppearance = (): Appearance => {
    const { options, systemAppearance } = themeState;
    if (options.appearance !== SYSTEM_APPEARANCE) return options.appearance;
    if (systemAppearance) return systemAppearance;
    return darkMode.state.isDark ? Appearance.dark : Appearance.light;
  };

  const applyPreset = () => {
    Object.assign(
      themeState.preset,
      createTheme({ ...themeState.options, appearance: resolveAppearance() })
    );
  };

  const followsSystem = () =>
    themeState.options.appearance === SYSTEM_APPEARANCE;

  const unsubscribes: Unsubscribe[] = [
    watch(darkMode.state).subscribe(propName => {
      if (propName !== 'isDark' || !followsSystem()) return;
      if (themeState.systemAppearance) return;

      applyPreset();
    }),
    watch(themeState.options).subscribe(applyPreset),
    watch(themeState.preset).subscribe(() => {
      Object.assign(theme, themeState.preset, themeState.custom);
    }),
    watch(themeState).subscribe(propName => {
      if (propName === 'systemAppearance') {
        followsSystem() && applyPreset();
        return;
      }
      if (propName !== 'custom') return;

      Object.assign(theme, themeState.preset, themeState.custom);
    }),
  ];

  const setPresetTheme = (newThemeOptions: Partial<ThemeOptions>) => {
    if (
      isString(newThemeOptions.grayColor) &&
      hasGrayColor(newThemeOptions.grayColor)
    ) {
      themeState.options.grayColor = newThemeOptions.grayColor;
    }
    if (
      isString(newThemeOptions.accentColor) &&
      hasAccentColor(newThemeOptions.accentColor)
    ) {
      themeState.options.accentColor = newThemeOptions.accentColor;
    }
    if (
      isString(newThemeOptions.appearance) &&
      hasAppearanceOption(newThemeOptions.appearance)
    ) {
      themeState.options.appearance = newThemeOptions.appearance;
    }
  };

  const setSystemAppearance = (appearance: Appearance | null) => {
    themeState.systemAppearance =
      isString(appearance) && hasAppearance(appearance) ? appearance : null;
  };

  const setTheme = (newTheme: Partial<Theme>) => {
    const customTheme: Partial<Theme> = {};
    ThemeTokens.forEach(key => {
      const value = get(newTheme, key);
      isString(value) && Reflect.set(customTheme, key, value);
    });
    themeState.custom = customTheme;
  };

  return {
    theme,
    themeState,
    resolveAppearance,
    followsSystem,
    hasDarkMode: () => resolveAppearance() === Appearance.dark,
    setPresetTheme,
    setSystemAppearance,
    setTheme,
    /** Stops repainting; the OS color scheme listener goes on unmount. */
    destroy: () => unsubscribes.forEach(unsubscribe => unsubscribe()),
  };
}
