import { FC, html } from '@dineug/r-html';

import { useAppContext } from '@/components/context';
import Sash, { SashProps, SashType } from '@/components/primitives/sash/Sash';
import { MEMO_MIN_HEIGHT, MEMO_MIN_WIDTH } from '@/constants/layout';
import { resizeMemoAction } from '@/engine/modules/memo/atom.actions';
import { Memo, ValuesType } from '@/internal-types';
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

const Direction = {
  left: 'left',
  right: 'right',
  top: 'top',
  bottom: 'bottom',
} as const;
type Direction = ValuesType<typeof Direction>;

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
    position: 'left',
  },
  {
    type: SashType.vertical,
    position: 'right',
    left,
  },
  // {
  //   type: SashType.horizontal,
  //   position: 'top',
  // },
  {
    type: SashType.horizontal,
    position: 'bottom',
    top,
  },
  {
    type: SashType.edge,
    position: 'lt',
    cursor: 'nwse-resize',
  },
  {
    type: SashType.edge,
    position: 'rt',
    cursor: 'nesw-resize',
    left,
  },
  {
    type: SashType.edge,
    position: 'lb',
    cursor: 'nesw-resize',
    top,
  },
  {
    type: SashType.edge,
    position: 'rb',
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
    direction: Direction
  ): ResizeMemo => {
    const ui = Object.assign({ change: false }, props.memo.ui);
    const mouseDirection: Direction = movementX < 0 ? 'left' : 'right';
    const width =
      direction === 'left' ? ui.width - movementX : ui.width + movementX;

    switch (mouseDirection) {
      case 'left':
        if (MEMO_MIN_WIDTH < width && x < clientX) {
          direction === 'left' && (ui.x += movementX);
          clientX += movementX;
          ui.width = width;
          ui.change = true;
        }
        break;
      case 'right':
        if (MEMO_MIN_WIDTH < width && x > clientX) {
          direction === 'left' && (ui.x += movementX);
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
    direction: Direction
  ): ResizeMemo => {
    const ui = Object.assign({ change: false }, props.memo.ui);
    const mouseDirection: Direction = movementY < 0 ? 'top' : 'bottom';
    const height =
      direction === 'top' ? ui.height - movementY : ui.height + movementY;

    switch (mouseDirection) {
      case 'top':
        if (MEMO_MIN_HEIGHT < height && y < clientY) {
          direction === 'top' && (ui.y += movementY);
          clientY += movementY;
          ui.height = height;
          ui.change = true;
        }
        break;
      case 'bottom':
        if (MEMO_MIN_HEIGHT < height && y > clientY) {
          direction === 'top' && (ui.y += movementY);
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
      case 'left':
      case 'right':
        verticalUI = resizeWidth(dragMove, position);
        break;
      case 'top':
      case 'bottom':
        horizontalUI = resizeHeight(dragMove, position);
        break;
      case 'lt':
        verticalUI = resizeWidth(dragMove, 'left');
        horizontalUI = resizeHeight(dragMove, 'top');
        break;
      case 'rt':
        verticalUI = resizeWidth(dragMove, 'right');
        horizontalUI = resizeHeight(dragMove, 'top');
        break;
      case 'lb':
        verticalUI = resizeWidth(dragMove, 'left');
        horizontalUI = resizeHeight(dragMove, 'bottom');
        break;
      case 'rb':
        verticalUI = resizeWidth(dragMove, 'right');
        horizontalUI = resizeHeight(dragMove, 'bottom');
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
