import {
  createRef,
  FC,
  nextTick,
  observable,
  onMounted,
  ref,
} from '@dineug/r-html';
import { debounceTime, filter, Observable } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import {
  goToErdTarget,
  showErdTab,
  showErdTargetAction$,
} from '@/components/erd/goToErdTarget';
import Icon from '@/components/primitives/icon/Icon';
import TextInput from '@/components/primitives/text-input/TextInput';
import { TOOLBAR_HEIGHT } from '@/constants/layout';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import { hasMoveKeys, isEditingText } from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import { useUnmounted } from '@/hooks/useUnmounted';
import { FindReplaceQuery, toggleSearchAction } from '@/utils/emitter';
import {
  createMatcher,
  DEFAULT_FIND_OPTIONS,
  FindField,
  FindFieldLabel,
  FindFieldList,
  FindMatch,
  findMatches,
  indexAfter,
  locationOf,
  Matcher,
  rematchField,
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
  toShortcutTitle,
} from '@/utils/keyboard-shortcut';

import { fieldIcon } from './fieldIcon';
import * as styles from './FindReplace.styles';
import { toErdTarget } from './matchTarget';

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

/** The space a jump keeps between the panel and what it lands on. */
const PANEL_GAP = 16;

/** The least of the canvas a jump keeps clear of the panel for; on less it lands as if there were none. */
const MIN_CLEAR_WIDTH = 320;

/** The overlays that take the whole canvas over, under which the panel stands down. */
const TAKEOVERS = [
  Open.automaticTablePlacement,
  Open.diffViewer,
  Open.timeTravel,
];

/** The chords a press in the panel still carries to the editor: its own, search, the document's undo and redo, and the zoom. */
const PASSING = [
  KeyBindingName.findReplace,
  KeyBindingName.search,
  KeyBindingName.undo,
  KeyBindingName.redo,
  KeyBindingName.zoomIn,
  KeyBindingName.zoomOut,
  KeyBindingName.zoomReset,
];

const SCOPE_LABEL: Record<FindField, string> = {
  [FindField.tableName]: 'Table names',
  [FindField.tableComment]: 'Table comments',
  [FindField.columnName]: 'Column names',
  [FindField.columnComment]: 'Column comments',
  [FindField.memo]: 'Memos',
};

const matchCount = (count: number) =>
  `${count} ${count === 1 ? 'match' : 'matches'}`;

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

/** Whether the panel is drawn: it stands aside, still open, while a dialog it would paint over is up. */
const isShown = ({ editor, settings }: RootState) =>
  Boolean(editor.openMap[Open.findReplace]) &&
  settings.canvasType === CanvasType.ERD &&
  !editor.openMap[Open.themeBuilder] &&
  !editor.openMap[Open.tableProperties] &&
  !TAKEOVERS.some(key => editor.openMap[key]);

const FindReplace: FC<FindReplaceProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();
  const root = createRef<HTMLDivElement>();

  const state = observable({
    query: '',
    replacement: '',
    matchCase: false,
    wholeWord: false,
    regex: false,
    fields: [...FindFieldList] as FindField[],
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

  /** Runs the search again over the document as it stands, keeping the current match when it is still there. */
  const refresh = (keepCurrent = false) => {
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
    const { editor } = store.state;
    if (TAKEOVERS.some(key => editor.openMap[key])) return;

    // The matches are shown and edited on the ERD canvas.
    showErdTab(store);
    store.dispatchSync(
      changeOpenMapAction({
        [Open.findReplace]: true,
        [Open.tableProperties]: false,
        [Open.themeBuilder]: false,
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
    if (isEditingText(editor) || TAKEOVERS.some(key => editor.openMap[key])) {
      return;
    }

    if (editor.openMap[Open.search]) {
      emitter.emit(toggleSearchAction());
    }
    isShown(store.state) ? nextTick(focusQuery) : open();
  };

  /** How far in from the left edge of the canvas the panel hides it. */
  const coveredWidth = () => {
    const panel = root.value;
    if (!panel?.offsetWidth) return 0;

    const { viewport } = app.value.store.state.editor;
    const covered = panel.offsetLeft + panel.offsetWidth + PANEL_GAP;
    return viewport.width - covered >= MIN_CLEAR_WIDTH ? covered : 0;
  };

  const goTo = (index: number) => {
    const match = result.matches[index];
    if (!match) return;

    const { store } = app.value;
    state.current = index;
    state.status = '';
    goToErdTarget(store, toErdTarget(match), coveredWidth());
    nextTick(scrollToCurrent);
  };

  const goToNext = () => {
    const total = result.matches.length;
    total && goTo(state.current + 1 >= total ? 0 : state.current + 1);
  };

  const goToPrevious = () => {
    const total = result.matches.length;
    total && goTo(state.current <= 0 ? total - 1 : state.current - 1);
  };

  const handleReplace = () => {
    if (props.readonly) return;

    // The texts as they stand now: a peer or the canvas may have changed one
    // since the last search, and a value built on the old text would undo it.
    refresh(true);
    const match = result.matches[state.current];
    if (!match || !matcher) {
      // Nothing is current yet, so the first press shows what it would replace.
      goToNext();
      return;
    }

    const { store } = app.value;
    const value = matcher.replace(match.text, state.replacement, match.start);
    const inserted = value.length - match.text.length + match.end - match.start;
    const actions = toReplaceActions(
      result.matches,
      matcher,
      state.replacement,
      match
    );
    // The next match is looked for in the text the replacement leaves, so the
    // jump to it rides in the replacement's dispatch and one undo takes back
    // both, the scroll included, wherever on the canvas that match is.
    const after = rematchField(result.matches, matcher, match, value);
    const next = after[indexAfter(after, match.slot, match.start + inserted)];
    const batch = next
      ? [...actions, showErdTargetAction$(toErdTarget(next), coveredWidth())]
      : actions;
    batch.length && store.dispatchSync(batch);

    refresh();
    state.status = '';
    state.current = next
      ? result.matches.findIndex(found => isSameMatch(found, next))
      : -1;
    nextTick(scrollToCurrent);
  };

  const handleReplaceAll = () => {
    if (props.readonly) return;

    refresh(true);
    const count = result.matches.length;
    if (!matcher || !count) return;

    const { store } = app.value;
    const actions = toReplaceActions(
      result.matches,
      matcher,
      state.replacement
    );
    // One dispatch is one entry in the history and one batch to every peer.
    actions.length && store.dispatchSync(actions);

    refresh();
    state.status = `Replaced ${matchCount(count)}`;
  };

  const handleQueryInput = (event: InputEvent) => {
    const input = event.target as HTMLInputElement;
    state.query = input.value;
    state.status = '';
    refresh();
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
   * its shortcuts bar PASSING and the arrows and Tab, and closes on Escape. Any
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
      !PASSING.some(matches) &&
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
      isShown(store.state) &&
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
    refresh();
  };

  const toggleField = (field: FindField) => {
    state.fields = state.fields.includes(field)
      ? state.fields.filter(value => value !== field)
      : FindFieldList.filter(
          value => value === field || state.fields.includes(value)
        );
    state.status = '';
    refresh();
  };

  onMounted(() => {
    const { store, shortcut$, emitter } = app.value;

    addUnsubscribe(
      shortcut$
        .pipe(filter(({ type }) => type === KeyBindingName.findReplace))
        .subscribe(handleShortcut),
      shortcut$
        .pipe(filter(({ type }) => type === KeyBindingName.stop))
        .subscribe(handleStop),
      emitter.on({
        openFindReplace: ({ payload }) => open(payload ?? undefined),
      }),
      // A peer, an undo or an edit on the canvas changes what matches.
      new Observable<void>(subscriber =>
        store.subscribe(() => subscriber.next())
      )
        .pipe(debounceTime(100))
        .subscribe(() => {
          isShown(store.state) && refresh(true);
        })
    );
  });

  return () => {
    const { store, keyBindingMap } = app.value;
    if (!isShown(store.state)) return null;

    const { matches, error } = result;
    const { current } = state;
    const [from, to] = rowWindow(current, matches.length);
    const count = state.status || countText({ ...state, error, matches });
    const top = store.state.editor.zenMode ? 16 : TOOLBAR_HEIGHT + 16;
    const replaceable = !props.readonly && matches.length > 0;

    return (
      <div
        class={['find-replace', styles.root]}
        style={{
          top: `${top}px`,
          'max-height': `calc(100% - ${top + 16}px)`,
        }}
        use:ref={ref(root)}
        on:keydown={handleKeydown}
      >
        <div class={styles.header}>
          <span>{props.readonly ? 'Find' : 'Find and Replace'}</span>
          <button
            class={['find-replace-close', styles.toggle]}
            type="button"
            title={toShortcutTitle(keyBindingMap, 'Close', KeyBindingName.stop)}
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
        {matches.length ? (
          <div class={['scrollbar', styles.list]}>
            {matches.slice(from, to).map((match, offset) => {
              const index = from + offset;
              const snippet = snippetOf(match);
              const location = locationOf(store.state, match);

              return (
                <div
                  class={[
                    'find-replace-match',
                    styles.match,
                    { selected: index === current },
                  ]}
                  title={match.text}
                  data-index={index}
                  on:click={() => goTo(index)}
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
                      {location
                        ? `${location} · ${FindFieldLabel[match.field]}`
                        : FindFieldLabel[match.field]}
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
