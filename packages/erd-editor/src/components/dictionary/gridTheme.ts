import type { CellStyle, GridTheme } from '@dineug/grid';

import type { DictionaryCheckLevel } from '@/engine/modules/dictionary/checks';
import type { Theme } from '@/themes/tokens';

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** The alpha byte a selected range's fill lays over the accent, 20% of opaque. */
const SELECTION_ALPHA = '33';

/**
 * The accent a selected range is filled with, translucent so the cells under
 * it still read. An override spelt other than in hex would paint opaque over
 * them, so the range then keeps its edge alone.
 */
function selectionFillOf(color: string): string {
  const match = HEX.exec(color.trim());
  if (!match) return 'transparent';

  const digits = match[1];
  const hex =
    digits.length === 6
      ? digits
      : [...digits].map(digit => `${digit}${digit}`).join('');

  return `#${hex}${SELECTION_ALPHA}`;
}

/**
 * The grid's fifteen colours from the palette the editor resolved: the sheet's
 * cells, band, lines and selected header from the tab's own tokens, the rest
 * from the shared text, focus, gray, accent and scrollbar tokens.
 */
function gridThemeOf(theme: Theme): GridTheme {
  return {
    background: theme.dictionaryBackground,
    headerBackground: theme.dictionaryHeaderBackground,
    headerText: theme.foreground,
    text: theme.active,
    gridLine: theme.dictionaryGridLine,
    frozenBorder: theme.grayColor7,
    selectionFill: selectionFillOf(theme.accentColor9),
    selectionBorder: theme.accentColor9,
    activeCellBorder: theme.focus,
    selectedHeaderBackground: theme.dictionaryHeaderSelect,
    selectedHeaderText: theme.active,
    fullSelectionBackground: theme.accentColor6,
    readonlyBackground: theme.grayColor3,
    scrollbarThumb: theme.scrollbarThumb,
    scrollbarTrack: theme.scrollbarTrack,
  };
}

/**
 * The theme the tab hands its grid. The grid redraws on a new object, so the
 * one handed before comes back while every colour still matches, and only a
 * theme change, light to dark or a new accent, makes another.
 */
export function toGridTheme(
  theme: Theme,
  previous?: Readonly<GridTheme>
): Readonly<GridTheme> {
  const next = gridThemeOf(theme);
  if (!previous) return next;

  const keys = Object.keys(next) as Array<keyof GridTheme>;
  return keys.every(key => previous[key] === next[key]) ? previous : next;
}

/** The style a sheet gives a cell the checks mark, by the loudest level they find. */
export type CellMarks = Readonly<
  Record<DictionaryCheckLevel, Readonly<CellStyle>>
>;

const sameStyle = (a: Readonly<CellStyle>, b: Readonly<CellStyle>) =>
  a.color === b.color && a.background === b.background;

/**
 * Each level's text on its own fill, from the tab's four mark tokens: the
 * error pair and the warning pair. The marks handed before come back while
 * both pairs match, so the tab hands the grid a new style getter only then.
 */
export function toCellMarks(theme: Theme, previous?: CellMarks): CellMarks {
  const error: CellStyle = Object.freeze({
    color: theme.dictionaryErrorForeground,
    background: theme.dictionaryErrorBackground,
  });
  const warning: CellStyle = Object.freeze({
    color: theme.dictionaryWarningForeground,
    background: theme.dictionaryWarningBackground,
  });

  if (
    previous &&
    sameStyle(previous.error, error) &&
    sameStyle(previous.warning, warning)
  ) {
    return previous;
  }
  return Object.freeze({ error, warning });
}
