import { showErdTab } from '@/components/erd/goToErdTarget';
import {
  applyViewport,
  layoutOf,
} from '@/components/erd-editor/viewportLayout';
import { EXPLORER_MAX_WIDTH, EXPLORER_MIN_WIDTH } from '@/constants/layout';
import { CanvasType } from '@/constants/schema';
import type { RxStore } from '@/engine/rx-store';
import { isTakenOver } from '@/utils/takeover';

import { explorerViewOf } from './explorerView';

/**
 * Whether the toolbar shows the Explorer's button pressed: open on the ERD
 * tab and not hidden by zen mode. A panel the canvas width hides for now
 * still counts, so a press there closes it.
 */
export function isExplorerPressed(store: RxStore): boolean {
  const { editor, settings } = store.state;
  const view = explorerViewOf(store);

  return (
    view.open &&
    settings.canvasType === CanvasType.ERD &&
    (!editor.zenMode || view.zenReveal)
  );
}

/** Whether the panel is drawn now, as opposed to open but stood aside. */
export const isExplorerShown = (store: RxStore) => layoutOf(store).reach > 0;

/**
 * Opens the Explorer on the ERD tab, from whichever tab is up. Under zen mode
 * it shows the panel and leaves zen on (an owner decision of 2026-10-13).
 * Under a takeover it does nothing.
 */
export function openExplorer(store: RxStore): void {
  if (isTakenOver(store.state)) return;
  showErdTab(store);
  // Settles a zen mode turned on since the layout last looked, which would
  // otherwise read this opening's reveal as one from before it and drop it.
  applyViewport(store);
  const view = explorerViewOf(store);
  view.open = true;
  if (store.state.editor.zenMode) view.zenReveal = true;
  applyViewport(store);
}

export function closeExplorer(store: RxStore): void {
  const view = explorerViewOf(store);
  view.open = false;
  view.zenReveal = false;
  applyViewport(store);
}

/** The toolbar button and the palette row: closes a pressed button's panel, opens any other, and does nothing under a takeover. */
export function toggleExplorer(store: RxStore): void {
  if (isTakenOver(store.state)) return;
  isExplorerPressed(store) ? closeExplorer(store) : openExplorer(store);
}

/** Sets the width a drag on the edge asks for, held between the least and the most. */
export function setExplorerWidth(store: RxStore, width: number): void {
  const view = explorerViewOf(store);
  const next = Math.round(
    Math.min(EXPLORER_MAX_WIDTH, Math.max(EXPLORER_MIN_WIDTH, width))
  );
  if (view.width === next) return;
  view.width = next;
  applyViewport(store);
}
