import { query } from '@dineug/erd-editor-schema';
import {
  createRef,
  type DOMTemplateLiterals,
  FC,
  onMounted,
  ref,
  repeat,
} from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import {
  MEMO_FONT_WEIGHT,
  MEMO_LINE_HEIGHT_PX,
} from '@/components/erd/canvas/memo/memoText';
import {
  SCENE_FONT_FAMILY,
  SCENE_FONT_SIZE,
} from '@/components/erd/canvas/sceneTokens';
import {
  COLUMN_TEXT_Y,
  getColumnCellSlots,
  getHeaderCellSlots,
  HEADER_CELLS_X,
  HEADER_CELLS_Y,
  HEADER_TEXT_Y,
} from '@/components/erd/canvas/table/cellLayout';
import EditInput from '@/components/primitives/edit-input/EditInput';
import ColumnDataType from '@/components/table-view/column/column-data-type/ColumnDataType';
import {
  MEMO_BORDER,
  MEMO_HEADER_HEIGHT,
  MEMO_PADDING,
} from '@/constants/layout';
import {
  editMemoEndAction,
  editTableEndAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType } from '@/engine/modules/editor/state';
import { changeMemoValueAction } from '@/engine/modules/memo/atom.actions';
import {
  changeTableCommentAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import { changeColumnValueAction$ } from '@/engine/modules/table-column/generator.actions';
import type { RootState } from '@/engine/state';
import {
  getColumnRect,
  getTableRect,
  getTableWidths,
} from '@/konva/scene/metrics';
import { getSceneOrigin } from '@/konva/scene/viewport';
import { onStop } from '@/utils/domEvent';
import { lastCursorFocus } from '@/utils/focus';
import { focusEvent } from '@/utils/internalEvents';
import { isHighLevelTable } from '@/utils/validation';

/** What an editor writes into, and what it shows while the value is empty. */
const EDITABLE: Partial<Record<FocusType, string>> = {
  [FocusType.tableName]: 'table',
  [FocusType.tableComment]: 'comment',
  [FocusType.columnName]: 'column',
  [FocusType.columnDataType]: 'dataType',
  [FocusType.columnDefault]: 'default',
  [FocusType.columnComment]: 'comment',
};

type CellTarget = {
  kind: 'cell';
  focusType: FocusType;
  tableId: string;
  columnId: string | null;
  /** Where the text this replaces is drawn, in canvas coordinates. */
  x: number;
  y: number;
  width: number;
  value: string;
  placeholder: string;
};

type MemoTarget = {
  kind: 'memo';
  memoId: string;
  /** Where the body this replaces is drawn, in canvas coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
  value: string;
};

type EditTarget = CellTarget | MemoTarget;

const keyOf = (target: EditTarget) =>
  target.kind === 'memo'
    ? `memo:${target.memoId}`
    : `${target.tableId}:${target.columnId ?? ''}:${target.focusType}`;

/**
 * The cell the editor is open on, or null while none is. Every box comes out of
 * the same slot list the scene lays its text out with, so the editor lands on
 * the text it replaces rather than beside it.
 */
function resolveCellTarget(state: RootState): CellTarget | null {
  const { editor, collections, settings } = state;
  const { focusTable } = editor;

  if (!focusTable?.edit || isHighLevelTable(settings.zoomLevel)) return null;

  const placeholder = EDITABLE[focusTable.focusType];
  if (placeholder === undefined) return null;

  const table = query(collections)
    .collection('tableEntities')
    .selectById(focusTable.tableId);
  if (!table) return null;

  const rect = getTableRect(state, table);

  if (!focusTable.columnId) {
    const slot = getHeaderCellSlots(state, table).find(
      candidate => candidate.focusType === focusTable.focusType
    );
    if (!slot) return null;

    return {
      kind: 'cell',
      focusType: slot.focusType,
      tableId: table.id,
      columnId: null,
      x: rect.x + HEADER_CELLS_X + slot.x,
      y: rect.y + HEADER_CELLS_Y + HEADER_TEXT_Y,
      width: slot.width,
      value:
        slot.focusType === FocusType.tableName ? table.name : table.comment,
      placeholder,
    };
  }

  const index = table.columnIds.indexOf(focusTable.columnId);
  if (index === -1) return null;

  const column = query(collections)
    .collection('tableColumnEntities')
    .selectById(focusTable.columnId);
  if (!column) return null;

  const slot = getColumnCellSlots(state, getTableWidths(state, table)).find(
    candidate => candidate.focusType === focusTable.focusType
  );
  if (!slot) return null;

  const value =
    slot.focusType === FocusType.columnName
      ? column.name
      : slot.focusType === FocusType.columnDataType
        ? column.dataType
        : slot.focusType === FocusType.columnDefault
          ? column.default
          : column.comment;

  return {
    kind: 'cell',
    focusType: slot.focusType,
    tableId: table.id,
    columnId: column.id,
    x: rect.x + slot.x,
    y: getColumnRect(state, table, index).y + COLUMN_TEXT_Y,
    width: slot.width,
    value,
    placeholder,
  };
}

/**
 * The memo the body editor is open on, or null while none is. The box is the
 * one the scene clips the drawn body to, so the caret sits on the same glyphs
 * the memo showed a moment earlier.
 */
function resolveMemoTarget(state: RootState): MemoTarget | null {
  const { editor, collections, doc } = state;
  const { editMemoId } = editor;
  // The document's own list, because a removed entity is still in collections
  // until the next gc and would keep an editor open over nothing.
  if (!editMemoId || !doc.memoIds.includes(editMemoId)) return null;

  const memo = query(collections)
    .collection('memoEntities')
    .selectById(editMemoId);
  if (!memo) return null;

  return {
    kind: 'memo',
    memoId: memo.id,
    x: memo.ui.x + MEMO_BORDER + MEMO_PADDING,
    y: memo.ui.y + MEMO_BORDER + MEMO_PADDING + MEMO_HEADER_HEIGHT,
    width: memo.ui.width,
    height: memo.ui.height,
    value: memo.value,
  };
}

/** The one editor open over the scene: a memo body outranks a table cell. */
const resolveEditTarget = (state: RootState): EditTarget | null =>
  resolveMemoTarget(state) ?? resolveCellTarget(state);

type MemoEditorProps = {
  target: MemoTarget;
};

/**
 * The textarea a memo body is edited in. It carries the font, the leading and
 * the wrapping rules the scene folded the drawn lines with, so the glyphs stay
 * where they were when the caret arrives.
 */
const MemoEditor: FC<MemoEditorProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const textarea = createRef<HTMLTextAreaElement>();

  const handleInput = (event: InputEvent) => {
    const el = event.target as HTMLTextAreaElement | null;
    if (!el) return;

    const { store } = app.value;
    store.dispatch(
      changeMemoValueAction({ id: props.target.memoId, value: el.value })
    );
  };

  const handleBlur = () => {
    const { store } = app.value;
    store.dispatch(editMemoEndAction());
    ctx.host.dispatchEvent(focusEvent());
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    textarea.value?.blur();
  };

  onMounted(() => {
    const el = textarea.value;
    if (el) lastCursorFocus(el);
  });

  return () => (
    <textarea
      class={['memo-textarea', 'scrollbar']}
      use:ref={ref(textarea)}
      style={{
        display: 'block',
        width: `${props.target.width}px`,
        height: `${props.target.height}px`,
        margin: '0',
        padding: '0',
        border: '0',
        outline: 'none',
        resize: 'none',
        'box-sizing': 'border-box',
        'background-color': 'transparent',
        color: 'var(--active)',
        'caret-color': 'var(--active)',
        'font-family': SCENE_FONT_FAMILY,
        'font-size': `${SCENE_FONT_SIZE}px`,
        'font-weight': MEMO_FONT_WEIGHT,
        'line-height': `${MEMO_LINE_HEIGHT_PX}px`,
        'letter-spacing': '0em',
        'white-space': 'pre-wrap',
        'overflow-wrap': 'break-word',
      }}
      spellcheck="false"
      prop:value={props.target.value}
      on:input={handleInput}
      on:keydown={handleKeydown}
      on:wheel={onStop}
      on:blur={handleBlur}
    ></textarea>
  );
};

/**
 * The one editing surface over the Stage. A canvas has no caret, no selection
 * and no IME, so the edited cell hides its konva text and a real input takes
 * its place, under the same zoom the scene layer carries.
 */
const EditOverlay: FC = (_, ctx) => {
  const app = useAppContext(ctx);

  const handleEditEnd = () => {
    const { store } = app.value;
    store.dispatch(editTableEndAction());
  };

  const handleInput = (event: InputEvent) => {
    const { store } = app.value;
    const input = event.target as HTMLInputElement | null;
    const target = resolveCellTarget(store.state);
    if (!input || !target) return;

    if (target.columnId) {
      store.dispatch(
        changeColumnValueAction$(
          target.focusType,
          target.tableId,
          target.columnId,
          input.value
        )
      );
      return;
    }

    const payload = { id: target.tableId, value: input.value };
    store.dispatch(
      target.focusType === FocusType.tableName
        ? changeTableNameAction(payload)
        : changeTableCommentAction(payload)
    );
  };

  const cellEditor = (target: CellTarget): DOMTemplateLiterals =>
    target.focusType === FocusType.columnDataType && target.columnId ? (
      <ColumnDataType
        tableId={target.tableId}
        columnId={target.columnId}
        width={target.width}
        value={target.value}
        focus={true}
        edit={true}
        onBlur={handleEditEnd}
        onEditEnd={handleEditEnd}
        onInput={handleInput}
      />
    ) : (
      <EditInput
        placeholder={target.placeholder}
        width={target.width}
        value={target.value}
        focus={true}
        edit={true}
        autofocus={true}
        onBlur={handleEditEnd}
        onInput={handleInput}
      />
    );

  const editor = (target: EditTarget): DOMTemplateLiterals =>
    target.kind === 'memo' ? (
      <MemoEditor target={target} />
    ) : (
      cellEditor(target)
    );

  return () => {
    const { store } = app.value;
    const { settings } = store.state;
    const target = resolveEditTarget(store.state);
    const { zoomLevel } = settings;

    // The same origin CanvasScene gives its layers, read from the one place
    // that transform is written down.
    const { x: originX, y: originY } = getSceneOrigin(settings);

    return (
      <div
        class="edit-overlay"
        style={{
          position: 'absolute',
          inset: '0',
          overflow: 'hidden',
          'pointer-events': 'none',
        }}
      >
        {repeat(target ? [target] : [], keyOf, item => (
          <div
            class="edit-overlay-cell"
            style={{
              position: 'absolute',
              top: '0',
              left: '0',
              'pointer-events': 'auto',
              'transform-origin': '0 0',
              transform: `translate(${originX + item.x * zoomLevel}px, ${
                originY + item.y * zoomLevel
              }px) scale(${zoomLevel})`,
            }}
          >
            {editor(item)}
          </div>
        ))}
      </div>
    );
  };
};

export default EditOverlay;
