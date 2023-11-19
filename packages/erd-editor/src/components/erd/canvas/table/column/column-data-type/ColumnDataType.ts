import {
  createRef,
  FC,
  html,
  observable,
  onMounted,
  ref,
  repeat,
  watch,
} from '@dineug/r-html';
import { arrayHas } from '@dineug/shared';
import { isEmpty } from 'lodash-es';

import { useAppContext } from '@/components/appContext';
import EditInput from '@/components/primitives/edit-input/EditInput';
import HighlightedText from '@/components/primitives/highlighted-text/HighlightedText';
import { DatabaseHintMap, DataTypeHint } from '@/constants/sql/dataType';
import { changeColumnDataTypeAction } from '@/engine/modules/tableColumn/atom.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { lastCursorFocus } from '@/utils/focus';

import * as styles from './ColumnDataType.styles';

export type ColumnDataTypeProps = {
  tableId: string;
  columnId: string;
  edit: boolean;
  focus: boolean;
  width: number;
  value: string;
  onInput?: (event: InputEvent) => void;
  onBlur?: (event: FocusEvent) => void;
};

export interface State {
  hints: DataTypeHint[];
  index: number;
  holdFilter: boolean;
}

const hasArrowKey = arrayHas([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

const ColumnDataType: FC<ColumnDataTypeProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const state = observable<State>({
    hints: [],
    index: -1,
    holdFilter: false,
  });
  const root = createRef<HTMLDivElement>();
  const { addUnsubscribe } = useUnmounted();

  const setHints = () => {
    if (state.holdFilter) return;

    const { store } = app.value;
    const { settings } = store.state;
    const hints = DatabaseHintMap[settings.database] ?? [];
    const value = props.value.trim();

    state.index = -1;
    state.hints = isEmpty(value)
      ? []
      : hints.filter(
          hint => hint.name.toLowerCase().indexOf(value.toLowerCase()) !== -1
        );
  };

  const handleSelectHint = (index: number) => {
    const hint = state.hints[index];
    if (!hint) return;

    const { store } = app.value;
    state.holdFilter = true;
    store.dispatch(
      changeColumnDataTypeAction({
        id: props.columnId,
        tableId: props.tableId,
        value: hint.name,
      })
    );
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

  const keyMap: Record<string, (event: KeyboardEvent) => void> = {
    ArrowUp: handleArrowUp,
    ArrowDown: handleArrowDown,
    ArrowLeft: handleArrowLeft,
    ArrowRight: handleArrowRight,
  };

  const handleKeydown = (event: KeyboardEvent) => {
    const { key } = event;
    if (!hasArrowKey(key)) return;

    keyMap[key]?.(event);
  };

  let currentFocus = false;
  let timerId = -1;

  const handleFocus = () => {
    currentFocus = true;
  };

  const handleFocusout = (event: FocusEvent) => {
    currentFocus = false;

    window.clearTimeout(timerId);
    timerId = window.setTimeout(() => {
      const input = root.value?.querySelector('input');
      const isFocus = currentFocus && input && props.edit;

      if (isFocus) {
        lastCursorFocus(input);
      } else {
        props.onBlur?.(event);
      }
    }, 1);
  };

  const handleInput = (event: InputEvent) => {
    state.holdFilter = false;
    props.onInput?.(event);
  };

  onMounted(() => {
    const { store } = app.value;
    const { settings } = store.state;

    addUnsubscribe(
      watch(props).subscribe(propName => {
        if (propName !== 'value') return;
        setHints();
      }),
      watch(settings).subscribe(propName => {
        if (propName !== 'database') return;
        state.holdFilter = false;
        setHints();
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
                (hint, index) =>
                  html`
                    <div
                      class=${{ selected: index === state.index }}
                      @click=${() => handleSelectHint(index)}
                    >
                      <${HighlightedText}
                        searchWords=${[props.value]}
                        textToHighlight=${hint.name}
                      />
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
