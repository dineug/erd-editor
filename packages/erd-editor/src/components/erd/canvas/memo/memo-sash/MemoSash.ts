import { FC, html } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import Sash, { SashProps, SashType } from '@/components/primitives/sash/Sash';
import { MEMO_MIN_HEIGHT, MEMO_MIN_WIDTH } from '@/constants/layout';
import { resizeMemoAction } from '@/engine/modules/memo/atom.actions';
import { Memo, ValuesType } from '@/internal-types';
import { DirectionName } from '@/utils/draw-relationship';
import { drag$, DragMove } from '@/utils/globalEventObservable';

export type MemoSashProps = {
  memo: Memo;
  top: number;
  left: number;
};

const Position = {
  left: 'left',
  right: 'right',
  top: 'top',
  bottom: 'bottom',
  lt: 'lt',
  rt: 'rt',
  lb: 'lb',
  rb: 'rb',
} as const;
type Position = ValuesType<typeof Position>;

const createSash = (
  top: number,
  left: number
): Array<
  {
    position: Position;
  } & SashProps
> => [
  {
    type: SashType.vertical,
    position: Position.left,
  },
  {
    type: SashType.vertical,
    position: Position.right,
    left,
  },
  // {
  //   type: SashType.horizontal,
  //   position: Position.top,
  // },
  {
    type: SashType.horizontal,
    position: Position.bottom,
    top,
  },
  {
    type: SashType.edge,
    position: Position.lt,
    cursor: 'nwse-resize',
  },
  {
    type: SashType.edge,
    position: Position.rt,
    cursor: 'nesw-resize',
    left,
  },
  {
    type: SashType.edge,
    position: Position.lb,
    cursor: 'nesw-resize',
    top,
  },
  {
    type: SashType.edge,
    position: Position.rb,
    cursor: 'nwse-resize',
    top,
    left,
  },
];

type ResizeMemo = {
  change: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
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

  const handleMousemove = (dragMove: DragMove, position: Position) => {
    dragMove.event.preventDefault();
    const { store } = app.value;
    let verticalUI: ResizeMemo | null = null;
    let horizontalUI: ResizeMemo | null = null;

    switch (position) {
      case Position.left:
      case Position.right:
        verticalUI = resizeWidth(dragMove, position);
        break;
      case Position.top:
      case Position.bottom:
        horizontalUI = resizeHeight(dragMove, position);
        break;
      case Position.lt:
        verticalUI = resizeWidth(dragMove, DirectionName.left);
        horizontalUI = resizeHeight(dragMove, DirectionName.top);
        break;
      case Position.rt:
        verticalUI = resizeWidth(dragMove, DirectionName.right);
        horizontalUI = resizeHeight(dragMove, DirectionName.top);
        break;
      case Position.lb:
        verticalUI = resizeWidth(dragMove, DirectionName.left);
        horizontalUI = resizeHeight(dragMove, DirectionName.bottom);
        break;
      case Position.rb:
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

  const handleMousedown = (event: MouseEvent, position: Position) => {
    clientX = event.clientX;
    clientY = event.clientY;
    drag$.subscribe(dragMove => handleMousemove(dragMove, position));
  };

  return () =>
    html`${createSash(props.top, props.left).map(
      sashProps =>
        html`
          <${Sash}
            ...${sashProps}
            .onMousedown=${(event: MouseEvent) => {
              handleMousedown(event, sashProps.position);
            }}
          />
        `
    )}`;
};

export default MemoSash;
