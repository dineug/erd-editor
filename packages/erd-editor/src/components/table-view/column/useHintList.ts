import { createRef, onMounted, onUnmounted, watch } from '@dineug/r-html';

import { DATA_TYPE_HINT_ROW_HEIGHT } from '@/constants/layout';
import { useUnmounted } from '@/hooks/useUnmounted';
import { lastCursorFocus } from '@/utils/focus';
import { isMod } from '@/utils/keyboard-shortcut';

export type HintListProps = {
  onBlur?: (event: FocusEvent) => void;
};

/** The rows a list under a cell editor offers, and the one the keyboard is on, -1 for none. */
export type HintListState = {
  rows: ReadonlyArray<unknown>;
  index: number;
};

/**
 * The focus, pointer and scroll handling a cell editor with a list under its
 * input shares with the data type cell: a press on the list keeps the caret,
 * the wheel it scrolls by stays off the canvas, and the keyboard row stays in view.
 */
export function useHintList(props: HintListProps, state: HintListState) {
  const root = createRef<HTMLDivElement>();
  const hintList = createRef<HTMLDivElement>();
  const { addUnsubscribe } = useUnmounted();

  let currentFocus = false;
  let timerId: ReturnType<typeof setTimeout> | undefined;
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
    currentFocus && input ? lastCursorFocus(input) : props.onBlur?.(event);
  };

  /** A press inside this editor takes the caret off the input first, so the answer waits a turn. */
  const handleFocusout = (event: FocusEvent) => {
    currentFocus = false;
    pendingBlur = event;

    clearTimeout(timerId);
    timerId = setTimeout(settleFocusout, 1);
  };

  // A torn down editor has no next turn to wait for, and the answer left to
  // the timer would end whichever cell opened next instead of this one.
  onUnmounted(settleFocusout);

  /**
   * Keeps a press on the list from reading as a press on bare canvas, and the
   * caret in the input, so no blur or broken composition comes before the click.
   */
  const handleHintMousedown = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  /** The same press, arriving as touch, which the canvas routing also reads. */
  const handleHintTouchstart = (event: TouchEvent) => {
    event.stopPropagation();
  };

  /**
   * Keeps a wheel the list scrolls by off the canvas, which would pan the scene
   * from under the editor. A sideways wheel, a zoom chord and a short list reach it.
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
   * Brings the keyboard row into view by the list's own scrollTop, since the
   * overlay clips the list and scrollIntoView would carry the input off its cell.
   */
  const keepIndexInView = () => {
    const el = hintList.value;
    if (!el || state.index === -1) return;

    const top = state.index * DATA_TYPE_HINT_ROW_HEIGHT;
    const bottom = top + DATA_TYPE_HINT_ROW_HEIGHT;

    if (top < el.scrollTop) {
      el.scrollTop = top;
    } else if (bottom > el.scrollTop + el.clientHeight) {
      el.scrollTop = bottom - el.clientHeight;
    }
  };

  /** A new list opens at its top, and an arrow keeps its row in view. */
  const handleState = (propName: PropertyKey) => {
    const el = hintList.value;
    if (el && propName === 'rows') el.scrollTop = 0;
    if (propName === 'index') keepIndexInView();
  };

  onMounted(() => {
    addUnsubscribe(watch(state).subscribe(handleState));
    keepIndexInView();
  });

  /** The keyboard row one step up or down, round either end; -1 while the list is empty. */
  const step = (delta: 1 | -1) => {
    const { length } = state.rows;
    if (!length) return;

    const index = state.index + delta;
    state.index = index < 0 ? length - 1 : index >= length ? 0 : index;
  };

  return {
    root,
    hintList,
    handleFocus,
    handleFocusout,
    handleHintMousedown,
    handleHintTouchstart,
    handleHintWheel,
    step,
  };
}
