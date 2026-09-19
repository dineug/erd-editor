import { accentColors, grayColors } from '@radix-ui/themes/props';

export type AppearancePreference = 'dark' | 'light' | 'system';
export type ResolvedAppearance = 'dark' | 'light';
export type AccentColor = (typeof accentColors)[number];
export type GrayColor = (typeof grayColors)[number];

export type ThemeState = {
  appearance: AppearancePreference;
  accentColor: AccentColor;
  grayColor: GrayColor;
};

export type ResolvedTheme = Omit<ThemeState, 'appearance'> & {
  appearance: ResolvedAppearance;
};

/** The pre-paint script in index.html reads the same key with the same rules. */
export const THEME_STORAGE_KEY = '@theme';
export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

export const DEFAULT_THEME: ThemeState = {
  appearance: 'dark',
  accentColor: 'jade',
  grayColor: 'olive',
};

const APPEARANCE_PREFERENCES: readonly AppearancePreference[] = [
  'dark',
  'light',
  'system',
];
const RESOLVED_APPEARANCES: readonly ResolvedAppearance[] = ['dark', 'light'];

function isOneOf<T extends string>(
  values: readonly T[],
  value: unknown
): value is T {
  return typeof value === 'string' && values.some(item => item === value);
}

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Reads whatever an older version, another tab or a hand edit left in storage.
 * Each field falls back to its default alone, so one bad value keeps the rest.
 */
export function parseThemeState(value: unknown): ThemeState {
  const record = toRecord(value);

  return {
    appearance: isOneOf(APPEARANCE_PREFERENCES, record.appearance)
      ? record.appearance
      : DEFAULT_THEME.appearance,
    accentColor: isOneOf(accentColors, record.accentColor)
      ? record.accentColor
      : DEFAULT_THEME.accentColor,
    grayColor: isOneOf(grayColors, record.grayColor)
      ? record.grayColor
      : DEFAULT_THEME.grayColor,
  };
}

export function resolveAppearance(
  preference: AppearancePreference,
  systemDark: boolean
): ResolvedAppearance {
  if (preference !== 'system') return preference;
  return systemDark ? 'dark' : 'light';
}

export function resolveTheme(
  state: ThemeState,
  systemDark: boolean
): ResolvedTheme {
  return {
    ...state,
    appearance: resolveAppearance(state.appearance, systemDark),
  };
}

/**
 * Folds the editor's theme builder choice into the preference. Only an
 * appearance other than the one on screen is a choice, so leaving it alone
 * keeps a system preference while the colors still apply.
 */
export function applyPresetTheme(
  state: ThemeState,
  preset: unknown,
  resolved: ResolvedAppearance
): ThemeState {
  const record = toRecord(preset);

  return {
    appearance:
      isOneOf(RESOLVED_APPEARANCES, record.appearance) &&
      record.appearance !== resolved
        ? record.appearance
        : state.appearance,
    accentColor: isOneOf(accentColors, record.accentColor)
      ? record.accentColor
      : state.accentColor,
    grayColor: isOneOf(grayColors, record.grayColor)
      ? record.grayColor
      : state.grayColor,
  };
}

/** Without matchMedia there is no system to follow, so it reads as the dark default. */
export function isSystemDark(): boolean {
  if (typeof globalThis.matchMedia !== 'function') return true;
  return globalThis.matchMedia(SYSTEM_DARK_QUERY).matches;
}

export function watchSystemDark(
  callback: (systemDark: boolean) => void
): () => void {
  if (typeof globalThis.matchMedia !== 'function') return () => {};

  const query = globalThis.matchMedia(SYSTEM_DARK_QUERY);
  const handleChange = () => callback(query.matches);

  query.addEventListener('change', handleChange);
  return () => query.removeEventListener('change', handleChange);
}

/**
 * Keeps the root element's Radix class and color-scheme on the resolved
 * appearance, as the pre-paint script left them, for scrollbars and controls.
 */
export function applyDocumentAppearance(
  root: HTMLElement,
  appearance: ResolvedAppearance
) {
  root.classList.toggle('dark-theme', appearance === 'dark');
  root.classList.toggle('light-theme', appearance === 'light');
  root.style.colorScheme = appearance;
}
