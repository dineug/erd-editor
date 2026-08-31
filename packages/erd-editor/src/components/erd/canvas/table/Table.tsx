/** @jsxHost konva */

import { query } from '@dineug/erd-editor-schema';
import { FC, observable, onMounted, repeat } from '@dineug/r-html';
import type { Node as KonvaNode } from 'konva/lib/Node';
import type { Stage } from 'konva/lib/Stage';
import type { Subscription } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import { sceneIcon } from '@/components/erd/canvas/SceneIcon.template';
import {
  CURSOR_INHERIT,
  CURSOR_POINTER,
  FOCUS_BORDER_HEIGHT,
  HEADER_COLOR_HEIGHT,
  HIT_FILL,
  RING_WIDTH,
  SCENE_FONT_FAMILY,
  SCENE_FONT_SIZE,
  type SceneMouseEvent,
  setSceneCursor,
  TABLE_CORNER_RADIUS,
  TABLE_INSET,
  TRANSPARENT,
} from '@/components/erd/canvas/sceneTokens';
import {
  type CellSlot,
  getHeaderCellSlots,
  HEADER_CELLS_Y,
  HEADER_TEXT_Y,
} from '@/components/erd/canvas/table/cellLayout';
import Column from '@/components/erd/canvas/table/column/Column';
import { createDoubleClickGuard } from '@/components/erd/canvas/table/doubleClick';
import { useSharedSelectEntity } from '@/components/erd/canvas/useSharedSelectEntity';
import type { IconName } from '@/components/primitives/icon/icons';
import { useThemeContext } from '@/components/themeContext';
import {
  HEADER_ICON_HEIGHT,
  INPUT_HEIGHT,
  INPUT_MARGIN_RIGHT,
  TABLE_BORDER,
  TABLE_HEADER_BUTTON_MARGIN_LEFT,
  TABLE_HEADER_INPUT_HEIGHT,
} from '@/constants/layout';
import { Show } from '@/constants/schema';
import {
  dragendColumnAction,
  editTableAction,
  focusTableAction,
} from '@/engine/modules/editor/atom.actions';
import {
  dragoverColumnAction$,
  dragstartColumnAction$,
} from '@/engine/modules/editor/generator.actions';
import { FocusType } from '@/engine/modules/editor/state';
import { removeTableAction$ } from '@/engine/modules/table/generator.actions';
import { addColumnAction$ } from '@/engine/modules/table-column/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import type { Table } from '@/internal-types';
import { findColumnDropTarget } from '@/konva/scene/columnDropTarget';
import { createKonvaFlip, type KonvaFlip } from '@/konva/scene/konvaFlip';
import {
  getColumnRect,
  getTableRect,
  getTableWidths,
} from '@/konva/scene/metrics';
import type { Theme } from '@/themes/tokens';
import { bHas } from '@/utils/bit';
import { dragendColumnAllAction, openColorPickerAction } from '@/utils/emitter';
import { drag$ } from '@/utils/globalEventObservable';
import { isMod } from '@/utils/keyboard-shortcut';

import { useFocusTable } from './useFocusTable';
import { useMoveTable } from './useMoveTable';
import { useSharedFocusTable } from './useSharedFocusTable';

export type TableProps = {
  table: Table;
  /** A drawn copy rather than the table itself, so nothing in it takes an id. */
  preview?: boolean;
  hovered?: boolean;
  hoveredColumnId?: string | null;
  ghostColumnId?: string | null;
  editorFocused?: boolean;
};

type HeaderCellOptions = {
  focusType: FocusType;
  x: number;
  width: number;
  text: string;
  fill: string;
  focus: boolean;
  edit: boolean;
  sharedFocus: string | null;
};

const Table: FC<TableProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);
  const { hasEdit, hasFocus, hasSelectColumn } = useFocusTable(
    ctx,
    props.table.id
  );
  const { sharedFocusColor, sharedFocusTableColor } = useSharedFocusTable(
    ctx,
    props.table.id
  );
  const { sharedSelectColor } = useSharedSelectEntity(ctx, props.table.id);
  const { onMoveStart } = useMoveTable(ctx, props);
  const { addUnsubscribe } = useUnmounted();
  const state = observable({
    hover: false,
    iconHover: null as IconName | null,
    dragstartId: null as string | null,
  });

  const doubleClick = createDoubleClickGuard();

  let dragoverSubscription: Subscription | null = null;
  let dragLayerStage: Stage | null = null;
  let flip: KonvaFlip | null = null;

  const handleMouseenter = () => {
    state.hover = true;
  };

  const handleMouseleave = () => {
    state.hover = false;
  };

  /** What the header icons had as their hover colour and their pointer cursor. */
  const handleIconMouseenter = (icon: IconName) => (event: SceneMouseEvent) => {
    state.iconHover = icon;
    setSceneCursor(event, CURSOR_POINTER);
  };

  const handleIconMouseleave = (event: SceneMouseEvent) => {
    state.iconHover = null;
    setSceneCursor(event, CURSOR_INHERIT);
  };

  const iconColor = (icon: IconName, hovered: boolean, theme: Theme) =>
    hovered
      ? state.iconHover === icon
        ? theme.active
        : theme.foreground
      : TRANSPARENT;

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

  const handleAddColumn = () => {
    const { store } = app.value;
    store.dispatch(addColumnAction$(props.table.id));
  };

  const handleRemoveTable = () => {
    const { store } = app.value;
    store.dispatch(removeTableAction$(props.table.id));
  };

  const handleFocus = (focusType: FocusType) => {
    const { store } = app.value;
    store.dispatch(focusTableAction({ tableId: props.table.id, focusType }));
  };

  const handleEdit = (focusType: FocusType, event: SceneMouseEvent) => {
    if (!doubleClick.isDouble(focusType, event)) return;

    const { store } = app.value;
    store.dispatch(editTableAction());
  };

  /** The canvas point a pointer event lands on, through the scene transform. */
  const toCanvasPoint = (event: MouseEvent | TouchEvent) => {
    const stage = dragLayerStage;
    const layer = stage?.findOne('.scene');
    if (!stage || !layer) return null;

    stage.setPointersPositions(event);
    const position = stage.getPointerPosition();
    if (!position) return null;

    return layer.getAbsoluteTransform().copy().invert().point(position);
  };

  const handleMoveColumn = (targetId: string, targetTableId: string) => {
    const { store } = app.value;
    const {
      editor: { draggableColumn },
    } = store.state;
    if (!draggableColumn || draggableColumn.columnIds.includes(targetId)) {
      return;
    }

    flip?.snapshot();
    store.dispatch(dragoverColumnAction$(targetId, targetTableId));
  };

  const handleDragoverColumn = (event: MouseEvent | TouchEvent) => {
    const { store } = app.value;
    const point = toCanvasPoint(event);
    if (!point) return;

    const target = findColumnDropTarget(store.state, point);
    if (!target) return;

    handleMoveColumn(target.columnId, target.tableId);
  };

  const handleDragendColumn = () => {
    const { store, emitter } = app.value;
    if (!dragoverSubscription && state.dragstartId === null) return;

    dragoverSubscription?.unsubscribe();
    dragoverSubscription = null;
    dragLayerStage = null;
    state.dragstartId = null;

    store.dispatch(dragendColumnAction());
    emitter.emit(dragendColumnAllAction());
  };

  /**
   * The drop half of a column drag. Which row a drop lands on is a question
   * about the whole sibling order, so the table answers it while the row that
   * was pressed only says that a drag of it began.
   */
  const handleDragstartColumn = (columnId: string, event: SceneMouseEvent) => {
    const { store } = app.value;
    const {
      editor: { focusTable },
    } = store.state;
    if (!focusTable || !focusTable.columnId) return;

    const stage = event.target?.getStage() ?? null;
    if (!stage) return;

    dragoverSubscription?.unsubscribe();
    dragLayerStage = stage;
    state.dragstartId = columnId;
    flip ??= createKonvaFlip(() => stage.find<KonvaNode>('.column-row'));

    store.dispatch(dragstartColumnAction$(isMod(event.evt)));

    dragoverSubscription = drag$.subscribe({
      next: ({ event: move }) => {
        handleDragoverColumn(move);
      },
      complete: handleDragendColumn,
    });
  };

  onMounted(() => {
    const { emitter } = app.value;

    addUnsubscribe(
      emitter.on({
        dragendColumnAll: () => {
          dragoverSubscription?.unsubscribe();
          dragoverSubscription = null;
        },
      }),
      () => {
        dragoverSubscription?.unsubscribe();
        dragoverSubscription = null;
        flip?.cancel();
      }
    );
  });

  /**
   * A header cell, laid out the way its input-padding div was: a hit box, the
   * text on the 20px input line, and the two underlines at their own edge. The
   * focus underline keeps its box while edited and paints nothing there.
   */
  const headerCell = ({
    focusType,
    x,
    width,
    text,
    fill,
    focus,
    edit,
    sharedFocus,
  }: HeaderCellOptions) => (
    <k-group
      name={`input-padding ${focusType}`}
      kind="input-padding"
      sharedFocus={sharedFocus}
      x={x}
      y={0}
      on:mousedown={(event: SceneMouseEvent) => {
        handleFocus(focusType);
        doubleClick.track(focusType, event);
      }}
      on:dblclick={(event: SceneMouseEvent) => {
        handleEdit(focusType, event);
      }}
    >
      <k-rect
        name="cell-hit"
        width={width + INPUT_MARGIN_RIGHT}
        height={TABLE_HEADER_INPUT_HEIGHT}
        fill={HIT_FILL}
      />
      <k-text
        name="cell-text"
        y={HEADER_TEXT_Y}
        width={width}
        height={INPUT_HEIGHT}
        text={text}
        fill={fill}
        fontFamily={SCENE_FONT_FAMILY}
        fontSize={SCENE_FONT_SIZE}
        verticalAlign="middle"
        wrap="none"
        ellipsis={true}
        visible={!edit}
      />
      {focus ? (
        <k-rect
          name="cell-focus-border"
          y={HEADER_TEXT_Y + INPUT_HEIGHT - FOCUS_BORDER_HEIGHT}
          width={width}
          height={FOCUS_BORDER_HEIGHT}
          fill={
            edit
              ? TRANSPARENT
              : props.editorFocused === false
                ? themeRef.value.placeholder
                : themeRef.value.focus
          }
        />
      ) : null}
      {sharedFocus ? (
        <k-rect
          name="cell-shared-focus-border"
          y={TABLE_HEADER_INPUT_HEIGHT - FOCUS_BORDER_HEIGHT}
          width={width + INPUT_MARGIN_RIGHT}
          height={FOCUS_BORDER_HEIGHT}
          fill={sharedFocus}
        />
      ) : null}
    </k-group>
  );

  return () => {
    const { store } = app.value;
    const { editor, settings, collections } = store.state;
    const { table } = props;
    const theme = themeRef.value;
    const selected = Boolean(editor.selectedMap[table.id]);
    const tableWidths = getTableWidths(store.state, table);
    const rect = getTableRect(store.state, table);
    const contentWidth = rect.width - TABLE_INSET * 2;

    const hovered = Boolean(props.hovered || state.hover);
    const ghostColumnId = props.ghostColumnId ?? state.dragstartId;
    const isGhostColumn =
      ghostColumnId !== null && !table.columnIds.includes(ghostColumnId);

    const sharedTableColor = sharedFocusTableColor();
    const sharedSelected = sharedSelectColor();
    const sharedNameColor = sharedFocusColor(FocusType.tableName);
    const sharedCommentColor = sharedFocusColor(FocusType.tableComment);
    const ringColor = sharedTableColor ?? sharedSelected;

    const headerCells = new Map<FocusType, CellSlot>(
      getHeaderCellSlots(store.state, table).map(slot => [slot.focusType, slot])
    );
    const nameCell = headerCells.get(FocusType.tableName);
    const commentCell = headerCells.get(FocusType.tableComment);

    const columns = query(collections)
      .collection('tableColumnEntities')
      .selectByIds(
        isGhostColumn
          ? [...table.columnIds, ghostColumnId as string]
          : table.columnIds
      );

    return (
      <k-group
        id={props.preview ? '' : `table-${table.id}`}
        name="table"
        kind="table"
        selected={selected}
        sharedFocus={sharedTableColor}
        sharedSelect={sharedSelected}
        x={rect.x}
        y={rect.y}
        on:mousedown={onMoveStart}
        on:touchstart={onMoveStart}
        on:mouseenter={handleMouseenter}
        on:mouseleave={handleMouseleave}
      >
        <k-rect
          name="table-body"
          x={TABLE_BORDER / 2}
          y={TABLE_BORDER / 2}
          width={rect.width - TABLE_BORDER}
          height={rect.height - TABLE_BORDER}
          cornerRadius={TABLE_CORNER_RADIUS}
          fill={theme.tableBackground}
          stroke={
            selected
              ? props.editorFocused === false
                ? theme.placeholder
                : theme.tableSelect
              : theme.tableBorder
          }
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
        <k-group name="table-header" x={TABLE_INSET} y={TABLE_INSET}>
          {sceneIcon({
            icon: 'plus',
            name: 'table-add-column',
            kind: 'icon',
            size: HEADER_ICON_HEIGHT,
            color: iconColor('plus', hovered, theme),
            mouseenter: handleIconMouseenter('plus'),
            mouseleave: handleIconMouseleave,
            x:
              contentWidth -
              HEADER_ICON_HEIGHT * 2 -
              TABLE_HEADER_BUTTON_MARGIN_LEFT,
            y: 0,
            click: handleAddColumn,
          })}
          {sceneIcon({
            icon: 'x',
            name: 'table-remove',
            kind: 'icon',
            size: HEADER_ICON_HEIGHT,
            color: iconColor('x', hovered, theme),
            mouseenter: handleIconMouseenter('x'),
            mouseleave: handleIconMouseleave,
            x: contentWidth - HEADER_ICON_HEIGHT,
            y: 0,
            click: handleRemoveTable,
          })}
          <k-group name="table-header-inputs" y={HEADER_CELLS_Y - TABLE_INSET}>
            {nameCell
              ? headerCell({
                  focusType: nameCell.focusType,
                  x: nameCell.x,
                  width: nameCell.width,
                  text: table.name.trim() ? table.name : 'table',
                  fill: table.name.trim() ? theme.active : theme.placeholder,
                  focus: hasFocus(FocusType.tableName),
                  edit: hasEdit(FocusType.tableName),
                  sharedFocus: sharedNameColor,
                })
              : null}
            {commentCell
              ? headerCell({
                  focusType: commentCell.focusType,
                  x: commentCell.x,
                  width: commentCell.width,
                  text: table.comment.trim() ? table.comment : 'comment',
                  fill: table.comment.trim() ? theme.active : theme.placeholder,
                  focus: hasFocus(FocusType.tableComment),
                  edit: hasEdit(FocusType.tableComment),
                  sharedFocus: sharedCommentColor,
                })
              : null}
          </k-group>
        </k-group>
        <k-group name="table-columns">
          {repeat(
            columns,
            column => column.id,
            (column, index) => (
              <Column
                column={column}
                y={getColumnRect(store.state, table, index).y - rect.y}
                width={rect.width}
                selected={hasSelectColumn(column.id)}
                hovered={column.id === props.hoveredColumnId}
                widthName={tableWidths.name}
                widthDataType={tableWidths.dataType}
                widthDefault={tableWidths.default}
                widthComment={tableWidths.comment}
                focusName={hasFocus(FocusType.columnName, column.id)}
                focusDataType={hasFocus(FocusType.columnDataType, column.id)}
                focusNotNull={hasFocus(FocusType.columnNotNull, column.id)}
                focusDefault={hasFocus(FocusType.columnDefault, column.id)}
                focusComment={hasFocus(FocusType.columnComment, column.id)}
                focusUnique={hasFocus(FocusType.columnUnique, column.id)}
                focusAutoIncrement={hasFocus(
                  FocusType.columnAutoIncrement,
                  column.id
                )}
                editName={hasEdit(FocusType.columnName, column.id)}
                editDataType={hasEdit(FocusType.columnDataType, column.id)}
                editDefault={hasEdit(FocusType.columnDefault, column.id)}
                editComment={hasEdit(FocusType.columnComment, column.id)}
                sharedFocusName={sharedFocusColor(
                  FocusType.columnName,
                  column.id
                )}
                sharedFocusDataType={sharedFocusColor(
                  FocusType.columnDataType,
                  column.id
                )}
                sharedFocusNotNull={sharedFocusColor(
                  FocusType.columnNotNull,
                  column.id
                )}
                sharedFocusDefault={sharedFocusColor(
                  FocusType.columnDefault,
                  column.id
                )}
                sharedFocusComment={sharedFocusColor(
                  FocusType.columnComment,
                  column.id
                )}
                sharedFocusUnique={sharedFocusColor(
                  FocusType.columnUnique,
                  column.id
                )}
                sharedFocusAutoIncrement={sharedFocusColor(
                  FocusType.columnAutoIncrement,
                  column.id
                )}
                ghost={isGhostColumn && column.id === ghostColumnId}
                preview={props.preview}
                editorFocused={props.editorFocused}
                onDragstart={handleDragstartColumn}
                onDragend={handleDragendColumn}
              />
            )
          )}
        </k-group>
      </k-group>
    );
  };
};

export default Table;
