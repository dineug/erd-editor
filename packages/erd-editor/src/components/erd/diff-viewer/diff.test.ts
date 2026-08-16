import { describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__/index';
import {
  Diff,
  DiffMap,
  diffState,
  getDiffStyle,
  getNameToTableMap,
} from '@/components/erd/diff-viewer/diff';
import {
  addTableAction,
  changeTableCommentAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import { RootState } from '@/engine/state';

type ColumnSeed = {
  id: string;
  name: string;
  comment?: string;
  dataType?: string;
  default?: string;
  primaryKey?: boolean;
  notNull?: boolean;
};

type TableSeed = {
  id: string;
  name: string;
  comment?: string;
  columns?: ColumnSeed[];
};

function createState(tables: TableSeed[]): RootState {
  const app = createTestAppContext();

  tables.forEach(table => {
    app.store.dispatchSync(
      addTableAction({ id: table.id, ui: { x: 0, y: 0, zIndex: 1 } })
    );
    app.store.dispatchSync(
      changeTableNameAction({ id: table.id, value: table.name })
    );
    if (table.comment !== undefined) {
      app.store.dispatchSync(
        changeTableCommentAction({ id: table.id, value: table.comment })
      );
    }

    (table.columns ?? []).forEach(column => {
      app.store.dispatchSync(
        addColumnAction({ tableId: table.id, id: column.id })
      );
      app.store.dispatchSync(
        changeColumnNameAction({
          tableId: table.id,
          id: column.id,
          value: column.name,
        })
      );
      if (column.comment !== undefined) {
        app.store.dispatchSync(
          changeColumnCommentAction({
            tableId: table.id,
            id: column.id,
            value: column.comment,
          })
        );
      }
      if (column.dataType !== undefined) {
        app.store.dispatchSync(
          changeColumnDataTypeAction({
            tableId: table.id,
            id: column.id,
            value: column.dataType,
          })
        );
      }
      if (column.default !== undefined) {
        app.store.dispatchSync(
          changeColumnDefaultAction({
            tableId: table.id,
            id: column.id,
            value: column.default,
          })
        );
      }
      if (column.primaryKey !== undefined) {
        app.store.dispatchSync(
          changeColumnPrimaryKeyAction({
            tableId: table.id,
            id: column.id,
            value: column.primaryKey,
          })
        );
      }
      if (column.notNull !== undefined) {
        app.store.dispatchSync(
          changeColumnNotNullAction({
            tableId: table.id,
            id: column.id,
            value: column.notNull,
          })
        );
      }
    });
  });

  return app.store.state;
}

const pathsOf = (diffMap: DiffMap, id: string) =>
  Array.from(diffMap.get(id)?.[1].keys() ?? []);

describe('Diff constants', () => {
  it('exposes disjoint single bit flags', () => {
    expect(Diff.insert).toBe(1);
    expect(Diff.delete).toBe(2);
    expect(Diff.insert & Diff.delete).toBe(0);
  });
});

describe('getNameToTableMap', () => {
  it('indexes tables by name and their columns by column name', () => {
    const state = createState([
      {
        id: 't1',
        name: 'users',
        columns: [
          { id: 'c1', name: 'id' },
          { id: 'c2', name: 'email' },
        ],
      },
      { id: 't2', name: 'posts' },
    ]);

    const map = getNameToTableMap(state);

    expect(Array.from(map.keys()).sort()).toEqual(['posts', 'users']);
    expect(map.get('users')?.table.id).toBe('t1');
    expect(Array.from(map.get('users')!.nameToColumnMap.keys()).sort()).toEqual(
      ['email', 'id']
    );
    expect(map.get('users')?.nameToColumnMap.get('email')?.id).toBe('c2');
    expect(map.get('posts')?.nameToColumnMap.size).toBe(0);
  });

  it('keeps only the last table when two tables share a name', () => {
    const state = createState([
      { id: 't1', name: 'dup', columns: [{ id: 'c1', name: 'a' }] },
      { id: 't2', name: 'dup', columns: [{ id: 'c2', name: 'b' }] },
    ]);

    const map = getNameToTableMap(state);

    expect(map.size).toBe(1);
    expect(map.get('dup')?.table.id).toBe('t2');
  });

  it('returns an empty map for an empty document', () => {
    expect(getNameToTableMap(createState([])).size).toBe(0);
  });
});

describe('diffState', () => {
  it('reports nothing when both documents are identical', () => {
    const seed: TableSeed[] = [
      {
        id: 't1',
        name: 'users',
        comment: 'people',
        columns: [{ id: 'c1', name: 'id', dataType: 'int' }],
      },
    ];

    const [prevDiffMap, diffMap] = diffState(
      createState(seed),
      createState(seed.map(t => ({ ...t, id: 'other-t1' })))
    );

    expect(prevDiffMap.size).toBe(0);
    expect(diffMap.size).toBe(0);
  });

  it('marks an added table as insert only', () => {
    const [prevDiffMap, diffMap] = diffState(
      createState([]),
      createState([{ id: 't1', name: 'users', comment: 'hi' }])
    );

    expect(prevDiffMap.size).toBe(0);
    expect(diffMap.get('t1')?.[0]).toBe('tableEntities');
    expect(pathsOf(diffMap, 't1').sort()).toEqual([
      'tableComment',
      'tableName',
    ]);
    expect(diffMap.get('t1')?.[1].get('tableName')).toBe(Diff.insert);
  });

  it('marks a removed table as delete only', () => {
    const [prevDiffMap, diffMap] = diffState(
      createState([{ id: 't1', name: 'users', comment: 'hi' }]),
      createState([])
    );

    expect(diffMap.size).toBe(0);
    expect(prevDiffMap.get('t1')?.[1].get('tableName')).toBe(Diff.delete);
    expect(prevDiffMap.get('t1')?.[1].get('tableComment')).toBe(Diff.delete);
  });

  it('also flags the comment of a renamed table because the lookup misses', () => {
    const [prevDiffMap, diffMap] = diffState(
      createState([{ id: 't1', name: 'users' }]),
      createState([{ id: 't2', name: 'members' }])
    );

    // both comments are '' but the name lookup fails, so `undefined` is
    // compared against '' and the comment is reported as changed too.
    expect(pathsOf(prevDiffMap, 't1').sort()).toEqual([
      'tableComment',
      'tableName',
    ]);
    expect(pathsOf(diffMap, 't2').sort()).toEqual([
      'tableComment',
      'tableName',
    ]);
  });

  it('flags only the changed column paths for a matched column', () => {
    const prevState = createState([
      {
        id: 't1',
        name: 'users',
        columns: [
          { id: 'c1', name: 'id', dataType: 'int', comment: 'pk', default: '' },
        ],
      },
    ]);
    const state = createState([
      {
        id: 't2',
        name: 'users',
        columns: [
          {
            id: 'c2',
            name: 'id',
            dataType: 'bigint',
            comment: 'pk',
            default: '',
          },
        ],
      },
    ]);

    const [prevDiffMap, diffMap] = diffState(prevState, state);

    expect(prevDiffMap.has('t1')).toBe(false);
    expect(diffMap.has('t2')).toBe(false);
    expect(pathsOf(prevDiffMap, 'c1')).toEqual(['columnDataType']);
    expect(prevDiffMap.get('c1')?.[0]).toBe('tableColumnEntities');
    expect(pathsOf(diffMap, 'c2')).toEqual(['columnDataType']);
    expect(diffMap.get('c2')?.[1].get('columnDataType')).toBe(Diff.insert);
  });

  it('flags every path of a column whose name has no counterpart', () => {
    const [prevDiffMap, diffMap] = diffState(
      createState([{ id: 't1', name: 'users' }]),
      createState([
        { id: 't2', name: 'users', columns: [{ id: 'c2', name: 'email' }] },
      ])
    );

    expect(prevDiffMap.size).toBe(0);
    expect(pathsOf(diffMap, 'c2').sort()).toEqual([
      'columnAutoIncrement',
      'columnComment',
      'columnDataType',
      'columnDefault',
      'columnName',
      'columnNotNull',
      'columnPrimaryKey',
      'columnUnique',
    ]);
    // no counterpart -> the raw diff flag is used for every option path
    expect(diffMap.get('c2')?.[1].get('columnPrimaryKey')).toBe(Diff.insert);
    expect(diffMap.get('c2')?.[1].get('columnDefault')).toBe(Diff.insert);
  });

  it('flags only the option paths that actually toggled', () => {
    const prevState = createState([
      {
        id: 't1',
        name: 'users',
        columns: [{ id: 'c1', name: 'id', primaryKey: true, notNull: false }],
      },
    ]);
    const state = createState([
      {
        id: 't2',
        name: 'users',
        columns: [{ id: 'c2', name: 'id', primaryKey: true, notNull: true }],
      },
    ]);

    const [prevDiffMap, diffMap] = diffState(prevState, state);

    expect(pathsOf(prevDiffMap, 'c1')).toEqual(['columnNotNull']);
    expect(prevDiffMap.get('c1')?.[1].get('columnNotNull')).toBe(Diff.delete);
    expect(pathsOf(diffMap, 'c2')).toEqual(['columnNotNull']);
    expect(diffMap.get('c2')?.[1].get('columnNotNull')).toBe(Diff.insert);
  });

  it('reports a table rename as a delete on one side and an insert on the other', () => {
    const [prevDiffMap, diffMap] = diffState(
      createState([
        { id: 't1', name: 'users', columns: [{ id: 'c1', name: 'id' }] },
      ]),
      createState([
        { id: 't2', name: 'members', columns: [{ id: 'c2', name: 'id' }] },
      ])
    );

    expect(prevDiffMap.get('t1')?.[1].get('tableName')).toBe(Diff.delete);
    expect(diffMap.get('t2')?.[1].get('tableName')).toBe(Diff.insert);
    // the columns lose their counterpart together with the table
    expect(prevDiffMap.has('c1')).toBe(true);
    expect(diffMap.has('c2')).toBe(true);
  });
});

describe('getDiffStyle', () => {
  it('returns an empty style element for an empty diff map', () => {
    const style = getDiffStyle(Diff.insert, new Map());

    expect(style.tagName).toBe('STYLE');
    expect(style.textContent).toBe('');
  });

  it('scopes insert rules under .diff-viewer-insert with the insert background', () => {
    const diffMap: DiffMap = new Map([
      ['c1', ['tableColumnEntities', new Map([['columnName', Diff.insert]])]],
    ]);

    const css = getDiffStyle(Diff.insert, diffMap).textContent ?? '';

    expect(css).toContain('.diff-viewer-insert [data-id="c1"]');
    expect(css).toContain('[data-type="columnName"]');
    expect(css).toContain('background-color: var(--diff-insert-background)');
    expect(css).not.toContain('--diff-delete-background');
  });

  it('scopes delete rules under .diff-viewer-delete with the delete background', () => {
    const diffMap: DiffMap = new Map([
      ['t1', ['tableEntities', new Map([['tableName', Diff.delete]])]],
    ]);

    const css = getDiffStyle(Diff.delete, diffMap).textContent ?? '';

    expect(css).toContain('.diff-viewer-delete [data-id="t1"]');
    expect(css).toContain('background-color: var(--diff-delete-background)');
  });

  it('falls back to the delete root class for any non insert diff', () => {
    const diffMap: DiffMap = new Map([
      ['t1', ['tableEntities', new Map([['tableName', Diff.delete]])]],
    ]);

    expect(getDiffStyle(0, diffMap).textContent).toContain(
      '.diff-viewer-delete'
    );
  });

  it('emits nothing for a path whose diff value is zero', () => {
    const diffMap: DiffMap = new Map([
      [
        't1',
        [
          'tableEntities',
          new Map([
            ['tableName', 0],
            ['tableComment', Diff.insert],
          ]),
        ],
      ],
    ]);

    const css = getDiffStyle(Diff.insert, diffMap).textContent ?? '';

    expect(css).not.toContain('[data-type="tableName"]');
    expect(css).toContain('[data-type="tableComment"]');
  });

  it('emits one rule per path across several entities', () => {
    const diffMap: DiffMap = new Map<string, [string, Map<string, number>]>([
      [
        't1',
        [
          'tableEntities',
          new Map([
            ['tableName', Diff.insert],
            ['tableComment', Diff.insert],
          ]),
        ],
      ],
      ['c1', ['tableColumnEntities', new Map([['columnName', Diff.insert]])]],
    ]);

    const css = getDiffStyle(Diff.insert, diffMap).textContent ?? '';

    expect(css.match(/background-color:/g)?.length).toBe(3);
    expect(css).toContain('[data-id="t1"]');
    expect(css).toContain('[data-id="c1"]');
  });

  it('renders a delete background for a delete flagged path inside an insert sheet', () => {
    const diffMap: DiffMap = new Map([
      ['t1', ['tableEntities', new Map([['tableName', Diff.delete]])]],
    ]);

    const css = getDiffStyle(Diff.insert, diffMap).textContent ?? '';

    // the root class follows the sheet, the colour follows the per path flag
    expect(css).toContain('.diff-viewer-insert');
    expect(css).toContain('background-color: var(--diff-delete-background)');
  });
});
