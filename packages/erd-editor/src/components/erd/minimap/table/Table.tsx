/** @jsxHost konva */

import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { useThemeContext } from '@/components/themeContext';
import { TABLE_BORDER } from '@/constants/layout';
import type { Table } from '@/internal-types';
import { getTableRect } from '@/konva/scene/metrics';

/** The radius the table stylesheet rounds a table box with. */
const CORNER_RADIUS = 6;

export type TableProps = {
  table: Table;
};

/**
 * A table as the minimap draws it: the box and nothing in it. The id stays off
 * the node because two stages spelling one id make an id scan ambiguous, so a
 * minimap node is found by its name and the table it carries.
 */
const Table: FC<TableProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);

  return () => {
    const { store } = app.value;
    const { table } = props;
    const theme = themeRef.value;
    const rect = getTableRect(store.state, table);

    return (
      <k-rect
        name="minimap-table"
        kind="minimap-table"
        tableId={table.id}
        x={rect.x + TABLE_BORDER / 2}
        y={rect.y + TABLE_BORDER / 2}
        width={rect.width - TABLE_BORDER}
        height={rect.height - TABLE_BORDER}
        cornerRadius={CORNER_RADIUS}
        fill={theme.tableBackground}
        stroke={theme.tableBorder}
        strokeWidth={TABLE_BORDER}
      />
    );
  };
};

export default Table;
