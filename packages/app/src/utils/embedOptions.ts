import type { ErdViewerElement } from '@dineug/erd-editor';
import { accentColors, grayColors } from '@radix-ui/themes/props';

import { isLocaleCode } from '@/i18n/locales';
import {
  type AccentColor,
  type AppearancePreference,
  type GrayColor,
  resolveAppearance,
  type ResolvedAppearance,
} from '@/utils/theme';

/** The viewer's gray colors: Radix's, without the auto that follows the accent. */
export type EmbedGrayColor = Exclude<GrayColor, 'auto'>;
/** What the viewer's setLocale takes: system, or one of its display languages. */
export type EmbedLocale = Parameters<ErdViewerElement['setLocale']>[0];
export type EmbedNameView = NonNullable<ErdViewerElement['nameView']>;

/** The options of an /embed URL; null is an option the URL leaves to the viewer. */
export type EmbedOptions = {
  src: string;
  theme: AppearancePreference | null;
  locale: EmbedLocale | null;
  nameView: EmbedNameView | null;
  minimap: boolean;
  controls: boolean;
  accentColor: AccentColor | null;
  grayColor: EmbedGrayColor | null;
};

/**
 * What the viewer shows for an option the URL leaves out, copied from it: its
 * indigo and slate, not the app's own colors. A null name view is the document's.
 */
export const EMBED_DEFAULTS = {
  theme: 'system',
  locale: 'system',
  nameView: null,
  minimap: true,
  controls: true,
  accentColor: 'indigo',
  grayColor: 'slate',
} as const satisfies Omit<EmbedOptions, 'src'>;

export const DEFAULT_EMBED_HEIGHT = 480;

const THEMES: ReadonlyArray<AppearancePreference> = ['light', 'dark', 'system'];
const NAME_VIEWS: ReadonlyArray<EmbedNameView> = [
  'physical',
  'logical',
  'both',
];
const GRAY_COLORS = grayColors.filter(
  (color): color is EmbedGrayColor => color !== 'auto'
);

function pick<T extends string>(
  values: ReadonlyArray<T>,
  value: string | null
): T | null {
  return values.find(item => item === value) ?? null;
}

function pickLocale(value: string | null): EmbedLocale | null {
  if (value === 'system') return value;
  return value !== null && isLocaleCode(value) ? value : null;
}

/**
 * Reads the options of an /embed URL. A repeated name takes its first value, a
 * value the viewer does not take reads as absent, and src is kept as it came.
 */
export function parseEmbedParams(
  search: string | URLSearchParams
): EmbedOptions {
  const params =
    typeof search === 'string' ? new URLSearchParams(search) : search;

  return {
    src: params.get('src') ?? '',
    theme: pick(THEMES, params.get('theme')),
    locale: pickLocale(params.get('locale')),
    nameView: pick(NAME_VIEWS, params.get('name-view')),
    minimap: params.get('minimap') !== 'false',
    controls: params.get('controls') !== 'false',
    accentColor: pick(accentColors, params.get('accent-color')),
    grayColor: pick(GRAY_COLORS, params.get('gray-color')),
  };
}

/**
 * The /embed URL of the options, in a fixed order and without an option equal
 * to the viewer's default; empty while there is no src.
 */
export function toEmbedUrl(origin: string, options: EmbedOptions): string {
  if (options.src === '') return '';

  const params = new URLSearchParams({ src: options.src });
  const setUnlessDefault = (
    name: string,
    value: string | null,
    fallback: string
  ) => {
    if (value !== null && value !== fallback) params.set(name, value);
  };

  setUnlessDefault('theme', options.theme, EMBED_DEFAULTS.theme);
  setUnlessDefault('locale', options.locale, EMBED_DEFAULTS.locale);
  if (options.nameView !== null) params.set('name-view', options.nameView);
  if (!options.minimap) params.set('minimap', 'false');
  if (!options.controls) params.set('controls', 'false');
  setUnlessDefault(
    'accent-color',
    options.accentColor,
    EMBED_DEFAULTS.accentColor
  );
  setUnlessDefault('gray-color', options.grayColor, EMBED_DEFAULTS.grayColor);

  return `${origin}/embed?${params}`;
}

/** A height typed as a positive whole number of pixels, else the default. */
export function parseEmbedHeight(input: string): number {
  const text = input.trim();
  if (!/^\d+$/.test(text)) return DEFAULT_EMBED_HEIGHT;

  const height = Number(text);
  return Number.isSafeInteger(height) && height > 0
    ? height
    : DEFAULT_EMBED_HEIGHT;
}

/**
 * The iframe a page pastes. The URL goes in unescaped: its query is encoded,
 * so it holds no quote or angle bracket, and every ampersand precedes a name.
 */
export function toIframeSnippet(url: string, height: number): string {
  return `<iframe src="${url}" width="100%" height="${height}" style="border: 0" loading="lazy" title="ERD Editor"></iframe>`;
}

/** The appearance the URL's theme shows, the system's when it names none. */
export function embedAppearance(
  theme: AppearancePreference | null,
  systemDark: boolean
): ResolvedAppearance {
  return resolveAppearance(theme ?? EMBED_DEFAULTS.theme, systemDark);
}
