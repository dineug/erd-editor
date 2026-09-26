import {
  AccentColor,
  Appearance,
  GrayColor,
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
};

/** The three values the theme settings and the editor's theme builder share. */
export type ThemeSettings = Pick<
  PluginSettings,
  'appearance' | 'grayColor' | 'accentColor'
>;

/** A theme as the editor takes it, with auto already resolved to light or dark. */
export type ResolvedTheme = ThemeOptions & { appearance: Appearance };

/** How a tab themes its editor, which main.ts implements over the settings. */
export interface ThemeHost {
  /** The theme every open diagram shows now. */
  current(): ResolvedTheme;
  /** The theme the tab's own theme builder picked, the event detail as it came. */
  picked(theme: unknown): void;
}

export const APPEARANCES: ReadonlyArray<PluginSettings['appearance']> = [
  'auto',
  Appearance.light,
  Appearance.dark,
];
export const GRAY_COLORS: ReadonlyArray<GrayColor> = Object.values(GrayColor);
export const ACCENT_COLORS: ReadonlyArray<AccentColor> =
  Object.values(AccentColor);

/** Coding agents on, as the VS Code extension's setting is; the theme follows Obsidian. */
export const DEFAULT_SETTINGS: Readonly<PluginSettings> = {
  agentHub: true,
  appearance: 'auto',
  grayColor: GrayColor.slate,
  accentColor: AccentColor.indigo,
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
  };
}

/** The theme to show, auto taking Obsidian's light or dark. */
export function resolveTheme(
  { appearance, grayColor, accentColor }: ThemeSettings,
  obsidianDark: boolean
): ResolvedTheme {
  return {
    appearance:
      appearance === 'auto'
        ? obsidianDark
          ? Appearance.dark
          : Appearance.light
        : appearance,
    grayColor,
    accentColor,
  };
}

/**
 * What the editor's theme builder picked, as the settings keep it. The builder
 * always names light or dark, so while the setting is auto the one auto shows
 * now keeps it auto: picking a color does not pin the appearance.
 */
export function themeFromBuilder(
  current: ThemeSettings,
  picked: unknown,
  obsidianDark: boolean
): ThemeSettings {
  const next = readTheme(picked, current);
  const shown = resolveTheme(current, obsidianDark).appearance;
  return current.appearance === 'auto' && next.appearance === shown
    ? { ...next, appearance: 'auto' }
    : next;
}
