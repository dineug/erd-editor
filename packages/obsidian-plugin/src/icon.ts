/** The id Obsidian knows the ERD Editor icon by, for the tab header and the New ERD menu item. */
export const ERD_ICON = 'erd-editor';

/**
 * The logo's two tables and their link in lines, as the IntelliJ plugin's file
 * icon draws them, on Lucide's 24 grid. addIcon wraps this in a 0 0 100 100 box:
 * the group scales the grid up and leaves the stroke width to Obsidian.
 */
export const ERD_ICON_SVG = [
  '<g transform="scale(4.1666667)" fill="none" stroke="currentColor" stroke-linejoin="miter" stroke-linecap="butt">',
  '<rect x="3.75" y="3.75" width="6" height="9"/>',
  '<rect x="15.75" y="11.25" width="6" height="9"/>',
  '<path d="M9.75 8.25H12.75V15.75H15.75"/>',
  '</g>',
].join('');
