import {
  createRef,
  FC,
  nextTick,
  observable,
  onMounted,
  ref,
} from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';
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
import { lastCursorFocus } from '@/utils/focus';
import { focusEvent } from '@/utils/internalEvents';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

import { Action, createScopeActions, searchActions } from './actions';
import * as styles from './QuickSearch.styles';

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
    index: -1,
  });

  const getActions = () => {
    return state.actions.filter(action =>
      action.filter ? action.filter(app.value) : true
    );
  };

  const clearKeyword = () => {
    state.keyword = '';
    state.index = -1;
  };

  const setActions = (value: string) => {
    const newValue = value.trim();

    state.index = -1;
    state.actions = isEmpty(newValue)
      ? state.prevActions
      : searchActions(getActions(), newValue);
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
    emitFocus();
  };

  const handlePerform = (index: number) => {
    const action = getActions()[index];
    if (!action) return;

    if (action.perform) {
      action.perform(app.value);
      handleClose();
    } else if (action.next) {
      state.prevActions = action.next;
      state.actions = action.next;

      const input = root.value?.querySelector('input');
      input && lastCursorFocus(input);
      clearKeyword();
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
    if (!hasAutocompleteKey(event.key)) return;

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

      if (opened) {
        const actions = createScopeActions(app.value);
        state.prevActions = actions;
        state.actions = actions;
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
      emitter.on({ toggleSearch: handleToggleSearch })
    );
  });

  return () => {
    const { store } = app.value;
    const {
      editor: { openMap },
    } = store.state;
    if (!openMap[Open.search]) return null;

    return (
      <div class={styles.root} on:click={handleOutsideClick}>
        <div class={['quick-search', styles.container]} use:ref={ref(root)}>
          <TextInput
            class={styles.search}
            placeholder="Search"
            autofocus={true}
            value={state.keyword}
            onInput={handleInputKeyword}
            onKeydown={handleKeydown}
          />
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
                    searchWords={[state.keyword]}
                    textToHighlight={action.name}
                  />
                </span>
                {action.keywords ? (
                  <>
                    <div class={styles.vertical}></div>
                    <span class={styles.keyword}>
                      <HighlightedText
                        searchWords={[state.keyword]}
                        textToHighlight={action.keywords}
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
