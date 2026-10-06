import {
  createRef,
  FC,
  nextTick,
  observable,
  onMounted,
  ref,
  watch,
} from '@dineug/r-html';
import { isEmpty } from 'es-toolkit/compat';
import { filter } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import { useI18n } from '@/components/localeContext';
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

import {
  Action,
  createScopeActions,
  PalettePreferences,
  searchActions,
} from './actions';
import { clearHangulForms, findPaletteChunks } from './hangul';
import {
  PALETTE_PREFIXES,
  PaletteQuery,
  parsePaletteQuery,
  scopeLabel,
} from './paletteQuery';
import * as styles from './QuickSearch.styles';
import { paletteRows, scopeBase } from './scopedActions';

export type QuickSearchProps = PalettePreferences;

const hasAutocompleteKey = arrayHas([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Enter',
]);

const QuickSearch: FC<QuickSearchProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);
  const { addUnsubscribe } = useUnmounted();
  const root = createRef<HTMLDivElement>();

  const state = observable({
    keyword: '',
    /** Every row of the level shown, the top level or a submenu, which each keystroke searches afresh. */
    level: [] as Action[],
    rows: [] as Action[],
    submenu: false,
    /** The id of the top-level row whose submenu is shown, so a rebuild finds it again wherever it now sits, or not at all. */
    parent: undefined as Action['id'],
    /** Whether the search with no prefix finds no command of the level. */
    missed: false,
    index: -1,
  });

  const byFilter = (actions: Action[]) =>
    actions.filter(action => (action.filter ? action.filter(app.value) : true));

  const isOpen = () =>
    Boolean(app.value.store.state.editor.openMap[Open.search]);

  /** The top level in the language shown, Theme and Display Language with it while the element offers those pickers. */
  const createTopLevel = () =>
    createScopeActions(app.value, i18n.value, {
      appearance: props.appearance,
      locale: props.locale,
    });

  /** What the list shows: the level's commands or their fuzzy hits, at the top level the prefixes offered below them, or a scope's rows. */
  const getActions = () => byFilter(state.rows);

  const setLevel = (actions: Action[]) => {
    state.level = actions;
    state.rows = scopeBase(actions, null);
    state.missed = false;
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
    const base = scopeBase(state.level, query.scope);
    const noKeyword = isEmpty(query.keyword);
    // Every keystroke searches the level's whole list, as VS Code's palette
    // does, never the last hits: a word deleted or typed anew finds afresh.
    const found = noKeyword
      ? base
      : searchActions(byFilter(base), query.keyword);

    state.index = -1;
    // Rows read from the document are looked up only at the top level.
    state.rows = state.submenu
      ? found
      : paletteRows(app.value, found, query, i18n.value);
    state.missed =
      !state.submenu && query.scope === null && !noKeyword && !found.length;
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
  const getSearchWords = ({
    scope,
    keyword,
    table,
  }: PaletteQuery): string[] => {
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

  /** Stands the keyboard on a submenu's option in force, as the locale picker does, scrolled into view. */
  const selectChecked = () => {
    state.index = getActions().findIndex(action => action.checked);
    if (state.index !== -1) scrollIntoView();
  };

  const openSubmenu = (actions: Action[]) => {
    setLevel(actions);
    state.submenu = true;
    clearKeyword();
    selectChecked();
  };

  /**
   * Builds the level shown again, after the language or an option in force
   * changed while the palette is open, keeping what is typed: the submenu
   * shown comes back in the new language while its row is offered, else the top level.
   */
  const rebuild = () => {
    if (!isOpen()) return;

    const top = createTopLevel();
    const submenu =
      state.submenu && state.parent
        ? top.find(action => action.id === state.parent)?.next
        : undefined;
    const keyword = state.keyword;

    state.submenu = Boolean(submenu);
    setLevel(submenu ?? top);
    if (keyword) {
      setActions(keyword);
    } else if (submenu) {
      selectChecked();
    } else {
      state.index = -1;
    }
  };

  let rebuildQueued = false;
  /** One rebuild for a switch, which sets the language's fields one by one, read once every field is in. */
  const queueRebuild = () => {
    if (rebuildQueued) return;
    rebuildQueued = true;
    nextTick(() => {
      rebuildQueued = false;
      rebuild();
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
      if (!state.submenu) state.parent = action.id;
      openSubmenu(action.next);

      const input = root.value?.querySelector('input');
      input && lastCursorFocus(input);
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
        setLevel(createTopLevel());
        state.submenu = false;
        state.parent = undefined;
        clearKeyword();
        store.dispatch(
          changeOpenMapAction({
            [Open.tableProperties]: false,
            [Open.themeBuilder]: false,
            [Open.exportImage]: false,
            [Open.localePicker]: false,
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
      watch(i18n.value).subscribe(name => {
        name === 'locale' && queueRebuild();
      }),
      watch(props).subscribe(name => {
        (name === 'appearance' || name === 'locale') && queueRebuild();
      }),
      clearHangulForms
    );
  });

  return () => {
    const { store } = app.value;
    const {
      editor: { openMap },
    } = store.state;
    if (!openMap[Open.search]) return null;

    const { t } = i18n.value;
    const query = readQuery(state.keyword);
    const searchWords = getSearchWords(query);
    const topLevel = !state.submenu;

    return (
      <div class={styles.root} on:click={handleOutsideClick}>
        <div class={['quick-search', styles.container]} use:ref={ref(root)}>
          <div class={styles.field}>
            <TextInput
              class={styles.search}
              placeholder={t('common.search')}
              dir="auto"
              autofocus={true}
              value={state.keyword}
              onInput={handleInputKeyword}
              onKeydown={handleKeydown}
            />
            {query.scope ? (
              <span class={['quick-search-scope', styles.scope]}>
                {scopeLabel(query.scope, i18n.value)}
              </span>
            ) : null}
          </div>
          {topLevel && !state.keyword ? (
            <div class={['quick-search-hint', styles.hint]}>
              {PALETTE_PREFIXES.map(({ prefix, labelKey, descriptionKey }) => (
                <button
                  class={styles.hintItem}
                  type="button"
                  title={t(descriptionKey)}
                  on:click={(event: MouseEvent) => {
                    event.stopPropagation();
                    insertText(prefix);
                  }}
                >
                  <span class={styles.prefix}>{prefix}</span>
                  {t(labelKey)}
                </button>
              ))}
            </div>
          ) : null}
          {state.missed ? (
            <div class={['quick-search-empty', styles.empty]}>
              {t('palette.noCommandsMatch')}
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
                <span class={styles.name} prop:dir="auto">
                  <HighlightedText
                    searchWords={searchWords}
                    textToHighlight={action.name}
                    findChunks={findPaletteChunks}
                  />
                </span>
                {action.keywords ? (
                  <>
                    <div class={styles.vertical}></div>
                    <span
                      class={styles.keyword}
                      prop:dir="auto"
                      title={action.keywords}
                    >
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
