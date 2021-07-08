import kebabCase from 'lodash/kebabCase';

import { isString } from '@/core/helper';
import { Theme, ThemeKey } from '@@types/core/theme';

export const createTheme = (): Theme => ({
  canvas: '#282828',
  table: '#191919',
  tableActive: '#14496d',
  focus: '#00a9ff',
  keyPK: '#B4B400',
  keyFK: '#dda8b1',
  keyPFK: '#60b9c4',
  font: '#a2a2a2',
  fontActive: 'white',
  fontPlaceholder: '#6D6D6D',
  contextmenu: '#191919',
  contextmenuActive: '#383d41',
  edit: '#ffc107',
  columnSelect: '#232a2f',
  columnActive: '#372908',
  minimapShadow: 'black',
  scrollbarThumb: '#6D6D6D',
  scrollbarThumbActive: '#a2a2a2',
  menubar: 'black',
  visualization: '#191919',
  diffAdd: '#74c56ad5',
  diffModify: '#f7894aac',
  diffRemove: '#dda8b1',
});

export const loadTheme = (theme: Theme, newTheme: Partial<Theme>) =>
  (Object.keys(theme) as ThemeKey[])
    .filter(key => isString(newTheme[key]))
    .forEach(key => (theme[key] = newTheme[key] as string));

export const themeToString = (theme: Theme) =>
  Object.keys(theme)
    .map(
      key =>
        `--vuerd-color-${kebabCase(key)}: var(--vuerd-theme-${kebabCase(
          key
        )}, ${theme[key as ThemeKey]});`
    )
    .join('');
