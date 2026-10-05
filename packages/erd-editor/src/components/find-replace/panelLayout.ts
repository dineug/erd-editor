import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import type { RootState } from '@/engine/state';

/** The overlays that take the whole canvas over, under which the panel stands down and opens on nothing. */
export const TAKEOVERS = [
  Open.automaticTablePlacement,
  Open.diffViewer,
  Open.timeTravel,
];

/** Whether an overlay that takes the canvas over is up, which keeps Find and Replace shut. */
export const isTakenOver = ({ editor }: RootState) =>
  TAKEOVERS.some(key => editor.openMap[key]);

/**
 * Whether the panel is drawn: it stands aside, still open, while a dialog its
 * opening closes is up, so its chord trades that dialog for it rather than
 * bring the caret back to a field under the dialog.
 */
export const isPanelShown = (state: RootState) =>
  Boolean(state.editor.openMap[Open.findReplace]) &&
  state.settings.canvasType === CanvasType.ERD &&
  !state.editor.openMap[Open.themeBuilder] &&
  !state.editor.openMap[Open.tableProperties] &&
  !state.editor.openMap[Open.exportImage] &&
  !isTakenOver(state);

/** How far in from the left of the canvas the panel stands, and how wide it is at most, as FindReplace.styles draws it. */
export const PANEL_LEFT = 16;
export const PANEL_WIDTH = 380;

/** The space a jump keeps between the panel and what it lands on. */
const PANEL_GAP = 16;

/**
 * The least of the canvas a jump keeps clear of the panel for: a jump's edge
 * margin on each side of the strip and the start of a name between them. On
 * less it lands as if there were no panel.
 */
const MIN_CLEAR_WIDTH = 160;

/**
 * How far in from the left edge of the canvas the panel hides it, read from
 * the state rather than the panel's box, so a jump that brings the panel back
 * with the ERD tab lands clear of it too. None while the panel is not drawn.
 */
export function coveredWidth(state: RootState): number {
  if (!isPanelShown(state)) return 0;

  const { width } = state.editor.viewport;
  const panel = Math.min(PANEL_WIDTH, width - PANEL_LEFT * 2);
  const covered = PANEL_LEFT + panel + PANEL_GAP;
  return width - covered >= MIN_CLEAR_WIDTH ? covered : 0;
}
