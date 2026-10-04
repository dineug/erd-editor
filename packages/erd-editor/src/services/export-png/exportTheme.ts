import {
  Appearance,
  createTheme,
  type ThemeOptions,
} from '@/themes/radix-ui-theme';
import type { Theme } from '@/themes/tokens';

/** What the canvas is painted with once the background is off: nothing at all. */
export const TRANSPARENT_BACKGROUND = 'rgba(0,0,0,0)';

export type ExportThemeOptions = {
  /** The palette the canvas is painted with now, overrides included. */
  sceneTheme: Theme;
  /** The gray and accent the editor's preset is built from. */
  themeOptions: Pick<ThemeOptions, 'grayColor' | 'accentColor'>;
  /** Whether the editor shows its dark appearance now. */
  isDarkMode: boolean;
  /** Whether the image is drawn dark. */
  darkMode: boolean;
  /** Whether the image keeps the canvas colour behind what it draws. */
  background: boolean;
};

/**
 * The palette an image is drawn with. The appearance on screen keeps every
 * colour the canvas shows, overrides included; the other one is the preset of
 * the same gray and accent, since no override was ever written for it.
 *
 * @example
 * const theme = createExportTheme({ sceneTheme, themeOptions, isDarkMode, darkMode, background });
 */
export function createExportTheme({
  sceneTheme,
  themeOptions: { grayColor, accentColor },
  isDarkMode,
  darkMode,
  background,
}: ExportThemeOptions): Theme {
  const theme =
    darkMode === isDarkMode
      ? { ...sceneTheme }
      : createTheme({
          grayColor,
          accentColor,
          appearance: darkMode ? Appearance.dark : Appearance.light,
        });

  // The background rect and the box under a referential action label both
  // paint this colour, so one token takes both away.
  return background
    ? theme
    : { ...theme, canvasBackground: TRANSPARENT_BACKGROUND };
}
