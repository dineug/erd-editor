/** @jsxHost konva */

import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import {
  CURSOR_INHERIT,
  HIT_FILL,
  type ScenePointerEvent,
  setSceneCursor,
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

  /**
   * The gesture straddles two spaces: movement and the anchor are screen pixels,
   * while width, height and the origin are scene units, so the movement crosses
   * over by zoomLevel the way moveAllAction$ does.
   */
  const resizeWidth = (
    { movementX, x }: DragMove,
    direction: DirectionName
  ): ResizeMemo => {
    const { zoomLevel } = app.value.store.state.settings;
    const ui = Object.assign({ change: false }, props.memo.ui);
    const movement = movementX / zoomLevel;
    const width =
      direction === DirectionName.left
        ? ui.width - movement
        : ui.width + movement;
    // A resize the minimum caught leaves the anchor where it stopped, so the
    // pointer takes the box up again only once it is back past that anchor.
    const pastAnchor = movementX < 0 ? x < clientX : x > clientX;

    if (MEMO_MIN_WIDTH < width && pastAnchor) {
      if (direction === DirectionName.left) ui.x += movement;
      clientX += movementX;
      ui.width = width;
      ui.change = true;
    }

    return ui;
  };

  const resizeHeight = (
    { movementY, y }: DragMove,
    direction: DirectionName
  ): ResizeMemo => {
    const { zoomLevel } = app.value.store.state.settings;
    const ui = Object.assign({ change: false }, props.memo.ui);
    const movement = movementY / zoomLevel;
    const height =
      direction === DirectionName.top
        ? ui.height - movement
        : ui.height + movement;
    const pastAnchor = movementY < 0 ? y < clientY : y > clientY;

    if (MEMO_MIN_HEIGHT < height && pastAnchor) {
      if (direction === DirectionName.top) ui.y += movement;
      clientY += movementY;
      ui.height = height;
      ui.change = true;
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

    if (!verticalUI?.change && !horizontalUI?.change) return;

    // Each axis keeps what its own resize answered; an axis this sash never
    // grabbed, or one the minimum refused, holds the memo where it already was.
    const { id, ui } = props.memo;
    const vertical = verticalUI?.change ? verticalUI : ui;
    const horizontal = horizontalUI?.change ? horizontalUI : ui;

    store.dispatch(
      resizeMemoAction({
        id,
        x: vertical.x,
        y: horizontal.y,
        width: vertical.width,
        height: horizontal.height,
      })
    );
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
              setSceneCursor(event, CURSORS[sash.position]);
            }}
            on:mouseleave={(event: ScenePointerEvent) => {
              setSceneCursor(event, CURSOR_INHERIT);
            }}
          />
        ))}
      </>
    );
  };
};

export default MemoSash;
