import { createRef, FC, Ref, ref, repeat } from '@dineug/r-html';

import { AppContext, useAppContext } from '@/components/appContext';
import EditInput from '@/components/primitives/edit-input/EditInput';
import HighlightedText from '@/components/primitives/highlighted-text/HighlightedText';
import Kbd from '@/components/primitives/kbd/Kbd';
import { useColumnCell } from '@/components/table-view/column/useColumnCell';
import { lastCursorFocus } from '@/utils/focus';

import * as styles from './ColumnDataType.styles';

export type ColumnDataTypeProps = {
  app?: Ref<AppContext>;
  tableId: string;
  columnId: string;
  edit?: boolean;
  focus?: boolean;
  width: number;
  value: string;
  onInput?: (event: InputEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  onEditEnd?: () => void;
};

const ColumnDataType: FC<ColumnDataTypeProps> = (props, ctx) => {
  const app = useAppContext(ctx, props.app?.value);
  const { state, setHints, handleSelectHint, handleKeydown } = useColumnCell(
    props,
    app
  );
  const root = createRef<HTMLDivElement>();

  let currentFocus = false;
  let timerId: any = -1;

  const handleFocus = () => {
    currentFocus = true;
  };

  const handleFocusout = (event: FocusEvent) => {
    if (!props.edit) return;

    currentFocus = false;

    clearTimeout(timerId);
    timerId = setTimeout(() => {
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

  return () => (
    <div
      class={styles.root}
      use:ref={ref(root)}
      tabindex="-1"
      on:focus={handleFocus}
      on:focusin={handleFocus}
      on:focusout={handleFocusout}
    >
      <EditInput
        placeholder="dataType"
        width={props.width}
        value={props.value}
        focus={props.focus}
        edit={props.edit}
        autofocus={true}
        onInput={handleInput}
        onKeydown={handleKeydown}
      />
      {props.edit ? (
        <div class={styles.hint}>
          {repeat(
            state.hints,
            hint => hint.name,
            (hint, index) => (
              <div
                class={[styles.hintItem, { selected: index === state.index }]}
                on:click={() => handleSelectHint(index)}
              >
                <HighlightedText
                  searchWords={[props.value]}
                  textToHighlight={hint.name}
                />
                <Kbd mini={true} shortcut="Tab" />
              </div>
            )
          )}
        </div>
      ) : null}
    </div>
  );
};

export default ColumnDataType;
