import type { GridTheme } from '@dineug/grid';
import { describe, expect, it } from 'vite-plus/test';

import { createTestTheme } from '@/__test-utils__';
import { toCellMarks, toGridTheme } from '@/components/dictionary/gridTheme';
import {
  AccentColor,
  Appearance,
  AppearanceList,
  createTheme,
  GrayColor,
} from '@/themes/radix-ui-theme';
import type { Theme } from '@/themes/tokens';

/** Each grid colour and the editor token it is read from, selectionFill aside. */
const SOURCES: ReadonlyArray<[keyof GridTheme, keyof Theme]> = [
  ['background', 'dictionaryBackground'],
  ['headerBackground', 'dictionaryHeaderBackground'],
  ['headerText', 'foreground'],
  ['text', 'active'],
  ['gridLine', 'dictionaryGridLine'],
  ['frozenBorder', 'grayColor7'],
  ['selectionBorder', 'accentColor9'],
  ['activeCellBorder', 'focus'],
  ['selectedHeaderBackground', 'dictionaryHeaderSelect'],
  ['selectedHeaderText', 'active'],
  ['fullSelectionBackground', 'accentColor6'],
  ['readonlyBackground', 'grayColor3'],
  ['scrollbarThumb', 'scrollbarThumb'],
  ['scrollbarTrack', 'scrollbarTrack'],
];

/** What the grid's own defaults spell their colours in, six or eight hex digits. */
const HEX_COLOR = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/;

describe('toGridTheme', () => {
  it('reads each of the fifteen grid colours from its own token', () => {
    const theme = createTestTheme();
    const grid = toGridTheme(theme);

    expect(Object.keys(grid)).toHaveLength(15);
    expect(Object.keys(grid).sort()).toEqual(
      [...SOURCES.map(([field]) => field), 'selectionFill'].sort()
    );
    SOURCES.forEach(([field, token]) => {
      expect(grid[field], `${field} <- ${token}`).toBe(theme[token]);
    });
  });

  it('takes the four surfaces of the sheet from the tab tokens alone', () => {
    const theme = createTestTheme();
    const grid = toGridTheme(theme);

    expect([
      grid.background,
      grid.headerBackground,
      grid.gridLine,
      grid.selectedHeaderBackground,
    ]).toEqual([
      theme.dictionaryBackground,
      theme.dictionaryHeaderBackground,
      theme.dictionaryGridLine,
      theme.dictionaryHeaderSelect,
    ]);
    expect(grid.background).not.toBe(theme.tableBackground);
    expect(grid.headerBackground).not.toBe(theme.tableHeaderBackground);
    expect(grid.gridLine).not.toBe(theme.tableBorder);
    expect(grid.selectedHeaderBackground).not.toBe(theme.columnSelect);
  });

  it('fills a selection with accent-9 at a 20% alpha', () => {
    const theme = createTestTheme();

    expect(toGridTheme(theme).selectionFill).toBe(`${theme.accentColor9}33`);
    expect(
      toGridTheme({ ...theme, accentColor9: ' #3E63DD ' }).selectionFill
    ).toBe('#3E63DD33');
    expect(toGridTheme({ ...theme, accentColor9: '#36d' }).selectionFill).toBe(
      '#3366dd33'
    );
  });

  it('fills no selection where an override spells the accent other than in hex, and keeps its edge', () => {
    const theme = createTestTheme();

    ['rgb(62, 99, 221)', 'royalblue', '#3e63dd80'].forEach(accent => {
      const grid = toGridTheme({ ...theme, accentColor9: accent });

      expect(grid.selectionFill, accent).toBe('transparent');
      expect(grid.selectionBorder, accent).toBe(accent);
    });
  });

  it('spells every colour of a resolved theme in hex, in both appearances', () => {
    AppearanceList.forEach(appearance => {
      const grid = toGridTheme(
        createTheme({
          appearance,
          grayColor: GrayColor.slate,
          accentColor: AccentColor.iris,
        })
      );
      const invalid = Object.entries(grid).filter(
        ([, value]) => !HEX_COLOR.test(value)
      );

      expect(invalid, appearance).toEqual([]);
      expect(grid.selectionFill, appearance).toMatch(/^#[0-9a-f]{6}33$/);
    });
  });

  it('hands back the theme it was given while every colour matches, and a new one once one changes', () => {
    const options = {
      appearance: Appearance.light,
      grayColor: GrayColor.gray,
      accentColor: AccentColor.blue,
    };
    const first = toGridTheme(createTheme(options));

    expect(toGridTheme(createTheme(options), first)).toBe(first);

    const dark = toGridTheme(
      createTheme({ ...options, appearance: Appearance.dark }),
      first
    );
    expect(dark).not.toBe(first);
    expect(dark.background).not.toBe(first.background);

    const accent = toGridTheme(
      { ...createTheme(options), accentColor9: '#000000' },
      first
    );
    expect(accent).not.toBe(first);
    expect(accent.selectionBorder).toBe('#000000');
  });
});

describe('toCellMarks', () => {
  it("writes each level's text on its own fill, from the tab's four mark tokens alone", () => {
    const theme = createTestTheme();

    expect(toCellMarks(theme)).toEqual({
      error: {
        color: theme.dictionaryErrorForeground,
        background: theme.dictionaryErrorBackground,
      },
      warning: {
        color: theme.dictionaryWarningForeground,
        background: theme.dictionaryWarningBackground,
      },
    });
  });

  it('hands back the marks it was given while both pairs match, and new ones once one changes', () => {
    const dark = createTheme({
      appearance: Appearance.dark,
      grayColor: GrayColor.slate,
      accentColor: AccentColor.indigo,
    });
    const marks = toCellMarks(dark);

    expect(Object.isFrozen(marks)).toBe(true);
    expect(Object.isFrozen(marks.error)).toBe(true);
    expect(toCellMarks({ ...dark }, marks)).toBe(marks);
    expect(toCellMarks({ ...dark, accentColor9: '#000000' }, marks)).toBe(
      marks
    );

    const warned = toCellMarks(
      { ...dark, dictionaryWarningBackground: '#000000' },
      marks
    );
    expect(warned).not.toBe(marks);
    expect(warned.warning.background).toBe('#000000');
    expect(
      toCellMarks({ ...dark, dictionaryErrorForeground: '#000000' }, marks)
        .error.color
    ).toBe('#000000');
  });
});
