import { observable } from '@dineug/r-html';

import { EXPLORER_WIDTH } from '@/constants/layout';
import type { RxStore } from '@/engine/rx-store';
import {
  DEFAULT_FIND_FIELDS,
  type FieldOrder,
  type FindField,
  type FindMatch,
} from '@/utils/find-replace';

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

  query: string;
  replacement: string;
  matchCase: boolean;
  wholeWord: boolean;
  regex: boolean;
  preserveCase: boolean;
  /** Replaced whole on every change, a copy of the frozen default to begin with. */
  fields: FindField[];
  /** Whether the Replace row is unfolded, and the row of scopes past the three dots. */
  replaceOpen: boolean;
  scopesOpen: boolean;
  /** The match the canvas was last taken to, by its place in the matches; -1 for none. */
  current: number;
  status: PressStatus | null;
  matches: FindMatch[];
  error: 'empty' | 'invalid' | null;
  /** The walk's order: by name, or the one a run of Replace presses began with. */
  order: FieldOrder | null;
  /** The folders and rows folded while a search shows, every other one open. */
  searchCollapsed: Record<string, true>;
  /** Raised to ask the find field for the keyboard; dropped unless a drawn panel takes it. */
  focusRequest: number;
};

/**
 * What the last press of Replace or Replace All said, kept as what it means
 * rather than as text, so a switch of language reads it again in the new one.
 */
export type PressStatus = 'noMoreMatches' | 'noChanges' | { replaced: number };

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
        query: '',
        replacement: '',
        matchCase: false,
        wholeWord: false,
        regex: false,
        preserveCase: false,
        fields: [...DEFAULT_FIND_FIELDS],
        replaceOpen: false,
        scopesOpen: false,
        current: -1,
        status: null,
        matches: [],
        error: null,
        order: null,
        searchCollapsed: {},
        focusRequest: 0,
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
