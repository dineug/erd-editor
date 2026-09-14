/** @jsxHost konva */

import { query } from '@dineug/erd-editor-schema';
import { FC, repeat } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { getColumnDragPointer } from '@/components/erd/canvas/column-drag-ghost/columnDragPointer';
import {
  SCENE_FONT_FAMILY,
  SCENE_FONT_SIZE,
  TABLE_CORNER_RADIUS,
} from '@/components/erd/canvas/sceneTokens';
import {
  getColumnCellSlots,
  getColumnTextHeight,
  getColumnTextY,
} from '@/components/erd/canvas/table/cellLayout';
import { useThemeContext } from '@/components/themeContext';
import { COLUMN_HEIGHT, TABLE_BORDER } from '@/constants/layout';
import { ColumnType } from '@/constants/schema';
import type { Column } from '@/internal-types';
import { getTableRect, getTableWidths } from '@/konva/scene/metrics';
import type { Theme } from '@/themes/tokens';

/** The duplicate ghost's own translucency, taken as one layer for the same reason. */
const GHOST_OPACITY = 0.6;

export type ColumnDragGhostProps = {};

/** The text of the two cells a dragged row is told apart by, placeholder included. */
const cellText = (theme: Theme, column: Column, columnType: number) => {
  const [value, placeholder] =
    columnType === ColumnType.columnName
      ? [column.name, 'column']
      : [column.dataType, 'dataType'];

  return value.trim()
    ? { text: value, fill: theme.active }
    : { text: placeholder, fill: theme.placeholder };
};

/**
 * The rows a column drag carries, drawn on the presence layer under the
 * pointer where the browser used to hang its drag image. Each keeps its name
 * and type where its table lays them out, and none of it answers a hit.
 */
const ColumnDragGhost: FC<ColumnDragGhostProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);

  return () => {
    const { store } = app.value;
    const {
      editor: { draggableColumn },
      collections,
    } = store.state;
    const pointer = getColumnDragPointer(store.state);
    if (!pointer || !draggableColumn) return null;

    const table = query(collections)
      .collection('tableEntities')
      .selectById(draggableColumn.tableId);
    if (!table) return null;

    const theme = themeRef.value;
    const columns = query(collections)
      .collection('tableColumnEntities')
      .selectByIds(draggableColumn.columnIds);
    const cells = getColumnCellSlots(
      store.state,
      getTableWidths(store.state, table)
    ).filter(
      ({ columnType }) =>
        columnType === ColumnType.columnName ||
        columnType === ColumnType.columnDataType
    );
    const { width } = getTableRect(store.state, table);
    // A drag into another table sizes the ghost to that table, which can be
    // narrower than where the row was taken, so the grab stays inside it.
    const grabX = Math.min(pointer.grabX, width - TABLE_BORDER);

    // Over a drop target the real row is already under the pointer, moved
    // there by the dragover, and a ghost on top of it would draw it twice.
    return (
      <k-group
        name="column-drag-ghost"
        kind="column-drag-ghost"
        x={pointer.x - grabX}
        y={pointer.y - pointer.grabY}
        opacity={GHOST_OPACITY}
        visible={!pointer.over}
        listening={false}
      >
        <k-rect
          name="column-drag-ghost-body"
          width={width}
          height={columns.length * COLUMN_HEIGHT}
          cornerRadius={TABLE_CORNER_RADIUS}
          fill={theme.columnSelect}
          stroke={theme.tableBorder}
          strokeWidth={TABLE_BORDER}
        />
        {repeat(
          columns,
          column => column.id,
          (column, index) => (
            <k-group name="column-drag-ghost-row" y={index * COLUMN_HEIGHT}>
              {repeat(
                cells,
                slot => slot.columnType,
                slot => {
                  const { text, fill } = cellText(
                    theme,
                    column,
                    slot.columnType
                  );

                  return (
                    <k-text
                      name="column-drag-ghost-text"
                      x={slot.x}
                      y={getColumnTextY()}
                      width={slot.width}
                      height={getColumnTextHeight()}
                      text={text}
                      fill={fill}
                      fontFamily={SCENE_FONT_FAMILY}
                      fontSize={SCENE_FONT_SIZE}
                      verticalAlign="middle"
                      wrap="none"
                      ellipsis={true}
                    />
                  );
                }
              )}
            </k-group>
          )
        )}
      </k-group>
    );
  };
};

export default ColumnDragGhost;
