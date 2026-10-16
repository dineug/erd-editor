import { Open } from '@/constants/open';
import type { RootState } from '@/engine/state';

/** The overlays that take the whole canvas over, each standing a scene of its own there. */
export const TAKEOVERS = [
  Open.automaticTablePlacement,
  Open.diffViewer,
  Open.timeTravel,
];

/** Whether an overlay that takes the canvas over is up, which keeps Find and Replace and the Explorer shut. */
export const isTakenOver = ({ editor }: RootState) =>
  TAKEOVERS.some(key => editor.openMap[key]);
