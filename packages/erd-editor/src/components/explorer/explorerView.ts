import { observable } from '@dineug/r-html';

import { EXPLORER_WIDTH } from '@/constants/layout';
import type { RxStore } from '@/engine/rx-store';

/** The folder the tree shows open as the Explorer first opens. */
export const TABLES_FOLDER_ID = 'f:tables';

export type ExplorerView = {
  open: boolean;
  /** Set by an opening while zen mode is on, which shows the panel without leaving zen. */
  zenReveal: boolean;
  width: number;
  /** Replaced whole on every change: r-html tracks no Set, Map or frozen value. */
  expanded: Record<string, true>;
  /** The row the keyboard is on, kept by node id so a row added before it moves nothing. */
  activeId: string | null;
};

const views = new WeakMap<RxStore, ExplorerView>();
const scrolls = new WeakMap<RxStore, { top: number }>();

/**
 * The Explorer's own state, one per editor, kept until the element goes:
 * never in the store, the file, the history or a peer, so it survives a tab
 * change and a reload of the document alike.
 */
export function explorerViewOf(store: RxStore): ExplorerView {
  let view = views.get(store);

  if (!view) {
    view = observable<ExplorerView>(
      {
        open: false,
        zenReveal: false,
        width: EXPLORER_WIDTH,
        expanded: { [TABLES_FOLDER_ID]: true },
        activeId: null,
      },
      { shallow: true }
    );
    views.set(store, view);
  }

  return view;
}

/** Where the tree is scrolled to, unobserved, so a scroll renders nothing outside the tree. */
export function explorerScrollOf(store: RxStore): { top: number } {
  let scroll = scrolls.get(store);

  if (!scroll) {
    scroll = { top: 0 };
    scrolls.set(store, scroll);
  }

  return scroll;
}
