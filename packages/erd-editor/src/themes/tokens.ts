import { kebabCase } from 'lodash-es';

export type Theme = {
  canvasBackground: string;
  canvasBoundaryBackground: string;

  tableBackground: string;
  tableSelect: string;

  memoBackground: string;
  memoSelect: string;

  columnSelect: string;
  columnHover: string;

  relationshipHover: string;

  toolbarBackground: string;

  contextMenuBackground: string;
  contextMenuSelect: string;
  contextMenuHover: string;

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
