import type { CellWrite } from '@/model/tsv';
import type { CellRef, CellStyle, ColumnDef } from '@/model/types';

/** Whether an edit keeps the cell's value to change it, or replaces it with what was typed. */
export type EditMode = 'edit' | 'replace';

/**
 * What asks for an edit. A double click, Enter and F2 keep the value; typing
 * on the active cell replaces it with the text typed, which is empty when an
 * IME composition starts the edit and fills it afterwards.
 */
export type EditTrigger =
  | { kind: 'doubleClick' | 'enter' | 'f2' }
  | { kind: 'type'; text: string };

/** Why the grid asks an open editor to close: Escape, or a press outside it. */
export type CloseReason = 'escape' | 'outside';

/** No cell is being edited. */
export interface IdleEdit {
  status: 'idle';
}

/**
 * One cell being edited. Its fields are read when the edit starts and only
 * input moves the draft afterwards, so a host change meanwhile, from a peer
 * or an undo, reaches neither the draft nor the value it is measured against.
 */
export interface ActiveEdit {
  status: 'editing';
  cell: CellRef;
  /** The id of the cell's column when the edit started, which the change carries. */
  columnId: string;
  mode: EditMode;
  /** What the host's getter answered for the cell when the edit started. */
  original: string;
  /** What the editor opens with: the value kept, or the text typed. */
  initialValue: string;
  /** What the grid's own editor holds now; a column's own editor keeps its draft itself. */
  draft: string;
  /** Whether the column's own editor took the edit in place of the grid's. */
  custom: boolean;
}

export type EditState = IdleEdit | ActiveEdit;

/** The state with no edit open, one frozen value since it carries nothing. */
export const EDIT_IDLE: IdleEdit = Object.freeze({ status: 'idle' });

/** One value for one cell, with the id of its column, as the commit event carries it. */
export interface CellChange extends CellWrite {
  columnId: string;
}

/** What an edit asks of the cell it starts on, read off the host's props at that moment. */
export interface EditRequest {
  cell: CellRef;
  column: ColumnDef;
  /** What the host's getter answers for the cell. */
  value: string;
  /** What the host's style hook answers for the cell, whose readonly skips it like the column's. */
  style?: CellStyle;
  /** Whether the column brings its own editor. */
  custom?: boolean;
  trigger: EditTrigger;
}

/** Where an ending edit leaves the grid, and the change it hands the host, if the value changed. */
export interface CommitOutcome {
  state: EditState;
  change: CellChange | null;
}

/** A close, which a column's own editor answers itself once it is given the reason. */
export interface CloseOutcome extends CommitOutcome {
  signal: CloseReason | null;
}

/** Whether a cell takes no edit, paste or clear: its column or its own style says so. */
export function isReadonly(
  column: ColumnDef,
  style: CellStyle | undefined
): boolean {
  return column.readonly === true || style?.readonly === true;
}

/**
 * Starts an edit on a cell, or answers the state it was given: on a readonly
 * cell, where a double click does nothing, and while an edit is open, since
 * the grid ends one before it starts another on a press elsewhere.
 */
export function startEdit(state: EditState, request: EditRequest): EditState {
  if (state.status === 'editing') return state;
  if (isReadonly(request.column, request.style)) return state;

  const { cell, column, value, trigger } = request;
  const initialValue = trigger.kind === 'type' ? trigger.text : value;

  return {
    status: 'editing',
    cell: { row: cell.row, col: cell.col },
    columnId: column.id,
    mode: trigger.kind === 'type' ? 'replace' : 'edit',
    original: value,
    initialValue,
    draft: initialValue,
    custom: request.custom === true,
  };
}

/** The grid's editor took input: its text becomes the draft. Nothing else writes the draft. */
export function inputDraft(state: EditState, draft: string): EditState {
  return state.status === 'editing' ? { ...state, draft } : state;
}

/**
 * Ends the edit with the draft, or with the value a column's own editor
 * hands back, and names a change only when that differs from what the cell
 * held when the edit started, so a peer's write meanwhile is not undone.
 */
export function commitEdit(state: EditState, value?: string): CommitOutcome {
  if (state.status === 'idle') return { state, change: null };

  const next = value ?? state.draft;
  const { cell, columnId, original } = state;

  return {
    state: EDIT_IDLE,
    change:
      next === original
        ? null
        : { row: cell.row, col: cell.col, columnId, value: next },
  };
}

/** Ends the edit and drops the draft. */
export function cancelEdit(): IdleEdit {
  return EDIT_IDLE;
}

/**
 * Escape or a press outside the editor. The grid's own editor cancels on the
 * first and commits on the second; a column's own editor stays open and is
 * handed the reason, and the edit ends once it answers commit or cancel.
 */
export function closeEdit(state: EditState, reason: CloseReason): CloseOutcome {
  if (state.status === 'idle') return { state, change: null, signal: null };
  if (state.custom) return { state, change: null, signal: reason };
  if (reason === 'escape') {
    return { state: cancelEdit(), change: null, signal: null };
  }

  return { ...commitEdit(state), signal: null };
}

/** What the grid knows of the host's cells when a paste or a clear writes to them. */
export interface CellSource {
  rowCount: number;
  columns: readonly ColumnDef[];
  getCellStyle?(row: number, col: number): CellStyle | undefined;
}

/** The changes a paste or a clear hands the host, and whether a write fell past the last column. */
export interface ChangeBatch {
  changes: CellChange[];
  beyondColumns: boolean;
}

/**
 * The writes a paste or a clear makes, less the readonly cells and those
 * past the last column, which the caller reports. A row past the last one is
 * kept for the host to add, and its style hook is never asked about it.
 */
export function writableChanges(
  writes: readonly CellWrite[],
  source: CellSource
): ChangeBatch {
  const { rowCount, columns, getCellStyle } = source;
  const changes: CellChange[] = [];
  let beyondColumns = false;

  for (const write of writes) {
    const column = columns[write.col];

    if (!column) {
      beyondColumns = true;
      continue;
    }

    const style =
      write.row < rowCount ? getCellStyle?.(write.row, write.col) : undefined;

    if (!isReadonly(column, style)) {
      changes.push({ ...write, columnId: column.id });
    }
  }

  return { changes, beyondColumns };
}
