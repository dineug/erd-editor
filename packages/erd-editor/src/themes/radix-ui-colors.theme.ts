import { amber, crimson, cyan } from '@radix-ui/colors';
import { get } from 'lodash-es';

import { Theme } from '@/themes/tokens';

const ThemeToColor: Theme = {
  canvasBackground: '2',
  canvasBoundaryBackground: '1',

  tableBackground: 'A3',
  tableSelect: '8',

  memoBackground: 'A3',
  memoSelect: '8',

  columnHover: '4',
  columnSelect: '5',

  relationshipHover: '4',

  toolbarBackground: '3',

  contextMenuBackground: 'A3',
  contextMenuHover: '4',
  contextMenuSelect: '5',

  dargSelectBackground: 'A4',
  dargSelectBorder: '8',

  scrollbarTrack: 'A3',
  scrollbarThumb: '9',
  scrollbarThumbHover: '10',

  foreground: '11',
  active: '12',
  placeholder: 'A11',

  focus: '8',
  inputActive: '10',

  keyPK: amber.amber9,
  keyFK: crimson.crimson9,
  keyPFK: cyan.cyan9,
} as const;
const ThemeKeys: ReadonlyArray<string> = Object.keys(ThemeToColor);

export function createTheme(
  name: string,
  color: Record<string, string>,
  colorA: Record<string, string>
) {
  return (): Theme =>
    ThemeKeys.reduce<Record<string, string>>((acc, key) => {
      const colorKey: string = get(ThemeToColor, key);
      const isAlpha = colorKey.startsWith('A');
      const colorName = `${name}${colorKey}`;

      acc[key] = isAlpha
        ? get(colorA, colorName, colorKey)
        : get(color, colorName, colorKey);

      return acc;
    }, {}) as Theme;
}
