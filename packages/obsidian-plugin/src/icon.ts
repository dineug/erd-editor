/** The id Obsidian knows the ERD Editor icon by, for the tab header and the New ERD menu item. */
export const ERD_ICON = 'erd-editor';

/** The page, and the two tables and their link cut out of it by the even-odd rule. */
const PAGE = [
  'M5.57 2H14.41V6.02a1.07 1.07 0 0 0 1.07 1.07H19.5V20.93a1.07 1.07 0 0 1-1.07 1.07H5.57a1.07 1.07 0 0 1-1.07-1.07V3.07a1.07 1.07 0 0 1 1.07-1.07Z',
  'M6.29 9.32H10.57V14.68H6.29ZM7.79 10.82H9.07V13.18H7.79Z',
  'M13.43 13.07H17.71V18.43H13.43ZM14.93 14.57H16.21V16.93H14.93Z',
  'M10.57 11.4H12.6V15.15H13.43V16.35H11.4V12.6H10.57Z',
].join('');

const FOLD = 'M14.41 2L19.5 7.09H15.48a1.07 1.07 0 0 1-1.07-1.07Z';

/**
 * The logo (img/icons/erd-editor_icon.svg) in one color on Lucide's 24 grid, the
 * fold lighter as the logo's is. addIcon wraps this in a 0 0 100 100 box, so the
 * group scales the grid up; the table rims and the link are thicker than the logo's.
 */
export const ERD_ICON_SVG = `<g transform="scale(4.1666667)" stroke="none" fill="currentColor"><path fill-rule="evenodd" d="${PAGE}"/><path d="${FOLD}" fill-opacity="0.45"/></g>`;
