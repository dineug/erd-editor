import { AnyAction } from '@dineug/r-html';
import { describe, expect, it } from 'vite-plus/test';

import {
  ColumnOption,
  ColumnUIKey,
  OrderType,
  RelationshipType,
} from '@/constants/schema';
import { ChangeActionTypes, SharedActionTypes } from '@/engine/actions';
import { pushStreamHistoryMap } from '@/engine/history.actions';
import {
  CreateEntityInput,
  toCreateEntityActions,
} from '@/engine/modules/editor/utils/duplicate';
import { ActionType as IndexColumnActionType } from '@/engine/modules/index-column/actions';
import { ActionType as MemoActionType } from '@/engine/modules/memo/actions';
import { ActionType as TableActionType } from '@/engine/modules/table/actions';
import {
  ClipboardColumn,
  ClipboardIndex,
  ClipboardMemo,
  ClipboardRelationship,
  ClipboardTable,
  PlacementPoint,
} from '@/utils/table-clipboard';

/**
 * The complete set of action types a create batch may emit, restated as
 * literals on purpose: the assertion has to break when the builder emits
 * something new, so it must not derive from the builder's own imports.
 */
const ALLOWED_ACTION_TYPES = [
  'column.add',
  'column.changeAutoIncrement',
  'column.changeComment',
  'column.changeDataType',
  'column.changeDefault',
  'column.changeName',
  'column.changeNotNull',
  'column.changePrimaryKey',
  'column.changeUnique',
  'index.add',
  'index.changeName',
  'index.changeUnique',
  'indexColumn.add',
  'indexColumn.changeOrderType',
  'memo.add',
  'memo.changeValue',
  'relationship.add',
  'table.add',
  'table.changeComment',
  'table.changeName',
];

/**
 * The three stream actions split the batch into a second history command, the
 * two changeZIndex actions are in no classification list, and moveIndexColumn
 * writes no LWW operator, so a concurrent merge could not resolve it.
 */
const FORBIDDEN_ACTION_TYPES = [
  'table.changeColor',
  'memo.changeColor',
  'memo.resize',
  'table.changeZIndex',
  'memo.changeZIndex',
  'indexColumn.move',
];

const createClipboardTable = (
  sourceId: string,
  overrides: Partial<ClipboardTable> = {}
): ClipboardTable => ({
  sourceId,
  name: `${sourceId}-name`,
  comment: `${sourceId}-comment`,
  columnIds: [],
  ui: {
    x: 100,
    y: 200,
    zIndex: 2,
    widthName: 60,
    widthComment: 60,
    color: '',
  },
  ...overrides,
});

const createClipboardColumn = (
  sourceId: string,
  tableId: string,
  overrides: Partial<ClipboardColumn> = {}
): ClipboardColumn => ({
  sourceId,
  tableId,
  name: `${sourceId}-name`,
  comment: `${sourceId}-comment`,
  dataType: 'varchar',
  default: `${sourceId}-default`,
  options: 0,
  ui: {
    keys: 0,
    widthName: 60,
    widthComment: 60,
    widthDataType: 60,
    widthDefault: 60,
  },
  ...overrides,
});

const createClipboardMemo = (
  sourceId: string,
  overrides: Partial<ClipboardMemo> = {}
): ClipboardMemo => ({
  sourceId,
  value: `${sourceId}-value`,
  ui: {
    x: 10,
    y: 20,
    width: 127,
    height: 128,
    zIndex: 3,
    color: '',
  },
  ...overrides,
});

const createClipboardRelationship = (
  overrides: Partial<ClipboardRelationship> = {}
): ClipboardRelationship => ({
  relationshipType: RelationshipType.ZeroN,
  start: { tableId: 't1', columnIds: ['c1'] },
  end: { tableId: 't2', columnIds: ['c2'] },
  ...overrides,
});

const createClipboardIndex = (
  tableId: string,
  overrides: Partial<ClipboardIndex> = {}
): ClipboardIndex => ({
  tableId,
  name: `${tableId}-index`,
  unique: true,
  indexColumns: [],
  ...overrides,
});

const createInput = (
  overrides: Partial<CreateEntityInput> = {}
): CreateEntityInput => ({
  tables: [],
  columns: [],
  memos: [],
  relationships: [],
  indexes: [],
  ...overrides,
});

const createPlacement = (
  entries: Array<[string, Partial<PlacementPoint>]>
): Map<string, PlacementPoint> =>
  new Map(
    entries.map(([sourceId, point]) => [
      sourceId,
      { x: 0, y: 0, zIndex: 0, ...point },
    ])
  );

const toTypes = (actions: AnyAction[]) => actions.map(({ type }) => type);

const toUniqueSortedTypes = (actions: AnyAction[]) =>
  [...new Set(toTypes(actions))].sort();

const findAction = (actions: AnyAction[], type: string) =>
  actions.find(action => action.type === type);

const filterActions = (actions: AnyAction[], type: string) =>
  actions.filter(action => action.type === type);

/**
 * A colourful table and memo — the exact input that used to split the batch.
 * It also carries a self relationship and a DESC index, so the whitelist above
 * covers every action type the builder can emit.
 */
const createColourfulBatch = () => {
  const input = createInput({
    tables: [
      createClipboardTable('t1', {
        columnIds: ['c1', 'c2'],
        ui: {
          x: 100,
          y: 200,
          zIndex: 2,
          widthName: 60,
          widthComment: 60,
          color: '#ff0000',
        },
      }),
    ],
    columns: [
      createClipboardColumn('c1', 't1', {
        options:
          ColumnOption.primaryKey |
          ColumnOption.notNull |
          ColumnOption.unique |
          ColumnOption.autoIncrement,
      }),
      createClipboardColumn('c2', 't1'),
    ],
    relationships: [
      createClipboardRelationship({
        start: { tableId: 't1', columnIds: ['c1'] },
        end: { tableId: 't1', columnIds: ['c2'] },
      }),
    ],
    indexes: [
      createClipboardIndex('t1', {
        indexColumns: [{ columnId: 'c2', orderType: OrderType.DESC }],
      }),
    ],
    memos: [
      createClipboardMemo('m1', {
        ui: {
          x: 10,
          y: 20,
          width: 127,
          height: 128,
          zIndex: 3,
          color: '#00ff00',
        },
      }),
    ],
  });

  const placement = createPlacement([
    ['t1', { x: 150, y: 250, zIndex: 11 }],
    ['m1', { x: 60, y: 70, zIndex: 12 }],
  ]);

  return toCreateEntityActions(input, placement);
};

describe('toCreateEntityActions — forbidden actions (AC-35)', () => {
  it('emits nothing outside the whitelist, even for coloured entities', () => {
    const { actions } = createColourfulBatch();

    expect(toUniqueSortedTypes(actions)).toEqual(ALLOWED_ACTION_TYPES);
  });

  it('emits none of the colour, resize or zIndex actions', () => {
    const { actions } = createColourfulBatch();
    const types = toTypes(actions);

    for (const forbidden of FORBIDDEN_ACTION_TYPES) {
      expect(types).not.toContain(forbidden);
    }
  });

  it('emits no action registered in pushStreamHistoryMap', () => {
    const { actions } = createColourfulBatch();
    const streamTypes = Object.keys(pushStreamHistoryMap);
    const intersection = toUniqueSortedTypes(actions).filter(type =>
      streamTypes.includes(type)
    );

    // A stream action would be regrouped by groupByStreamActions and buffered
    // behind debounceTime(200), producing a second history command ~200ms
    // after the batch — one undo would then restore only part of the copy.
    expect(intersection).toEqual([]);
    expect(streamTypes.length).toBeGreaterThan(0);
  });

  it('names real action types in the forbidden list', () => {
    // Without this the list above could go stale into a typo and pass forever.
    expect(FORBIDDEN_ACTION_TYPES).toEqual([
      TableActionType.changeTableColor,
      MemoActionType.changeMemoColor,
      MemoActionType.resizeMemo,
      TableActionType.changeZIndex,
      MemoActionType.changeZIndex,
      IndexColumnActionType.moveIndexColumn,
    ]);
  });

  it('keeps moveIndexColumn out over the merge, not over replication', () => {
    // It is classified as a change action, so the shared store broadcasts it
    // and every replica applies it. Only the unversioned splice in its reducer
    // is the reason a concurrent merge could not resolve it.
    expect(ChangeActionTypes).toContain(IndexColumnActionType.moveIndexColumn);
    expect(SharedActionTypes).toContain(IndexColumnActionType.moveIndexColumn);
  });

  it('carries the table colour and zIndex in the add payload instead', () => {
    const { actions, tableIds } = createColourfulBatch();
    const addTable = findAction(actions, 'table.add');

    expect(addTable?.payload).toEqual({
      id: tableIds[0],
      ui: { x: 150, y: 250, zIndex: 11, color: '#ff0000' },
    });
  });

  it('carries the memo colour, size and zIndex in the add payload instead', () => {
    const { actions, memoIds } = createColourfulBatch();
    const addMemo = findAction(actions, 'memo.add');

    expect(addMemo?.payload).toEqual({
      id: memoIds[0],
      ui: {
        x: 60,
        y: 70,
        zIndex: 12,
        color: '#00ff00',
        width: 127,
        height: 128,
      },
    });
  });

  it('leaves the derived widths out of the batch', () => {
    const { actions } = createColourfulBatch();
    const addTable = findAction(actions, 'table.add');

    // changeTableName/changeTableComment recompute them with
    // textInRange(toWidth(value)), so sending them would be sending stale
    // state, not restoring it.
    expect(addTable?.payload.ui).not.toHaveProperty('widthName');
    expect(addTable?.payload.ui).not.toHaveProperty('widthComment');
  });
});

describe('toCreateEntityActions', () => {
  it('returns nothing for an empty input', () => {
    const result = toCreateEntityActions(createInput(), createPlacement([]));

    expect(result).toEqual({ actions: [], tableIds: [], memoIds: [] });
  });

  it('emits the table actions in add / name / comment order', () => {
    const { actions, tableIds } = toCreateEntityActions(
      createInput({ tables: [createClipboardTable('t1')] }),
      createPlacement([['t1', { x: 1, y: 2, zIndex: 3 }]])
    );

    expect(toTypes(actions)).toEqual([
      'table.add',
      'table.changeName',
      'table.changeComment',
    ]);
    expect(actions[1].payload).toEqual({ id: tableIds[0], value: 't1-name' });
    expect(actions[2].payload).toEqual({
      id: tableIds[0],
      value: 't1-comment',
    });
  });

  it('mints a fresh id per entity and reports it back', () => {
    const { actions, tableIds, memoIds } = toCreateEntityActions(
      createInput({
        tables: [createClipboardTable('t1'), createClipboardTable('t2')],
        memos: [createClipboardMemo('m1')],
      }),
      createPlacement([
        ['t1', {}],
        ['t2', {}],
        ['m1', {}],
      ])
    );

    const ids = [
      ...tableIds,
      ...memoIds,
      ...filterActions(actions, 'column.add').map(({ payload }) => payload.id),
    ];

    expect(tableIds).toHaveLength(2);
    expect(memoIds).toHaveLength(1);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      filterActions(actions, 'table.add').map(({ payload }) => payload.id)
    ).toEqual(tableIds);
    expect(
      filterActions(actions, 'memo.add').map(({ payload }) => payload.id)
    ).toEqual(memoIds);
  });

  it('rebuilds the columns in the source table order', () => {
    const { actions, tableIds } = toCreateEntityActions(
      createInput({
        tables: [createClipboardTable('t1', { columnIds: ['c3', 'c1', 'c2'] })],
        columns: [
          createClipboardColumn('c1', 't1'),
          createClipboardColumn('c2', 't1'),
          createClipboardColumn('c3', 't1'),
        ],
      }),
      createPlacement([['t1', {}]])
    );

    const names = filterActions(actions, 'column.changeName').map(
      ({ payload }) => payload.value
    );

    expect(names).toEqual(['c3-name', 'c1-name', 'c2-name']);
    expect(
      filterActions(actions, 'column.add').every(
        ({ payload }) => payload.tableId === tableIds[0]
      )
    ).toBe(true);
  });

  it('keeps each table to the columns its columnIds name', () => {
    const { actions, tableIds } = toCreateEntityActions(
      createInput({
        tables: [
          createClipboardTable('t1', { columnIds: ['c1'] }),
          createClipboardTable('t2', { columnIds: ['c2'] }),
        ],
        columns: [
          createClipboardColumn('c1', 't1'),
          createClipboardColumn('c2', 't2'),
        ],
      }),
      createPlacement([
        ['t1', {}],
        ['t2', {}],
      ])
    );

    const [first, second] = filterActions(actions, 'column.add');

    expect(first.payload.tableId).toBe(tableIds[0]);
    expect(second.payload.tableId).toBe(tableIds[1]);
  });

  it('emits addColumnAction with the two ids alone and replays no ui', () => {
    const { actions, tableIds } = toCreateEntityActions(
      createInput({
        tables: [createClipboardTable('t1', { columnIds: ['c1'] })],
        columns: [
          createClipboardColumn('c1', 't1', {
            ui: {
              keys: ColumnUIKey.foreignKey,
              widthName: 60,
              widthComment: 60,
              widthDataType: 60,
              widthDefault: 60,
            },
          }),
        ],
      }),
      createPlacement([['t1', {}]])
    );

    // The clipboard payload does carry ui.keys, so this is what keeps the
    // foreign key badge on a copy coming from addColumnForeignKeyHook alone.
    const [add] = filterActions(actions, 'column.add');

    expect(add.payload).toEqual({ id: add.payload.id, tableId: tableIds[0] });
  });

  it('ignores a columnId with no matching column', () => {
    const { actions } = toCreateEntityActions(
      createInput({
        tables: [createClipboardTable('t1', { columnIds: ['c1', 'gone'] })],
        columns: [createClipboardColumn('c1', 't1')],
      }),
      createPlacement([['t1', {}]])
    );

    expect(filterActions(actions, 'column.add')).toHaveLength(1);
  });

  it('unpacks the option bits into their four boolean actions', () => {
    const { actions } = toCreateEntityActions(
      createInput({
        tables: [createClipboardTable('t1', { columnIds: ['c1'] })],
        columns: [
          createClipboardColumn('c1', 't1', {
            options: ColumnOption.primaryKey | ColumnOption.unique,
          }),
        ],
      }),
      createPlacement([['t1', {}]])
    );

    expect(findAction(actions, 'column.changePrimaryKey')?.payload.value).toBe(
      true
    );
    expect(findAction(actions, 'column.changeUnique')?.payload.value).toBe(
      true
    );
    expect(findAction(actions, 'column.changeNotNull')?.payload.value).toBe(
      false
    );
    expect(
      findAction(actions, 'column.changeAutoIncrement')?.payload.value
    ).toBe(false);
  });

  it('copies every column value across', () => {
    const { actions } = toCreateEntityActions(
      createInput({
        tables: [createClipboardTable('t1', { columnIds: ['c1'] })],
        columns: [
          createClipboardColumn('c1', 't1', {
            name: 'id',
            dataType: 'int',
            default: '0',
            comment: 'pk',
          }),
        ],
      }),
      createPlacement([['t1', {}]])
    );

    expect(findAction(actions, 'column.changeName')?.payload.value).toBe('id');
    expect(findAction(actions, 'column.changeDataType')?.payload.value).toBe(
      'int'
    );
    expect(findAction(actions, 'column.changeDefault')?.payload.value).toBe(
      '0'
    );
    expect(findAction(actions, 'column.changeComment')?.payload.value).toBe(
      'pk'
    );
  });

  it('emits the memo value alongside the add', () => {
    const { actions, memoIds } = toCreateEntityActions(
      createInput({ memos: [createClipboardMemo('m1')] }),
      createPlacement([['m1', { x: 5, y: 6, zIndex: 7 }]])
    );

    expect(toTypes(actions)).toEqual(['memo.add', 'memo.changeValue']);
    expect(actions[1].payload).toEqual({
      id: memoIds[0],
      value: 'm1-value',
    });
  });

  it('skips an entity the caller did not place, and its columns with it', () => {
    const { actions, tableIds, memoIds } = toCreateEntityActions(
      createInput({
        tables: [
          createClipboardTable('t1', { columnIds: ['c1'] }),
          createClipboardTable('t2', { columnIds: ['c2'] }),
        ],
        columns: [
          createClipboardColumn('c1', 't1'),
          createClipboardColumn('c2', 't2'),
        ],
        memos: [createClipboardMemo('m1')],
      }),
      createPlacement([['t1', {}]])
    );

    expect(tableIds).toHaveLength(1);
    expect(memoIds).toHaveLength(0);
    expect(filterActions(actions, 'table.add')).toHaveLength(1);
    expect(filterActions(actions, 'column.add')).toHaveLength(1);
    expect(filterActions(actions, 'memo.add')).toHaveLength(0);
  });

  it('does not mutate its input', () => {
    const input = createInput({
      tables: [createClipboardTable('t1', { columnIds: ['c1'] })],
      columns: [createClipboardColumn('c1', 't1')],
      memos: [createClipboardMemo('m1')],
      relationships: [
        createClipboardRelationship({
          start: { tableId: 't1', columnIds: ['c1'] },
          end: { tableId: 't1', columnIds: ['c1'] },
        }),
      ],
      indexes: [
        createClipboardIndex('t1', {
          indexColumns: [{ columnId: 'c1', orderType: OrderType.ASC }],
        }),
      ],
    });
    const snapshot = structuredClone(input);

    toCreateEntityActions(
      input,
      createPlacement([
        ['t1', {}],
        ['m1', {}],
      ])
    );

    expect(input).toEqual(snapshot);
  });
});

describe('toCreateEntityActions — relationships', () => {
  const twoTables = () =>
    createInput({
      tables: [
        createClipboardTable('t1', { columnIds: ['c1'] }),
        createClipboardTable('t2', { columnIds: ['c2'] }),
      ],
      columns: [
        createClipboardColumn('c1', 't1'),
        createClipboardColumn('c2', 't2'),
      ],
    });

  const bothPlaced = () =>
    createPlacement([
      ['t1', {}],
      ['t2', {}],
    ]);

  it('points the duplicated relationship at the new tables and the new columns', () => {
    const { actions, tableIds } = toCreateEntityActions(
      { ...twoTables(), relationships: [createClipboardRelationship()] },
      bothPlaced()
    );

    const [addC1, addC2] = filterActions(actions, 'column.add');
    const add = findAction(actions, 'relationship.add')!;

    expect(add.payload.start).toEqual({
      tableId: tableIds[0],
      columnIds: [addC1.payload.id],
    });
    expect(add.payload.end).toEqual({
      tableId: tableIds[1],
      columnIds: [addC2.payload.id],
    });

    const sourceIds = ['t1', 't2', 'c1', 'c2'];
    const referenced = [
      add.payload.start.tableId,
      add.payload.end.tableId,
      ...add.payload.start.columnIds,
      ...add.payload.end.columnIds,
    ];
    expect(referenced.some(id => sourceIds.includes(id))).toBe(false);
  });

  it('copies the relationshipType verbatim', () => {
    const { actions } = toCreateEntityActions(
      {
        ...twoTables(),
        relationships: [
          createClipboardRelationship({
            relationshipType: RelationshipType.OneN,
          }),
        ],
      },
      bothPlaced()
    );

    expect(
      findAction(actions, 'relationship.add')?.payload.relationshipType
    ).toBe(RelationshipType.OneN);
  });

  it('keeps a composite relationship paired and in order', () => {
    const { actions } = toCreateEntityActions(
      createInput({
        tables: [
          createClipboardTable('t1', { columnIds: ['c1', 'c2'] }),
          createClipboardTable('t2', { columnIds: ['c3', 'c4'] }),
        ],
        columns: [
          createClipboardColumn('c1', 't1'),
          createClipboardColumn('c2', 't1'),
          createClipboardColumn('c3', 't2'),
          createClipboardColumn('c4', 't2'),
        ],
        relationships: [
          createClipboardRelationship({
            start: { tableId: 't1', columnIds: ['c1', 'c2'] },
            end: { tableId: 't2', columnIds: ['c3', 'c4'] },
          }),
        ],
      }),
      bothPlaced()
    );

    const columnIds = filterActions(actions, 'column.add').map(
      ({ payload }) => payload.id
    );
    const add = findAction(actions, 'relationship.add')!;

    expect(add.payload.start.columnIds).toEqual([columnIds[0], columnIds[1]]);
    expect(add.payload.end.columnIds).toEqual([columnIds[2], columnIds[3]]);
  });

  it('skips a relationship with one end outside the copied tables', () => {
    const { actions } = toCreateEntityActions(
      createInput({
        tables: [createClipboardTable('t1', { columnIds: ['c1'] })],
        columns: [createClipboardColumn('c1', 't1')],
        relationships: [createClipboardRelationship()],
      }),
      createPlacement([['t1', {}]])
    );

    expect(filterActions(actions, 'relationship.add')).toHaveLength(0);
    expect(filterActions(actions, 'table.add')).toHaveLength(1);
    expect(filterActions(actions, 'column.add')).toHaveLength(1);
  });

  it('skips a relationship whose column did not resolve', () => {
    const { actions } = toCreateEntityActions(
      {
        ...twoTables(),
        relationships: [
          createClipboardRelationship({
            start: { tableId: 't1', columnIds: ['c-gone'] },
          }),
        ],
      },
      bothPlaced()
    );

    expect(filterActions(actions, 'relationship.add')).toHaveLength(0);
    expect(filterActions(actions, 'column.add')).toHaveLength(2);
  });

  it('duplicates a self referencing relationship onto the one new table', () => {
    const { actions, tableIds } = toCreateEntityActions(
      createInput({
        tables: [createClipboardTable('t1', { columnIds: ['c1', 'c2'] })],
        columns: [
          createClipboardColumn('c1', 't1'),
          createClipboardColumn('c2', 't1'),
        ],
        relationships: [
          createClipboardRelationship({
            start: { tableId: 't1', columnIds: ['c1'] },
            end: { tableId: 't1', columnIds: ['c2'] },
          }),
        ],
      }),
      createPlacement([['t1', {}]])
    );

    const columnIds = filterActions(actions, 'column.add').map(
      ({ payload }) => payload.id
    );
    const add = findAction(actions, 'relationship.add')!;

    expect(add.payload.start.tableId).toBe(tableIds[0]);
    expect(add.payload.end.tableId).toBe(tableIds[0]);
    expect(add.payload.start.columnIds).toEqual([columnIds[0]]);
    expect(add.payload.end.columnIds).toEqual([columnIds[1]]);
  });
});

describe('toCreateEntityActions — indexes', () => {
  const oneTable = (indexes: ClipboardIndex[]) =>
    createInput({
      tables: [createClipboardTable('t1', { columnIds: ['c1', 'c2'] })],
      columns: [
        createClipboardColumn('c1', 't1'),
        createClipboardColumn('c2', 't1'),
      ],
      indexes,
    });

  const placed = () => createPlacement([['t1', {}]]);

  it('emits the index actions in add, name, unique, column order', () => {
    const { actions } = toCreateEntityActions(
      oneTable([
        createClipboardIndex('t1', {
          indexColumns: [{ columnId: 'c1', orderType: OrderType.ASC }],
        }),
      ]),
      placed()
    );

    expect(toTypes(actions).filter(type => type.startsWith('index'))).toEqual([
      'index.add',
      'index.changeName',
      'index.changeUnique',
      'indexColumn.add',
      'indexColumn.changeOrderType',
    ]);
  });

  it('emits addIndexAction before any addIndexColumnAction for the same index', () => {
    const { actions } = toCreateEntityActions(
      oneTable([
        createClipboardIndex('t1', {
          indexColumns: [{ columnId: 'c1', orderType: OrderType.ASC }],
        }),
      ]),
      placed()
    );

    // An index reached only through getOrCreate never enters doc.indexIds, so
    // it renders nowhere, serialises nowhere and reaches no generator.
    const types = toTypes(actions);
    expect(types.indexOf('index.add')).toBeLessThan(
      types.indexOf('indexColumn.add')
    );
  });

  it('points the index at the new table and the new columns', () => {
    const { actions, tableIds } = toCreateEntityActions(
      oneTable([
        createClipboardIndex('t1', {
          indexColumns: [{ columnId: 'c1', orderType: OrderType.ASC }],
        }),
      ]),
      placed()
    );

    const columnIds = filterActions(actions, 'column.add').map(
      ({ payload }) => payload.id
    );
    const addIndex = findAction(actions, 'index.add')!;
    const addIndexColumn = findAction(actions, 'indexColumn.add')!;

    expect(addIndex.payload.tableId).toBe(tableIds[0]);
    expect(addIndexColumn.payload.tableId).toBe(tableIds[0]);
    expect(addIndexColumn.payload.indexId).toBe(addIndex.payload.id);
    expect(addIndexColumn.payload.columnId).toBe(columnIds[0]);

    // The change actions carry the same seed, because getOrCreate in their
    // reducers materialises the index from whichever of the two a replica
    // applies first.
    expect(findAction(actions, 'index.changeName')!.payload.tableId).toBe(
      tableIds[0]
    );
    expect(findAction(actions, 'index.changeUnique')!.payload.tableId).toBe(
      tableIds[0]
    );
  });

  it('keeps the index columns in the payload order', () => {
    const { actions } = toCreateEntityActions(
      oneTable([
        createClipboardIndex('t1', {
          indexColumns: [
            { columnId: 'c2', orderType: OrderType.ASC },
            { columnId: 'c1', orderType: OrderType.ASC },
          ],
        }),
      ]),
      placed()
    );

    const columnIds = filterActions(actions, 'column.add').map(
      ({ payload }) => payload.id
    );

    expect(
      filterActions(actions, 'indexColumn.add').map(
        ({ payload }) => payload.columnId
      )
    ).toEqual([columnIds[1], columnIds[0]]);
  });

  it('copies the orderType of each index column', () => {
    const { actions } = toCreateEntityActions(
      oneTable([
        createClipboardIndex('t1', {
          indexColumns: [
            { columnId: 'c1', orderType: OrderType.ASC },
            { columnId: 'c2', orderType: OrderType.DESC },
          ],
        }),
      ]),
      placed()
    );

    const columnIds = filterActions(actions, 'column.add').map(
      ({ payload }) => payload.id
    );
    const changes = filterActions(actions, 'indexColumn.changeOrderType');

    expect(changes.map(({ payload }) => payload.value)).toEqual([
      OrderType.ASC,
      OrderType.DESC,
    ]);
    expect(changes.map(({ payload }) => payload.columnId)).toEqual(columnIds);
    expect(changes[0].payload).not.toHaveProperty('tableId');
  });

  it('emits changeIndexName and changeIndexUnique even at their defaults', () => {
    const { actions } = toCreateEntityActions(
      oneTable([createClipboardIndex('t1', { name: '', unique: false })]),
      placed()
    );

    expect(findAction(actions, 'index.changeName')?.payload.value).toBe('');
    expect(findAction(actions, 'index.changeUnique')?.payload.value).toBe(
      false
    );
  });

  it('drops the whole index when one of its columns did not resolve', () => {
    const { actions } = toCreateEntityActions(
      oneTable([
        createClipboardIndex('t1', {
          indexColumns: [
            { columnId: 'c1', orderType: OrderType.ASC },
            { columnId: 'c-gone', orderType: OrderType.ASC },
          ],
        }),
      ]),
      placed()
    );

    expect(filterActions(actions, 'index.add')).toHaveLength(0);
    expect(filterActions(actions, 'indexColumn.add')).toHaveLength(0);
  });

  it('copies an index that has no index columns', () => {
    const { actions } = toCreateEntityActions(
      oneTable([createClipboardIndex('t1', { name: 'empty', unique: true })]),
      placed()
    );

    expect(filterActions(actions, 'index.add')).toHaveLength(1);
    expect(findAction(actions, 'index.changeName')?.payload.value).toBe(
      'empty'
    );
    expect(findAction(actions, 'index.changeUnique')?.payload.value).toBe(true);
    expect(filterActions(actions, 'indexColumn.add')).toHaveLength(0);
  });
});

describe('toCreateEntityActions — the graph as a whole', () => {
  const graphInput = () =>
    createInput({
      tables: [
        createClipboardTable('t1', { columnIds: ['c1'] }),
        createClipboardTable('t2', { columnIds: ['c2'] }),
      ],
      columns: [
        createClipboardColumn('c1', 't1'),
        createClipboardColumn('c2', 't2'),
      ],
      memos: [createClipboardMemo('m1')],
      relationships: [createClipboardRelationship()],
      indexes: [
        createClipboardIndex('t1', {
          indexColumns: [{ columnId: 'c1', orderType: OrderType.DESC }],
        }),
      ],
    });

  it('emits no graph action for an entity the caller did not place', () => {
    const { actions } = toCreateEntityActions(
      graphInput(),
      createPlacement([['m1', {}]])
    );

    expect(filterActions(actions, 'relationship.add')).toHaveLength(0);
    expect(filterActions(actions, 'index.add')).toHaveLength(0);
  });

  it('emits the graph after the tables and columns it points at, and before the memos', () => {
    const { actions } = toCreateEntityActions(
      graphInput(),
      createPlacement([
        ['t1', {}],
        ['t2', {}],
        ['m1', {}],
      ])
    );

    // The undo of a batch replays its removes in forward order, so a graph
    // action ahead of the table it points at would remove an entity that is
    // not there yet.
    const types = toTypes(actions);
    const lastColumn = types.lastIndexOf('column.add');
    const firstMemo = types.indexOf('memo.add');

    for (const type of ['relationship.add', 'index.add', 'indexColumn.add']) {
      expect(types.indexOf(type)).toBeGreaterThan(lastColumn);
      expect(types.indexOf(type)).toBeLessThan(firstMemo);
    }
  });

  it('mints a fresh id for every relationship, index and index column', () => {
    const { actions } = toCreateEntityActions(
      graphInput(),
      createPlacement([
        ['t1', {}],
        ['t2', {}],
        ['m1', {}],
      ])
    );

    const ids = [
      ...filterActions(actions, 'relationship.add'),
      ...filterActions(actions, 'index.add'),
      ...filterActions(actions, 'indexColumn.add'),
    ].map(({ payload }) => payload.id);
    const sourceIds = ['t1', 't2', 'c1', 'c2', 'm1'];

    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.some(id => sourceIds.includes(id))).toBe(false);
  });

  it('emits no relationship or index action for an input carrying none', () => {
    const { actions } = toCreateEntityActions(
      createInput({
        tables: [createClipboardTable('t1', { columnIds: ['c1'] })],
        columns: [createClipboardColumn('c1', 't1')],
      }),
      createPlacement([['t1', {}]])
    );

    const types = toTypes(actions);

    expect(types.filter(type => type.startsWith('relationship'))).toEqual([]);
    expect(types.filter(type => type.startsWith('index'))).toEqual([]);
  });
});
