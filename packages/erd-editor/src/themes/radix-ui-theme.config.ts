import { amber, crimson, cyan } from '@radix-ui/colors';

import { Theme } from '@/themes/tokens';

export const ThemeConfig: Theme = {
  canvasBackground: 'gray-4',
  canvasBoundaryBackground: 'gray-9',

  tableBackground: 'gray-2',
  tableSelect: 'accent-8',

  memoBackground: 'gray-2',
  memoSelect: 'accent-8',

  columnHover: 'accent-6',
  columnSelect: 'accent-7',

  relationshipHover: 'accent-6',

  toolbarBackground: 'gray-2',

  contextMenuBackground: 'gray-2',
  contextMenuHover: 'accent-7',
  contextMenuSelect: 'accent-6',

  dargSelectBackground: 'grayA-4',
  dargSelectBorder: 'accent-8',

  scrollbarTrack: 'grayA-3',
  scrollbarThumb: 'gray-9',
  scrollbarThumbHover: 'gray-10',

  foreground: 'gray-11',
  active: 'gray-12',
  placeholder: 'grayA-10',

  focus: 'accent-9',
  inputActive: 'accent-10',

  keyPK: `override-${amber.amber9}`,
  keyFK: `override-${crimson.crimson9}`,
  keyPFK: `override-${cyan.cyan9}`,
} as const;
