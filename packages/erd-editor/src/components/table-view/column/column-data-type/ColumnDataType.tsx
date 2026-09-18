import {
  createRef,
  FC,
  onMounted,
  onUnmounted,
  Ref,
  ref,
  repeat,
  watch,
} from '@dineug/r-html';

import { AppContext, useAppContext } from '@/components/appContext';
import EditInput from '@/components/primitives/edit-input/EditInput';
import HighlightedText from '@/components/primitives/highlighted-text/HighlightedText';
import Kbd from '@/components/primitives/kbd/Kbd';
import { useColumnCell } from '@/components/table-view/column/useColumnCell';
import { DATA_TYPE_HINT_ROW_HEIGHT } from '@/constants/layout';
import { useUnmounted } from '@/hooks/useUnmounted';
import { lastCursorFocus } from '@/utils/focus';
import { isMod } from '@/utils/keyboard-shortcut';

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
  const hintList = createRef<HTMLDivElement>();
  const { addUnsubscribe } = useUnmounted();

  let currentFocus = false;
  let timerId: any = -1;
  let pendingBlur: FocusEvent | null = null;

  const handleFocus = () => {
    currentFocus = true;
  };

  /**
   * Answers the question the focusout left open: the caret goes back when the
   * press landed inside this editor, and the edit ends when it landed anywhere
   * else. Answering twice is what a cleared timer prevents.
   */
  const settleFocusout = () => {
    clearTimeout(timerId);
    const event = pendingBlur;
    if (!event) return;
    pendingBlur = null;

    const input = root.value?.querySelector('input');
    const isFocus = currentFocus && input && props.edit;

    isFocus ? lastCursorFocus(input) : props.onBlur?.(event);
  };

  /**
   * A press on the hint list takes the caret off the input before the click
   * lands, so the answer waits a turn for the focusin that press brings back.
   */
  const handleFocusout = (event: FocusEvent) => {
    if (!props.edit) return;

    currentFocus = false;
    pendingBlur = event;

    clearTimeout(timerId);
    timerId = setTimeout(settleFocusout, 1);
  };

  /**
   * A torn down editor has no next turn to wait for, and the store has already
   * moved on. Left to the timer, the answer lands after whatever cell opened
   * next and ends that one's edit instead of this one's.
   */
  onUnmounted(settleFocusout);

  const handleInput = (event: InputEvent) => {
    const input = event.target as HTMLInputElement | null;
    input && setHints(input.value);
    props.onInput?.(event);
  };

  /**
   * Keeps a press on the list from being read as a press on bare canvas. The
   * list is dom over the stage, so the scene hit test cannot see it, and the
   * canvas routing above ends this editor's focus before the release arrives.
   */
  const handleHintMousedown = (event: MouseEvent) => {
    // Holding the caret here too, so no blur, no focusout timer and no
    // interrupted composition stands between the press and the click.
    event.preventDefault();
    event.stopPropagation();
  };

  /** The same press, arriving as touch, which the canvas routing also reads. */
  const handleHintTouchstart = (event: TouchEvent) => {
    event.stopPropagation();
  };

  /**
   * Keeps a wheel the list scrolls by off the canvas, which would pan the
   * scene out from under the editor. A sideways wheel, the shifted spelling
   * the canvas reads as one, a zoom chord, a ctrl wheel and a short list reach it.
   */
  const handleHintWheel = (event: WheelEvent) => {
    if (isMod(event) || event.ctrlKey) return;

    const { deltaX, deltaY } = event;
    const sideways =
      deltaY === 0 ||
      Math.abs(deltaY) < Math.abs(deltaX) ||
      (event.shiftKey && deltaX === 0);
    if (sideways) return;

    const el = hintList.value;
    if (!el || el.scrollHeight <= el.clientHeight) return;

    event.stopPropagation();
  };

  /**
   * Keeps the row the keyboard selects in view by the list's own scrollTop. The
   * overlay above clips the list, so scrollIntoView would scroll that too and
   * carry the input off the cell it edits. A new list opens at its top.
   */
  const handleHintState = (propName: PropertyKey) => {
    const el = hintList.value;
    if (!el) return;

    if (propName === 'hints') {
      el.scrollTop = 0;
      return;
    }
    if (propName !== 'index' || state.index === -1) return;

    const top = state.index * DATA_TYPE_HINT_ROW_HEIGHT;
    const bottom = top + DATA_TYPE_HINT_ROW_HEIGHT;

    if (top < el.scrollTop) {
      el.scrollTop = top;
    } else if (bottom > el.scrollTop + el.clientHeight) {
      el.scrollTop = bottom - el.clientHeight;
    }
  };

  onMounted(() => {
    addUnsubscribe(watch(state).subscribe(handleHintState));
  });

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
        <div
          class={['data-type-hint', styles.hint]}
          use:ref={ref(hintList)}
          on:mousedown={handleHintMousedown}
          on:touchstart={handleHintTouchstart}
          on:wheel={handleHintWheel}
        >
          {repeat(
            state.hints,
            hint => hint.name,
            (hint, index) => (
              <div
                class={[
                  'data-type-hint-item',
                  styles.hintItem,
                  { selected: index === state.index },
                ]}
                on:click={() => handleSelectHint(index)}
              >
                <span>
                  <HighlightedText
                    searchWords={[props.value]}
                    textToHighlight={hint.name}
                  />
                </span>
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
