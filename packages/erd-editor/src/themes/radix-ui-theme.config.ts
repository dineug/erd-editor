import { amber, cyan, ruby } from '@radix-ui/colors';

import { Theme } from '@/themes/tokens';

export const ThemeConfig: Theme = {
  canvasBackground: 'gray-3',
  canvasBoundaryBackground: 'gray-1',

  tableBackground: 'gray-2',
  tableSelect: 'accent-8',
  tableBorder: 'gray-6',

  memoBackground: 'gray-2',
  memoSelect: 'accent-8',
  memoBorder: 'gray-6',

  columnSelect: 'gray-5',
  columnHover: 'gray-4',

  relationshipHover: 'accent-8',

  toolbarBackground: 'gray-1',

  contextMenuBackground: 'gray-2',
  contextMenuSelect: 'gray-4',
  contextMenuHover: 'accent-7',
  contextMenuBorder: 'gray-6',

  minimapBorder: 'override-black',
  minimapShadow: 'override-black',
  minimapViewportBorder: 'accent-7',
  minimapViewportBorderHover: 'accent-8',

  dargSelectBackground: 'accent-5',
  dargSelectBorder: 'accent-8',

  scrollbarTrack: 'grayA-3',
  scrollbarThumb: 'gray-9',
  scrollbarThumbHover: 'gray-10',

  foreground: 'gray-11',
  active: 'gray-12',
  placeholder: 'grayA-10',

  focus: 'accent-8',
  inputActive: 'accent-10',

  keyPK: `override-${amber.amber9}`,
  keyFK: `override-${ruby.ruby9}`,
  keyPFK: `override-${cyan.cyan9}`,
} as const;
