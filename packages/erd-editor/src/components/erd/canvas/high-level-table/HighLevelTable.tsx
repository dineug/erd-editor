/** @jsxHost konva */

import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { useDiffMap } from '@/components/diffContext';
import { diffOutlineRect } from '@/components/erd/canvas/DiffOutline.template';
import {
  CURSOR_INHERIT,
  CURSOR_POINTER,
  HIGH_LEVEL_FONT_SIZES,
  mainButtonClick,
  RING_WIDTH,
  SCENE_FONT_FAMILY,
  type SceneMouseEvent,
  type ScenePointerEvent,
  setSceneCursor,
  TABLE_CORNER_RADIUS,
  TABLE_INSET,
} from '@/components/erd/canvas/sceneTokens';
import { getColorEdgePath } from '@/components/erd/canvas/table/colorEdge';
import { useMoveTable } from '@/components/erd/canvas/table/useMoveTable';
import { useSharedFocusTable } from '@/components/erd/canvas/table/useSharedFocusTable';
import { useSharedSelectEntity } from '@/components/erd/canvas/useSharedSelectEntity';
import { useI18n } from '@/components/localeContext';
import { useSceneSource } from '@/components/sceneSourceContext';
import { useThemeContext } from '@/components/themeContext';
import { TABLE_BORDER } from '@/constants/layout';
import { FocusType } from '@/engine/modules/editor/state';
import { toNameLabel } from '@/engine/modules/editor/utils/nameView';
import { Table } from '@/internal-types';
import { getTableRect } from '@/konva/scene/metrics';
import { getSceneTransform } from '@/konva/scene/viewport';
import { diffOutline, diffTextColor } from '@/utils/diff/diff';
import { openColorPickerAction } from '@/utils/emitter';

export type HighLevelTableProps = {
  table: Table;
  /** A drawn copy rather than the table itself, so nothing in it takes an id. */
  preview?: boolean;
  /** Off while the table is kept built but scrolled out of the culling rect. */
  visible?: boolean;
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

/**
 * The text the card draws in the name view: the name it leads with, and in
 * the view of both the name after the logical name on a line of its own.
 */
const nameText = ({ text, after }: { text: string; after: string }) =>
  after ? `${text}\n${after}` : text;

const HighLevelTable: FC<HighLevelTableProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);
  const i18n = useI18n(ctx);
  const sourceRef = useSceneSource(ctx);
  const diffMapRef = useDiffMap(ctx);
  const { sharedFocusTableColor } = useSharedFocusTable(ctx, props.table.id);
  const { sharedSelectColor } = useSharedSelectEntity(ctx, props.table.id);
  const { onMoveStart } = useMoveTable(ctx, props, sourceRef);

  /**
   * Whether the press under way found a relationship draw armed. The press
   * closes or starts that draw, so the click konva ends it with on the colour
   * edge belongs to the draw, not to the edge.
   */
  let pressDraws = false;

  const handlePress = (event: ScenePointerEvent) => {
    pressDraws = Boolean(app.value.store.state.editor.drawRelationship);
    onMoveStart(event);
  };

  const handleOpenColorPicker = (event: SceneMouseEvent) => {
    if (pressDraws) return;

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
    const { editor } = store.state;
    const { table } = props;
    const theme = themeRef.value;
    const source = sourceRef.value;
    const selected = Boolean(editor.selectedMap[table.id]);
    const rect = getTableRect(store.state, table, source);
    const { zoomLevel } = getSceneTransform(store.state, source);

    const label = toNameLabel(store.state.settings, table);
    const isEmptyName = !label.text.trim();
    const sharedFocus = sharedFocusTableColor();
    const sharedSelected = sharedSelectColor();
    const ringColor = sharedFocus ?? sharedSelected;
    // Zoomed out, a table in a diff pane is marked as the full card is, a
    // comment change on its name, since this card draws no comment.
    const diffPaths = diffMapRef.value?.get(table.id);

    return (
      <k-group
        id={props.preview ? '' : `table-${table.id}`}
        name="table high-level-table"
        kind="table"
        visible={props.visible ?? true}
        selected={selected}
        sharedFocus={sharedFocus}
        sharedSelect={sharedSelected}
        x={rect.x}
        y={rect.y}
        on:mousedown={handlePress}
        on:touchstart={handlePress}
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
        {diffOutlineRect({
          name: 'table-diff-outline',
          stroke: diffOutline(theme, diffPaths),
          width: rect.width,
          height: rect.height,
          cornerRadius: TABLE_CORNER_RADIUS,
        })}
        <k-text
          name="high-level-table-name"
          x={TABLE_BORDER}
          y={TABLE_INSET}
          width={rect.width - TABLE_BORDER * 2}
          height={rect.height - TABLE_INSET * 2}
          text={isEmptyName ? i18n.value.t('common.unnamed') : nameText(label)}
          fill={
            diffTextColor(theme, diffPaths, FocusType.tableName) ??
            diffTextColor(theme, diffPaths, FocusType.tableComment) ??
            (isEmptyName || label.standIn ? theme.placeholder : theme.active)
          }
          fontFamily={SCENE_FONT_FAMILY}
          fontSize={nameFontSize(zoomLevel)}
          fontStyle="bold"
          align="center"
          verticalAlign="middle"
          wrap="char"
        />
        <k-path
          name="table-header-color"
          kind="table-header-color"
          data={getColorEdgePath(rect.height)}
          fill={table.ui.color}
          on:click={mainButtonClick(handleOpenColorPicker)}
          on:mouseenter={(event: SceneMouseEvent) => {
            setSceneCursor(event, CURSOR_POINTER);
          }}
          on:mouseleave={(event: SceneMouseEvent) => {
            setSceneCursor(event, CURSOR_INHERIT);
          }}
        />
      </k-group>
    );
  };
};

export default HighLevelTable;
