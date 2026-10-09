/** @jsxHost konva */

import { FC } from '@dineug/r-html';
import { uniq } from 'es-toolkit';

import { useAppContext } from '@/components/appContext';
import {
  TABLE_GROUP_CORNER_RADIUS,
  TABLE_GROUP_DROP_WIDTH,
} from '@/components/erd/canvas/sceneTokens';
import { useThemeContext } from '@/components/themeContext';
import { getTableGroupDrops } from '@/engine/modules/table-group/generator.actions';
import { getTableGroupRect } from '@/utils/tableGroup';

export type TableGroupDropTargetProps = {};

/**
 * The outline of each group a table drag would drop a table into, in the
 * focus color, over the static scene and under the dragged tables; nothing
 * where the drop would put every table in none.
 */
const TableGroupDropTarget: FC<TableGroupDropTargetProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);

  return () => {
    const { state } = app.value.store;
    const drops = getTableGroupDrops(state);
    const judged = drops.map(({ table }) => table.id);
    const groups = uniq(drops.map(({ groupId }) => groupId))
      .filter(Boolean)
      .map(id => state.collections.tableGroupEntities[id]);
    const inset = TABLE_GROUP_DROP_WIDTH / 2;

    return (
      <>
        {groups.map(group => {
          const { x, y, width, height } = getTableGroupRect(state, group, {
            excludeTableIds: judged,
          });
          return (
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
          );
        })}
      </>
    );
  };
};

export default TableGroupDropTarget;
