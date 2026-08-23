import { AnyAction } from '@dineug/r-html';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnOption } from '@/constants/schema';
import { pushStreamHistoryMap } from '@/engine/history.actions';
import {
  CreateEntityInput,
  toCreateEntityActions,
} from '@/engine/modules/editor/utils/duplicate';
import { ActionType as MemoActionType } from '@/engine/modules/memo/actions';
import { ActionType as TableActionType } from '@/engine/modules/table/actions';
import {
  ClipboardColumn,
  ClipboardMemo,
  ClipboardTable,
  PlacementPoint,
} from '@/utils/table-clipboard';

/**
 * The complete set of action types a create batch is allowed to emit (AC-35).
 *
 * Restated here as literals on purpose: the point of the assertion is that it
 * breaks when the builder starts emitting something new, so it must not be
 * derived from the builder's own imports.
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
  'memo.add',
  'memo.changeValue',
  'table.add',
  'table.changeComment',
  'table.changeName',
];

/**
 * The three stream actions split the batch into a second history command, and
 * the two `changeZIndex` actions are in no classification list at all.
 */
const FORBIDDEN_ACTION_TYPES = [
  'table.changeColor',
  'memo.changeColor',
  'memo.resize',
  'table.changeZIndex',
  'memo.changeZIndex',
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

const createInput = (
  overrides: Partial<CreateEntityInput> = {}
): CreateEntityInput => ({
  tables: [],
  columns: [],
  memos: [],
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

/** A colourful table and memo — the exact input that used to split the batch. */
const createColourfulBatch = () => {
  const input = createInput({
    tables: [
      createClipboardTable('t1', {
        columnIds: ['c1'],
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

    // A stream action would be regrouped by `groupByStreamActions` and buffered
    // behind `debounceTime(200)`, producing a second history command ~200ms
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
    ]);
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

    // `changeTableName`/`changeTableComment` recompute them with
    // `textInRange(toWidth(value))`, so sending them would be sending stale
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
