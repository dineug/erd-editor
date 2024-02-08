import { kebabCase } from 'lodash-es';

export type Theme = {
  grayColor1: string;
  grayColor2: string;
  grayColor3: string;
  grayColor4: string;
  grayColor5: string;
  grayColor6: string;
  grayColor7: string;
  grayColor8: string;
  grayColor9: string;
  grayColor10: string;
  grayColor11: string;
  grayColor12: string;

  accentColor1: string;
  accentColor2: string;
  accentColor3: string;
  accentColor4: string;
  accentColor5: string;
  accentColor6: string;
  accentColor7: string;
  accentColor8: string;
  accentColor9: string;
  accentColor10: string;
  accentColor11: string;
  accentColor12: string;

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

  toastBackground: string;
  toastBorder: string;

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

  diffInsertBackground: string;
  diffDeleteBackground: string;
  diffInsertForeground: string;
  diffDeleteForeground: string;
};

export const ThemeTokens: ReadonlyArray<keyof Theme> = [
  'grayColor1',
  'grayColor2',
  'grayColor3',
  'grayColor4',
  'grayColor5',
  'grayColor6',
  'grayColor7',
  'grayColor8',
  'grayColor9',
  'grayColor10',
  'grayColor11',
  'grayColor12',

  'accentColor1',
  'accentColor2',
  'accentColor3',
  'accentColor4',
  'accentColor5',
  'accentColor6',
  'accentColor7',
  'accentColor8',
  'accentColor9',
  'accentColor10',
  'accentColor11',
  'accentColor12',

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

  'toastBackground',
  'toastBorder',

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

  'diffInsertBackground',
  'diffDeleteBackground',
  'diffInsertForeground',
  'diffDeleteForeground',
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
