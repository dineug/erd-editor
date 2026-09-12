/** @jsxHost konva */

import { query } from '@dineug/erd-editor-schema';
import { FC, observable, onMounted, repeat } from '@dineug/r-html';
import type { Node as KonvaNode } from 'konva/lib/Node';
import type { Stage } from 'konva/lib/Stage';
import type { Subscription } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import {
  progressOf,
  transitionKey,
  transitionTo,
} from '@/components/erd/canvas/highlightTransition';
import { mixColor } from '@/components/erd/canvas/mixColor';
import { headerCellHit } from '@/components/erd/canvas/sceneHit';
import { sceneIcon } from '@/components/erd/canvas/SceneIcon.template';
import {
  CURSOR_INHERIT,
  CURSOR_POINTER,
  FOCUS_BORDER_HEIGHT,
  HEADER_COLOR_HEIGHT,
  RING_WIDTH,
  SCENE_FONT_FAMILY,
  SCENE_FONT_SIZE,
  type SceneMouseEvent,
  type ScenePointerEvent,
  setSceneCursor,
  TABLE_CORNER_RADIUS,
  TABLE_INSET,
  TRANSPARENT,
  VIEW_CARD_GLOW_BLUR,
  VIEW_CARD_GLOW_OPACITY,
  VIEW_CARD_SHADOW_BLUR,
  VIEW_CARD_SHADOW_OFFSET_X,
  VIEW_CARD_SHADOW_OFFSET_Y,
  VIEW_CARD_SHADOW_OPACITY,
} from '@/components/erd/canvas/sceneTokens';
import {
  CELL_UNDERLINE_Y,
  focusBorderFill,
  getCellTextHeight,
  getHeaderCellSlots,
  getHeaderCellsY,
  HEADER_TEXT_Y,
} from '@/components/erd/canvas/table/cellLayout';
import Column from '@/components/erd/canvas/table/column/Column';
import { createDoubleClickGuard } from '@/components/erd/canvas/table/doubleClick';
import { goToErdTable } from '@/components/erd/canvas/table/goToErd';
import { useSharedSelectEntity } from '@/components/erd/canvas/useSharedSelectEntity';
import { focusFlowView } from '@/components/flowCenters';
import type { LucideIconName } from '@/components/primitives/icon/icons';
import { useSceneSource } from '@/components/sceneSourceContext';
import { useThemeContext } from '@/components/themeContext';
import {
  HEADER_ICON_HEIGHT,
  INPUT_MARGIN_RIGHT,
  TABLE_BORDER,
  TABLE_HEADER_BUTTON_MARGIN_LEFT,
  TABLE_HEADER_INPUT_HEIGHT,
  VIEW_TABLE_HEADER_BUTTON_SIZE,
  VIEW_TABLE_HEADER_HEIGHT,
} from '@/constants/layout';
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
import {
  clearViewHoverTable,
  getVisibleColumnIds,
  setViewHoverTable,
} from '@/konva/scene/viewLayout';
import type { Theme } from '@/themes/tokens';
import { dragendColumnAllAction, openColorPickerAction } from '@/utils/emitter';
import { drag$ } from '@/utils/globalEventObservable';
import { isMod } from '@/utils/keyboard-shortcut';

import { useFocusTable } from './useFocusTable';
import { useMoveTable } from './useMoveTable';
import { useSharedFocusTable } from './useSharedFocusTable';
import { useViewPin } from './useViewPin';

export type TableProps = {
  table: Table;
  /** A drawn copy rather than the table itself, so nothing in it takes an id. */
  preview?: boolean;
  hovered?: boolean;
  hoveredColumnId?: string | null;
  ghostColumnId?: string | null;
  editorFocused?: boolean;
  /** Off while the table is kept built but scrolled out of the culling rect. */
  visible?: boolean;
  /** Whether the view lights this card, decided by the scene it is drawn in. */
  lit?: boolean;
  /**
   * The rows of this table a relationship ends on, which a view tints. Decided
   * by the scene, which walks the document's links once for every card it draws.
   */
  relatedColumnIds?: Set<string> | null;
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
  const sourceRef = useSceneSource(ctx);
  const { hasEdit, hasFocus, hasSelectColumn } = useFocusTable(
    ctx,
    props.table.id
  );
  const { sharedFocusColor, sharedFocusTableColor } = useSharedFocusTable(
    ctx,
    props.table.id
  );
  const { sharedSelectColor } = useSharedSelectEntity(ctx, props.table.id);
  const { onMoveStart } = useMoveTable(ctx, props, sourceRef);
  const pin = useViewPin(app, props, sourceRef);
  const { addUnsubscribe } = useUnmounted();
  const state = observable({
    hover: false,
    iconHover: null as LucideIconName | null,
    dragstartId: null as string | null,
  });

  const doubleClick = createDoubleClickGuard();

  let dragoverSubscription: Subscription | null = null;
  let dragLayerStage: Stage | null = null;
  let flip: KonvaFlip | null = null;

  /**
   * The hover a view lights by, taken beside the local one the icons read. It
   * is scene state and carries no action, so what a reader points at never
   * reaches the document, the history or a peer.
   */
  const handleMouseenter = () => {
    state.hover = true;

    if (sourceRef.value !== 'document') {
      setViewHoverTable(app.value.store.state, props.table.id, sourceRef.value);
    }
  };

  const handleMouseleave = () => {
    state.hover = false;

    if (sourceRef.value !== 'document') {
      setViewHoverTable(app.value.store.state, null, sourceRef.value);
    }
  };

  // Culling and a closing view take the node out from under the pointer, and
  // neither sends a mouseleave, so the hover leaves with whatever held it. The
  // document scene shares the editor id, so only a view table clears it.
  addUnsubscribe(() => {
    if (sourceRef.value === 'document') return;

    clearViewHoverTable(app.value.store.state, props.table.id, sourceRef.value);
  });

  /** What the header icons had as their hover colour and their pointer cursor. */
  const handleIconMouseenter =
    (icon: LucideIconName) => (event: SceneMouseEvent) => {
      state.iconHover = icon;
      setSceneCursor(event, CURSOR_POINTER);
    };

  const handleIconMouseleave = (event: SceneMouseEvent) => {
    state.iconHover = null;
    setSceneCursor(event, CURSOR_INHERIT);
  };

  const iconColor = (theme: Theme, icon: LucideIconName, hovered: boolean) => {
    if (!hovered) return TRANSPARENT;

    return state.iconHover === icon ? theme.active : theme.foreground;
  };

  /** The border a table body draws, greyed out while the editor is unfocused. */
  const bodyStroke = (theme: Theme, selected: boolean) => {
    if (!selected) return theme.tableBorder;

    return props.editorFocused === false
      ? theme.placeholder
      : theme.tableSelect;
  };

  /** The press a table takes: its drag, and in a view scene the start of a click that pins it. */
  const handlePress = (event: ScenePointerEvent) => {
    onMoveStart(event);
    pin.onPress(event);
  };

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

  /** The Related button: the view narrows to this table and its one hop. */
  const handleRelated = () => {
    focusFlowView(app.value, [props.table.id]);
  };

  /** The Go to ERD button: the tab, then the scroll and the selection. */
  const handleGoToErd = () => {
    goToErdTable(app.value.store, props.table.id);
  };

  const handleFocus = (focusType: FocusType) => {
    const { store } = app.value;
    store.dispatch(focusTableAction({ tableId: props.table.id, focusType }));
  };

  const handleEdit = (focusType: FocusType, event: SceneMouseEvent) => {
    if (!doubleClick.isDouble(focusType, event)) return;
    // A view edits nothing: the editor this would open is the document
    // overlay's, which draws on the document placement and not on this cell.
    if (sourceRef.value !== 'document') return;

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

  const handleDragoverColumn = (event: MouseEvent | TouchEvent) => {
    const { store } = app.value;
    const point = toCanvasPoint(event);
    if (!point) return;

    const target = findColumnDropTarget(store.state, point, sourceRef.value);
    if (!target) return;

    const {
      editor: { draggableColumn },
    } = store.state;
    if (
      !draggableColumn ||
      draggableColumn.columnIds.includes(target.columnId)
    ) {
      return;
    }

    flip?.snapshot();
    store.dispatch(dragoverColumnAction$(target.columnId, target.tableId));
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
    // A view reorders nothing: the gate drops what a drag would dispatch, so
    // arming one here would only run the flip and the drop search for nothing.
    if (sourceRef.value !== 'document') return;

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
   * A header cell, laid out the way its input-padding div was: the text on the
   * 20px input line, answering a press for the whole box, and the two underlines
   * at their own edge. The focus underline keeps its box while edited.
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
      <k-text
        name="cell-text"
        y={HEADER_TEXT_Y}
        width={width}
        height={getCellTextHeight()}
        text={text}
        fill={fill}
        fontFamily={SCENE_FONT_FAMILY}
        fontSize={SCENE_FONT_SIZE}
        verticalAlign="middle"
        wrap="none"
        ellipsis={true}
        visible={!edit}
        hitFunc={headerCellHit}
      />
      {focus ? (
        <k-rect
          name="cell-focus-border"
          y={HEADER_TEXT_Y + CELL_UNDERLINE_Y}
          width={width}
          height={FOCUS_BORDER_HEIGHT}
          fill={focusBorderFill(themeRef.value, edit, props.editorFocused)}
          listening={false}
        />
      ) : null}
      {sharedFocus ? (
        <k-rect
          name="cell-shared-focus-border"
          y={TABLE_HEADER_INPUT_HEIGHT - FOCUS_BORDER_HEIGHT}
          width={width + INPUT_MARGIN_RIGHT}
          height={FOCUS_BORDER_HEIGHT}
          fill={sharedFocus}
          listening={false}
        />
      ) : null}
    </k-group>
  );

  return () => {
    const { store } = app.value;
    const { editor, collections } = store.state;
    const { table } = props;
    const theme = themeRef.value;
    const selected = Boolean(editor.selectedMap[table.id]);
    const source = sourceRef.value;
    const tableWidths = getTableWidths(store.state, table, source);
    const rect = getTableRect(store.state, table, source);
    const contentWidth = rect.width - TABLE_INSET * 2;
    // The view header has no icon band above its name box, so its two buttons
    // sit centred on the name line and after it, over the end of a name that
    // reaches them: konva paints and hit tests siblings in order.
    const headerButtonY =
      (VIEW_TABLE_HEADER_HEIGHT - VIEW_TABLE_HEADER_BUTTON_SIZE) / 2;

    const hovered = Boolean(props.hovered || state.hover);
    const draggingColumnId = props.ghostColumnId ?? state.dragstartId;
    const ghostColumnId =
      draggingColumnId !== null && !table.columnIds.includes(draggingColumnId)
        ? draggingColumnId
        : null;

    const sharedTableColor = sharedFocusTableColor();
    const sharedSelected = sharedSelectColor();
    const sharedNameColor = sharedFocusColor(FocusType.tableName);
    const sharedCommentColor = sharedFocusColor(FocusType.tableComment);
    const ringColor = sharedTableColor ?? sharedSelected;

    // A view draws no affordance the width it is measured at has no room for,
    // and the colour band is the same read only header, so it takes no click:
    // the picker it opens sits over a view whose colour change the gate drops.
    const view = source !== 'document';

    // The two header buttons, on the hovered card of a view alone.
    const viewButtons = view && hovered;

    /**
     * Whether a cell hands its text over to an editor. Only the document scene
     * carries one, so a view keeps every cell drawn while the document is
     * edited, and blanks nothing it has no input to put in the gap.
     */
    const cellEdit = (focusType: FocusType, columnId?: string) =>
      !view && hasEdit(focusType, columnId);

    const headerCells = getHeaderCellSlots(store.state, table, source);
    const nameCell = headerCells.find(
      slot => slot.focusType === FocusType.tableName
    );
    const commentCell = headerCells.find(
      slot => slot.focusType === FocusType.tableComment
    );

    const columnIds = getVisibleColumnIds(store.state, table, source);

    // A view lights its centers and what a hover reaches. The card wears that
    // as an accent border and a glow, and a table it leaves unlit keeps its
    // type column's width and draws nothing in it.
    const lit = view && Boolean(props.lit);

    // How far the light has come up on this card, which is what every paint the
    // highlight owns is scaled by: one value, so they all arrive together.
    const litKey = transitionKey(editor.id, 'table', table.id);
    view && transitionTo(litKey, lit ? 1 : 0);
    const litAlpha = view ? progressOf(litKey) : 0;
    const relatedIds = props.relatedColumnIds ?? null;

    const columns = query(collections)
      .collection('tableColumnEntities')
      .selectByIds(ghostColumnId ? [...columnIds, ghostColumnId] : columnIds);

    return (
      <k-group
        id={props.preview ? '' : `table-${table.id}`}
        name="table"
        kind="table"
        visible={props.visible ?? true}
        selected={selected}
        sharedFocus={sharedTableColor}
        sharedSelect={sharedSelected}
        x={rect.x}
        y={rect.y}
        on:mousedown={handlePress}
        on:touchstart={handlePress}
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
          stroke={mixColor(
            bodyStroke(theme, selected),
            theme.accentColor9,
            litAlpha
          )}
          strokeWidth={TABLE_BORDER}
          shadowColor={view ? theme.minimapShadow : undefined}
          shadowBlur={view ? VIEW_CARD_SHADOW_BLUR : undefined}
          shadowOffsetX={view ? VIEW_CARD_SHADOW_OFFSET_X : undefined}
          shadowOffsetY={view ? VIEW_CARD_SHADOW_OFFSET_Y : undefined}
          shadowOpacity={view ? VIEW_CARD_SHADOW_OPACITY : undefined}
          shadowForStrokeEnabled={view ? false : undefined}
          on:mouseenter={(event: SceneMouseEvent) => {
            view && setSceneCursor(event, CURSOR_POINTER);
          }}
          on:mouseleave={(event: SceneMouseEvent) => {
            view && setSceneCursor(event, CURSOR_INHERIT);
          }}
        />
        {litAlpha > 0 ? (
          <k-rect
            name="table-glow"
            x={-RING_WIDTH / 2}
            y={-RING_WIDTH / 2}
            width={rect.width + RING_WIDTH}
            height={rect.height + RING_WIDTH}
            cornerRadius={TABLE_CORNER_RADIUS}
            opacity={litAlpha}
            stroke={theme.accentColor9}
            strokeWidth={TABLE_BORDER}
            shadowColor={theme.accentColor9}
            shadowBlur={VIEW_CARD_GLOW_BLUR}
            shadowOpacity={VIEW_CARD_GLOW_OPACITY}
            shadowForStrokeEnabled={true}
            listening={false}
          />
        ) : null}
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
            listening={false}
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
          listening={!view}
          on:click={handleOpenColorPicker}
          on:mouseenter={(event: SceneMouseEvent) => {
            setSceneCursor(event, CURSOR_POINTER);
          }}
          on:mouseleave={(event: SceneMouseEvent) => {
            setSceneCursor(event, CURSOR_INHERIT);
          }}
        />
        <k-group name="table-header" x={TABLE_INSET} y={TABLE_INSET}>
          {view
            ? null
            : sceneIcon({
                icon: 'plus',
                name: 'table-add-column',
                kind: 'icon',
                size: HEADER_ICON_HEIGHT,
                color: iconColor(theme, 'plus', hovered),
                mouseenter: handleIconMouseenter('plus'),
                mouseleave: handleIconMouseleave,
                x:
                  contentWidth -
                  HEADER_ICON_HEIGHT * 2 -
                  TABLE_HEADER_BUTTON_MARGIN_LEFT,
                y: 0,
                click: handleAddColumn,
              })}
          {view
            ? null
            : sceneIcon({
                icon: 'x',
                name: 'table-remove',
                kind: 'icon',
                size: HEADER_ICON_HEIGHT,
                color: iconColor(theme, 'x', hovered),
                mouseenter: handleIconMouseenter('x'),
                mouseleave: handleIconMouseleave,
                x: contentWidth - HEADER_ICON_HEIGHT,
                y: 0,
                click: handleRemoveTable,
              })}
          <k-group
            name="table-header-inputs"
            y={getHeaderCellsY(source) - TABLE_INSET}
          >
            {nameCell
              ? headerCell({
                  ...nameCell,
                  text: table.name.trim() ? table.name : 'table',
                  fill: table.name.trim() ? theme.active : theme.placeholder,
                  focus: hasFocus(FocusType.tableName),
                  edit: cellEdit(FocusType.tableName),
                  sharedFocus: sharedNameColor,
                })
              : null}
            {commentCell
              ? headerCell({
                  ...commentCell,
                  text: table.comment.trim() ? table.comment : 'comment',
                  fill: table.comment.trim() ? theme.active : theme.placeholder,
                  focus: hasFocus(FocusType.tableComment),
                  edit: cellEdit(FocusType.tableComment),
                  sharedFocus: sharedCommentColor,
                })
              : null}
          </k-group>
          {viewButtons
            ? sceneIcon({
                icon: 'waypoints',
                name: 'table-related',
                kind: 'icon',
                size: VIEW_TABLE_HEADER_BUTTON_SIZE,
                color: iconColor(theme, 'waypoints', hovered),
                mouseenter: handleIconMouseenter('waypoints'),
                mouseleave: handleIconMouseleave,
                x:
                  contentWidth -
                  VIEW_TABLE_HEADER_BUTTON_SIZE * 2 -
                  TABLE_HEADER_BUTTON_MARGIN_LEFT,
                y: headerButtonY,
                click: handleRelated,
              })
            : null}
          {viewButtons
            ? sceneIcon({
                icon: 'external-link',
                name: 'table-go-to-erd',
                kind: 'icon',
                size: VIEW_TABLE_HEADER_BUTTON_SIZE,
                color: iconColor(theme, 'external-link', hovered),
                mouseenter: handleIconMouseenter('external-link'),
                mouseleave: handleIconMouseleave,
                x: contentWidth - VIEW_TABLE_HEADER_BUTTON_SIZE,
                y: headerButtonY,
                click: handleGoToErd,
              })
            : null}
        </k-group>
        <k-group name="table-columns">
          {repeat(
            columns,
            column => column.id,
            (column, index) => (
              <Column
                column={column}
                source={source}
                related={relatedIds?.has(column.id) ?? false}
                litAlpha={litAlpha}
                divider={view && index < columns.length - 1}
                y={getColumnRect(store.state, table, index, source).y - rect.y}
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
                editName={cellEdit(FocusType.columnName, column.id)}
                editDataType={cellEdit(FocusType.columnDataType, column.id)}
                editDefault={cellEdit(FocusType.columnDefault, column.id)}
                editComment={cellEdit(FocusType.columnComment, column.id)}
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
                ghost={column.id === ghostColumnId}
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
