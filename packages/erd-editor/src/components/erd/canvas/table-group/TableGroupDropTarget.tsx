/** @jsxHost konva */

import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import {
  getHeldTableGroupBoxes,
  hasEntityDragTravelled,
} from '@/components/erd/canvas/entityDrag';
import {
  TABLE_GROUP_CORNER_RADIUS,
  TABLE_GROUP_DROP_WIDTH,
} from '@/components/erd/canvas/sceneTokens';
import { useSceneSource } from '@/components/sceneSourceContext';
import { useThemeContext } from '@/components/themeContext';
import { getTableGroupDrops } from '@/engine/modules/table-group/generator.actions';
import type { Rect } from '@/konva/scene/metrics';

export type TableGroupDropTargetProps = {};

/**
 * The outline of each group a table drag would drop a table into, in the focus color, over the
 * static scene and under the dragged tables, in the box the drop is judged in; nothing where the
 * drop would put every table in none, nor short of the click distance, where it judges none.
 */
const TableGroupDropTarget: FC<TableGroupDropTargetProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);
  const sourceRef = useSceneSource(ctx);

  return () => {
    const { state } = app.value.store;
    const source = sourceRef.value;
    const drops = hasEntityDragTravelled(state, source)
      ? getTableGroupDrops(state, getHeldTableGroupBoxes(state, source))
      : [];
    const boxes = new Map<string, Rect>();
    drops.forEach(({ groupId, box }) => {
      if (box) boxes.set(groupId, box);
    });
    const inset = TABLE_GROUP_DROP_WIDTH / 2;

    return (
      <>
        {[...boxes.values()].map(({ x, y, width, height }) => (
          <k-rect
            name="table-group-drop-target"
            x={x - inset}
            y={y - inset}
            width={width + TABLE_GROUP_DROP_WIDTH}
            height={height + TABLE_GROUP_DROP_WIDTH}
            cornerRadius={TABLE_GROUP_CORNER_RADIUS + inset}
            stroke={themeRef.value.focus}
            strokeWidth={TABLE_GROUP_DROP_WIDTH}
            listening={false}
          />
        ))}
      </>
    );
  };
};

export default TableGroupDropTarget;
