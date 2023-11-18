import { kebabCase } from 'lodash-es';

export type Theme = {
  canvasBackground: string;
  canvasBoundaryBackground: string;

  tableBackground: string;
  tableSelect: string;
  tableBorder: string;

  memoBackground: string;
  memoSelect: string;
  memoBorder: string;

  columnSelect: string;
  columnHover: string;

  relationshipHover: string;

  toolbarBackground: string;

  contextMenuBackground: string;
  contextMenuSelect: string;
  contextMenuHover: string;
  contextMenuBorder: string;

  minimapBorder: string;
  minimapShadow: string;
  minimapViewportBorder: string;
  minimapViewportBorderHover: string;

  dargSelectBackground: string;
  dargSelectBorder: string;

  scrollbarTrack: string;
  scrollbarThumb: string;
  scrollbarThumbHover: string;

  foreground: string;
  active: string;
  placeholder: string;

  focus: string;
  inputActive: string;

  keyPK: string;
  keyFK: string;
  keyPFK: string;
};

export const ThemeTokens: ReadonlyArray<keyof Theme> = [
  'canvasBackground',
  'canvasBoundaryBackground',

  'tableBackground',
  'tableSelect',
  'tableBorder',

  'memoBackground',
  'memoSelect',
  'memoBorder',

  'columnSelect',
  'columnHover',

  'relationshipHover',

  'toolbarBackground',

  'contextMenuBackground',
  'contextMenuSelect',
  'contextMenuHover',
  'contextMenuBorder',

  'minimapBorder',
  'minimapShadow',
  'minimapViewportBorder',
  'minimapViewportBorderHover',

  'dargSelectBackground',
  'dargSelectBorder',

  'scrollbarTrack',
  'scrollbarThumb',
  'scrollbarThumbHover',

  'foreground',
  'active',
  'placeholder',

  'focus',
  'inputActive',

  'keyPK',
  'keyFK',
  'keyPFK',
];

export const themeToTokensString = (theme: Theme) =>
  Object.keys(theme)
    .map(key => {
      const name = kebabCase(key);
      return `--${name}: var(--erd-editor-${name}, ${Reflect.get(
        theme,
        key
      )});`;
    })
    .join('\n');
