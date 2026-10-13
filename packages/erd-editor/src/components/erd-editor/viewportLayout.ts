import { observable } from '@dineug/r-html';

import { explorerViewOf } from '@/components/explorer/explorerView';
import {
  EXPLORER_CANVAS_MIN_WIDTH,
  EXPLORER_MIN_WIDTH,
  TOOLBAR_HEIGHT,
} from '@/constants/layout';
import { CanvasType } from '@/constants/schema';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import type { RxStore } from '@/engine/rx-store';
import type { RootState } from '@/engine/state';
import type { Unsubscribe } from '@/internal-types';
import { isTakenOver } from '@/utils/takeover';

export type Layout = {
  /** The root as the ResizeObserver last measured it. */
  observed: { width: number; height: number };
  /** How much of the root's width a panel docked beside the canvas takes. */
  reach: number;
};

type LayoutRecord = {
  layout: Layout;
  /** What the viewport was last applied from, null until something asked. */
  inputs: readonly unknown[] | null;
};

const records = new WeakMap<RxStore, LayoutRecord>();

function recordOf(store: RxStore): LayoutRecord {
  let record = records.get(store);

  if (!record) {
    record = {
      layout: observable<Layout>(
        { observed: { width: 0, height: 0 }, reach: 0 },
        { shallow: true }
      ),
      inputs: null,
    };
    records.set(store, record);
  }

  return record;
}

/** The root's measured size and the panel reach, one per editor, kept until the element goes. */
export function layoutOf(store: RxStore): Layout {
  return recordOf(store).layout;
}

/**
 * Whether the toolbar is drawn. Zen mode takes it away over the canvas it was
 * entered from alone, or the tab that turned the mode on would be the only one
 * it could be turned off from.
 */
export const hasToolbar = ({ editor, settings }: RootState): boolean =>
  !editor.zenMode || settings.canvasType !== CanvasType.ERD;

/**
 * The editor's own width, panel included, which decides whether a dialog
 * stacks: the viewport plus the reach a docked panel takes from it, so a spec
 * that sets the viewport alone reads that width.
 */
export function editorWidthOf(store: RxStore): number {
  return store.state.editor.viewport.width + layoutOf(store).reach;
}

function inputsOf(store: RxStore, { observed }: Layout) {
  const { state } = store;
  const explorer = explorerViewOf(store);

  return [
    state.settings.canvasType,
    state.editor.zenMode,
    isTakenOver(state),
    observed.width,
    observed.height,
    explorer.open,
    explorer.width,
    explorer.zenReveal,
  ] as const;
}

/**
 * The width the Explorer takes from the root: none while it is closed, off
 * the ERD tab, under a takeover, or hidden by zen mode, and none either where
 * the canvas would keep less than its least beside the panel's least.
 */
function explorerReach(store: RxStore, observedWidth: number): number {
  const { editor, settings } = store.state;
  const explorer = explorerViewOf(store);
  const hidden =
    !explorer.open ||
    settings.canvasType !== CanvasType.ERD ||
    isTakenOver(store.state) ||
    (editor.zenMode && !explorer.zenReveal);
  if (hidden) return 0;

  const width = Math.min(
    explorer.width,
    observedWidth - EXPLORER_CANVAS_MIN_WIDTH
  );
  return width < EXPLORER_MIN_WIDTH ? 0 : width;
}

const sameInputs = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * Applies the viewport from what decides it: the measured root, the toolbar
 * zen mode takes away, the tab and the Explorer. It compares those first and
 * returns when none moved, writes the reach first, and dispatches only a new viewport.
 */
export function applyViewport(store: RxStore) {
  const record = recordOf(store);
  const before = record.inputs;
  let inputs = inputsOf(store, record.layout);
  if (before && sameInputs(before, inputs)) return;

  // Zen mode turned on hides an Explorer an earlier opening showed through it.
  const explorer = explorerViewOf(store);
  if (before && !before[1] && inputs[1] && explorer.zenReveal) {
    explorer.zenReveal = false;
    inputs = inputsOf(store, record.layout);
  }
  record.inputs = inputs;

  const { layout } = record;
  const { observed } = layout;
  const reach = explorerReach(store, observed.width);
  if (layout.reach !== reach) layout.reach = reach;

  const toolbar = hasToolbar(store.state) ? TOOLBAR_HEIGHT : 0;
  const width = Math.max(0, observed.width - reach);
  // A hidden host reports no height at all, which must not read as a
  // viewport with a negative one.
  const height = Math.max(0, observed.height - toolbar);
  const { viewport } = store.state.editor;
  if (viewport.width === width && viewport.height === height) return;

  store.dispatchSync(changeViewportAction({ width, height }));
}

/**
 * Applies the viewport inside every batch that moves its inputs, so a tab,
 * zen mode or takeover change has it before anything renders. The inputs as
 * they stand now are the first ones, so a batch that moves none writes nothing.
 */
export function observeViewport(store: RxStore): Unsubscribe {
  const record = recordOf(store);
  record.inputs = inputsOf(store, record.layout);
  return store.subscribe(() => applyViewport(store));
}

/** Records what the ResizeObserver measured and applies the viewport from it. */
export function measureRoot(
  store: RxStore,
  observed: { width: number; height: number }
) {
  layoutOf(store).observed = observed;
  applyViewport(store);
}

/** How far in from the canvas's left edge the theme builder and the locale picker stand. */
export const PICKER_INSET = 16;

/**
 * Where the theme builder and the locale picker stand left to right while the
 * Explorer takes the left of the root: past it, at the canvas's own left edge.
 * Right to left they keep their place at the other end.
 */
export function insetPastExplorer(
  store: RxStore,
  dir: 'ltr' | 'rtl'
): Record<string, string> {
  const { reach } = layoutOf(store);
  return dir === 'ltr' && reach > 0
    ? { 'inset-inline-start': `${PICKER_INSET + reach}px` }
    : {};
}
