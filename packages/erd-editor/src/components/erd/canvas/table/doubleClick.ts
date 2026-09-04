import type { SceneMouseEvent } from '@/components/erd/canvas/sceneTokens';
import type { FocusType } from '@/engine/modules/editor/state';

/** The browser's own click count, which resets when a click lands elsewhere. */
const clickCount = (event: SceneMouseEvent) => event.evt?.detail ?? 0;

export type DoubleClickGuard = {
  /** Records the cell a click opened a pair on. */
  track(cell: FocusType, event: SceneMouseEvent): void;
  /** Whether a konva dblclick closes a pair that began on this same cell. */
  isDouble(cell: FocusType, event: SceneMouseEvent): boolean;
};

/**
 * Tells a real double click from the one konva invents. Konva fires dblclick on
 * whatever the second click of any pair inside its window lands on, wherever
 * the first one was, so the cell that opened the pair is remembered here.
 */
export function createDoubleClickGuard(): DoubleClickGuard {
  let opened: FocusType | null = null;

  return {
    track(cell, event) {
      if (clickCount(event) <= 1) opened = cell;
    },
    isDouble(cell, event) {
      return clickCount(event) >= 2 && opened === cell;
    },
  };
}
