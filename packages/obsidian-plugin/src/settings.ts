import type { ErdEditorElement } from '@dineug/erd-editor';
import {
  AccentColor,
  Appearance,
  GrayColor,
  type Locale,
  LocaleLabel,
  type LocaleSetting,
  type ThemeOptions,
} from '@dineug/erd-editor-webview-bridge';

/** What the plugin keeps in data.json, per vault. */
export type PluginSettings = {
  /** Whether coding agents may edit the open diagrams through the hub. */
  agentHub: boolean;
  /** Auto follows Obsidian's light or dark and switches with it. */
  appearance: ThemeOptions['appearance'];
  grayColor: GrayColor;
  accentColor: AccentColor;
  /** The editor's display language; auto follows Obsidian's language. */
  locale: LocaleSetting;
};

/** The three values the theme settings and the editor's theme builder share. */
export type ThemeSettings = Pick<
  PluginSettings,
  'appearance' | 'grayColor' | 'accentColor'
>;

/**
 * A theme as the editor takes it: auto spelled system, as its theme builder
 * names it, beside the light or dark Obsidian shows for system to follow.
 */
export type EditorTheme = Omit<ThemeSettings, 'appearance'> & {
  appearance: Appearance | 'system';
  systemAppearance: Appearance;
};

/** How a tab themes its editor, which main.ts implements over the settings. */
export interface ThemeHost {
  /** The theme every open diagram shows now. */
  current(): EditorTheme;
  /** The theme the tab's own theme builder picked, the event detail as it came. */
  picked(theme: unknown): void;
}

/**
 * A display language as the editor takes it: auto spelled system, as its
 * language picker names it, beside Obsidian's language for system to follow.
 */
export type EditorLocale = {
  locale: Parameters<ErdEditorElement['setLocale']>[0];
  /** Obsidian's language as a BCP 47 tag; null leaves the editor to the browser's languages. */
  systemLocale: string | null;
};

/** How a tab sets its editor's display language, which main.ts implements over the settings. */
export interface LocaleHost {
  /** The display language every open diagram shows now. */
  current(): EditorLocale;
  /** The language the tab's own language picker picked, the event detail as it came. */
  picked(detail: unknown): void;
}

export const APPEARANCES: ReadonlyArray<PluginSettings['appearance']> = [
  'auto',
  Appearance.light,
  Appearance.dark,
];
export const GRAY_COLORS: ReadonlyArray<GrayColor> = Object.values(GrayColor);
export const ACCENT_COLORS: ReadonlyArray<AccentColor> =
  Object.values(AccentColor);
/** Auto, then every display language the editor offers, in its picker's order. */
export const LOCALES: ReadonlyArray<LocaleSetting> = [
  'auto',
  ...(Object.keys(LocaleLabel) as Locale[]),
];
/** What the settings tab calls each: Auto, then each language by its own name. */
export const LOCALE_NAMES: Readonly<Record<LocaleSetting, string>> = {
  auto: 'Auto',
  ...LocaleLabel,
};

/** Coding agents on, as the VS Code extension's setting is; the theme and the language follow Obsidian. */
export const DEFAULT_SETTINGS: Readonly<PluginSettings> = {
  agentHub: true,
  appearance: 'auto',
  grayColor: GrayColor.slate,
  accentColor: AccentColor.indigo,
  locale: 'auto',
};

function fields(data: unknown): Record<string, unknown> {
  return typeof data === 'object' && data !== null
    ? (data as Record<string, unknown>)
    : {};
}

function oneOf<T>(value: unknown, allowed: ReadonlyArray<T>, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** The three theme values of data, each one that is missing or unknown taken from fallback. */
export function readTheme(
  data: unknown,
  fallback: ThemeSettings
): ThemeSettings {
  const saved = fields(data);
  return {
    appearance: oneOf(saved.appearance, APPEARANCES, fallback.appearance),
    grayColor: oneOf(saved.grayColor, GRAY_COLORS, fallback.grayColor),
    accentColor: oneOf(saved.accentColor, ACCENT_COLORS, fallback.accentColor),
  };
}

/** Reads what loadData gave back, keeping a default for every field it lacks or holds wrong. */
export function readSettings(data: unknown): PluginSettings {
  const saved = fields(data);
  return {
    agentHub:
      typeof saved.agentHub === 'boolean'
        ? saved.agentHub
        : DEFAULT_SETTINGS.agentHub,
    ...readTheme(saved, DEFAULT_SETTINGS),
    locale: oneOf(saved.locale, LOCALES, DEFAULT_SETTINGS.locale),
  };
}

/** The theme to show, auto following Obsidian's light or dark. */
export function editorTheme(
  { appearance, grayColor, accentColor }: ThemeSettings,
  obsidianDark: boolean
): EditorTheme {
  return {
    appearance: appearance === 'auto' ? 'system' : appearance,
    grayColor,
    accentColor,
    systemAppearance: obsidianDark ? Appearance.dark : Appearance.light,
  };
}

/**
 * What the editor's theme builder picked, as the settings keep it: its system
 * is auto. Anything missing or unknown keeps the current value.
 */
export function themeFromBuilder(
  current: ThemeSettings,
  picked: unknown
): ThemeSettings {
  const saved = fields(picked);
  return readTheme(
    saved.appearance === 'system' ? { ...saved, appearance: 'auto' } : saved,
    current
  );
}

/** The display language to show, auto following Obsidian's language. */
export function editorLocale(
  locale: LocaleSetting,
  systemLocale: string | null
): EditorLocale {
  return { locale: locale === 'auto' ? 'system' : locale, systemLocale };
}

/**
 * What the editor's language picker picked, as the settings keep it: its
 * system is auto. Anything missing or unknown keeps the current value.
 */
export function localeFromPicker(
  current: LocaleSetting,
  picked: unknown
): LocaleSetting {
  const { locale } = fields(picked);
  return oneOf(locale === 'system' ? 'auto' : locale, LOCALES, current);
}

/** Where Obsidian keeps its language in localStorage, which getLanguage reads. */
const LANGUAGE_KEY = 'language';

/**
 * Obsidian's display language: getLanguage, added in Obsidian 1.8.7, else the
 * localStorage key it reads, else null for the browser's, which Obsidian then
 * follows too. Its pt is European Portuguese; the editor reads pt as Brazilian.
 */
export function obsidianLanguage(
  getLanguage: (() => string) | undefined,
  storage: Pick<Storage, 'getItem'>
): string | null {
  const language = getLanguage ? getLanguage() : storage.getItem(LANGUAGE_KEY);
  if (!language) return null;
  return language === 'pt' ? 'pt-PT' : language;
}
