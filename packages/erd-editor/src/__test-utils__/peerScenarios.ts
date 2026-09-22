import { query } from '@dineug/erd-editor-schema';
import type { CompositionActions } from '@dineug/r-html';

import { ColumnOption } from '@/constants/schema';
import type { GeneratorAction } from '@/engine/generator.actions';
import { FocusType } from '@/engine/modules/editor/state';
import {
  changeMemoColorAction,
  resizeMemoAction,
} from '@/engine/modules/memo/atom.actions';
import { changeDatabaseAction } from '@/engine/modules/settings/atom.actions';
import {
  changeTableColorAction,
  changeTableNameAction,
  moveToTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  addTableAction$,
  sortTablesToMoveAction$,
} from '@/engine/modules/table/generator.actions';
import {
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import {
  addColumnAction$,
  changeColumnValueAction$,
} from '@/engine/modules/table-column/generator.actions';
import type {
  DispatchFocus,
  DispatchReport,
  PeerStore,
} from '@/engine/peer-store';
import { bHas } from '@/utils/bit';

/**
 * One edit a caller makes through a peer store: the actions it dispatches,
 * the cell it focuses first, and the label it names the undo unit with.
 */
export type PeerScenario = {
  label: string;
  actions: CompositionActions;
  focus?: DispatchFocus;
};

/** Dispatches a scenario under its own label and focus. */
export const play = (
  peer: PeerStore,
  { label, actions, focus }: PeerScenario
): DispatchReport => peer.dispatch(actions, { label, focus });

const tableFocus = (tableId: string): DispatchFocus => ({
  tableId,
  focusType: FocusType.tableName,
});

const columnFocus = (
  tableId: string,
  columnId: string,
  focusType: FocusType
): DispatchFocus => ({ tableId, columnId, focusType });

/** A color's undo entry needs the color it replaces, which only the state knows. */
const colorTableAction$ = (id: string, color: string): GeneratorAction =>
  function* ({ collections }) {
    const table = query(collections).collection('tableEntities').selectById(id);

    yield changeTableColorAction({
      id,
      color,
      prevColor: table?.ui.color ?? '',
    });
  };

const colorMemoAction$ = (id: string, color: string): GeneratorAction =>
  function* ({ collections }) {
    const memo = query(collections).collection('memoEntities').selectById(id);

    yield changeMemoColorAction({
      id,
      color,
      prevColor: memo?.ui.color ?? '',
    });
  };

/** Resizes from the memo's corner, where it stands, as the far edge handles do. */
const resizeMemoAction$ = (
  id: string,
  width: number,
  height: number
): GeneratorAction =>
  function* ({ collections }) {
    const memo = query(collections).collection('memoEntities').selectById(id);
    if (!memo) return;

    yield resizeMemoAction({ id, x: memo.ui.x, y: memo.ui.y, width, height });
  };

/**
 * Sets a column flag outright and yields nothing when it already holds, since
 * the flag's undo entry stores the negation of the value sent.
 */
const setColumnOptionAction$ =
  (
    creator:
      | typeof changeColumnNotNullAction
      | typeof changeColumnPrimaryKeyAction,
    option: number
  ) =>
  (tableId: string, columnId: string, value: boolean): GeneratorAction =>
    function* ({ collections }) {
      const column = query(collections)
        .collection('tableColumnEntities')
        .selectById(columnId);
      if (!column || bHas(column.options, option) === value) return;

      yield creator({ tableId, id: columnId, value });
    };

const setNotNullAction$ = setColumnOptionAction$(
  changeColumnNotNullAction,
  ColumnOption.notNull
);

const setPrimaryKeyAction$ = setColumnOptionAction$(
  changeColumnPrimaryKeyAction,
  ColumnOption.primaryKey
);

export const addTable = (): PeerScenario => ({
  label: 'addTable',
  actions: [addTableAction$()],
});

export const renameTable = (tableId: string, value: string): PeerScenario => ({
  label: 'renameTable',
  actions: [changeTableNameAction({ id: tableId, value })],
  focus: tableFocus(tableId),
});

export const colorTable = (tableId: string, color: string): PeerScenario => ({
  label: 'colorTable',
  actions: [colorTableAction$(tableId, color)],
  focus: tableFocus(tableId),
});

export const moveTable = (
  tableId: string,
  x: number,
  y: number
): PeerScenario => ({
  label: 'moveTable',
  actions: [moveToTableAction({ id: tableId, x, y })],
  focus: tableFocus(tableId),
});

export const sortTables = (): PeerScenario => ({
  label: 'sortTables',
  actions: [sortTablesToMoveAction$()],
});

export const addColumn = (tableId: string): PeerScenario => ({
  label: 'addColumn',
  actions: [addColumnAction$(tableId)],
});

export const renameColumn = (
  tableId: string,
  columnId: string,
  value: string
): PeerScenario => ({
  label: 'renameColumn',
  actions: [
    changeColumnValueAction$(FocusType.columnName, tableId, columnId, value),
  ],
  focus: columnFocus(tableId, columnId, FocusType.columnName),
});

export const setColumnNotNull = (
  tableId: string,
  columnId: string,
  value: boolean
): PeerScenario => ({
  label: 'setColumnNotNull',
  actions: [setNotNullAction$(tableId, columnId, value)],
  focus: columnFocus(tableId, columnId, FocusType.columnNotNull),
});

export const setColumnPrimaryKey = (
  tableId: string,
  columnId: string,
  value: boolean
): PeerScenario => ({
  label: 'setColumnPrimaryKey',
  actions: [setPrimaryKeyAction$(tableId, columnId, value)],
  focus: columnFocus(tableId, columnId, FocusType.columnName),
});

export const colorMemo = (memoId: string, color: string): PeerScenario => ({
  label: 'colorMemo',
  actions: [colorMemoAction$(memoId, color)],
});

export const resizeMemo = (
  memoId: string,
  width: number,
  height: number
): PeerScenario => ({
  label: 'resizeMemo',
  actions: [resizeMemoAction$(memoId, width, height)],
});

export const setDatabase = (value: number): PeerScenario => ({
  label: 'setDatabase',
  actions: [changeDatabaseAction({ value })],
});
