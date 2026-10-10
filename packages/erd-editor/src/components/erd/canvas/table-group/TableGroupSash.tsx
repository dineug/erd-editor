/** @jsxHost konva */

import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import {
  CURSOR_INHERIT,
  HIT_FILL,
  holdSceneCursor,
  type ScenePointerEvent,
  setSceneCursor,
} from '@/components/erd/canvas/sceneTokens';
import { SASH_SIZE } from '@/components/primitives/sash/Sash.styles';
import {
  TABLE_GROUP_MIN_HEIGHT,
  TABLE_GROUP_MIN_WIDTH,
} from '@/constants/layout';
import { resizeTableGroupAction } from '@/engine/modules/table-group/atom.actions';
import type { TableGroup, ValuesType } from '@/internal-types';
import type { Rect } from '@/konva/scene/metrics';
import {
  isMainButtonPress,
  isMouseEvent,
  isMultiTouch,
} from '@/utils/domEvent';
import { drag$ } from '@/utils/globalEventObservable';
import { getTableGroupMemberIds, getTablesGroupRect } from '@/utils/tableGroup';

export const TableGroupSashPosition = {
  left: 'left',
  right: 'right',
  top: 'top',
  bottom: 'bottom',
  lt: 'lt',
  rt: 'rt',
  lb: 'lb',
  rb: 'rb',
} as const;
export type TableGroupSashPosition = ValuesType<typeof TableGroupSashPosition>;

/** The edges each sash takes along, the corners two at once. */
const EDGES: Record<
  TableGroupSashPosition,
  { x?: 'left' | 'right'; y?: 'top' | 'bottom' }
> = {
  left: { x: 'left' },
  right: { x: 'right' },
  top: { y: 'top' },
  bottom: { y: 'bottom' },
  lt: { x: 'left', y: 'top' },
  rt: { x: 'right', y: 'top' },
  lb: { x: 'left', y: 'bottom' },
  rb: { x: 'right', y: 'bottom' },
};

/** The pointer each sash asks the stage container for under it and holds for its drag, a memo's. */
const CURSORS: Record<TableGroupSashPosition, string> = {
  left: 'ew-resize',
  right: 'ew-resize',
  top: 'ns-resize',
  bottom: 'ns-resize',
  lt: 'nwse-resize',
  rt: 'nesw-resize',
  lb: 'nesw-resize',
  rb: 'nwse-resize',
};

/** The sides first and the corners over them, so a corner wins where two meet. */
const POSITIONS = Object.values(TableGroupSashPosition);

/**
 * The box a sash drag leaves, the edges it grabs moved by the drag in scene
 * units: never smaller than the minimum, nor than the members' padded box,
 * which the edge stops at however far past it the pointer goes.
 */
export function resizeTableGroupRect(
  start: Rect,
  members: Rect | null,
  position: TableGroupSashPosition,
  movementX: number,
  movementY: number
): Rect {
  const { x, y } = EDGES[position];
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;

  if (x === 'left') {
    left = Math.min(
      left + movementX,
      right - TABLE_GROUP_MIN_WIDTH,
      members?.x ?? Infinity
    );
  } else if (x === 'right') {
    right = Math.max(
      right + movementX,
      left + TABLE_GROUP_MIN_WIDTH,
      members ? members.x + members.width : -Infinity
    );
  }

  if (y === 'top') {
    top = Math.min(
      top + movementY,
      bottom - TABLE_GROUP_MIN_HEIGHT,
      members?.y ?? Infinity
    );
  } else if (y === 'bottom') {
    bottom = Math.max(
      bottom + movementY,
      top + TABLE_GROUP_MIN_HEIGHT,
      members ? members.y + members.height : -Infinity
    );
  }

  return { x: left, y: top, width: right - left, height: bottom - top };
}

const sameRect = (a: Rect, b: Rect) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/** Where the gesture began, from either pointer kind the scene accepts. */
const pointerOf = (event: ScenePointerEvent) =>
  isMouseEvent(event.evt)
    ? { x: event.evt.clientX, y: event.evt.clientY }
    : {
        x: event.evt.touches[0]?.clientX ?? 0,
        y: event.evt.touches[0]?.clientY ?? 0,
      };

export type TableGroupSashProps = {
  group: TableGroup;
  /** The box the group is drawn in, in scene units; the sashes sit on its edges. */
  box: Rect;
  /** Takes each step's box to draw, and null once the drag is over. */
  onDraft: (rect: Rect | null) => void;
};

/**
 * The eight resize handles on a selected group's edges and corners. A drag
 * draws its steps without writing them and writes one resize as it ends, so
 * peers hear one write and one undo puts back the rect it started from.
 */
const TableGroupSash: FC<TableGroupSashProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const handleMoveStart = (
    event: ScenePointerEvent,
    position: TableGroupSashPosition
  ) => {
    // An edge is part of the group, which only the main button carries.
    if (!isMainButtonPress(event.evt) || isMultiTouch(event.evt)) return;

    const { store } = app.value;
    const { id } = props.group;
    const start = { ...props.box };
    const members = getTablesGroupRect(
      store.state,
      getTableGroupMemberIds(store.state, id)
    );
    const { zoomLevel } = store.state.settings;
    const origin = pointerOf(event);
    let rect = start;

    const commit = () => {
      const { doc } = store.state;
      if (!sameRect(rect, start) && doc.tableGroupIds.includes(id)) {
        store.dispatchSync(resizeTableGroupAction({ id, ...rect }));
      }
      props.onDraft(null);
    };

    // The pointer outruns the thin hit area and the clamp stops the edge
    // under it, so the stage's own hover would hand the cursor away mid drag.
    const release = holdSceneCursor(event, CURSORS[position]);
    const gesture = drag$.subscribe(({ event, x, y }) => {
      event.type === 'mousemove' && event.preventDefault();
      rect = resizeTableGroupRect(
        start,
        members,
        position,
        (x - origin.x) / zoomLevel,
        (y - origin.y) / zoomLevel
      );
      props.onDraft(rect);
    });
    gesture.add(release);
    gesture.add(commit);
  };

  return () => {
    const { width, height } = props.box;
    const half = SASH_SIZE / 2;

    // Each sash centred on the edge it grabs, so it reaches half out of the box.
    const offset = {
      left: -half,
      top: -half,
      right: width - half,
      bottom: height - half,
    };

    return (
      <>
        {POSITIONS.map(position => {
          const { x, y } = EDGES[position];
          return (
            <k-rect
              name={`table-group-sash table-group-sash-${position}`}
              kind="table-group-sash"
              x={x ? offset[x] : 0}
              y={y ? offset[y] : 0}
              width={x ? SASH_SIZE : width}
              height={y ? SASH_SIZE : height}
              fill={HIT_FILL}
              on:mousedown={(event: ScenePointerEvent) => {
                handleMoveStart(event, position);
              }}
              on:touchstart={(event: ScenePointerEvent) => {
                handleMoveStart(event, position);
              }}
              on:mouseenter={(event: ScenePointerEvent) => {
                setSceneCursor(event, CURSORS[position]);
              }}
              on:mouseleave={(event: ScenePointerEvent) => {
                setSceneCursor(event, CURSOR_INHERIT);
              }}
            />
          );
        })}
      </>
    );
  };
};

export default TableGroupSash;
