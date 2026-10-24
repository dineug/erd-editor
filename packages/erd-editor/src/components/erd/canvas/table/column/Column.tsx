/** @jsxHost konva */

import {
  type DOMTemplateLiterals,
  FC,
  observable,
  repeat,
  watch,
} from '@dineug/r-html';
import type { Node as KonvaNode } from 'konva/lib/Node';
import type { Subscription } from 'rxjs';

import { useAppContext } from '@/components/appContext';
import { mixColor } from '@/components/erd/canvas/mixColor';
import {
  columnCellHit,
  columnDragHandleHit,
} from '@/components/erd/canvas/sceneHit';
import { sceneIcon } from '@/components/erd/canvas/SceneIcon.template';
import {
  COLUMN_DRAG_HANDLE_RADIUS,
  COLUMN_DRAG_HANDLE_REST_OPACITY,
  createSceneCursorScope,
  CURSOR_GRAB,
  CURSOR_INHERIT,
  CURSOR_POINTER,
  FOCUS_BORDER_HEIGHT,
  SCENE_CODE_FONT_FAMILY,
  SCENE_FONT_FAMILY,
  SCENE_FONT_SIZE,
  type SceneMouseEvent,
  type ScenePointerEvent,
  setSceneCursor,
  TABLE_CORNER_RADIUS,
  TABLE_INSET,
  TRANSPARENT,
} from '@/components/erd/canvas/sceneTokens';
import { blankLogicalName } from '@/components/erd/canvas/table/blankLogicalName';
import {
  type ColumnCellSlot,
  focusBorderFill,
  getAlternateKeyMarkHeight,
  getAlternateKeyMarkX,
  getColumnCellSlots,
  getColumnTextHeight,
  getColumnTextY,
  getColumnUnderlineY,
} from '@/components/erd/canvas/table/cellLayout';
import { columnMarkFill } from '@/components/erd/canvas/table/dictionaryMarks';
import { createDoubleClickGuard } from '@/components/erd/canvas/table/doubleClick';
import { useI18n } from '@/components/localeContext';
import { useThemeContext } from '@/components/themeContext';
import {
  COLUMN_DELETE_WIDTH,
  COLUMN_DRAG_HANDLE_GAP,
  COLUMN_DRAG_HANDLE_HEIGHT,
  COLUMN_DRAG_HANDLE_ICON_SIZE,
  COLUMN_DRAG_HANDLE_WIDTH,
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
import { getLiveDomainName } from '@/engine/modules/dictionary/membership';
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
import {
  COLUMN_KEY_PATH,
  type DiffPaths,
  diffTextColor,
  ENTITY_PATH,
} from '@/utils/diff/diff';
import {
  isMainButtonPress,
  isMultiTouch,
  isSecondaryButtonPress,
} from '@/utils/domEvent';
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
   * What the diff pane this row is drawn in changed of its column, which tints
   * those cells. A prop for the reason source is one, and null outside a pane.
   */
  diffPaths?: DiffPaths | null;
  /**
   * How far the light has come up on the card this row is drawn in, which a
   * related row's tint is drawn at, so it comes up with the card's border and
   * glow over the one span of time. A document row reads none of it.
   */
  litAlpha?: number;
  /**
   * Whether the card rules a line under this row. A view card rules one under
   * every row but the last, and a document table rules none.
   */
  divider?: boolean;
  /**
   * Whether this is the row a card ends at. A card draws no padding under its
   * rows, so the last one meets the card's bottom border and takes the two
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
  /** The logical name's own cell, 0 while the name view lays out none. */
  widthLogicalName?: number;
  /** The domain's own cell, 0 while its show bit is off. */
  widthDomain?: number;
  /**
   * The room the table keeps for alternate key marks after the last cell, 0
   * while it draws none; the same for every row, so the marks stay in line.
   */
  widthAlternateKey?: number;
  /** The mark this row carries in that room, AK1.2 or several comma joined. */
  alternateKey?: string;
  /**
   * The name and type cells' marks, under whichever focus the name view gives
   * them: the logical view's name cell takes the logical name's, and its type
   * cell the domain's while the domain has no cell of its own.
   */
  focusName: boolean;
  focusDataType: boolean;
  focusNotNull: boolean;
  focusDefault: boolean;
  focusComment: boolean;
  focusUnique: boolean;
  focusAutoIncrement: boolean;
  /** The marks of the logical name and domain cells, which a row lays out in some views alone. */
  focusLogicalName?: boolean;
  focusDomain?: boolean;
  sharedFocusName: string | null;
  sharedFocusDataType: string | null;
  sharedFocusNotNull: string | null;
  sharedFocusDefault: string | null;
  sharedFocusComment: string | null;
  sharedFocusUnique: string | null;
  sharedFocusAutoIncrement: string | null;
  sharedFocusLogicalName?: string | null;
  sharedFocusDomain?: string | null;
  editName: boolean;
  editDataType: boolean;
  editDefault: boolean;
  editComment: boolean;
  editLogicalName?: boolean;
  editDomain?: boolean;
  hovered?: boolean;
  /** The placeholder row for a column dragged in from another table. */
  ghost?: boolean;
  /**
   * Whether the name cells write what the dictionaries' checks find in their
   * colours, which the table decides for every row it draws.
   */
  checkMarks?: boolean;
  /** Drawn inside a copy of the table, which owns none of its ids. */
  preview?: boolean;
  editorFocused?: boolean;
  /**
   * Whether the row carries the handle a column drag starts from, outside the
   * table's left edge. The table gives it to its focused row alone, and only
   * where a reader can reorder: the document, unlocked, never a copy.
   */
  dragHandle?: boolean;
  /**
   * The one pair of callbacks the scene keeps. A drop lands between siblings,
   * so the table that owns the order is the only thing that can judge one, and
   * the row can only say that a drag of it started and that it ended.
   */
  onDragstart?: (columnId: string, event: ScenePointerEvent) => void;
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
  diffFallback?: string | null;
  /** The diff path of what the cell draws, its focus type unless it says otherwise. */
  diffPath?: string;
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
 * The fill a row takes. A hover lifts whatever the row already wears a step
 * rather than replacing it, so a selected row or one a view tints keeps its hue
 * under the pointer. A view paints no selection, which is the ERD tab's mark.
 */
const rowBackground = (
  theme: Theme,
  view: boolean,
  selected: boolean,
  hover: boolean,
  tint: number
) => {
  if (!view && selected) {
    return hover ? theme.columnSelectHover : theme.columnSelect;
  }
  // Mixed against the card rather than laid over it as a second rect, so the
  // row keeps the one fill the hover and the selection already paint.
  if (tint > 0) {
    return hover
      ? mixColor(theme.columnHover, theme.accentColor4, tint)
      : mixColor(theme.tableBackground, theme.accentColor3, tint);
  }
  return hover ? theme.columnHover : TRANSPARENT;
};

const Column: FC<ColumnProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);
  // Read only where a field is empty, so a switch redraws the empty cells alone.
  const i18n = useI18n(ctx);
  const state = observable({
    hover: false,
    removeHover: false,
    handleHover: false,
  });
  const { addUnsubscribe } = useUnmounted();
  const doubleClick = createDoubleClickGuard();
  const handleCursor = createSceneCursorScope();

  let dragSubscription: Subscription | null = null;

  const endDrag = () => {
    dragSubscription?.unsubscribe();
    dragSubscription = null;
  };

  /** The handle the pointer is on, which a leave has to start from. */
  let hoveredHandle: KonvaNode | null = null;

  /**
   * Konva sends no leave to a node taken away from under the pointer, so the
   * handle gives its hover and cursor back itself when the focus moves off it,
   * and tells the row and the table it stands outside that the pointer left.
   */
  const releaseHandle = () => {
    const left = state.handleHover ? hoveredHandle : null;
    hoveredHandle = null;
    state.handleHover = false;
    handleCursor.release();

    let node = left?.getParent() ?? null;
    while (node && node.getType() === 'Group') {
      node.fire('mouseleave');
      if (node.getAttr('kind') === 'table') break;
      node = node.getParent();
    }
  };

  addUnsubscribe(
    endDrag,
    releaseHandle,
    watch(props).subscribe(name => {
      if (name === 'dragHandle' && !props.dragHandle) releaseHandle();
    })
  );

  /**
   * Arms a column drag on a press of the handle and reports it once the pointer
   * has moved, which is the moment the browser used to call a dragstart. A
   * press that never moves stays a click, and a second finger is a pinch's.
   */
  const handleDragstart = (event: ScenePointerEvent) => {
    if (!isMainButtonPress(event.evt) || isMultiTouch(event.evt)) return;

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

  /** Whether the press under way found a relationship draw, which it closes or starts. */
  let pressDraws = false;

  /** The native press a cell of this row focused, which the row then leaves to it. */
  let focusedPress: MouseEvent | null = null;

  /**
   * The row's press, read before the table it bubbles to dispatches anything.
   * Its click on the remove button then belongs to the draw it met, if any.
   */
  const handlePress = (event: SceneMouseEvent) => {
    pressDraws = Boolean(app.value.store.state.editor.drawRelationship);

    const focused = focusedPress === event.evt;
    focusedPress = null;
    if (focused || !isSecondaryButtonPress(event.evt)) return;

    // A right press on the key, between two cells or on an alternate key mark
    // focuses the row too, so the menu it opens never acts on a stale focus.
    const { focusTable } = app.value.store.state.editor;
    const focusType =
      focusTable?.columnId === props.column.id
        ? focusTable.focusType
        : FocusType.columnName;
    handleFocus(focusType, event);
  };

  const handleMouseenter = () => {
    state.hover = true;
  };

  const handleMouseleave = () => {
    state.hover = false;
  };

  const handleHandleMouseenter = (event: SceneMouseEvent) => {
    hoveredHandle = event.currentTarget;
    state.handleHover = true;
    handleCursor.set(event, CURSOR_GRAB);
  };

  const handleHandleMouseleave = (event: SceneMouseEvent) => {
    hoveredHandle = null;
    state.handleHover = false;
    handleCursor.set(event, CURSOR_INHERIT);
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

  /**
   * How a press reshapes the column selection. A right press on a selected row
   * keeps the selection, which the context menu then acts on, and anywhere else
   * selects its row alone; any other press reads its modifier keys.
   */
  const pressSelection = (evt: MouseEvent) => {
    if (!isSecondaryButtonPress(evt)) {
      return { $mod: isMod(evt), shiftKey: evt.shiftKey };
    }

    const { focusTable } = app.value.store.state.editor;
    const { column } = props;
    const selected =
      focusTable?.tableId === column.tableId &&
      focusTable.selectColumnIds.includes(column.id);

    return { $mod: selected, shiftKey: false };
  };

  const handleFocus = (focusType: FocusType, event: SceneMouseEvent) => {
    // A view holds no focus: the cell a reader presses there is not a cell of
    // the document, and the underline it would light belongs to the ERD tab.
    if (props.source !== 'document') return;

    focusedPress = event.evt;
    const { store } = app.value;
    const { column } = props;
    store.dispatch(
      focusColumnAction({
        tableId: column.tableId,
        columnId: column.id,
        focusType,
        ...pressSelection(event.evt),
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
    if (pressDraws) return;

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

  /** What the checks find in a filled name cell, in their colour; null for none or a blank one. */
  const markFill = (field: 'name' | 'logicalName') => {
    const { column } = props;
    if (!props.checkMarks || !column[field].trim()) return null;

    return columnMarkFill(app.value.store, themeRef.value, column, field);
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
    diffFallback = null,
    diffPath = focusType,
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
        fill={
          diffTextColor(themeRef.value, props.diffPaths, diffPath, true) ??
          diffFallback ??
          fill
        }
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

  /**
   * A logical name cell: the logical name, or while it is blank what stands in
   * for it, dimmed, the name in the logical view and else the placeholder.
   */
  const logicalNameCell = (
    { focusType, x, width }: ColumnCellSlot,
    marks: Pick<CellOptions, 'focus' | 'edit' | 'sharedFocus'>,
    diffFallback: string | null
  ) => {
    const { column } = props;
    const theme = themeRef.value;
    const filled = column.logicalName.trim() !== '';
    let text = column.logicalName;

    if (!filled) {
      const { standIn, key } = blankLogicalName(
        app.value.store.state.settings,
        column.name,
        'common.placeholder.column'
      );
      text = standIn || i18n.value.t(key);
    }

    return cell({
      focusType,
      x,
      width,
      text,
      fill:
        markFill('logicalName') ?? (filled ? theme.active : theme.placeholder),
      ...marks,
      ellipsis: true,
      diffFallback,
    });
  };

  /**
   * The diff path a slot marks: its focus type, but the type's for the type
   * cell in every view, since it draws the type or the domain governing it.
   */
  const diffPathOf = (slot: ColumnCellSlot): string =>
    slot.columnType === ColumnType.columnDataType
      ? FocusType.columnDataType
      : slot.focusType;

  /** One cell, filled in with what its own column type puts in the box. */
  const cellOf = (
    slot: ColumnCellSlot,
    diffFallback: string | null
  ): DOMTemplateLiterals | null => {
    const { columnType, focusType, x, width } = slot;
    const { column } = props;
    const theme = themeRef.value;
    const view = props.source !== 'document';

    switch (columnType) {
      case ColumnType.columnName:
        // The logical view sets the logical name in the name's place.
        if (focusType === FocusType.columnLogicalName) {
          return logicalNameCell(
            slot,
            {
              focus: props.focusName,
              edit: props.editName,
              sharedFocus: props.sharedFocusName,
            },
            diffFallback
          );
        }

        return cell({
          focusType,
          x,
          width,
          text: column.name.trim()
            ? column.name
            : i18n.value.t('common.placeholder.column'),
          fill:
            markFill('name') ??
            (column.name.trim() ? theme.active : theme.placeholder),
          focus: props.focusName,
          edit: props.editName,
          sharedFocus: props.sharedFocusName,
          ellipsis: true,
          diffFallback,
        });
      case ColumnType.columnDefault:
        return cell({
          focusType,
          x,
          width,
          text: column.default.trim()
            ? column.default
            : i18n.value.t('common.placeholder.default'),
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
          text: column.comment.trim()
            ? column.comment
            : i18n.value.t('common.placeholder.comment'),
          fill: column.comment.trim() ? theme.active : theme.placeholder,
          focus: props.focusComment,
          edit: props.editComment,
          sharedFocus: props.sharedFocusComment,
          ellipsis: true,
        });
      case ColumnType.columnDataType: {
        // Where the type cell takes the domain's focus it stands for the
        // domain, and draws its name while the column links a listed one.
        const domainName =
          focusType === FocusType.columnDomain
            ? getLiveDomainName(app.value.store.state, column.domainId)
            : '';
        const filled = domainName !== '' || column.dataType.trim() !== '';

        return cell({
          focusType,
          x,
          width,
          text:
            domainName ||
            (column.dataType.trim()
              ? column.dataType
              : i18n.value.t('common.placeholder.dataType')),
          fill: filled ? theme.active : theme.placeholder,
          focus: props.focusDataType,
          edit: props.editDataType,
          sharedFocus: props.sharedFocusDataType,
          ellipsis: true,
          align: view ? 'right' : undefined,
          // A domain's name is measured in the text face, so it keeps it.
          fontFamily: view && !domainName ? SCENE_CODE_FONT_FAMILY : undefined,
          diffPath: diffPathOf(slot),
        });
      }
      case ColumnType.columnLogicalName:
        return logicalNameCell(
          slot,
          {
            focus: props.focusLogicalName ?? false,
            edit: props.editLogicalName ?? false,
            sharedFocus: props.sharedFocusLogicalName ?? null,
          },
          null
        );
      case ColumnType.columnDomain: {
        // A column linking no listed domain shows the placeholder, as an empty type does.
        const domainName = getLiveDomainName(
          app.value.store.state,
          column.domainId
        );
        return cell({
          focusType,
          x,
          width,
          text: domainName || i18n.value.t('common.placeholder.domain'),
          fill: domainName ? theme.active : theme.placeholder,
          focus: props.focusDomain ?? false,
          edit: props.editDomain ?? false,
          sharedFocus: props.sharedFocusDomain ?? null,
          ellipsis: true,
        });
      }
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

  /**
   * The diff colour a change to a cell this row does not draw takes on the
   * name instead, so a change the tree lists is marked in the pane.
   */
  const hiddenDiffColor = (slots: ColumnCellSlot[], theme: Theme) => {
    const { diffPaths } = props;
    if (!diffPaths) return null;
    for (const path of diffPaths.keys()) {
      if (path === ENTITY_PATH) continue;
      if (path === COLUMN_KEY_PATH && props.column.ui.keys !== 0) continue;
      if (slots.some(slot => diffPathOf(slot) === path)) continue;
      const color = diffTextColor(theme, diffPaths, path);
      if (color) return color;
    }
    return null;
  };

  const getColumnOrder = (slots: ColumnCellSlot[]): ColumnOrderTpl[] => {
    const fallback = hiddenDiffColor(slots, themeRef.value);
    return slots
      .map(slot => ({
        columnType: slot.columnType,
        template: cellOf(slot, fallback),
      }))
      .filter(({ template }) => Boolean(template));
  };

  /**
   * The alternate key mark, one margin past the last cell whatever the order,
   * in the room every row of the table keeps. Derived and never edited, so it
   * answers no press and a press on it falls to the row, as between two cells.
   */
  const alternateKeyMark = (slots: ColumnCellSlot[], theme: Theme) =>
    props.widthAlternateKey && props.source === 'document' ? (
      <k-text
        name="column-alternate-key"
        x={getAlternateKeyMarkX(slots)}
        y={getColumnTextY(props.source)}
        width={props.widthAlternateKey}
        height={getAlternateKeyMarkHeight()}
        text={props.alternateKey ?? ''}
        fill={theme.foreground}
        fontFamily={SCENE_CODE_FONT_FAMILY}
        fontSize={SCENE_FONT_SIZE}
        verticalAlign="middle"
        wrap="none"
        listening={false}
      />
    ) : null;

  /**
   * The handle a column drag starts from, outside the table's left edge on the
   * row's middle: a button at half strength until the pointer is on it, which
   * then shows it whole on the hover step. Its box runs back to the table's edge.
   */
  const dragHandle = (rowHeight: number, theme: Theme) => {
    const hover = state.handleHover;

    return (
      <k-group
        name="column-drag-handle"
        kind="column-drag-handle"
        x={-(COLUMN_DRAG_HANDLE_GAP + COLUMN_DRAG_HANDLE_WIDTH)}
        y={(rowHeight - COLUMN_DRAG_HANDLE_HEIGHT) / 2}
        opacity={hover ? 1 : COLUMN_DRAG_HANDLE_REST_OPACITY}
        on:mousedown={handleDragstart}
        on:touchstart={handleDragstart}
        on:mouseenter={handleHandleMouseenter}
        on:mouseleave={handleHandleMouseleave}
      >
        <k-rect
          name="column-drag-handle-button"
          x={TABLE_BORDER / 2}
          y={TABLE_BORDER / 2}
          width={COLUMN_DRAG_HANDLE_WIDTH - TABLE_BORDER}
          height={COLUMN_DRAG_HANDLE_HEIGHT - TABLE_BORDER}
          cornerRadius={COLUMN_DRAG_HANDLE_RADIUS}
          fill={
            hover
              ? theme.columnHandleHoverBackground
              : theme.columnHandleBackground
          }
          stroke={
            hover ? theme.columnHandleHoverBorder : theme.columnHandleBorder
          }
          strokeWidth={TABLE_BORDER}
          hitFunc={columnDragHandleHit}
        />
        {sceneIcon({
          icon: 'grip-vertical',
          name: 'column-drag-handle-icon',
          kind: 'column-drag-handle',
          size: COLUMN_DRAG_HANDLE_ICON_SIZE,
          color: hover ? theme.active : theme.foreground,
          x: (COLUMN_DRAG_HANDLE_WIDTH - COLUMN_DRAG_HANDLE_ICON_SIZE) / 2,
          y: (COLUMN_DRAG_HANDLE_HEIGHT - COLUMN_DRAG_HANDLE_ICON_SIZE) / 2,
        })}
      </k-group>
    );
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
    const slots = getColumnCellSlots(
      store.state,
      {
        name: props.widthName,
        logicalName: props.widthLogicalName ?? 0,
        comment: props.widthComment,
        dataType: props.widthDataType,
        domain: props.widthDomain ?? 0,
        default: props.widthDefault,
      },
      props.source
    );

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
        on:mousedown={handlePress}
        on:mouseenter={handleMouseenter}
        on:mouseleave={handleMouseleave}
      >
        <k-rect
          name="column-row-background"
          x={TABLE_BORDER}
          width={width - TABLE_BORDER * 2}
          height={rowHeight}
          cornerRadius={
            props.last ? [0, 0, TABLE_CORNER_RADIUS, TABLE_CORNER_RADIUS] : 0
          }
          fill={background}
        />
        {sceneIcon({
          icon: 'key-round',
          name: 'column-col column-key',
          kind: 'column-col',
          size: keySize,
          color:
            column.ui.keys === 0
              ? TRANSPARENT
              : (diffTextColor(theme, props.diffPaths, COLUMN_KEY_PATH, true) ??
                keyFill(column.ui.keys, theme)),
          x: TABLE_INSET,
          y: (rowHeight - keySize) / 2,
          mouseenter: handleKeyMouseenter,
          mouseleave: handleKeyMouseleave,
        })}
        {repeat(
          getColumnOrder(slots),
          ({ columnType }) => columnType,
          ({ template }) => template
        )}
        {alternateKeyMark(slots, theme)}
        {props.divider ? (
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
        {props.dragHandle && !view && !props.preview && !props.ghost
          ? dragHandle(rowHeight, theme)
          : null}
      </k-group>
    );
  };
};

export default Column;
