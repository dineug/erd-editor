/** @jsxHost konva */

import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import {
  HIT_FILL,
  type ScenePointerEvent,
} from '@/components/erd/canvas/sceneTokens';
import { SASH_SIZE } from '@/components/primitives/sash/Sash.styles';
import {
  MEMO_BORDER,
  MEMO_MIN_HEIGHT,
  MEMO_MIN_WIDTH,
} from '@/constants/layout';
import { resizeMemoAction } from '@/engine/modules/memo/atom.actions';
import type { Memo, ValuesType } from '@/internal-types';
import { isMouseEvent } from '@/utils/domEvent';
import { DirectionName } from '@/utils/draw-relationship';
import { drag$, DragMove } from '@/utils/globalEventObservable';

export type MemoSashProps = {
  memo: Memo;
  top: number;
  left: number;
};

export const MemoSashPosition = {
  left: 'left',
  right: 'right',
  bottom: 'bottom',
  lt: 'lt',
  rt: 'rt',
  lb: 'lb',
  rb: 'rb',
} as const;
export type MemoSashPosition = ValuesType<typeof MemoSashPosition>;

/**
 * The three shapes a sash takes, spelled out rather than imported from the DOM
 * Sash primitive: that module reaches the window through drag$, which a scene
 * drawn in a worker has none of.
 */
const SashShape = {
  vertical: 'vertical',
  horizontal: 'horizontal',
  edge: 'edge',
} as const;
type SashShape = ValuesType<typeof SashShape>;

/**
 * The pointer a sash asks the stage container for while it is under one. Sash
 * styles gave the sides theirs through a class and each corner one of its own,
 * and a konva node has no cursor of its own to carry them.
 */
const CURSORS: Record<MemoSashPosition, string> = {
  left: 'ew-resize',
  right: 'ew-resize',
  bottom: 'ns-resize',
  lt: 'nwse-resize',
  rt: 'nesw-resize',
  lb: 'nesw-resize',
  rb: 'nwse-resize',
};

type SashPlacement = {
  position: MemoSashPosition;
  shape: SashShape;
  top?: number;
  left?: number;
};

const createSash = (top: number, left: number): SashPlacement[] => [
  {
    shape: SashShape.vertical,
    position: MemoSashPosition.left,
  },
  {
    shape: SashShape.vertical,
    position: MemoSashPosition.right,
    left,
  },
  {
    shape: SashShape.horizontal,
    position: MemoSashPosition.bottom,
    top,
  },
  {
    shape: SashShape.edge,
    position: MemoSashPosition.lt,
  },
  {
    shape: SashShape.edge,
    position: MemoSashPosition.rt,
    left,
  },
  {
    shape: SashShape.edge,
    position: MemoSashPosition.lb,
    top,
  },
  {
    shape: SashShape.edge,
    position: MemoSashPosition.rb,
    top,
    left,
  },
];

const centerTop = ({ shape, top = 0 }: SashPlacement) =>
  top === 0 && shape === SashShape.vertical ? top : top - SASH_SIZE / 2;

const centerLeft = ({ shape, left = 0 }: SashPlacement) =>
  left === 0 && shape === SashShape.horizontal ? left : left - SASH_SIZE / 2;

type ResizeMemo = {
  change: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Where the gesture began, from either pointer kind the scene accepts. */
const pointerOf = (event: ScenePointerEvent) =>
  isMouseEvent(event.evt)
    ? { x: event.evt.clientX, y: event.evt.clientY }
    : {
        x: event.evt.touches[0]?.clientX ?? 0,
        y: event.evt.touches[0]?.clientY ?? 0,
      };

const MemoSash: FC<MemoSashProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  let clientX = 0;
  let clientY = 0;

  const resizeWidth = (
    { movementX, x }: DragMove,
    direction: DirectionName
  ): ResizeMemo => {
    const ui = Object.assign({ change: false }, props.memo.ui);
    const mouseDirection =
      movementX < 0 ? DirectionName.left : DirectionName.right;
    const width =
      direction === DirectionName.left
        ? ui.width - movementX
        : ui.width + movementX;

    switch (mouseDirection) {
      case DirectionName.left:
        if (MEMO_MIN_WIDTH < width && x < clientX) {
          direction === DirectionName.left && (ui.x += movementX);
          clientX += movementX;
          ui.width = width;
          ui.change = true;
        }
        break;
      case DirectionName.right:
        if (MEMO_MIN_WIDTH < width && x > clientX) {
          direction === DirectionName.left && (ui.x += movementX);
          clientX += movementX;
          ui.width = width;
          ui.change = true;
        }
        break;
    }
    return ui;
  };

  const resizeHeight = (
    { movementY, y }: DragMove,
    direction: DirectionName
  ): ResizeMemo => {
    const ui = Object.assign({ change: false }, props.memo.ui);
    const mouseDirection =
      movementY < 0 ? DirectionName.top : DirectionName.bottom;
    const height =
      direction === DirectionName.top
        ? ui.height - movementY
        : ui.height + movementY;

    switch (mouseDirection) {
      case DirectionName.top:
        if (MEMO_MIN_HEIGHT < height && y < clientY) {
          direction === DirectionName.top && (ui.y += movementY);
          clientY += movementY;
          ui.height = height;
          ui.change = true;
        }
        break;
      case DirectionName.bottom:
        if (MEMO_MIN_HEIGHT < height && y > clientY) {
          direction === DirectionName.top && (ui.y += movementY);
          clientY += movementY;
          ui.height = height;
          ui.change = true;
        }
        break;
    }
    return ui;
  };

  const handleMove = (dragMove: DragMove, position: MemoSashPosition) => {
    dragMove.event.type === 'mousemove' && dragMove.event.preventDefault();
    const { store } = app.value;
    let verticalUI: ResizeMemo | null = null;
    let horizontalUI: ResizeMemo | null = null;

    switch (position) {
      case MemoSashPosition.left:
      case MemoSashPosition.right:
        verticalUI = resizeWidth(dragMove, position);
        break;
      case MemoSashPosition.bottom:
        horizontalUI = resizeHeight(dragMove, DirectionName.bottom);
        break;
      case MemoSashPosition.lt:
        verticalUI = resizeWidth(dragMove, DirectionName.left);
        horizontalUI = resizeHeight(dragMove, DirectionName.top);
        break;
      case MemoSashPosition.rt:
        verticalUI = resizeWidth(dragMove, DirectionName.right);
        horizontalUI = resizeHeight(dragMove, DirectionName.top);
        break;
      case MemoSashPosition.lb:
        verticalUI = resizeWidth(dragMove, DirectionName.left);
        horizontalUI = resizeHeight(dragMove, DirectionName.bottom);
        break;
      case MemoSashPosition.rb:
        verticalUI = resizeWidth(dragMove, DirectionName.right);
        horizontalUI = resizeHeight(dragMove, DirectionName.bottom);
        break;
    }

    if (verticalUI?.change && horizontalUI?.change) {
      store.dispatch(
        resizeMemoAction({
          id: props.memo.id,
          x: verticalUI.x,
          y: horizontalUI.y,
          width: verticalUI.width,
          height: horizontalUI.height,
        })
      );
    } else if (verticalUI?.change) {
      store.dispatch(
        resizeMemoAction({
          id: props.memo.id,
          x: verticalUI.x,
          y: verticalUI.y,
          width: verticalUI.width,
          height: verticalUI.height,
        })
      );
    } else if (horizontalUI?.change) {
      store.dispatch(
        resizeMemoAction({
          id: props.memo.id,
          x: horizontalUI.x,
          y: horizontalUI.y,
          width: horizontalUI.width,
          height: horizontalUI.height,
        })
      );
    }
  };

  const handleMoveStart = (
    event: ScenePointerEvent,
    position: MemoSashPosition
  ) => {
    const pointer = pointerOf(event);
    clientX = pointer.x;
    clientY = pointer.y;
    drag$.subscribe(dragMove => handleMove(dragMove, position));
  };

  const setCursor = (event: ScenePointerEvent, cursor: string) => {
    const container = event.target?.getStage()?.container();
    if (container) container.style.cursor = cursor;
  };

  return () => {
    // What the DOM sash spanned with a width or height of 100%: the memo box less
    // the border it sits inside on both sides.
    const spanWidth = props.left - MEMO_BORDER * 2;
    const spanHeight = props.top - MEMO_BORDER * 2;

    return (
      <>
        {createSash(props.top, props.left).map(sash => (
          <k-rect
            name={`memo-sash memo-sash-${sash.position}`}
            kind="sash"
            x={centerLeft(sash)}
            y={centerTop(sash)}
            width={sash.shape === SashShape.horizontal ? spanWidth : SASH_SIZE}
            height={sash.shape === SashShape.vertical ? spanHeight : SASH_SIZE}
            fill={HIT_FILL}
            on:mousedown={(event: ScenePointerEvent) => {
              handleMoveStart(event, sash.position);
            }}
            on:touchstart={(event: ScenePointerEvent) => {
              handleMoveStart(event, sash.position);
            }}
            on:mouseenter={(event: ScenePointerEvent) => {
              setCursor(event, CURSORS[sash.position]);
            }}
            on:mouseleave={(event: ScenePointerEvent) => {
              setCursor(event, '');
            }}
          />
        ))}
      </>
    );
  };
};

export default MemoSash;
