import { query } from '@dineug/erd-editor-schema';
import type { CompositionActions } from '@dineug/r-html';

import { createImportValue, SEED } from '@/__test-utils__/peerSeed';
import {
  BracketType,
  ColumnOption,
  ColumnType,
  Database,
  Language,
  NameCase,
  OrderType,
  RelationshipType,
  SaveSettingType,
  Show,
} from '@/constants/schema';
import type { GeneratorAction } from '@/engine/generator.actions';
import {
  loadJsonAction$,
  loadSchemaAMLAction$,
  loadSchemaDBMLAction$,
  loadSchemaGraphQLAction$,
  loadSchemaSQLAction$,
} from '@/engine/modules/editor/generator.actions';
import { FocusType } from '@/engine/modules/editor/state';
import {
  changeIndexNameAction,
  changeIndexUniqueAction,
  removeIndexAction,
} from '@/engine/modules/index/atom.actions';
import { addIndexAction$ } from '@/engine/modules/index/generator.actions';
import { changeIndexColumnOrderTypeAction } from '@/engine/modules/index-column/atom.actions';
import {
  addIndexColumnAction$,
  moveIndexColumnAction$,
  removeIndexColumnAction$,
} from '@/engine/modules/index-column/generator.actions';
import {
  changeMemoColorAction,
  changeMemoValueAction,
  moveToMemoAction,
  resizeMemoAction,
} from '@/engine/modules/memo/atom.actions';
import {
  addMemoAction$,
  removeMemoAction$,
} from '@/engine/modules/memo/generator.actions';
import {
  addRelationshipAction,
  changeRelationshipTypeAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import { addRelationshipAction$ } from '@/engine/modules/relationship/generator.actions';
import {
  changeBracketTypeAction,
  changeColumnNameCaseAction,
  changeColumnOrderAction,
  changeDatabaseAction,
  changeDatabaseNameAction,
  changeIgnoreSaveSettingsAction,
  changeLanguageAction,
  changeMaxWidthCommentAction,
  changeRelationshipDataTypeSyncAction,
  changeRelationshipOptimizationAction,
  changeShowAction,
  changeTableNameCaseAction,
} from '@/engine/modules/settings/atom.actions';
import {
  changeTableColorAction,
  changeTableCommentAction,
  changeTableNameAction,
  moveToTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  addTableAction$,
  removeTableAction$,
  sortTablesToMoveAction$,
} from '@/engine/modules/table/generator.actions';
import {
  changeColumnAutoIncrementAction,
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
  changeColumnUniqueAction,
  moveColumnAction,
} from '@/engine/modules/table-column/atom.actions';
import {
  addColumnAction$,
  changeColumnDataTypeAction$,
  changeColumnValueAction$,
  removeColumnAction$,
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
      | typeof changeColumnPrimaryKeyAction
      | typeof changeColumnUniqueAction
      | typeof changeColumnAutoIncrementAction,
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

const setUniqueAction$ = setColumnOptionAction$(
  changeColumnUniqueAction,
  ColumnOption.unique
);

const setAutoIncrementAction$ = setColumnOptionAction$(
  changeColumnAutoIncrementAction,
  ColumnOption.autoIncrement
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

/** A scenario under its own label, for the edits only the seed map makes. */
const edit = (
  label: string,
  actions: CompositionActions,
  focus?: DispatchFocus
): PeerScenario => ({ label, actions, focus });

/**
 * One edit per shape of change on the seed, each built from the engine's own
 * creators and each changing the seed: every entity module's, every setting,
 * every import. Built again for every use, since a generator runs once.
 */
export const SEED_SCENARIOS: Readonly<Record<string, () => PeerScenario>> = {
  addTable: () => addTable(),
  removeTable: () => edit('removeTable', [removeTableAction$(SEED.orders)]),
  renameTable: () => renameTable(SEED.users, 'members'),
  commentTable: () =>
    edit(
      'commentTable',
      [changeTableCommentAction({ id: SEED.users, value: 'who signs in' })],
      tableFocus(SEED.users)
    ),
  colorTable: () => colorTable(SEED.users, '#ff8800'),
  moveTable: () => moveTable(SEED.users, 40, 60),
  sortTables: () => sortTables(),

  addColumn: () => addColumn(SEED.empty),
  removeColumns: () =>
    edit('removeColumns', [
      removeColumnAction$(SEED.orders, [SEED.orderUser, SEED.orderNote]),
    ]),
  setColumnDataType: () =>
    edit(
      'setColumnDataType',
      [
        changeColumnDataTypeAction$({
          tableId: SEED.users,
          id: SEED.userId,
          value: 'BIGINT',
        }),
      ],
      columnFocus(SEED.users, SEED.userId, FocusType.columnDataType)
    ),
  renameColumn: () => renameColumn(SEED.users, SEED.userName, 'full_name'),
  setColumnDefault: () =>
    edit(
      'setColumnDefault',
      [
        changeColumnValueAction$(
          FocusType.columnDefault,
          SEED.users,
          SEED.userName,
          "'anonymous'"
        ),
      ],
      columnFocus(SEED.users, SEED.userName, FocusType.columnDefault)
    ),
  commentColumn: () =>
    edit(
      'commentColumn',
      [
        changeColumnValueAction$(
          FocusType.columnComment,
          SEED.users,
          SEED.userName,
          'shown to others'
        ),
      ],
      columnFocus(SEED.users, SEED.userName, FocusType.columnComment)
    ),
  setColumnPrimaryKey: () =>
    setColumnPrimaryKey(SEED.users, SEED.userName, true),
  setColumnUnique: () =>
    edit(
      'setColumnUnique',
      [setUniqueAction$(SEED.users, SEED.userName, true)],
      columnFocus(SEED.users, SEED.userName, FocusType.columnUnique)
    ),
  setColumnNotNull: () => setColumnNotNull(SEED.users, SEED.userName, true),
  setColumnAutoIncrement: () =>
    edit(
      'setColumnAutoIncrement',
      [setAutoIncrementAction$(SEED.users, SEED.userId, true)],
      columnFocus(SEED.users, SEED.userId, FocusType.columnAutoIncrement)
    ),
  moveColumn: () =>
    edit('moveColumn', [
      moveColumnAction({
        id: SEED.orderNote,
        tableId: SEED.orders,
        targetId: SEED.orderId,
      }),
    ]),

  // A start table with no key, so the relationship brings one of its own.
  addRelationship: () =>
    edit('addRelationship', [
      addRelationshipAction$(SEED.empty, SEED.users, RelationshipType.ZeroN),
    ]),
  linkColumns: () =>
    edit('linkColumns', [
      addRelationshipAction({
        id: 'users_orders_note',
        relationshipType: RelationshipType.OneOnly,
        start: { tableId: SEED.users, columnIds: [SEED.userId] },
        end: { tableId: SEED.orders, columnIds: [SEED.orderNote] },
      }),
    ]),
  removeRelationship: () =>
    edit('removeRelationship', [
      removeRelationshipAction({ id: SEED.relationship }),
    ]),
  setRelationshipType: () =>
    edit('setRelationshipType', [
      changeRelationshipTypeAction({
        id: SEED.relationship,
        value: RelationshipType.ZeroOne,
      }),
    ]),

  addIndex: () => edit('addIndex', [addIndexAction$(SEED.users)]),
  removeIndex: () =>
    edit('removeIndex', [removeIndexAction({ id: SEED.index })]),
  renameIndex: () =>
    edit('renameIndex', [
      changeIndexNameAction({
        id: SEED.index,
        tableId: SEED.orders,
        value: 'orders_note_idx',
      }),
    ]),
  setIndexUnique: () =>
    edit('setIndexUnique', [
      changeIndexUniqueAction({
        id: SEED.index,
        tableId: SEED.orders,
        value: true,
      }),
    ]),
  addIndexColumn: () =>
    edit('addIndexColumn', [addIndexColumnAction$(SEED.index, SEED.orderId)]),
  removeIndexColumn: () =>
    edit('removeIndexColumn', [
      removeIndexColumnAction$(SEED.index, SEED.orderNote),
    ]),
  moveIndexColumn: () =>
    edit('moveIndexColumn', [
      moveIndexColumnAction$(SEED.userIndexColumn, SEED.indexColumn),
    ]),
  setIndexColumnOrder: () =>
    edit('setIndexColumnOrder', [
      changeIndexColumnOrderTypeAction({
        id: SEED.indexColumn,
        indexId: SEED.index,
        columnId: SEED.orderNote,
        value: OrderType.DESC,
      }),
    ]),

  addMemo: () => edit('addMemo', [addMemoAction$()]),
  removeMemo: () => edit('removeMemo', [removeMemoAction$(SEED.memo)]),
  editMemo: () =>
    edit('editMemo', [
      changeMemoValueAction({ id: SEED.memo, value: 'ship on friday' }),
    ]),
  colorMemo: () => colorMemo(SEED.memo, '#336699'),
  moveMemo: () =>
    edit('moveMemo', [moveToMemoAction({ id: SEED.memo, x: 960, y: 420 })]),
  resizeMemo: () => resizeMemo(SEED.memo, 320, 240),

  setDatabaseName: () =>
    edit('setDatabaseName', [changeDatabaseNameAction({ value: 'shop' })]),
  setDatabase: () => setDatabase(Database.PostgreSQL),
  setLanguage: () =>
    edit('setLanguage', [changeLanguageAction({ value: Language.TypeScript })]),
  setTableNameCase: () =>
    edit('setTableNameCase', [
      changeTableNameCaseAction({ value: NameCase.snakeCase }),
    ]),
  setColumnNameCase: () =>
    edit('setColumnNameCase', [
      changeColumnNameCaseAction({ value: NameCase.snakeCase }),
    ]),
  setBracketType: () =>
    edit('setBracketType', [
      changeBracketTypeAction({ value: BracketType.backtick }),
    ]),
  setRelationshipDataTypeSync: () =>
    edit('setRelationshipDataTypeSync', [
      changeRelationshipDataTypeSyncAction({ value: false }),
    ]),
  setRelationshipOptimization: () =>
    edit('setRelationshipOptimization', [
      changeRelationshipOptimizationAction({ value: true }),
    ]),
  setColumnOrder: () =>
    edit('setColumnOrder', [
      changeColumnOrderAction({
        value: ColumnType.columnComment,
        target: ColumnType.columnName,
      }),
    ]),
  setShow: () =>
    edit('setShow', [
      changeShowAction({ show: Show.columnUnique, value: true }),
    ]),
  setMaxWidthComment: () =>
    edit('setMaxWidthComment', [changeMaxWidthCommentAction({ value: 120 })]),
  setIgnoreSaveSettings: () =>
    edit('setIgnoreSaveSettings', [
      changeIgnoreSaveSettingsAction({
        saveSettingType: SaveSettingType.scroll,
        value: true,
      }),
    ]),

  importSql: () =>
    edit('importSql', [
      loadSchemaSQLAction$(
        'CREATE TABLE accounts (id INT NOT NULL PRIMARY KEY, email VARCHAR(255));'
      ),
    ]),
  importGraphql: () =>
    edit('importGraphql', [
      loadSchemaGraphQLAction$('type Account {\n  id: ID!\n  email: String\n}'),
    ]),
  importDbml: () =>
    edit('importDbml', [
      loadSchemaDBMLAction$(
        'Table accounts {\n  id int [pk]\n  email varchar\n}'
      ),
    ]),
  importAml: () =>
    edit('importAml', [
      loadSchemaAMLAction$('accounts\n  id int pk\n  email varchar'),
    ]),
  importJson: () => edit('importJson', [loadJsonAction$(createImportValue())]),
};
