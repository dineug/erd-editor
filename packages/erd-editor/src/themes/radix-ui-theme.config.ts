import { Theme } from '@/themes/tokens';

export const ThemeConfig: Theme = {
  grayColor1: 'gray-1',
  grayColor2: 'gray-2',
  grayColor3: 'gray-3',
  grayColor4: 'gray-4',
  grayColor5: 'gray-5',
  grayColor6: 'gray-6',
  grayColor7: 'gray-7',
  grayColor8: 'gray-8',
  grayColor9: 'gray-9',
  grayColor10: 'gray-10',
  grayColor11: 'gray-11',
  grayColor12: 'gray-12',

  accentColor1: 'accent-1',
  accentColor2: 'accent-2',
  accentColor3: 'accent-3',
  accentColor4: 'accent-4',
  accentColor5: 'accent-5',
  accentColor6: 'accent-6',
  accentColor7: 'accent-7',
  accentColor8: 'accent-8',
  accentColor9: 'accent-9',
  accentColor10: 'accent-10',
  accentColor11: 'accent-11',
  accentColor12: 'accent-12',

  canvasBackground: 'gray-3',
  canvasBoundaryBackground: 'gray-1',

  tableBackground: 'gray-2',
  // A step past the gray-3 canvas on the side away from the body, lighter in
  // dark and darker in light, so the header never reads as the canvas.
  tableHeaderBackground: 'gray-5',
  tableSelect: 'accent-8',
  tableBorder: 'gray-6',
  tableShadow: 'override-transparent',

  memoBackground: 'gray-2',
  memoSelect: 'accent-8',
  memoBorder: 'gray-6',
  memoShadow: 'override-transparent',

  columnSelect: 'accent-3',
  columnSelectHover: 'accent-4',
  columnHover: 'gray-4',

  relationshipHover: 'accent-8',

  visualizationLink: 'gray-7',
  visualizationColumn: 'gray-8',
  visualizationRelationship: 'gray-8',

  toolbarBackground: 'gray-1',

  contextMenuBackground: 'gray-2',
  contextMenuSelect: 'gray-4',
  contextMenuHover: 'accent-7',
  contextMenuBorder: 'gray-6',

  minimapBorder: 'override-black',
  minimapShadow: 'override-black',
  minimapViewportBorder: 'accent-7',
  minimapViewportBorderHover: 'accent-8',

  toastBackground: 'gray-2',
  toastBorder: 'gray-6',

  dragSelectBackground: 'accent-5',
  dragSelectBorder: 'accent-8',

  scrollbarTrack: 'grayA-3',
  scrollbarThumb: 'gray-9',
  scrollbarThumbHover: 'gray-10',

  foreground: 'gray-11',
  active: 'gray-12',
  placeholder: 'grayA-10',

  focus: 'accent-8',
  inputActive: 'accent-10',

  keyPK: `custom-amber--9`,
  keyFK: `custom-ruby--9`,
  keyPFK: `custom-cyan--9`,

  diffInsertBackground: `custom-green--4`,
  diffDeleteBackground: `custom-red--4`,
  diffCrossBackground: `custom-blue--4`,
  diffInsertForeground: `custom-green--11`,
  diffDeleteForeground: `custom-red--11`,
  diffCrossForeground: `custom-blue--11`,
} as const;

/**
 * What the gray, gold and bronze accents take instead: their low steps sit on
 * the gray-4 hover, so a selected row stays on gray-6 and a hovered one eases
 * back to gray-5, as gray-7 would take gray-11 text in light down to 3.76:1.
 */
export const NeutralAccentThemeConfig: Partial<Theme> = {
  columnSelect: 'gray-6',
  columnSelectHover: 'gray-5',
};

/**
 * What the light appearance takes instead: its gray 1 to 3 sit too close to lift
 * a table off the canvas, and a step 9 key or line reads under 3:1 on them, so
 * the boxes go white with a gray-8 edge and the keys drop to step 11.
 */
export const LightThemeConfig: Partial<Theme> = {
  tableBackground: 'override-#ffffff',
  tableBorder: 'gray-8',
  memoBackground: 'override-#ffffff',
  memoBorder: 'gray-8',
  tableShadow: 'override-rgba(0, 0, 0, 0.18)',
  memoShadow: 'override-rgba(0, 0, 0, 0.18)',
  minimapBorder: 'gray-7',
  keyPK: 'custom-amber--11',
  keyFK: 'custom-ruby--11',
  keyPFK: 'custom-cyan--11',
  // A step darker on the light canvas is what brings these strokes level with
  // the contrast their dark steps already have.
  visualizationLink: 'gray-8',
  visualizationColumn: 'gray-9',
  visualizationRelationship: 'gray-9',
};
