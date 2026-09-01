/** @jsxHost konva */

import { FC } from '@dineug/r-html';
import { isEmpty } from 'es-toolkit/compat';

import { useAppContext } from '@/components/appContext';
import {
  CURSOR_INHERIT,
  CURSOR_POINTER,
  HEADER_COLOR_HEIGHT,
  HIGH_LEVEL_FONT_SIZES,
  RING_WIDTH,
  SCENE_FONT_FAMILY,
  type SceneMouseEvent,
  setSceneCursor,
  TABLE_CORNER_RADIUS,
  TABLE_INSET,
} from '@/components/erd/canvas/sceneTokens';
import { useMoveTable } from '@/components/erd/canvas/table/useMoveTable';
import { useSharedFocusTable } from '@/components/erd/canvas/table/useSharedFocusTable';
import { useSharedSelectEntity } from '@/components/erd/canvas/useSharedSelectEntity';
import { useThemeContext } from '@/components/themeContext';
import { TABLE_BORDER } from '@/constants/layout';
import { Table } from '@/internal-types';
import { getTableRect } from '@/konva/scene/metrics';
import { openColorPickerAction } from '@/utils/emitter';

export type HighLevelTableProps = {
  table: Table;
  /** A drawn copy rather than the table itself, so nothing in it takes an id. */
  preview?: boolean;
};

/**
 * The typography step the name is drawn at. Zooming out shrinks the whole scene,
 * so each step up the scale is what keeps a table name legible as the table it
 * sits in gets smaller.
 */
const nameFontSize = (zoomLevel: number) => {
  if (zoomLevel > 0.6) return HIGH_LEVEL_FONT_SIZES[0];
  if (zoomLevel > 0.5) return HIGH_LEVEL_FONT_SIZES[1];
  if (zoomLevel > 0.4) return HIGH_LEVEL_FONT_SIZES[2];
  if (zoomLevel > 0.3) return HIGH_LEVEL_FONT_SIZES[3];
  return HIGH_LEVEL_FONT_SIZES[4];
};

const HighLevelTable: FC<HighLevelTableProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);
  const { sharedFocusTableColor } = useSharedFocusTable(ctx, props.table.id);
  const { sharedSelectColor } = useSharedSelectEntity(ctx, props.table.id);
  const { onMoveStart } = useMoveTable(ctx, props);

  const handleOpenColorPicker = (event: SceneMouseEvent) => {
    const { emitter } = app.value;
    emitter.emit(
      openColorPickerAction({
        x: event.evt.clientX,
        y: event.evt.clientY,
        color: props.table.ui.color,
      })
    );
  };

  return () => {
    const { store } = app.value;
    const { editor, settings } = store.state;
    const { table } = props;
    const theme = themeRef.value;
    const selected = Boolean(editor.selectedMap[table.id]);
    const rect = getTableRect(store.state, table);

    const isEmptyName = isEmpty(table.name.trim());
    const sharedFocus = sharedFocusTableColor();
    const sharedSelected = sharedSelectColor();
    const ringColor = sharedFocus ?? sharedSelected;

    return (
      <k-group
        id={props.preview ? '' : `table-${table.id}`}
        name="table high-level-table"
        kind="table"
        selected={selected}
        sharedFocus={sharedFocus}
        sharedSelect={sharedSelected}
        x={rect.x}
        y={rect.y}
        on:mousedown={onMoveStart}
        on:touchstart={onMoveStart}
      >
        <k-rect
          name="table-body"
          x={TABLE_BORDER / 2}
          y={TABLE_BORDER / 2}
          width={rect.width - TABLE_BORDER}
          height={rect.height - TABLE_BORDER}
          cornerRadius={TABLE_CORNER_RADIUS}
          fill={theme.tableBackground}
          stroke={selected ? theme.tableSelect : theme.tableBorder}
          strokeWidth={TABLE_BORDER}
        />
        {ringColor ? (
          <k-rect
            name="table-ring"
            x={-RING_WIDTH / 2}
            y={-RING_WIDTH / 2}
            width={rect.width + RING_WIDTH}
            height={rect.height + RING_WIDTH}
            cornerRadius={TABLE_CORNER_RADIUS}
            stroke={ringColor}
            strokeWidth={RING_WIDTH}
          />
        ) : null}
        <k-rect
          name="table-header-color"
          kind="table-header-color"
          x={TABLE_BORDER}
          y={0}
          width={rect.width - TABLE_BORDER * 2}
          height={HEADER_COLOR_HEIGHT}
          cornerRadius={[TABLE_CORNER_RADIUS, TABLE_CORNER_RADIUS, 0, 0]}
          fill={table.ui.color}
          on:click={handleOpenColorPicker}
          on:mouseenter={(event: SceneMouseEvent) => {
            setSceneCursor(event, CURSOR_POINTER);
          }}
          on:mouseleave={(event: SceneMouseEvent) => {
            setSceneCursor(event, CURSOR_INHERIT);
          }}
        />
        <k-text
          name="high-level-table-name"
          x={TABLE_BORDER}
          y={TABLE_INSET}
          width={rect.width - TABLE_BORDER * 2}
          height={rect.height - TABLE_INSET * 2}
          text={isEmptyName ? 'unnamed' : table.name}
          fill={isEmptyName ? theme.placeholder : theme.active}
          fontFamily={SCENE_FONT_FAMILY}
          fontSize={nameFontSize(settings.zoomLevel)}
          fontStyle="bold"
          align="center"
          verticalAlign="middle"
          wrap="char"
        />
      </k-group>
    );
  };
};

export default HighLevelTable;
