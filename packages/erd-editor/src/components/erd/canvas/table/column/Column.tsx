/** @jsxHost konva */

import {
  type DOMTemplateLiterals,
  FC,
  observable,
  repeat,
} from '@dineug/r-html';
import type { Subscription } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import { mixColor } from '@/components/erd/canvas/mixColor';
import { columnCellHit } from '@/components/erd/canvas/sceneHit';
import { sceneIcon } from '@/components/erd/canvas/SceneIcon.template';
import {
  CURSOR_INHERIT,
  CURSOR_POINTER,
  FOCUS_BORDER_HEIGHT,
  SCENE_CODE_FONT_FAMILY,
  SCENE_FONT_FAMILY,
  SCENE_FONT_SIZE,
  type SceneMouseEvent,
  setSceneCursor,
  TABLE_CORNER_RADIUS,
  TABLE_INSET,
  TRANSPARENT,
} from '@/components/erd/canvas/sceneTokens';
import {
  type ColumnCellSlot,
  focusBorderFill,
  getColumnCellSlots,
  getColumnTextHeight,
  getColumnTextY,
  getColumnUnderlineY,
} from '@/components/erd/canvas/table/cellLayout';
import { createDoubleClickGuard } from '@/components/erd/canvas/table/doubleClick';
import { useThemeContext } from '@/components/themeContext';
import {
  COLUMN_DELETE_WIDTH,
  COLUMN_HEIGHT,
  COLUMN_KEY_WIDTH,
  INPUT_MARGIN_RIGHT,
  TABLE_BORDER,
  VIEW_COLUMN_ICON_SIZE,
} from '@/constants/layout';
import {
  ColumnOption as ColumnOptionType,
  ColumnType,
  ColumnUIKey,
} from '@/constants/schema';
import {
  editTableAction,
  focusColumnAction,
} from '@/engine/modules/editor/atom.actions';
import {
  columnKeyHoverEndAction$,
  columnKeyHoverStartAction$,
} from '@/engine/modules/editor/generator.actions';
import { FocusType } from '@/engine/modules/editor/state';
import {
  isToggleColumnTypes,
  removeColumnAction$,
  toggleColumnValueAction$,
} from '@/engine/modules/table-column/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import type { Column } from '@/internal-types';
import type { Theme } from '@/themes/tokens';
import { bHas } from '@/utils/bit';
import { tableRowHeight } from '@/utils/calcTable';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import { drag$ } from '@/utils/globalEventObservable';
import { isMod } from '@/utils/keyboard-shortcut';

export type ColumnProps = {
  column: Column;
  /**
   * The source the table drawing this row reads, which picks the row's cells. A
   * prop rather than useSceneSource, the one leaf to depart from it: the table
   * resolved it already, and a context costs an observable and a subscription per row.
   */
  source: GeometrySource;
  /**
   * Whether a relationship ends on this column, which a view tints the row
   * for. Decided by the scene, which walks the links once for every card.
   */
  related?: boolean;
  /**
   * How far the light has come up on the card this row is drawn in, which is
   * what the row tint and the type cell above are both drawn at. One number, so
   * the two of them come up over the one span of time and a document row reads none of it.
   */
  litAlpha?: number;
  /** Whether a view rules a line under this row, which every row but the last does. */
  divider?: boolean;
  /**
   * Whether this is the row a view card ends at. A view draws no padding under
   * its rows, so the last one meets the card's bottom border and takes the two
   * corners it is rounded by, or its square tint would stand outside them.
   */
  last?: boolean;
  y: number;
  width: number;
  selected: boolean;
  widthName: number;
  widthDataType: number;
  widthDefault: number;
  widthComment: number;
  focusName: boolean;
  focusDataType: boolean;
  focusNotNull: boolean;
  focusDefault: boolean;
  focusComment: boolean;
  focusUnique: boolean;
  focusAutoIncrement: boolean;
  sharedFocusName: string | null;
  sharedFocusDataType: string | null;
  sharedFocusNotNull: string | null;
  sharedFocusDefault: string | null;
  sharedFocusComment: string | null;
  sharedFocusUnique: string | null;
  sharedFocusAutoIncrement: string | null;
  editName: boolean;
  editDataType: boolean;
  editDefault: boolean;
  editComment: boolean;
  hovered?: boolean;
  /** The placeholder row for a column dragged in from another table. */
  ghost?: boolean;
  /** Drawn inside a copy of the table, which owns none of its ids. */
  preview?: boolean;
  editorFocused?: boolean;
  /**
   * The one pair of callbacks the scene keeps. A drop lands between siblings,
   * so the table that owns the order is the only thing that can judge one, and
   * the row can only say that a drag of it started and that it ended.
   */
  onDragstart?: (columnId: string, event: SceneMouseEvent) => void;
  onDragend?: () => void;
};

type CellOptions = {
  focusType: FocusType;
  x: number;
  width: number;
  text: string;
  fill: string;
  focus: boolean;
  edit: boolean;
  sharedFocus: string | null;
  ellipsis: boolean;
  opacity?: number;
  align?: 'center' | 'left' | 'right';
  fontFamily?: string;
};

type ColumnOrderTpl = {
  columnType: number;
  template: DOMTemplateLiterals | null;
};

/** Which of the three key colours a column's key bits paint it, if any. */
const keyFill = (keys: number, theme: Theme) => {
  const isPrimaryKey = bHas(keys, ColumnUIKey.primaryKey);
  const isForeignKey = bHas(keys, ColumnUIKey.foreignKey);

  if (isPrimaryKey && isForeignKey) return theme.keyPFK;
  if (isPrimaryKey) return theme.keyPK;
  if (isForeignKey) return theme.keyFK;
  return TRANSPARENT;
};

/**
 * The fill a row takes, where a selection outranks a hover and a hover outranks
 * the tint a view puts on the rows a relationship ends at. A view paints no
 * selection, since what the ERD tab has selected is no mark a reader of a view made.
 */
const rowBackground = (
  theme: Theme,
  view: boolean,
  selected: boolean,
  hover: boolean,
  tint: number
) => {
  if (!view && selected) return theme.columnSelect;
  if (hover) return theme.columnHover;
  // Mixed against the card rather than laid over it as a second rect, so the
  // row keeps the one fill the hover and the selection already paint.
  if (tint > 0)
    return mixColor(theme.tableBackground, theme.accentColor3, tint);
  return TRANSPARENT;
};

const Column: FC<ColumnProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);
  const state = observable({ hover: false, removeHover: false });
  const { addUnsubscribe } = useUnmounted();
  const doubleClick = createDoubleClickGuard();

  let dragSubscription: Subscription | null = null;

  const endDrag = () => {
    dragSubscription?.unsubscribe();
    dragSubscription = null;
  };

  addUnsubscribe(endDrag);

  /**
   * Arms a column drag on the press and reports it once the pointer has moved,
   * which is the moment the browser used to call a dragstart. A press that never
   * moves stays a click, so a button and a cell focus still work.
   */
  const handleDragstart = (event: SceneMouseEvent) => {
    if (props.preview || props.ghost || event.evt.button !== 0) return;
    // A view reorders no row, and a second subscriber to the pointer stream
    // reads no movement, so an armed row would hold still the card it drags.
    if (props.source !== 'document') return;

    endDrag();
    let started = false;

    const subscription = drag$.subscribe({
      next: () => {
        if (started) return;
        started = true;
        props.onDragstart?.(props.column.id, event);
      },
      complete: () => {
        if (dragSubscription === subscription) dragSubscription = null;
        started && props.onDragend?.();
      },
    });

    dragSubscription = subscription;
  };

  const handleMouseenter = () => {
    state.hover = true;
  };

  const handleMouseleave = () => {
    state.hover = false;
  };

  /** What the remove button had as its hover colour and its pointer cursor. */
  const handleRemoveMouseenter = (event: SceneMouseEvent) => {
    state.removeHover = true;
    setSceneCursor(event, CURSOR_POINTER);
  };

  const handleRemoveMouseleave = (event: SceneMouseEvent) => {
    state.removeHover = false;
    setSceneCursor(event, CURSOR_INHERIT);
  };

  /** The remove button is invisible until the row itself is hovered. */
  const removeIconColor = (theme: Theme, hover: boolean) => {
    if (!hover) return TRANSPARENT;

    return state.removeHover ? theme.active : theme.foreground;
  };

  const handleFocus = (focusType: FocusType, event: SceneMouseEvent) => {
    // A view holds no focus: the cell a reader presses there is not a cell of
    // the document, and the underline it would light belongs to the ERD tab.
    if (props.source !== 'document') return;

    const { store } = app.value;
    const { column } = props;
    store.dispatch(
      focusColumnAction({
        tableId: column.tableId,
        columnId: column.id,
        focusType,
        $mod: isMod(event.evt),
        shiftKey: event.evt.shiftKey,
      })
    );
  };

  const handleEdit = (focusType: FocusType, event: SceneMouseEvent) => {
    if (!doubleClick.isDouble(focusType, event)) return;
    // A view edits nothing, and this is both halves of it: the document
    // overlay on a text cell, and a write straight to the document on a flag.
    if (props.source !== 'document') return;

    const { store } = app.value;
    const { column } = props;
    store.dispatch(
      isToggleColumnTypes(focusType)
        ? toggleColumnValueAction$(focusType, column.tableId, column.id)
        : editTableAction()
    );
  };

  const handleRemove = () => {
    const { store } = app.value;
    const { column } = props;
    store.dispatch(removeColumnAction$(column.tableId, [column.id]));
  };

  const handleKeyMouseenter = () => {
    const { column } = props;
    if (column.ui.keys === 0) return;

    const { store } = app.value;
    store.dispatch(columnKeyHoverStartAction$(column.id));
  };

  const handleKeyMouseleave = () => {
    const { store } = app.value;
    store.dispatch(columnKeyHoverEndAction$());
  };

  /**
   * One cell, laid out the way its div was: the text in the 20px input line,
   * answering a press for the whole box, and the two underlines at their own
   * edge. The focus underline is the document's alone and keeps its box while edited.
   */
  const cell = ({
    focusType,
    x,
    width,
    text,
    fill,
    focus,
    edit,
    sharedFocus,
    ellipsis,
    opacity = 1,
    align,
    fontFamily = SCENE_FONT_FAMILY,
  }: CellOptions) => (
    <k-group
      name={`column-col ${focusType}`}
      kind="column-col"
      sharedFocus={sharedFocus}
      x={x}
      y={0}
      opacity={opacity}
      listening={opacity > 0}
      on:mousedown={(event: SceneMouseEvent) => {
        handleFocus(focusType, event);
        doubleClick.track(focusType, event);
      }}
      on:dblclick={(event: SceneMouseEvent) => {
        handleEdit(focusType, event);
      }}
    >
      <k-text
        name="cell-text"
        y={getColumnTextY(props.source)}
        width={width}
        height={getColumnTextHeight(props.source, fontFamily)}
        text={text}
        fill={fill}
        fontFamily={fontFamily}
        fontSize={SCENE_FONT_SIZE}
        align={align}
        verticalAlign="middle"
        wrap="none"
        ellipsis={ellipsis}
        visible={!edit}
        hitFunc={columnCellHit[props.source]}
      />
      {focus && props.source === 'document' ? (
        <k-rect
          name="cell-focus-border"
          y={getColumnTextY(props.source) + getColumnUnderlineY()}
          width={width}
          height={FOCUS_BORDER_HEIGHT}
          fill={focusBorderFill(themeRef.value, edit, props.editorFocused)}
          listening={false}
        />
      ) : null}
      {sharedFocus ? (
        <k-rect
          name="cell-shared-focus-border"
          y={tableRowHeight(props.source) - FOCUS_BORDER_HEIGHT}
          width={width + INPUT_MARGIN_RIGHT}
          height={FOCUS_BORDER_HEIGHT}
          fill={sharedFocus}
          listening={false}
        />
      ) : null}
    </k-group>
  );

  /** One cell, filled in with what its own column type puts in the box. */
  const cellOf = ({
    columnType,
    focusType,
    x,
    width,
  }: ColumnCellSlot): DOMTemplateLiterals | null => {
    const { column } = props;
    const theme = themeRef.value;
    const view = props.source !== 'document';

    switch (columnType) {
      case ColumnType.columnName:
        return cell({
          focusType,
          x,
          width,
          text: column.name.trim() ? column.name : 'column',
          fill: column.name.trim() ? theme.active : theme.placeholder,
          focus: props.focusName,
          edit: props.editName,
          sharedFocus: props.sharedFocusName,
          ellipsis: true,
        });
      case ColumnType.columnDefault:
        return cell({
          focusType,
          x,
          width,
          text: column.default.trim() ? column.default : 'default',
          fill: column.default.trim() ? theme.active : theme.placeholder,
          focus: props.focusDefault,
          edit: props.editDefault,
          sharedFocus: props.sharedFocusDefault,
          ellipsis: true,
        });
      case ColumnType.columnComment:
        return cell({
          focusType,
          x,
          width,
          text: column.comment.trim() ? column.comment : 'comment',
          fill: column.comment.trim() ? theme.active : theme.placeholder,
          focus: props.focusComment,
          edit: props.editComment,
          sharedFocus: props.sharedFocusComment,
          ellipsis: true,
        });
      case ColumnType.columnDataType:
        return cell({
          focusType,
          x,
          width,
          text: column.dataType.trim() ? column.dataType : 'dataType',
          fill: column.dataType.trim() ? theme.active : theme.placeholder,
          focus: props.focusDataType,
          edit: props.editDataType,
          sharedFocus: props.sharedFocusDataType,
          ellipsis: true,
          opacity: view ? (props.litAlpha ?? 0) : 1,
          align: view ? 'right' : undefined,
          fontFamily: view ? SCENE_CODE_FONT_FAMILY : undefined,
        });
      case ColumnType.columnNotNull:
        return cell({
          focusType,
          x,
          width,
          text: bHas(column.options, ColumnOptionType.notNull) ? 'N-N' : 'NULL',
          fill: theme.active,
          focus: props.focusNotNull,
          edit: false,
          sharedFocus: props.sharedFocusNotNull,
          ellipsis: false,
        });
      case ColumnType.columnUnique:
        return cell({
          focusType,
          x,
          width,
          text: 'UQ',
          fill: bHas(column.options, ColumnOptionType.unique)
            ? theme.active
            : theme.placeholder,
          focus: props.focusUnique,
          edit: false,
          sharedFocus: props.sharedFocusUnique,
          ellipsis: false,
        });
      case ColumnType.columnAutoIncrement:
        return cell({
          focusType,
          x,
          width,
          text: 'AI',
          fill: bHas(column.options, ColumnOptionType.autoIncrement)
            ? theme.active
            : theme.placeholder,
          focus: props.focusAutoIncrement,
          edit: false,
          sharedFocus: props.sharedFocusAutoIncrement,
          ellipsis: false,
        });
    }

    return null;
  };

  const getColumnOrder = (): ColumnOrderTpl[] => {
    const { store } = app.value;

    return getColumnCellSlots(
      store.state,
      {
        name: props.widthName,
        comment: props.widthComment,
        dataType: props.widthDataType,
        default: props.widthDefault,
      },
      props.source
    )
      .map(slot => ({ columnType: slot.columnType, template: cellOf(slot) }))
      .filter(({ template }) => Boolean(template));
  };
  return () => {
    const { store } = app.value;
    const { editor } = store.state;
    const { column, selected, width } = props;
    const theme = themeRef.value;
    const hover = Boolean(
      props.hovered || state.hover || editor.hoverColumnMap[column.id]
    );
    const dragging = Boolean(editor.draggingColumnMap[column.id]);
    const contentWidth = width - TABLE_INSET * 2;
    const view = props.source !== 'document';
    const background = rowBackground(
      theme,
      view,
      selected,
      hover,
      view && props.related ? (props.litAlpha ?? 0) : 0
    );
    const rowHeight = tableRowHeight(props.source);
    const keySize = view ? VIEW_COLUMN_ICON_SIZE : COLUMN_KEY_WIDTH;

    return (
      <k-group
        id={props.preview ? '' : `column-${column.id}`}
        name="column-row"
        kind="column-row"
        tableId={column.tableId}
        selected={selected}
        y={props.y}
        opacity={dragging ? 0.5 : 1}
        visible={!props.ghost}
        on:mousedown={handleDragstart}
        on:mouseenter={handleMouseenter}
        on:mouseleave={handleMouseleave}
      >
        <k-rect
          name="column-row-background"
          x={TABLE_BORDER}
          width={width - TABLE_BORDER * 2}
          height={rowHeight}
          cornerRadius={
            view && props.last
              ? [0, 0, TABLE_CORNER_RADIUS, TABLE_CORNER_RADIUS]
              : 0
          }
          fill={background}
        />
        {sceneIcon({
          icon: 'key-round',
          name: 'column-col column-key',
          kind: 'column-col',
          size: keySize,
          color: keyFill(column.ui.keys, theme),
          x: TABLE_INSET,
          y: (rowHeight - keySize) / 2,
          mouseenter: handleKeyMouseenter,
          mouseleave: handleKeyMouseleave,
        })}
        {repeat(
          getColumnOrder(),
          ({ columnType }) => columnType,
          ({ template }) => template
        )}
        {view && props.divider ? (
          <k-line
            name="column-row-divider"
            points={[TABLE_BORDER, rowHeight, width - TABLE_BORDER, rowHeight]}
            stroke={theme.tableBorder}
            strokeWidth={TABLE_BORDER}
            listening={false}
          />
        ) : null}
        {view
          ? null
          : sceneIcon({
              icon: 'x',
              name: 'column-remove',
              kind: 'icon',
              size: COLUMN_DELETE_WIDTH,
              color: removeIconColor(theme, hover),
              x: TABLE_INSET + contentWidth - COLUMN_DELETE_WIDTH,
              y: (COLUMN_HEIGHT - COLUMN_DELETE_WIDTH) / 2,
              click: handleRemove,
              mouseenter: handleRemoveMouseenter,
              mouseleave: handleRemoveMouseleave,
            })}
      </k-group>
    );
  };
};

export default Column;
