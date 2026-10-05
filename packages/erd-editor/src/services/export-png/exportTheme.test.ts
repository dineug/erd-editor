import { describe, expect, it } from 'vite-plus/test';

import { createTestTheme } from '@/__test-utils__';
import {
  createExportTheme,
  TRANSPARENT_BACKGROUND,
} from '@/services/export-png/exportTheme';
import {
  AccentColor,
  Appearance,
  createTheme,
  GrayColor,
} from '@/themes/radix-ui-theme';

const sceneTheme = createTestTheme();

const themeOptions = {
  grayColor: GrayColor.mauve,
  accentColor: AccentColor.crimson,
};

describe('createExportTheme', () => {
  it('keeps every colour the canvas shows when the image matches the screen', () => {
    const theme = createExportTheme({
      sceneTheme,
      themeOptions,
      isDarkMode: true,
      darkMode: true,
      background: true,
    });

    expect(theme).toEqual(sceneTheme);
    expect(theme).not.toBe(sceneTheme);
  });

  it('draws the other appearance from the preset of the same gray and accent', () => {
    expect(
      createExportTheme({
        sceneTheme,
        themeOptions,
        isDarkMode: true,
        darkMode: false,
        background: true,
      })
    ).toEqual(createTheme({ ...themeOptions, appearance: Appearance.light }));

    expect(
      createExportTheme({
        sceneTheme,
        themeOptions,
        isDarkMode: false,
        darkMode: true,
        background: true,
      })
    ).toEqual(createTheme({ ...themeOptions, appearance: Appearance.dark }));
  });

  it('makes the canvas colour transparent and nothing else with the background off', () => {
    const theme = createExportTheme({
      sceneTheme,
      themeOptions,
      isDarkMode: false,
      darkMode: false,
      background: false,
    });

    expect(theme).toEqual({
      ...sceneTheme,
      canvasBackground: TRANSPARENT_BACKGROUND,
    });
  });

  it('takes the background out of the other appearance too', () => {
    const theme = createExportTheme({
      sceneTheme,
      themeOptions,
      isDarkMode: false,
      darkMode: true,
      background: false,
    });

    expect(theme.canvasBackground).toBe(TRANSPARENT_BACKGROUND);
    expect(theme.tableBackground).toBe(
      createTheme({ ...themeOptions, appearance: Appearance.dark })
        .tableBackground
    );
  });
});
