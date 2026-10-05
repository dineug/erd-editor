import {
  AnyAction,
  CompositionActions,
  createRef,
  FC,
  nextTick,
  observable,
  onMounted,
  onUpdated,
  ref,
} from '@dineug/r-html';
import { debounceTime, filter, Observable } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import { goToErdTarget, showErdTab } from '@/components/erd/goToErdTarget';
import Icon from '@/components/primitives/icon/Icon';
import TextInput from '@/components/primitives/text-input/TextInput';
import { TOOLBAR_HEIGHT } from '@/constants/layout';
import { Open } from '@/constants/open';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import { hasMoveKeys, isEditingText } from '@/engine/modules/editor/state';
import { useUnmounted } from '@/hooks/useUnmounted';
import { arrayHas } from '@/utils/arrayHas';
import { FindReplaceQuery, toggleSearchAction } from '@/utils/emitter';
import {
  createMatcher,
  DEFAULT_FIND_FIELDS,
  DEFAULT_FIND_OPTIONS,
  describeMatch,
  FindField,
  FindFieldList,
  FindMatch,
  findMatches,
  FindTextActionTypes,
  Matcher,
  nextReplace,
  rematchField,
  ReplaceRun,
  resumeRun,
  snippetOf,
  toReplaceActions,
} from '@/utils/find-replace';
import { focusEvent } from '@/utils/internalEvents';
import {
  isComposing,
  isMod,
  KeyBindingName,
  KeyBindingNameList,
  matchesShortcut,
  PANEL_PASSING_BINDINGS,
  toShortcutTitle,
} from '@/utils/keyboard-shortcut';

import { fieldIcon } from './fieldIcon';
import * as styles from './FindReplace.styles';
import { showNextMatchAction$, toErdTarget } from './matchTarget';
import { coveredWidth, isPanelShown, isTakenOver } from './panelLayout';

export type FindReplaceProps = {
  readonly: boolean;
};

/** How many result rows the list draws at once; the rest are reached by moving through them. */
export const MATCH_ROW_LIMIT = 200;

/** The rows drawn for a list longer than the limit: a window kept around the current match. */
export function rowWindow(
  current: number,
  total: number,
  limit = MATCH_ROW_LIMIT
): [number, number] {
  if (total <= limit) return [0, total];

  const start = Math.min(
    Math.max(0, current - Math.floor(limit / 2)),
    total - limit
  );
  return [start, start + limit];
}

/** How long the panel waits for typing to pause before it searches a regular expression. */
export const REGEX_INPUT_DELAY = 150;

/** The space the panel keeps from the edges of the canvas and from the floating toolbar. */
const PANEL_MARGIN = 16;

/** How far up from the bottom of the canvas the floating toolbar reaches: 24 px off it, 36 px tall. */
const FLOATING_TOOLBAR_REACH = 60;

const SCOPE_LABEL: Record<FindField, string> = {
  [FindField.tableName]: 'Table names',
  [FindField.tableComment]: 'Table comments',
  [FindField.columnName]: 'Column names',
  [FindField.columnComment]: 'Column comments',
  [FindField.memo]: 'Memos',
};

const matchCount = (count: number) =>
  `${count} ${count === 1 ? 'match' : 'matches'}`;

const isTextAction = arrayHas<string>(FindTextActionTypes);

const isSameMatch = (a: FindMatch, b: FindMatch) =>
  a.field === b.field && a.id === b.id && a.start === b.start;

type CountInput = {
  query: string;
  error: string | null;
  matches: FindMatch[];
  current: number;
};

/** What the line under the fields says: the place in the matches, how many there are, or why none. */
function countText({ query, error, matches, current }: CountInput): string {
  if (error === 'invalid') return 'Invalid regular expression';
  if (!query) return '';
  if (!matches.length) return 'No results';
  if (current === -1) return matchCount(matches.length);
  return `${current + 1} of ${matches.length}`;
}

const FindReplace: FC<FindReplaceProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();
  const root = createRef<HTMLDivElement>();
  const controls = createRef<HTMLDivElement>();

  const state = observable({
    query: '',
    replacement: '',
    matchCase: false,
    wholeWord: false,
    regex: false,
    fields: [...DEFAULT_FIND_FIELDS] as FindField[],
    current: -1,
    status: '',
  });
  const result = observable(
    {
      matches: [] as FindMatch[],
      error: null as string | null,
    },
    { shallow: true }
  );
  let matcher: Matcher | null = null;
  let pendingSearch: ReturnType<typeof setTimeout> | null = null;
  /** Set while the panel dispatches its own edit, whose matches it has worked out already. */
  let replacing = false;
  /** Whether the panel was drawn once the last batch the store saw was in. */
  let shown = false;
  /** Set by an edit of a searched text the list does not show yet, one made while the panel stood aside say. */
  let stale = false;
  /** Where the presses of Replace since the last jump or change of search began. */
  let run: ReplaceRun | null = null;
  /** Set once that run has come back to where it began, which holds until a new run. */
  let stopped = false;
  /** The height the panel needs to show its controls whole, measured once they are drawn. */
  const layout = observable({ floor: 0 });
  /** The controls measured, a new element each time the panel is drawn again. */
  let measured: HTMLDivElement | null = null;
  /** Made once the panel is first drawn, so an editor never opening it measures nothing. */
  let resizeObserver: ResizeObserver | null = null;

  const measureControls = () => {
    const element = controls.value ?? null;
    if (element === measured) return;

    resizeObserver ??= new ResizeObserver(() => {
      const height = measured?.offsetHeight ?? 0;
      layout.floor = height && height + styles.PANEL_CHROME_HEIGHT;
    });
    resizeObserver.disconnect();
    element && resizeObserver.observe(element);
    measured = element;
  };

  /** Starts a new run of Replace presses: a jump, a change of search, an opening or a Replace All. */
  const newRun = () => {
    run = null;
    stopped = false;
  };

  const cancelPendingSearch = () => {
    pendingSearch !== null && clearTimeout(pendingSearch);
    pendingSearch = null;
  };

  /** Runs the search again over the document as it stands, keeping the current match when it is still there. */
  const refresh = (keepCurrent = false) => {
    cancelPendingSearch();
    stale = false;

    const { store } = app.value;
    const previous = result.matches[state.current];
    const created = createMatcher(state.query, state);

    matcher = created.matcher;
    result.error = created.error;
    result.matches = matcher
      ? findMatches(store.state, matcher, state.fields)
      : [];
    state.current =
      keepCurrent && previous
        ? result.matches.findIndex(match => isSameMatch(match, previous))
        : -1;
  };

  /** A search the reader asked for by changing its query, options or scopes, which starts a new run of Replace. */
  const search = () => {
    newRun();
    refresh();
  };

  /** Searches again for an edit, whose list the count then speaks for rather than what the last press said. */
  const searchEdited = () => {
    state.status = '';
    refresh(true);
  };

  /**
   * What typing in regex mode searches once it pauses. A panel closed or
   * standing aside by then searches nothing, leaving what is typed to the
   * opening or the batch that shows it again, as a change of search.
   */
  const searchTyped = () => {
    if (isPanelShown(app.value.store.state)) return search();

    pendingSearch = null;
    stale = true;
  };

  /**
   * Searches what is typed when a regular expression still waits for the
   * pause, as a change of search; true when it did. A press goes through the
   * matches of the query on screen, never of the one before it.
   */
  const searchPending = () => {
    if (pendingSearch === null) return false;
    search();
    return true;
  };

  /** Dispatches the panel's own edit, which the store hands back to the subscription below. */
  const dispatchOwn = (actions: CompositionActions) => {
    replacing = true;
    try {
      app.value.store.dispatchSync(actions);
    } finally {
      replacing = false;
    }
  };

  const scrollToCurrent = () => {
    root.value?.querySelector('.find-replace-match.selected')?.scrollIntoView({
      block: 'nearest',
    });
  };

  const focusQuery = () => {
    const input = root.value?.querySelector<HTMLInputElement>('.find-input');
    input?.focus();
    input?.select();
  };

  const open = (handed?: FindReplaceQuery) => {
    const { store } = app.value;
    if (isTakenOver(store.state)) return;

    // The search below reads every edit made while the panel was away, so the
    // batches that bring it back have none left to search for.
    stale = false;
    // The matches are shown and edited on the ERD canvas.
    showErdTab(store);
    store.dispatchSync(
      changeOpenMapAction({
        [Open.findReplace]: true,
        [Open.tableProperties]: false,
        [Open.themeBuilder]: false,
        [Open.exportImage]: false,
      })
    );

    if (handed) {
      // A query handed over is searched the way the palette searched it, not
      // with whatever options and scopes an earlier search left on.
      state.query = handed.query;
      Object.assign(state, DEFAULT_FIND_OPTIONS);
      state.fields = FindFieldList.filter(field =>
        handed.fields.includes(field)
      );
    }
    state.status = '';
    newRun();
    refresh();
    nextTick(focusQuery);
  };

  const close = () => {
    const { store } = app.value;
    store.dispatch(changeOpenMapAction({ [Open.findReplace]: false }));
    nextTick(() => {
      ctx.host.dispatchEvent(focusEvent());
    });
  };

  /**
   * Opens the panel, or brings the keyboard back to its find field, as every
   * host's find does on its chord; the palette gives way, as its own row does.
   * A cell or memo editor keeps the press, as it keeps the palette's chord.
   */
  const handleShortcut = () => {
    const { store, emitter } = app.value;
    const { editor } = store.state;
    if (isEditingText(editor) || isTakenOver(store.state)) return;

    if (editor.openMap[Open.search]) {
      emitter.emit(toggleSearchAction());
    }
    isPanelShown(store.state) ? nextTick(focusQuery) : open();
  };

  const goTo = (index: number) => {
    const match = result.matches[index];
    if (!match) return;

    const { store } = app.value;
    state.current = index;
    state.status = '';
    newRun();
    goToErdTarget(store, toErdTarget(match));
    nextTick(scrollToCurrent);
  };

  /** A row clicked before a regular expression's pause goes to its match among those of what is typed, if any. */
  const goToRow = (index: number) => {
    const clicked = result.matches[index];
    if (!searchPending()) return goTo(index);

    goTo(result.matches.findIndex(match => isSameMatch(match, clicked)));
  };

  const goToNext = () => {
    searchPending();
    const total = result.matches.length;
    total && goTo(state.current + 1 >= total ? 0 : state.current + 1);
  };

  const goToPrevious = () => {
    searchPending();
    const total = result.matches.length;
    total && goTo(state.current <= 0 ? total - 1 : state.current - 1);
  };

  const handleReplace = () => {
    if (props.readonly) return;

    // The texts as they stand now: a peer or the canvas may have changed one
    // since the last search, and a value built on the old text would undo it.
    searchPending() || refresh(true);
    // A run goes on from its field as it left it; one an undo or a peer has
    // written over since gives way to a run beginning here.
    const began = resumeRun(app.value.store.state, state.fields, run);
    const match = result.matches[state.current];
    if (!match || !matcher) {
      // A run back where it began holds there, rather than go round to what it wrote.
      if (stopped && began) {
        state.status = 'No more matches';
        return;
      }
      // Nothing is current yet, so the first press shows what it would replace.
      goToNext();
      return;
    }

    const { value } = matcher.replace(
      match.text,
      state.replacement,
      match.start
    );
    const { actions } = toReplaceActions(
      result.matches,
      matcher,
      state.replacement,
      match
    );
    // The next match is looked for in the text the replacement leaves, so the
    // jump to it rides in the replacement's dispatch and one undo takes back
    // both, the scroll included, measured on the table the replacement leaves.
    const after = rematchField(result.matches, matcher, match, value);
    const step = nextReplace(after, match, value, began);
    const next = after[step.index];
    const { store } = app.value;
    const batch = next
      ? [
          ...actions,
          showNextMatchAction$(next, match, value, coveredWidth(store.state)),
        ]
      : actions;
    batch.length && dispatchOwn(batch);

    // What the text left holds, found in the one field it changed rather than
    // in a second search of the whole document.
    result.matches = after;
    run = step.run;
    // Past the place the presses began, every match there was is replaced.
    stopped = !next && after.length > 0;
    state.status = stopped ? 'No more matches' : '';
    state.current = step.index;
    nextTick(scrollToCurrent);
  };

  const handleReplaceAll = () => {
    if (props.readonly) return;

    searchPending() || refresh(true);
    newRun();
    if (!matcher || !result.matches.length) return;

    const { actions, replaced } = toReplaceActions(
      result.matches,
      matcher,
      state.replacement
    );
    // One dispatch is one entry in the history and one batch to every peer.
    actions.length && dispatchOwn(actions);

    refresh();
    // A match the replacement writes back as it was is no change to count.
    state.status = replaced ? `Replaced ${matchCount(replaced)}` : 'No changes';
  };

  /** Searches plain text at once, as it is quick, and a regular expression once typing pauses, as one can be slow. */
  const handleQueryInput = (event: InputEvent) => {
    const input = event.target as HTMLInputElement;
    state.query = input.value;
    state.status = '';
    newRun();
    if (!state.regex) return search();

    cancelPendingSearch();
    pendingSearch = setTimeout(searchTyped, REGEX_INPUT_DELAY);
  };

  const handleReplacementInput = (event: InputEvent) => {
    const input = event.target as HTMLInputElement;
    state.replacement = input.value;
  };

  const handleQueryKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || isComposing(event)) return;

    event.preventDefault();
    event.shiftKey ? goToPrevious() : goToNext();
  };

  const handleReplacementKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || isComposing(event)) return;

    event.preventDefault();
    isMod(event) ? handleReplaceAll() : handleReplace();
  };

  /**
   * Keeps from the canvas what it would read as an edit of the ringed cell,
   * its shortcuts bar PANEL_PASSING_BINDINGS and the arrows and Tab, and closes on Escape. Any
   * other press goes on to the host, so its save or command palette works here.
   */
  const handleKeydown = (event: KeyboardEvent) => {
    const { keyBindingMap } = app.value;
    const matches = (name: KeyBindingName) =>
      matchesShortcut(event, keyBindingMap[name]);

    if (isComposing(event)) {
      event.stopPropagation();
    } else if (matches(KeyBindingName.stop)) {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (
      !PANEL_PASSING_BINDINGS.some(matches) &&
      (hasMoveKeys(event.key) || KeyBindingNameList.some(matches))
    ) {
      event.stopPropagation();
    }
  };

  /**
   * Escape pressed anywhere closes the panel, as it closes every other one,
   * unless something takes it first: an open cell editor or a relationship
   * being drawn, which that press ends alone, or the palette, which it closes.
   */
  const handleStop = () => {
    const { store } = app.value;
    const { editor } = store.state;

    if (
      isPanelShown(store.state) &&
      !editor.openMap[Open.search] &&
      !isEditingText(editor) &&
      !editor.drawRelationship
    ) {
      close();
    }
  };

  const toggleOption = (key: 'matchCase' | 'wholeWord' | 'regex') => {
    state[key] = !state[key];
    state.status = '';
    search();
  };

  const toggleField = (field: FindField) => {
    state.fields = state.fields.includes(field)
      ? state.fields.filter(value => value !== field)
      : FindFieldList.filter(
          value => value === field || state.fields.includes(value)
        );
    state.status = '';
    search();
  };

  /**
   * An edit of a searched text leaves the list stale: searched again once the
   * edits pause while the panel is shown, or at once by the batch that shows
   * it again. A hover, a selection or a scroll edits none and searches nothing.
   */
  const handleBatch = (actions: AnyAction[], edited: () => void) => {
    const before = shown;
    shown = isPanelShown(app.value.store.state);
    if (replacing) return;

    stale ||= actions.some(({ type }) => isTextAction(type));
    if (!stale || !shown) return;
    before ? edited() : searchEdited();
  };

  onMounted(() => {
    const { store, shortcut$, emitter } = app.value;
    shown = isPanelShown(store.state);

    addUnsubscribe(
      shortcut$
        .pipe(filter(({ type }) => type === KeyBindingName.findReplace))
        .subscribe(handleShortcut),
      shortcut$
        .pipe(filter(({ type }) => type === KeyBindingName.stop))
        .subscribe(handleStop),
      emitter.on({
        // The toolbar, the palette row and the context menu hand no query, and
        // the panel shown keeps its current match, as it does on the chord.
        openFindReplace: ({ payload }) =>
          !payload && isPanelShown(store.state)
            ? nextTick(focusQuery)
            : open(payload ?? undefined),
      }),
      // A peer, an undo or an edit on the canvas changes what matches, and
      // nothing else does: a hover, a selection or a scroll leaves it be.
      new Observable<void>(subscriber =>
        store.subscribe(actions =>
          handleBatch(actions, () => subscriber.next())
        )
      )
        .pipe(debounceTime(100))
        .subscribe(() => {
          stale && isPanelShown(store.state) && searchEdited();
        }),
      cancelPendingSearch,
      () => resizeObserver?.disconnect()
    );
    measureControls();
  });

  onUpdated(measureControls);

  return () => {
    const { store, keyBindingMap } = app.value;
    if (!isPanelShown(store.state)) return null;

    const { matches, error } = result;
    const { current } = state;
    const [from, to] = rowWindow(current, matches.length);
    const count = state.status || countText({ ...state, error, matches });
    const top =
      (store.state.editor.zenMode ? 0 : TOOLBAR_HEIGHT) + PANEL_MARGIN;
    // On a short canvas the list gives up its height before the panel reaches
    // the floating toolbar, whose tools it would cover, but the controls stay
    // whole down to the margin, since the panel is no use without its count.
    const clear = `calc(100% - ${top + FLOATING_TOOLBAR_REACH + PANEL_MARGIN}px)`;
    const maxHeight = layout.floor
      ? `max(${clear}, min(${layout.floor}px, calc(100% - ${top + PANEL_MARGIN}px)))`
      : clear;
    const replaceable = !props.readonly && matches.length > 0;

    return (
      <div
        class={['find-replace', styles.root]}
        style={{
          top: `${top}px`,
          'max-height': maxHeight,
        }}
        use:ref={ref(root)}
        on:keydown={handleKeydown}
      >
        <div class={styles.controls} use:ref={ref(controls)}>
          <div class={styles.header}>
            <span>{props.readonly ? 'Find' : 'Find and Replace'}</span>
            <button
              class={['find-replace-close', styles.toggle]}
              type="button"
              title={toShortcutTitle(
                keyBindingMap,
                'Close',
                KeyBindingName.stop
              )}
              on:click={close}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
          <div class={styles.row}>
            <TextInput
              class={[
                'find-input',
                styles.input,
                { invalid: error === 'invalid' },
              ]}
              title="Find"
              placeholder="Find"
              value={state.query}
              onInput={handleQueryInput}
              onKeydown={handleQueryKeydown}
            />
            <div class={styles.actions}>
              <button
                class={[
                  'find-match-case',
                  styles.toggle,
                  { active: state.matchCase },
                ]}
                type="button"
                title="Match Case"
                aria-pressed={String(state.matchCase)}
                on:click={() => toggleOption('matchCase')}
              >
                <Icon name="case-sensitive" size={16} />
              </button>
              <button
                class={[
                  'find-whole-word',
                  styles.toggle,
                  { active: state.wholeWord },
                ]}
                type="button"
                title="Match Whole Word"
                aria-pressed={String(state.wholeWord)}
                on:click={() => toggleOption('wholeWord')}
              >
                <Icon name="whole-word" size={16} />
              </button>
              <button
                class={['find-regex', styles.toggle, { active: state.regex }]}
                type="button"
                title="Use Regular Expression"
                aria-pressed={String(state.regex)}
                on:click={() => toggleOption('regex')}
              >
                <Icon name="regex" size={16} />
              </button>
            </div>
          </div>
          {props.readonly ? null : (
            <div class={styles.row}>
              <TextInput
                class={['replace-input', styles.input]}
                title="Replace"
                placeholder="Replace"
                value={state.replacement}
                onInput={handleReplacementInput}
                onKeydown={handleReplacementKeydown}
              />
              <div class={styles.actions}>
                <button
                  class={['find-replace-one', styles.toggle]}
                  type="button"
                  title="Replace (Enter)"
                  bool:disabled={!replaceable}
                  on:click={handleReplace}
                >
                  <Icon name="replace" size={16} />
                </button>
                <button
                  class={['find-replace-all', styles.toggle]}
                  type="button"
                  title="Replace All"
                  bool:disabled={!replaceable}
                  on:click={handleReplaceAll}
                >
                  <Icon name="replace-all" size={16} />
                </button>
              </div>
            </div>
          )}
          <div class={styles.scopes}>
            {FindFieldList.map(field => (
              <button
                class={[
                  'find-scope',
                  styles.scope,
                  { active: state.fields.includes(field) },
                ]}
                type="button"
                data-field={field}
                aria-pressed={String(state.fields.includes(field))}
                on:click={() => toggleField(field)}
              >
                {SCOPE_LABEL[field]}
              </button>
            ))}
          </div>
          <div class={styles.status}>
            <span
              class={[
                'find-count',
                styles.count,
                { invalid: error === 'invalid' },
              ]}
            >
              {count}
            </span>
            <button
              class={['find-previous', styles.toggle]}
              type="button"
              title="Previous Match (Shift+Enter)"
              bool:disabled={!matches.length}
              on:click={goToPrevious}
            >
              <Icon name="arrow-up" size={16} />
            </button>
            <button
              class={['find-next', styles.toggle]}
              type="button"
              title="Next Match (Enter)"
              bool:disabled={!matches.length}
              on:click={goToNext}
            >
              <Icon name="arrow-down" size={16} />
            </button>
          </div>
        </div>
        {matches.length ? (
          <div class={['scrollbar', styles.list]}>
            {matches.slice(from, to).map((match, offset) => {
              const index = from + offset;
              const snippet = snippetOf(match);

              return (
                <div
                  class={[
                    'find-replace-match',
                    styles.match,
                    { selected: index === current },
                  ]}
                  title={match.text}
                  data-index={index}
                  on:click={() => goToRow(index)}
                >
                  <div class={styles.icon}>{fieldIcon(match.field)}</div>
                  <div class={styles.body}>
                    <span class={styles.text}>
                      {snippet.text.slice(0, snippet.start)}
                      <mark class={styles.mark}>
                        {snippet.text.slice(snippet.start, snippet.end)}
                      </mark>
                      {snippet.text.slice(snippet.end)}
                    </span>
                    <span class={styles.location}>
                      {describeMatch(store.state, match)}
                    </span>
                  </div>
                </div>
              );
            })}
            {matches.length > to - from ? (
              <div class={styles.more}>
                {`Showing ${from + 1}–${to} of ${matches.length}`}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };
};

export default FindReplace;
