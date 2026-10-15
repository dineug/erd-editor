import {
  type AnyAction,
  type CompositionActions,
  nextTick,
} from '@dineug/r-html';

import { localized } from '@/components/localized/Localized';
import { openStatusToast } from '@/components/toast-container/openStatusToast';
import { Open } from '@/constants/open';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import type { RxStore } from '@/engine/rx-store';
import type { I18n } from '@/i18n/translate';
import { arrayHas } from '@/utils/arrayHas';
import type { Emitter } from '@/utils/emitter';
import {
  createMatcher,
  type FieldOrder,
  FindField,
  FindFieldList,
  type FindMatch,
  findMatches,
  FindTextActionTypes,
  type Matcher,
  nextReplace,
  rematchField,
  type ReplaceRun,
  resumeRun,
  toReplaceActions,
  treeOrderOf,
} from '@/utils/find-replace';
import { isTakenOver } from '@/utils/takeover';

import { isExplorerShown, openExplorer } from './explorerCommands';
import { jumpTo } from './explorerNavigation';
import { matchRowId } from './explorerTree';
import { explorerViewOf, type PressStatus } from './explorerView';
import { showNextMatchAction$, toErdTarget } from './matchTarget';

/** How long typing must pause before a regular expression is searched, as one can be slow. */
export const REGEX_INPUT_DELAY = 150;

/** What the search holds that no render reads: the matcher, the run, the timers. */
type SearchRuntime = {
  matcher: Matcher | null;
  pendingSearch: ReturnType<typeof setTimeout> | null;
  /** Set while the search dispatches its own edit, whose matches it has worked out already. */
  replacing: boolean;
  /** Set by an edit of a searched text the tree does not show yet, one made while it stood aside say. */
  stale: boolean;
  /** Where the presses of Replace since the last jump or change of search began. */
  run: ReplaceRun | null;
  /** Set once that run has come back to where it began, which holds until a new run. */
  stopped: boolean;
  /** The last focus request the find field took or let go. */
  focusTaken: number;
};

const runtimes = new WeakMap<RxStore, SearchRuntime>();

export function searchRuntimeOf(store: RxStore): SearchRuntime {
  let runtime = runtimes.get(store);

  if (!runtime) {
    runtime = {
      matcher: null,
      pendingSearch: null,
      replacing: false,
      stale: false,
      run: null,
      stopped: false,
      focusTaken: 0,
    };
    runtimes.set(store, runtime);
  }

  return runtime;
}

export const isTextAction = arrayHas<string>(FindTextActionTypes);

const isSameMatch = (a: FindMatch, b: FindMatch) =>
  a.field === b.field && a.id === b.id && a.start === b.start;

/** Whether a query is being searched, which puts the tree in its search form. */
export const isSearching = (store: RxStore) =>
  explorerViewOf(store).query.length > 0;

export function statusText(status: PressStatus, { t }: Pick<I18n, 't'>) {
  if (status === 'noMoreMatches') return t('findReplace.noMoreMatches');
  if (status === 'noChanges') return t('findReplace.noChanges');
  return t('findReplace.replaced', { count: status.replaced });
}

/** What the line under the fields says: the place in the matches, how many there are, or why none. */
export function countText(store: RxStore, i18n: Pick<I18n, 't'>): string {
  const { query, error, matches, current, status } = explorerViewOf(store);
  const { t } = i18n;
  if (status) return statusText(status, i18n);
  if (error === 'invalid') return t('findReplace.invalidRegex');
  if (!query) return '';
  if (!matches.length) return t('findReplace.noResults');
  if (current === -1) {
    return t('findReplace.matchCount', { count: matches.length });
  }
  return t('findReplace.position', {
    current: current + 1,
    total: matches.length,
  });
}

const sameOrder = (a: FieldOrder | null, b: FieldOrder) =>
  a !== null &&
  a.tableIds.length === b.tableIds.length &&
  a.tableIds.every((id, index) => id === b.tableIds[index]) &&
  a.tableGroupIds.length === b.tableGroupIds.length &&
  a.tableGroupIds.every((id, index) => id === b.tableGroupIds[index]);

/**
 * The matches in another walk order without a search: by table, then by
 * group, then the memos, each field's matches as they stood. Their slots stay
 * as the last search set them, which every press that reads one searches anew.
 */
function inWalkOrder(
  matches: ReadonlyArray<FindMatch>,
  { tableIds, tableGroupIds }: FieldOrder
): FindMatch[] {
  const rank = new Map<string, number>();
  tableIds.forEach((id, index) => rank.set(`t:${id}`, index));
  tableGroupIds.forEach((id, index) =>
    rank.set(`g:${id}`, tableIds.length + index)
  );
  const last = tableIds.length + tableGroupIds.length;
  const rankOf = ({ field, id, tableId }: FindMatch) =>
    field === FindField.memo
      ? last
      : (rank.get(
          field === FindField.tableGroupName ? `g:${id}` : `t:${tableId}`
        ) ?? last);

  return matches
    .map((match, index) => ({ match, index, rank: rankOf(match) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ match }) => match);
}

/**
 * Starts a new run of Replace presses: a jump, a change of search, an opening
 * or a Replace All. The tree goes back to the name order in the same step,
 * the matches with it, so a rename the run made shows in its place at once.
 */
function newRun(store: RxStore) {
  const view = explorerViewOf(store);
  const runtime = searchRuntimeOf(store);
  runtime.run = null;
  runtime.stopped = false;

  const order = treeOrderOf(store.state);
  if (!sameOrder(view.order, order) && view.matches.length) {
    const current = view.matches[view.current];
    view.matches = inWalkOrder(view.matches, order);
    view.current = current ? view.matches.indexOf(current) : -1;
  }
  view.order = order;
}

/** Drops a regular expression's search still waiting for typing to pause. */
export function cancelPendingSearch(store: RxStore) {
  const runtime = searchRuntimeOf(store);
  runtime.pendingSearch !== null && clearTimeout(runtime.pendingSearch);
  runtime.pendingSearch = null;
}

/**
 * Runs the search again over the document as it stands, in the tree's order:
 * the name order between runs, and the order a run began with while it lasts.
 * The current match stays current while it is still there, when asked.
 */
export function refresh(store: RxStore, keepCurrent = false) {
  const view = explorerViewOf(store);
  const runtime = searchRuntimeOf(store);
  cancelPendingSearch(store);
  runtime.stale = false;

  if (!runtime.run || !view.order) view.order = treeOrderOf(store.state);
  const previous = view.matches[view.current];
  const created = createMatcher(view.query, view);
  runtime.matcher = created.matcher;
  view.error = created.error;
  view.matches = runtime.matcher
    ? findMatches(store.state, runtime.matcher, view.fields, view.order)
    : [];
  view.current =
    keepCurrent && previous
      ? view.matches.findIndex(match => isSameMatch(match, previous))
      : -1;
}

/**
 * A search asked for by a change of query, options or scopes, which starts a
 * new run and shows every row it finds open.
 */
export function search(store: RxStore) {
  explorerViewOf(store).searchCollapsed = {};
  newRun(store);
  refresh(store);
}

/** Searches again for an edit, whose list the count then speaks for rather than the last press. */
export function searchEdited(store: RxStore) {
  explorerViewOf(store).status = null;
  refresh(store, true);
}

/** Searches what is typed when a regular expression still waits for its pause; true when it did. */
function searchPending(store: RxStore) {
  if (searchRuntimeOf(store).pendingSearch === null) return false;
  search(store);
  return true;
}

/**
 * Asks the find field for the keyboard. The renders the request schedules run
 * first, and a panel not drawn by then lets it go, so a window widened later
 * draws the panel without taking the keyboard from wherever it went.
 */
export function requestSearchFocus(store: RxStore) {
  const view = explorerViewOf(store);
  view.focusRequest++;
  const request = view.focusRequest;
  nextTick(() => {
    const runtime = searchRuntimeOf(store);
    if (runtime.focusTaken < request) runtime.focusTaken = request;
  });
}

/** Whether the find field may take the keyboard now, which it marks as taken. */
export function takeSearchFocus(store: RxStore): boolean {
  const view = explorerViewOf(store);
  const runtime = searchRuntimeOf(store);
  if (runtime.focusTaken >= view.focusRequest) return false;
  runtime.focusTaken = view.focusRequest;
  return true;
}

/**
 * The five dialogs a search trades for itself, as they close one another:
 * Table Properties, the theme builder, the locale picker, the export image
 * dialog and Map Columns.
 */
const SEARCH_DIALOGS = [
  Open.tableProperties,
  Open.themeBuilder,
  Open.exportImage,
  Open.localePicker,
  Open.mapColumns,
];

/** Whether a dialog the search trades for itself is up, which the chord then trades. */
export const hasSearchDialog = (store: RxStore) =>
  SEARCH_DIALOGS.some(name => store.state.editor.openMap[name]);

function closeDialogs(store: RxStore) {
  if (!hasSearchDialog(store)) return;
  store.dispatchSync(
    changeOpenMapAction(
      Object.fromEntries(SEARCH_DIALOGS.map(name => [name, false]))
    )
  );
}

/**
 * Brings the keyboard back to the search of a panel shown already, keeping
 * its current match and its run, as every host's find does pressed again.
 */
export function focusSearch(store: RxStore) {
  closeDialogs(store);
  requestSearchFocus(store);
}

/**
 * Opens the Explorer on its search, handing it the keyboard. A canvas too
 * narrow says so rather than show nothing (an owner decision of 2026-10-13).
 */
export function openSearch(store: RxStore, emitter: Emitter) {
  if (isTakenOver(store.state)) return;
  const view = explorerViewOf(store);
  const runtime = searchRuntimeOf(store);

  // The search below reads every edit made while the panel was away.
  runtime.stale = false;
  closeDialogs(store);
  openExplorer(store);

  view.status = null;
  view.searchCollapsed = {};
  newRun(store);
  refresh(store);

  if (!isExplorerShown(store)) {
    openStatusToast(emitter, {
      key: 'explorer.tooNarrow',
      title: localized('explorer.tooNarrow'),
    });
    return;
  }
  requestSearchFocus(store);
}

/**
 * Takes the canvas to a match and makes it current, which starts a new run;
 * the tree's keyboard row follows it, so an arrow goes on from there.
 */
export function goTo(store: RxStore, index: number) {
  const view = explorerViewOf(store);
  const match = view.matches[index];
  if (!match) return;

  view.current = index;
  view.status = null;
  view.activeId = matchRowId(match);
  newRun(store);
  jumpTo(store, toErdTarget(match));
}

export function goToNext(store: RxStore) {
  searchPending(store);
  const { matches, current } = explorerViewOf(store);
  const total = matches.length;
  total && goTo(store, current + 1 >= total ? 0 : current + 1);
}

export function goToPrevious(store: RxStore) {
  searchPending(store);
  const { matches, current } = explorerViewOf(store);
  const total = matches.length;
  total && goTo(store, current <= 0 ? total - 1 : current - 1);
}

/** A row picked before a regular expression's pause goes to its match among those of what is typed, if any. */
export function goToMatch(store: RxStore, match: FindMatch) {
  searchPending(store);
  goTo(
    store,
    explorerViewOf(store).matches.findIndex(found => isSameMatch(found, match))
  );
}

/** Dispatches the search's own edit, which the store hands back to the batch watch. */
function dispatchOwn(store: RxStore, actions: CompositionActions) {
  const runtime = searchRuntimeOf(store);
  runtime.replacing = true;
  try {
    store.dispatchSync(actions);
  } finally {
    runtime.replacing = false;
  }
}

/**
 * Replaces the current match and takes the canvas to the next one in the same
 * dispatch, so one undo takes back both. A run that comes back to where it
 * began stops there rather than go round to what it wrote.
 */
export function replaceOne(store: RxStore) {
  const view = explorerViewOf(store);
  const runtime = searchRuntimeOf(store);

  // The texts as they stand now: a peer or the canvas may have changed one
  // since the last search, and a value built on the old text would undo it.
  searchPending(store) || refresh(store, true);
  const began = resumeRun(
    store.state,
    view.fields,
    runtime.run,
    view.order ?? undefined
  );
  const match = view.matches[view.current];
  const { matcher } = runtime;
  if (!match || !matcher) {
    if (runtime.stopped && began) {
      view.status = 'noMoreMatches';
      return;
    }
    // Nothing is current yet, so the first press shows what it would replace.
    goToNext(store);
    return;
  }

  const { value } = matcher.replace(match.text, view.replacement, match.start);
  const { actions } = toReplaceActions(
    view.matches,
    matcher,
    view.replacement,
    match
  );
  const after = rematchField(view.matches, matcher, match, value);
  const step = nextReplace(after, match, value, began);
  const next = after[step.index];
  const batch = next
    ? [...actions, showNextMatchAction$(next, match, value)]
    : actions;
  batch.length && dispatchOwn(store, batch);

  view.matches = after;
  runtime.run = step.run;
  runtime.stopped = !next && after.length > 0;
  view.status = runtime.stopped ? 'noMoreMatches' : null;
  view.current = step.index;
}

/** Replaces every match in one dispatch: one history entry and one batch to every peer. */
export function replaceAll(store: RxStore) {
  const view = explorerViewOf(store);
  const runtime = searchRuntimeOf(store);

  searchPending(store) || refresh(store, true);
  newRun(store);
  const { matcher } = runtime;
  if (!matcher || !view.matches.length) return;

  const { actions, replaced } = toReplaceActions(
    view.matches,
    matcher,
    view.replacement
  );
  actions.length && dispatchOwn(store, actions);

  refresh(store);
  // A match the replacement writes back as it was is no change to count.
  view.status = replaced ? { replaced } : 'noChanges';
}

/** Searches plain text at once, as it is quick, and a regular expression once typing pauses. */
export function setQuery(store: RxStore, query: string) {
  const view = explorerViewOf(store);
  const runtime = searchRuntimeOf(store);
  view.query = query;
  view.status = null;
  newRun(store);
  if (!view.regex) return search(store);

  cancelPendingSearch(store);
  runtime.pendingSearch = setTimeout(() => {
    runtime.pendingSearch = null;
    // A panel standing aside by then searches nothing, leaving what is typed
    // to the batch that shows it again, as a change of search.
    isExplorerShown(store) ? search(store) : (runtime.stale = true);
  }, REGEX_INPUT_DELAY);
}

export function setReplacement(store: RxStore, replacement: string) {
  explorerViewOf(store).replacement = replacement;
}

/** Match Case, Whole Word and Regex search again; Preserve Case only shapes what Replace writes. */
export function toggleOption(
  store: RxStore,
  key: 'matchCase' | 'wholeWord' | 'regex' | 'preserveCase'
) {
  const view = explorerViewOf(store);
  view[key] = !view[key];
  if (key === 'preserveCase') {
    // The matcher writes the replacement, so it takes the option at once.
    const runtime = searchRuntimeOf(store);
    runtime.matcher = createMatcher(view.query, view).matcher;
    return;
  }
  view.status = null;
  search(store);
}

export function toggleField(store: RxStore, field: FindField) {
  const view = explorerViewOf(store);
  view.fields = view.fields.includes(field)
    ? view.fields.filter(value => value !== field)
    : FindFieldList.filter(
        value => value === field || view.fields.includes(value)
      );
  view.status = null;
  search(store);
}

/**
 * An edit of a searched text leaves the matches stale: searched again once
 * the edits pause while the panel is shown, or at once by the batch that shows
 * it again. A hover, a selection or a scroll edits none and searches nothing.
 */
export function noteBatch(store: RxStore, actions: AnyAction[]): boolean {
  const runtime = searchRuntimeOf(store);
  if (runtime.replacing) return false;
  runtime.stale ||= actions.some(({ type }) => isTextAction(type));
  return runtime.stale;
}

/** Searches again when an edit left the matches stale and the search is on screen. */
export function searchIfStale(store: RxStore) {
  const runtime = searchRuntimeOf(store);
  if (runtime.stale && isSearching(store) && isExplorerShown(store)) {
    searchEdited(store);
  }
}
