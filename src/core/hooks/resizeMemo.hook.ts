import { Move } from '@/internal-types/event.helper';
import { useContext } from './context.hook';
import { SIZE_MEMO_WIDTH, SIZE_MEMO_HEIGHT } from '@/core/layout';
import { MemoProps } from '@/components/editor/memo/Memo';
import { resizeMemo } from '@/engine/command/memo.cmd.helper';

type Direction = 'left' | 'right' | 'top' | 'bottom';
export type Position =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'lt'
  | 'rt'
  | 'lb'
  | 'rb';

interface ResizeMemo {
  change: boolean;
  top: number;
  left: number;
  width: number;
  height: number;
}

export function useResizeMemo(props: MemoProps, ctx: Element) {
  const contextRef = useContext(ctx);

  let clientX = 0;
  let clientY = 0;

  const resizeWidth = (
    { movementX, x }: Move,
    direction: Direction
  ): ResizeMemo => {
    const ui = Object.assign({ change: false }, props.memo.ui);
    const mouseDirection: Direction = movementX < 0 ? 'left' : 'right';
    const width =
      direction === 'left' ? ui.width - movementX : ui.width + movementX;

    switch (mouseDirection) {
      case 'left':
        if (SIZE_MEMO_WIDTH < width && x < clientX) {
          direction === 'left' && (ui.left += movementX);
          clientX += movementX;
          ui.width = width;
          ui.change = true;
        }
        break;
      case 'right':
        if (SIZE_MEMO_WIDTH < width && x > clientX) {
          direction === 'left' && (ui.left += movementX);
          clientX += movementX;
          ui.width = width;
          ui.change = true;
        }
        break;
    }
    return ui;
  };

  const resizeHeight = (
    { movementY, y }: Move,
    direction: Direction
  ): ResizeMemo => {
    const ui = Object.assign({ change: false }, props.memo.ui);
    const mouseDirection: Direction = movementY < 0 ? 'top' : 'bottom';
    const height =
      direction === 'top' ? ui.height - movementY : ui.height + movementY;

    switch (mouseDirection) {
      case 'top':
        if (SIZE_MEMO_HEIGHT < height && y < clientY) {
          direction === 'top' && (ui.top += movementY);
          clientY += movementY;
          ui.height = height;
          ui.change = true;
        }
        break;
      case 'bottom':
        if (SIZE_MEMO_HEIGHT < height && y > clientY) {
          direction === 'top' && (ui.top += movementY);
          clientY += movementY;
          ui.height = height;
          ui.change = true;
        }
        break;
    }
    return ui;
  };

  const onMousemoveSash = (move: Move, position: Position) => {
    move.event.preventDefault();
    const { store } = contextRef.value;
    let verticalUI: ResizeMemo | null = null;
    let horizontalUI: ResizeMemo | null = null;

    switch (position) {
      case 'left':
      case 'right':
        verticalUI = resizeWidth(move, position);
        break;
      case 'top':
      case 'bottom':
        horizontalUI = resizeHeight(move, position);
        break;
      case 'lt':
        verticalUI = resizeWidth(move, 'left');
        horizontalUI = resizeHeight(move, 'top');
        break;
      case 'rt':
        verticalUI = resizeWidth(move, 'right');
        horizontalUI = resizeHeight(move, 'top');
        break;
      case 'lb':
        verticalUI = resizeWidth(move, 'left');
        horizontalUI = resizeHeight(move, 'bottom');
        break;
      case 'rb':
        verticalUI = resizeWidth(move, 'right');
        horizontalUI = resizeHeight(move, 'bottom');
        break;
    }

    if (verticalUI?.change && horizontalUI?.change) {
      store.dispatch(
        resizeMemo(
          props.memo.id,
          horizontalUI.top,
          verticalUI.left,
          verticalUI.width,
          horizontalUI.height
        )
      );
    } else if (verticalUI?.change) {
      store.dispatch(
        resizeMemo(
          props.memo.id,
          verticalUI.top,
          verticalUI.left,
          verticalUI.width,
          verticalUI.height
        )
      );
    } else if (horizontalUI?.change) {
      store.dispatch(
        resizeMemo(
          props.memo.id,
          horizontalUI.top,
          horizontalUI.left,
          horizontalUI.width,
          horizontalUI.height
        )
      );
    }
  };

  const onMousedownSash = (event: MouseEvent, position: Position) => {
    const { drag$ } = contextRef.value.globalEvent;
    clientX = event.clientX;
    clientY = event.clientY;
    drag$.subscribe(move => onMousemoveSash(move, position));
  };

  return {
    onMousedownSash,
  };
}
