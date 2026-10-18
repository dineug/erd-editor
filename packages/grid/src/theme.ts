/**
 * The colours the grid draws with, its own fifteen and nothing of a host's: a
 * host maps its theme onto these. Each is a CSS colour a canvas fillStyle and
 * strokeStyle accept.
 */
export interface GridTheme {
  /** The body cells. */
  background: string;
  /** The column header row, the row number column and the corner they share. */
  headerBackground: string;
  /** Header labels and row numbers. */
  headerText: string;
  /** Cell text. */
  text: string;
  /** The line between two cells, and between two header cells. */
  gridLine: string;
  /** The edge of the headers and of the frozen columns, which stay as the rest scrolls. */
  frozenBorder: string;
  /** The fill over a selected range, translucent so the cells show through. */
  selectionFill: string;
  /** The 1px edge of a selected range. */
  selectionBorder: string;
  /** The 2px edge of the active cell. */
  activeCellBorder: string;
  /** A header cell whose row or column meets a selected range. */
  selectedHeaderBackground: string;
  /** The label of a header cell whose whole row or column is selected. */
  selectedHeaderText: string;
  /** A header cell whose whole row or column is selected. */
  fullSelectionBackground: string;
  /** A cell its column or the style hook marks read-only. */
  readonlyBackground: string;
  /** The scrollbar thumb. */
  scrollbarThumb: string;
  /** The scrollbar track. */
  scrollbarTrack: string;
}

/** The light default: grey headers with dark labels, green header tints, blue selection. */
export const lightTheme: Readonly<GridTheme> = Object.freeze({
  background: '#ffffff',
  headerBackground: '#f8f9fa',
  headerText: '#444746',
  text: '#1f1f1f',
  gridLine: '#e1e3e1',
  frozenBorder: '#c4c7c5',
  selectionFill: '#1a73e81a',
  selectionBorder: '#1a73e8',
  activeCellBorder: '#1a73e8',
  selectedHeaderBackground: '#d6eedb',
  selectedHeaderText: '#ffffff',
  fullSelectionBackground: '#137333',
  readonlyBackground: '#f1f3f4',
  scrollbarThumb: '#bdc1c6',
  scrollbarTrack: '#f8f9fa',
});

/** The dark default: the same roles as the light one on a dark background. */
export const darkTheme: Readonly<GridTheme> = Object.freeze({
  background: '#1f1f1f',
  headerBackground: '#282a2c',
  headerText: '#c4c7c5',
  text: '#e3e3e3',
  gridLine: '#3c4043',
  frozenBorder: '#5f6368',
  selectionFill: '#8ab4f829',
  selectionBorder: '#8ab4f8',
  activeCellBorder: '#8ab4f8',
  selectedHeaderBackground: '#24392b',
  selectedHeaderText: '#ffffff',
  fullSelectionBackground: '#1e8e3e',
  readonlyBackground: '#2a2b2e',
  scrollbarThumb: '#5f6368',
  scrollbarTrack: '#242526',
});
