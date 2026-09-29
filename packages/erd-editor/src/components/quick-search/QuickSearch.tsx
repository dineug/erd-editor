import {
  createRef,
  FC,
  nextTick,
  observable,
  onMounted,
  ref,
} from '@dineug/r-html';
import { isEmpty } from 'es-toolkit/compat';
import { filter } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import HighlightedText from '@/components/primitives/highlighted-text/HighlightedText';
import Kbd from '@/components/primitives/kbd/Kbd';
import TextInput from '@/components/primitives/text-input/TextInput';
import { Open } from '@/constants/open';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import { isEditingText } from '@/engine/modules/editor/state';
import { useUnmounted } from '@/hooks/useUnmounted';
import { arrayHas } from '@/utils/arrayHas';
import { lastCursorFocus } from '@/utils/focus';
import { focusEvent } from '@/utils/internalEvents';
import { isComposing, KeyBindingName } from '@/utils/keyboard-shortcut';

import { Action, createScopeActions, searchActions } from './actions';
import { clearHangulForms, findPaletteChunks } from './hangul';
import {
  PALETTE_PREFIXES,
  PaletteQuery,
  PaletteScope,
  parsePaletteQuery,
  scopeLabel,
} from './paletteQuery';
import * as styles from './QuickSearch.styles';
import { paletteRows, scopeBase } from './scopedActions';

export type QuickSearchProps = {};

const hasAutocompleteKey = arrayHas([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Enter',
]);

const QuickSearch: FC<QuickSearchProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const { addUnsubscribe } = useUnmounted();
  const root = createRef<HTMLDivElement>();

  const state = observable({
    keyword: '',
    prevActions: [] as Action[],
    actions: [] as Action[],
    rows: [] as Action[],
    submenu: false,
    scope: null as PaletteScope | null,
    index: -1,
  });

  const byFilter = (actions: Action[]) =>
    actions.filter(action => (action.filter ? action.filter(app.value) : true));

  /** What the list shows: the level, the keyword's fuzzy hits, or at the top level those ranked around the fields. */
  const getActions = () => byFilter(state.rows);

  const setLevel = (actions: Action[]) => {
    state.prevActions = actions;
    state.actions = actions;
    state.rows = actions;
    state.scope = null;
  };

  /** What is typed, read for a prefix at the top level only; a submenu filters its own rows. */
  const readQuery = (value: string): PaletteQuery =>
    state.submenu
      ? { scope: null, keyword: value.trim(), table: null }
      : parsePaletteQuery(value);

  const clearKeyword = () => {
    state.keyword = '';
    state.index = -1;
  };

  const setActions = (value: string) => {
    const query = readQuery(value);
    const base = scopeBase(state.prevActions, query.scope);
    // Only the unscoped list narrows inside its last hits, as the owner pinned;
    // each step a Korean IME hands over spells on from the last, so it keeps
    // its rows. A scope searches its whole base, and a prefix change restarts.
    const narrow = query.scope === null && state.scope === null;
    const from = narrow ? state.actions : base;

    state.index = -1;
    state.scope = query.scope;
    state.actions = isEmpty(query.keyword)
      ? base
      : searchActions(byFilter(from), query.keyword);
    // Rows read from the document are looked up afresh on every keystroke,
    // never narrowed from the last list, and only at the top level.
    state.rows = state.submenu
      ? state.actions
      : paletteRows(app.value, state.actions, query);
  };

  /** Types a prefix for the reader, as a help row or a hint does, and leaves the caret after it. */
  const insertText = (text: string) => {
    state.keyword = text;
    setActions(text);

    nextTick(() => {
      const input = root.value?.querySelector('input');
      input && lastCursorFocus(input);
    });
  };

  /** The words a row lights up: the keyword as typed, or without its prefix, and a column search's table part. */
  const getSearchWords = (): string[] => {
    const { scope, keyword, table } = readQuery(state.keyword);
    if (!scope) return [state.keyword];
    return table ? [keyword, table] : [keyword];
  };

  const scrollIntoView = () => {
    nextTick(() => {
      root.value?.querySelector('.selected')?.scrollIntoView({
        block: 'nearest',
      });
    });
  };

  const emitFocus = () => {
    nextTick(() => {
      ctx.host.dispatchEvent(focusEvent());
    });
  };

  const handleClose = () => {
    const { store } = app.value;
    store.dispatch(changeOpenMapAction({ [Open.search]: false }));
    clearHangulForms();
    emitFocus();
  };

  const handlePerform = (index: number) => {
    const action = getActions()[index];
    if (!action) return;

    if (action.perform) {
      action.perform(app.value);
      handleClose();
    } else if (action.next) {
      setLevel(action.next);
      state.submenu = true;

      const input = root.value?.querySelector('input');
      input && lastCursorFocus(input);
      clearKeyword();
    } else if (action.insert !== undefined) {
      insertText(action.insert);
    } else {
      handleClose();
    }
  };

  const handleArrowUp = (event: KeyboardEvent) => {
    const actions = getActions();
    if (!actions.length) return;
    event.preventDefault();

    const index = state.index - 1;
    state.index = index < 0 ? actions.length - 1 : index;
    scrollIntoView();
  };

  const handleArrowDown = (event: KeyboardEvent) => {
    const actions = getActions();
    if (!actions.length) return;
    event.preventDefault();

    const index = state.index + 1;
    state.index = index > actions.length - 1 ? 0 : index;
    scrollIntoView();
  };

  const handleArrowLeft = () => {
    state.index = -1;
  };
  const handleArrowRight = () => {
    state.index = -1;
  };

  const handleEnter = (event: KeyboardEvent) => {
    if (state.index === -1) return;
    event.stopPropagation();

    handlePerform(state.index);
  };

  const keyMap: Record<string, (event: KeyboardEvent) => void> = {
    ArrowUp: handleArrowUp,
    ArrowDown: handleArrowDown,
    ArrowLeft: handleArrowLeft,
    ArrowRight: handleArrowRight,
    Enter: handleEnter,
  };

  const handleKeydown = (event: KeyboardEvent) => {
    // A key pressed mid-syllable belongs to the IME, which finishes it first,
    // and Chrome on a Mac sends that Enter again once it has: only that one acts.
    if (isComposing(event) || !hasAutocompleteKey(event.key)) return;

    keyMap[event.key]?.(event);
  };

  const handleInputKeyword = (event: InputEvent) => {
    const el = event.target as HTMLInputElement | null;
    if (!el) return;

    setActions(el.value);
    state.keyword = el.value;
  };

  const handleToggleSearch = () => {
    const { store } = app.value;
    const { editor } = store.state;

    if (!isEditingText(editor)) {
      const opened = !editor.openMap[Open.search];
      store.dispatch(changeOpenMapAction({ [Open.search]: opened }));
      clearHangulForms();

      if (opened) {
        setLevel(createScopeActions(app.value));
        state.submenu = false;
        clearKeyword();
        store.dispatch(
          changeOpenMapAction({
            [Open.tableProperties]: false,
            [Open.themeBuilder]: false,
          })
        );
      } else {
        emitFocus();
      }
    }
  };

  const handleOutsideClick = (event: MouseEvent) => {
    const el = event.target as HTMLElement | null;
    if (!el) return;

    const canClose = !el.closest('.quick-search');
    canClose && handleClose();
  };

  onMounted(() => {
    const { shortcut$, emitter } = app.value;

    addUnsubscribe(
      shortcut$
        .pipe(filter(({ type }) => type === KeyBindingName.stop))
        .subscribe(handleClose),
      shortcut$
        .pipe(filter(({ type }) => type === KeyBindingName.search))
        .subscribe(handleToggleSearch),
      emitter.on({ toggleSearch: handleToggleSearch }),
      clearHangulForms
    );
  });

  return () => {
    const { store } = app.value;
    const {
      editor: { openMap },
    } = store.state;
    if (!openMap[Open.search]) return null;

    const searchWords = getSearchWords();
    const topLevel = !state.submenu;

    return (
      <div class={styles.root} on:click={handleOutsideClick}>
        <div class={['quick-search', styles.container]} use:ref={ref(root)}>
          <div class={styles.field}>
            <TextInput
              class={styles.search}
              placeholder="Search"
              autofocus={true}
              value={state.keyword}
              onInput={handleInputKeyword}
              onKeydown={handleKeydown}
            />
            {topLevel && state.scope ? (
              <span class={['quick-search-scope', styles.scope]}>
                {scopeLabel(state.scope)}
              </span>
            ) : null}
          </div>
          {topLevel && !state.keyword ? (
            <div class={['quick-search-hint', styles.hint]}>
              {PALETTE_PREFIXES.map(({ prefix, label, description }) => (
                <button
                  class={styles.hintItem}
                  type="button"
                  title={description}
                  on:click={(event: MouseEvent) => {
                    event.stopPropagation();
                    insertText(prefix);
                  }}
                >
                  <span class={styles.prefix}>{prefix}</span>
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          <div class={['scrollbar', styles.list]}>
            {getActions().map((action, index) => (
              <div
                class={[styles.action, { selected: index === state.index }]}
                on:click={(event: MouseEvent) => {
                  event.stopPropagation();
                  handlePerform(index);
                }}
              >
                {action.icon ? (
                  <div class={styles.icon}>{action.icon}</div>
                ) : null}
                <span class={styles.name}>
                  <HighlightedText
                    searchWords={searchWords}
                    textToHighlight={action.name}
                    findChunks={findPaletteChunks}
                  />
                </span>
                {action.keywords ? (
                  <>
                    <div class={styles.vertical}></div>
                    <span class={styles.keyword}>
                      <HighlightedText
                        searchWords={searchWords}
                        textToHighlight={action.keywords}
                        findChunks={findPaletteChunks}
                      />
                    </span>
                  </>
                ) : null}
                {action.shortcut ? (
                  <div class={styles.shortcut}>
                    <Kbd shortcut={action.shortcut} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };
};

export default QuickSearch;
