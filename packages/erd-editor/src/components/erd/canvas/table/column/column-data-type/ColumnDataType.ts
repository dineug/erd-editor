import {
  createRef,
  FC,
  html,
  observable,
  onMounted,
  Ref,
  ref,
  repeat,
  watch,
} from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';
import { isEmpty } from 'lodash-es';

import { AppContext, useAppContext } from '@/components/appContext';
import EditInput from '@/components/primitives/edit-input/EditInput';
import HighlightedText from '@/components/primitives/highlighted-text/HighlightedText';
import Kbd from '@/components/primitives/kbd/Kbd';
import { DatabaseHintMap, DataTypeHint } from '@/constants/sql/dataType';
import { changeColumnDataTypeAction$ } from '@/engine/modules/table-column/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { lastCursorFocus } from '@/utils/focus';

import * as styles from './ColumnDataType.styles';

export type ColumnDataTypeProps = {
  app: Ref<AppContext>;
  tableId: string;
  columnId: string;
  edit: boolean;
  focus: boolean;
  width: number;
  value: string;
  onInput?: (event: InputEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  onEditEnd?: () => void;
};

const hasAutocompleteKey = arrayHas([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Tab',
  'Enter',
]);

const ColumnDataType: FC<ColumnDataTypeProps> = (props, ctx) => {
  const app = useAppContext(ctx, props.app?.value);
  const state = observable({
    hints: [] as DataTypeHint[],
    index: -1,
  });
  const root = createRef<HTMLDivElement>();
  const { addUnsubscribe } = useUnmounted();

  const setHints = (value: string) => {
    const { store } = app.value;
    const { settings } = store.state;
    const hints = DatabaseHintMap[settings.database] ?? [];
    const newValue = value.trim();

    state.index = -1;
    state.hints = isEmpty(newValue)
      ? []
      : hints.filter(
          hint => hint.name.toLowerCase().indexOf(newValue.toLowerCase()) !== -1
        );
  };

  const handleSelectHint = (index: number) => {
    const hint = state.hints[index];
    if (!hint) return;

    const { store } = app.value;
    store.dispatch(
      changeColumnDataTypeAction$({
        id: props.columnId,
        tableId: props.tableId,
        value: hint.name,
      })
    );
    setHints('');
  };

  const handleArrowUp = (event: KeyboardEvent) => {
    if (!state.hints.length) return;
    event.preventDefault();

    const index = state.index - 1;
    state.index = index < 0 ? state.hints.length - 1 : index;
  };

  const handleArrowDown = (event: KeyboardEvent) => {
    if (!state.hints.length) return;
    event.preventDefault();

    const index = state.index + 1;
    state.index = index > state.hints.length - 1 ? 0 : index;
  };

  const handleArrowLeft = (event: KeyboardEvent) => {
    state.index = -1;
  };

  const handleArrowRight = (event: KeyboardEvent) => {
    if (state.index === -1) return;
    event.preventDefault();

    handleSelectHint(state.index);
  };

  const handleTab = (event: KeyboardEvent) => {
    if (state.index === -1) return;
    event.preventDefault();
    event.stopPropagation();

    handleSelectHint(state.index);
  };

  const handleEnter = (event: KeyboardEvent) => {
    if (state.index === -1) return;
    event.stopPropagation();

    handleSelectHint(state.index);
    props.onEditEnd?.();
  };

  const keyMap: Record<string, (event: KeyboardEvent) => void> = {
    ArrowUp: handleArrowUp,
    ArrowDown: handleArrowDown,
    ArrowLeft: handleArrowLeft,
    ArrowRight: handleArrowRight,
    Tab: handleTab,
    Enter: handleEnter,
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (!hasAutocompleteKey(event.key)) return;

    keyMap[event.key]?.(event);
  };

  let currentFocus = false;
  let timerId = -1;

  const handleFocus = () => {
    currentFocus = true;
  };

  const handleFocusout = (event: FocusEvent) => {
    if (!props.edit) return;

    currentFocus = false;

    window.clearTimeout(timerId);
    timerId = window.setTimeout(() => {
      const input = root.value?.querySelector('input');
      const isFocus = currentFocus && input && props.edit;

      isFocus ? lastCursorFocus(input) : props.onBlur?.(event);
    }, 1);
  };

  const handleInput = (event: InputEvent) => {
    const input = event.target as HTMLInputElement | null;
    input && setHints(input.value);
    props.onInput?.(event);
  };

  onMounted(() => {
    const { store } = app.value;
    const { settings } = store.state;

    addUnsubscribe(
      watch(props).subscribe(propName => {
        if (propName !== 'edit') return;
        !props.edit && setHints('');
      }),
      watch(settings).subscribe(propName => {
        if (propName !== 'database') return;
        setHints(props.value);
      })
    );
  });

  return () => html`
    <div
      class=${styles.root}
      ${ref(root)}
      tabindex="-1"
      @focus=${handleFocus}
      @focusin=${handleFocus}
      @focusout=${handleFocusout}
    >
      <${EditInput}
        placeholder="dataType"
        width=${props.width}
        value=${props.value}
        focus=${props.focus}
        edit=${props.edit}
        autofocus=${true}
        .onInput=${handleInput}
        .onKeydown=${handleKeydown}
      />
      ${props.edit
        ? html`
            <div class=${styles.hint}>
              ${repeat(
                state.hints,
                hint => hint.name,
                (hint, index) => html`
                  <div
                    class=${[
                      styles.hintItem,
                      { selected: index === state.index },
                    ]}
                    @click=${() => handleSelectHint(index)}
                  >
                    <${HighlightedText}
                      searchWords=${[props.value]}
                      textToHighlight=${hint.name}
                    />
                    <${Kbd} mini=${true} shortcut="Tab" />
                  </div>
                `
              )}
            </div>
          `
        : null}
    </div>
  `;
};

export default ColumnDataType;
