/** @jsxHost konva */

import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { getDrawnTableGroupRect } from '@/components/erd/canvas/table-group/tableGroupBox';
import { getMinimapMarkRect } from '@/components/erd/minimap/minimapGeometry';
import { useSceneSource } from '@/components/sceneSourceContext';
import { useThemeContext } from '@/components/themeContext';
import type { Table, TableGroup } from '@/internal-types';
import { getTableGroupColors } from '@/utils/tableGroup';

/**
 * How much of its color a group's box shows, more than the canvas body's,
 * since a box a few pixels across shows its color there or not at all.
 */
const FILL_OPACITY = 0.4;

export type TableGroupProps = {
  group: TableGroup;
  /** The group's member tables, read once for every group by the minimap scene. */
  members: ReadonlyArray<Table>;
  /** Thumbnail pixels per scene unit, which is what the box is floored at. */
  ratio: number;
};

/**
 * A table group as the minimap draws it: the box the canvas draws it in,
 * filled in its color, or the canvas's neutral one, at a low alpha behind the
 * table marks.
 */
const TableGroup: FC<TableGroupProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);
  const sourceRef = useSceneSource(ctx);

  return () => {
    const { store } = app.value;
    const { group, members, ratio } = props;
    const rect = getMinimapMarkRect(
      ratio,
      getDrawnTableGroupRect(store.state, group, sourceRef.value, members)
    );

    return (
      <k-rect
        name={`minimap-table-group ${group.id}`}
        kind="minimap-table-group"
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill={
          getTableGroupColors(group)?.background ?? themeRef.value.foreground
        }
        opacity={FILL_OPACITY}
      />
    );
  };
};

export default TableGroup;
