import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  ColumnOption,
  Database,
  NameCase,
  OrderType,
  RelationshipType,
} from '@/constants/schema';
import { RootState } from '@/engine/state';
import {
  Column,
  DeepPartial,
  Index,
  IndexColumn,
  Relationship,
  Table,
} from '@/internal-types';
import { createIndex } from '@/utils/collection/index.entity';
import { createIndexColumn } from '@/utils/collection/indexColumn.entity';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createCode, formatTable } from '@/utils/generator-code/aml';

type StateInput = {
  tables?: Table[];
  columns?: Column[];
  relationships?: Relationship[];
  indexes?: Index[];
  indexColumns?: IndexColumn[];
  settings?: Partial<RootState['settings']>;
};

function createState({
  tables = [],
  columns = [],
  relationships = [],
  indexes = [],
  indexColumns = [],
  settings,
}: StateInput): RootState {
  const state = schemaV3Parser({}) as unknown as RootState;
  state.doc.tableIds = tables.map(table => table.id);
  state.doc.relationshipIds = relationships.map(
    relationship => relationship.id
  );
  state.doc.indexIds = indexes.map(index => index.id);
  tables.forEach(table => {
    state.collections.tableEntities[table.id] = table;
  });
  columns.forEach(column => {
    state.collections.tableColumnEntities[column.id] = column;
  });
  relationships.forEach(relationship => {
    state.collections.relationshipEntities[relationship.id] = relationship;
  });
  indexes.forEach(index => {
    state.collections.indexEntities[index.id] = index;
  });
  indexColumns.forEach(indexColumn => {
    state.collections.indexColumnEntities[indexColumn.id] = indexColumn;
  });
  Object.assign(state.settings, settings);
  return state;
}

function createSingleColumnState(
  column: Partial<Column>,
  table: Partial<Table> = {}
): RootState {
  return createState({
    tables: [
      createTable({ id: 't1', name: 'user', columnIds: ['c1'], ...table }),
    ],
    columns: [
      createColumn({
        id: 'c1',
        tableId: 't1',
        name: 'id',
        dataType: 'int',
        ...column,
      }),
    ],
  });
}

function attributeLine(state: RootState): string {
  return createCode(state).split('\n')[2];
}

function relLines(state: RootState): string[] {
  return createCode(state)
    .split('\n')
    .filter(line => line.startsWith('rel '));
}

function renderTable(state: RootState, table: Table): string[] {
  const buffer: string[] = [];
  formatTable(state, { buffer, table });
  return buffer;
}

describe('generator-code/aml', () => {
  describe('createCode', () => {
    it('returns an empty string when the document has no tables', () => {
      expect(createCode(createState({}))).toBe('');
    });

    it('renders a table as an entity with an indented attribute', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'user', columnIds: ['c1'] })],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'created_at',
            dataType: 'INT',
            options: ColumnOption.notNull,
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'user',
        '  created_at INT',
        '',
      ]);
    });

    it('orders tables by name ascending', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'post', columnIds: ['c1'] }),
          createTable({ id: 't2', name: 'comment', columnIds: ['c2'] }),
          createTable({ id: 't3', name: 'Album', columnIds: ['c3'] }),
        ],
        columns: [
          createColumn({ id: 'c1', tableId: 't1', name: 'a', dataType: 'int' }),
          createColumn({ id: 'c2', tableId: 't2', name: 'b', dataType: 'int' }),
          createColumn({ id: 'c3', tableId: 't3', name: 'c', dataType: 'int' }),
        ],
      });

      expect(
        createCode(state)
          .split('\n')
          .filter(line => line !== '' && !line.startsWith('  '))
      ).toEqual(['Album', 'comment', 'post']);
    });

    it('keeps an entity that has no attribute, which AML can express', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'social_accounts' })],
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'social_accounts',
        '',
      ]);
    });

    it('keeps an attribute with no type, which AML can express', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'admins', columnIds: ['c1', 'c2'] }),
        ],
        columns: [
          createColumn({ id: 'c1', tableId: 't1', name: 'id', dataType: '' }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'email',
            dataType: 'varchar',
            options: ColumnOption.notNull,
          }),
        ],
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'admins',
        '  id nullable',
        '  email varchar',
        '',
      ]);
    });
  });

  describe('attribute constraints', () => {
    it('emits nullable when the column is not marked not null', () => {
      expect(attributeLine(createSingleColumnState({}))).toBe(
        '  id int nullable'
      );
    });

    it('emits nothing for not null, which is the AML default', () => {
      expect(
        attributeLine(
          createSingleColumnState({ options: ColumnOption.notNull })
        )
      ).toBe('  id int');
    });

    it('emits a primary key as pk', () => {
      expect(
        attributeLine(
          createSingleColumnState({
            options: ColumnOption.primaryKey | ColumnOption.notNull,
          })
        )
      ).toBe('  id int pk');
    });

    it('emits a two-column primary key as a bare pk on each attribute', () => {
      const state = createState({
        tables: [
          createTable({
            id: 't1',
            name: 'membership',
            columnIds: ['c1', 'c2'],
          }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'user_id',
            dataType: 'int',
            options: ColumnOption.primaryKey | ColumnOption.notNull,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'group_id',
            dataType: 'int',
            options: ColumnOption.primaryKey | ColumnOption.notNull,
          }),
        ],
      });

      expect(createCode(state).split('\n').slice(2, 4)).toEqual([
        '  user_id int pk',
        '  group_id int pk',
      ]);
    });

    it('emits a unique column as a bare unique constraint', () => {
      expect(
        attributeLine(
          createSingleColumnState({
            options: ColumnOption.unique | ColumnOption.notNull,
          })
        )
      ).toBe('  id int unique');
    });

    it('emits auto increment as a property block', () => {
      expect(
        attributeLine(
          createSingleColumnState({
            options: ColumnOption.autoIncrement | ColumnOption.notNull,
          })
        )
      ).toBe('  id int {autoIncrement}');
    });

    it('emits every part of an attribute in the AML order', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'user', columnIds: ['c1'] })],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
            default: '1',
            comment: 'surrogate key',
            options:
              ColumnOption.primaryKey |
              ColumnOption.autoIncrement |
              ColumnOption.unique,
          }),
        ],
      });

      expect(attributeLine(state)).toBe(
        '  id int=1 nullable pk unique {autoIncrement} | surrogate key'
      );
    });
  });

  describe('data types', () => {
    it('leaves a bare identifier type unquoted', () => {
      expect(
        attributeLine(createSingleColumnState({ dataType: 'bigint' }))
      ).toBe('  id bigint nullable');
    });

    it('quotes an argument list, which the bare form would read as enum members', () => {
      expect(
        attributeLine(createSingleColumnState({ dataType: 'varchar(100)' }))
      ).toBe('  id "varchar(100)" nullable');
    });

    it('quotes a multi-argument list', () => {
      expect(
        attributeLine(createSingleColumnState({ dataType: 'decimal(10, 2)' }))
      ).toBe('  id "decimal(10, 2)" nullable');
    });

    it('quotes a multi-word type name', () => {
      expect(
        attributeLine(
          createSingleColumnState({ dataType: 'timestamp with time zone' })
        )
      ).toBe('  id "timestamp with time zone" nullable');
    });

    it('quotes an array type', () => {
      expect(
        attributeLine(createSingleColumnState({ dataType: 'varchar[]' }))
      ).toBe('  id "varchar[]" nullable');
    });

    it('quotes a type spelled like an AML keyword', () => {
      expect(attributeLine(createSingleColumnState({ dataType: 'type' }))).toBe(
        '  id "type" nullable'
      );
    });

    it('trims the surrounding whitespace of a type', () => {
      expect(
        attributeLine(createSingleColumnState({ dataType: '  int  ' }))
      ).toBe('  id int nullable');
    });

    it('emits no type at all for a blank one', () => {
      expect(attributeLine(createSingleColumnState({ dataType: '   ' }))).toBe(
        '  id nullable'
      );
    });
  });

  describe('defaults', () => {
    const defaultOf = (value: string) =>
      attributeLine(createSingleColumnState({ default: value }));

    it('emits an integer literal bare', () => {
      expect(defaultOf('0')).toBe('  id int=0 nullable');
    });

    it('emits a negative literal bare', () => {
      expect(defaultOf('-1')).toBe('  id int=-1 nullable');
    });

    it('emits a decimal literal bare', () => {
      expect(defaultOf('1.5')).toBe('  id int=1.5 nullable');
    });

    it('emits a signed-positive literal as an expression, which AML has no literal for', () => {
      expect(defaultOf('+1')).toBe('  id int=`+1` nullable');
    });

    it('emits true, false and null bare and lowercased', () => {
      expect(defaultOf('TRUE')).toBe('  id int=true nullable');
      expect(defaultOf('False')).toBe('  id int=false nullable');
      expect(defaultOf('NULL')).toBe('  id int=null nullable');
    });

    it('rewrites a SQL string literal into a bare AML identifier', () => {
      expect(defaultOf("'pending'")).toBe('  id int=pending nullable');
    });

    it('quotes a SQL string literal that no bare identifier can spell', () => {
      expect(defaultOf("'not set'")).toBe('  id int="not set" nullable');
      expect(defaultOf("'0'")).toBe('  id int="0" nullable');
    });

    it('unescapes a doubled quote inside a SQL string literal', () => {
      expect(defaultOf("'it''s'")).toBe('  id int="it\'s" nullable');
    });

    it('emits anything else as a backtick expression', () => {
      expect(defaultOf('now()')).toBe('  id int=`now()` nullable');
    });

    it('falls back to an identifier when the value holds a backtick, which no expression can escape', () => {
      expect(defaultOf('`now`()')).toBe('  id int="`now`()" nullable');
    });

    it('omits a blank default', () => {
      expect(defaultOf('   ')).toBe('  id int nullable');
    });

    it('drops the default of a typeless attribute, which has no place to put one', () => {
      expect(
        attributeLine(
          createSingleColumnState({ dataType: '', default: 'now()' })
        )
      ).toBe('  id nullable');
    });
  });

  describe('identifier quoting', () => {
    it('leaves a bare identifier unquoted', () => {
      expect(
        attributeLine(createSingleColumnState({ name: 'created_at' }))
      ).toBe('  created_at int nullable');
    });

    it('quotes a name spelled like an AML keyword, whatever its case', () => {
      const state = createSingleColumnState(
        { name: 'index' },
        { name: 'Type' }
      );

      expect(createCode(state).split('\n').slice(1, 3)).toEqual([
        '"Type"',
        '  "index" int nullable',
      ]);
    });

    it('quotes the AMLv1 keyword fk, which the legacy dialect still reads', () => {
      expect(attributeLine(createSingleColumnState({ name: 'fk' }))).toBe(
        '  "fk" int nullable'
      );
    });

    it('quotes a name holding a space', () => {
      expect(attributeLine(createSingleColumnState({ name: 'added by' }))).toBe(
        '  "added by" int nullable'
      );
    });

    it('quotes a name opening with a digit', () => {
      expect(attributeLine(createSingleColumnState({ name: '1st' }))).toBe(
        '  "1st" int nullable'
      );
    });

    it('quotes a name holding a hash, which would otherwise open a comment', () => {
      expect(attributeLine(createSingleColumnState({ name: 'tag#1' }))).toBe(
        '  "tag#1" int nullable'
      );
    });

    it('quotes a non-ASCII name', () => {
      const state = createSingleColumnState(
        { name: '이름' },
        { name: '사용자' }
      );

      expect(createCode(state).split('\n').slice(1, 3)).toEqual([
        '"사용자"',
        '  "이름" int nullable',
      ]);
    });

    it('quotes an empty name', () => {
      const state = createSingleColumnState({ name: '' }, { name: '' });

      expect(createCode(state).split('\n').slice(1, 3)).toEqual([
        '""',
        '  "" int nullable',
      ]);
    });

    it('escapes a double quote in a name', () => {
      const state = createSingleColumnState(
        { name: 'we"ird' },
        { name: 'ta"ble' }
      );

      expect(createCode(state).split('\n').slice(1, 3)).toEqual([
        '"ta\\"ble"',
        '  "we\\"ird" int nullable',
      ]);
    });

    it('escapes a backslash in a name, which the quoted form cannot carry raw', () => {
      expect(attributeLine(createSingleColumnState({ name: 'a\\b' }))).toBe(
        '  "a\\\\b" int nullable'
      );
    });

    it('folds every line terminator in a name onto the newline escape', () => {
      expect(
        attributeLine(createSingleColumnState({ name: 'a\nb\rc\r\nd' }))
      ).toBe('  "a\\nb\\nc\\nd" int nullable');
    });
  });

  describe('docs', () => {
    it('renders a table comment as a doc on the entity line', () => {
      const state = createSingleColumnState({}, { comment: 'Store users' });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'user | Store users',
        '  id int nullable',
        '',
      ]);
    });

    it('renders a column comment as a doc on the attribute line', () => {
      expect(
        attributeLine(createSingleColumnState({ comment: 'surrogate key' }))
      ).toBe('  id int nullable | surrogate key');
    });

    it('omits a blank comment', () => {
      const state = createSingleColumnState(
        { comment: '  ' },
        { comment: ' ' }
      );

      expect(createCode(state).split('\n')).toEqual([
        '',
        'user',
        '  id int nullable',
        '',
      ]);
    });

    it('trims a comment, because the parser trims what it reads back', () => {
      expect(
        attributeLine(createSingleColumnState({ comment: '  spaced  ' }))
      ).toBe('  id int nullable | spaced');
    });

    it('escapes a hash so it stays inside the doc', () => {
      expect(
        attributeLine(createSingleColumnState({ comment: 'issue #42' }))
      ).toBe('  id int nullable | issue \\#42');
    });

    it('renders a multi-line table comment as a triple-pipe block', () => {
      const state = createSingleColumnState({}, { comment: 'line1\nline2' });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'user |||',
        '  line1',
        '  line2',
        '|||',
        '  id int nullable',
        '',
      ]);
    });

    it('indents a multi-line column comment under its attribute', () => {
      const state = createSingleColumnState({ comment: 'line1\nline2' });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'user',
        '  id int nullable |||',
        '    line1',
        '    line2',
        '  |||',
        '',
      ]);
    });

    it('splits a carriage return like any other line terminator', () => {
      const state = createSingleColumnState({
        comment: 'line1\r\nline2\rline3',
      });

      expect(createCode(state).split('\n').slice(2, 7)).toEqual([
        '  id int nullable |||',
        '    line1',
        '    line2',
        '    line3',
        '  |||',
      ]);
    });

    it('folds a comment holding a triple pipe onto one line, which cannot close the block early', () => {
      expect(
        attributeLine(createSingleColumnState({ comment: 'a\nb ||| c' }))
      ).toBe('  id int nullable | a b ||| c');
    });
  });

  describe('duplicate names', () => {
    it('renames the second table of a duplicated name', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'user', columnIds: ['c1'] }),
          createTable({ id: 't2', name: 'user', columnIds: ['c2'] }),
        ],
        columns: [
          createColumn({ id: 'c1', tableId: 't1', name: 'a', dataType: 'int' }),
          createColumn({ id: 'c2', tableId: 't2', name: 'b', dataType: 'int' }),
        ],
      });

      expect(
        createCode(state)
          .split('\n')
          .filter(line => line !== '' && !line.startsWith('  '))
      ).toEqual(['user', 'user2']);
    });

    it('counts a rename against the original name, so it can outrun a name already taken', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'user', columnIds: ['c1'] }),
          createTable({ id: 't2', name: 'user2', columnIds: ['c2'] }),
          createTable({ id: 't3', name: 'user', columnIds: ['c3'] }),
        ],
        columns: [
          createColumn({ id: 'c1', tableId: 't1', name: 'a', dataType: 'int' }),
          createColumn({ id: 'c2', tableId: 't2', name: 'b', dataType: 'int' }),
          createColumn({ id: 'c3', tableId: 't3', name: 'c', dataType: 'int' }),
        ],
      });

      expect(
        createCode(state)
          .split('\n')
          .filter(line => line !== '' && !line.startsWith('  '))
      ).toEqual(['user', 'user2', 'user22']);
    });

    it('drops the second attribute of a duplicated name, which AML would merge', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'user', columnIds: ['c1', 'c2'] }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'id',
            dataType: 'varchar',
          }),
        ],
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'user',
        '  id int nullable',
        '',
      ]);
    });
  });

  describe('indexes', () => {
    function createIndexState(
      index: Partial<Index>,
      indexColumnIds: string[] = ['ic1']
    ) {
      return createState({
        tables: [
          createTable({ id: 't1', name: 'user', columnIds: ['c1', 'c2'] }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'name',
            dataType: 'varchar',
            options: ColumnOption.notNull,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'created_at',
            dataType: 'int',
            options: ColumnOption.notNull,
          }),
        ],
        indexes: [
          createIndex({ id: 'i1', tableId: 't1', indexColumnIds, ...index }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c1' }),
          createIndexColumn({
            id: 'ic2',
            indexId: 'i1',
            columnId: 'c2',
            orderType: OrderType.DESC,
          }),
        ],
      });
    }

    it('leaves a single-column index unnamed', () => {
      expect(createCode(createIndexState({})).split('\n')).toEqual([
        '',
        'user',
        '  name varchar index',
        '  created_at int',
        '',
      ]);
    });

    it('names a single-column index when the document does', () => {
      expect(
        createCode(createIndexState({ name: 'idx_user_name' })).split('\n')[2]
      ).toBe('  name varchar index=idx_user_name');
    });

    it('renders a unique index as the unique keyword', () => {
      expect(
        createCode(createIndexState({ unique: true })).split('\n')[2]
      ).toBe('  name varchar unique');
    });

    it('shares a generated name across the members of an unnamed composite index', () => {
      expect(
        createCode(createIndexState({}, ['ic1', 'ic2']))
          .split('\n')
          .slice(2, 4)
      ).toEqual([
        '  name varchar index=user_idx_1',
        '  created_at int index=user_idx_1',
      ]);
    });

    it('shares the document name across the members of a named composite index', () => {
      expect(
        createCode(
          createIndexState({ name: 'uq_user', unique: true }, ['ic1', 'ic2'])
        )
          .split('\n')
          .slice(2, 4)
      ).toEqual([
        '  name varchar unique=uq_user',
        '  created_at int unique=uq_user',
      ]);
    });

    it('quotes a generated name built from a table name that needs quoting', () => {
      const state = createIndexState({}, ['ic1', 'ic2']);
      state.collections.tableEntities.t1.name = 'user profile';

      expect(createCode(state).split('\n')[2]).toBe(
        '  name varchar index="user profile_idx_1"'
      );
    });

    it('renames the second index of a duplicated name, which AML would merge', () => {
      const state = createIndexState({ name: 'idx' });
      state.doc.indexIds.push('i2');
      state.collections.indexEntities.i2 = createIndex({
        id: 'i2',
        name: 'idx',
        tableId: 't1',
        indexColumnIds: ['ic3'],
      });
      state.collections.indexColumnEntities.ic3 = createIndexColumn({
        id: 'ic3',
        indexId: 'i2',
        columnId: 'c2',
      });

      expect(createCode(state).split('\n').slice(2, 4)).toEqual([
        '  name varchar index=idx',
        '  created_at int index=idx1',
      ]);
    });

    it('omits a blank index name', () => {
      expect(createCode(createIndexState({ name: '   ' })).split('\n')[2]).toBe(
        '  name varchar index'
      );
    });

    it('drops the descending order of a column, which AML has no spelling for', () => {
      expect(createCode(createIndexState({}, ['ic2'])).split('\n')[3]).toBe(
        '  created_at int index'
      );
    });

    it('keeps both the unique column flag and an index over the same column', () => {
      const state = createIndexState({});
      state.collections.tableColumnEntities.c1.options |= ColumnOption.unique;

      expect(createCode(state).split('\n')[2]).toBe(
        '  name varchar unique index'
      );
    });

    it('drops an index whose columns all failed to resolve', () => {
      const state = createIndexState({});
      state.collections.indexColumnEntities.ic1.columnId = 'missing';

      expect(createCode(state)).not.toContain('index');
    });

    it('drops an index column pointing at a column of another table', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'user', columnIds: ['c1'] }),
          createTable({ id: 't2', name: 'post', columnIds: ['c2'] }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
          }),
          createColumn({
            id: 'c2',
            tableId: 't2',
            name: 'title',
            dataType: 'varchar',
          }),
        ],
        indexes: [
          createIndex({ id: 'i1', tableId: 't1', indexColumnIds: ['ic1'] }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c2' }),
        ],
      });

      expect(createCode(state)).not.toContain('index');
    });

    it('drops an index column whose attribute was dropped as a duplicate', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'user', columnIds: ['c1', 'c2'] }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
          }),
        ],
        indexes: [
          createIndex({
            id: 'i1',
            tableId: 't1',
            indexColumnIds: ['ic1', 'ic2'],
          }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c1' }),
          createIndexColumn({ id: 'ic2', indexId: 'i1', columnId: 'c2' }),
        ],
      });

      expect(createCode(state).split('\n')[2]).toBe('  id int nullable index');
    });

    it('leaves an index of another table out of the entity it belongs to', () => {
      const state = createIndexState({});
      state.collections.indexEntities.i1.tableId = 't2';

      expect(createCode(state)).not.toContain('index');
    });
  });

  describe('relationships', () => {
    function createRelationshipState(
      relationship: DeepPartial<Relationship> = {},
      extra: StateInput = {}
    ) {
      return createState({
        tables: [
          createTable({ id: 't1', name: 'user', columnIds: ['c1'] }),
          createTable({ id: 't2', name: 'post', columnIds: ['c2'] }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey | ColumnOption.notNull,
          }),
          createColumn({
            id: 'c2',
            tableId: 't2',
            name: 'user_id',
            dataType: 'int',
            options: ColumnOption.notNull,
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            start: { tableId: 't1', columnIds: ['c1'] },
            end: { tableId: 't2', columnIds: ['c2'] },
            ...relationship,
          }),
        ],
        ...extra,
      });
    }

    const childLine = (state: RootState) => createCode(state).split('\n')[2];

    it('renders a single-column relationship inline on the child attribute', () => {
      expect(createCode(createRelationshipState()).split('\n')).toEqual([
        '',
        'post',
        '  user_id int -> user(id)',
        '',
        'user',
        '  id int pk',
        '',
      ]);
    });

    it('renders a mandatory one-to-many with the same arrow', () => {
      expect(
        childLine(
          createRelationshipState({ relationshipType: RelationshipType.OneN })
        )
      ).toBe('  user_id int -> user(id)');
    });

    it('renders an optional one-to-many with the same arrow', () => {
      expect(
        childLine(
          createRelationshipState({ relationshipType: RelationshipType.ZeroN })
        )
      ).toBe('  user_id int -> user(id)');
    });

    it('renders a one-to-one relationship with a double dash', () => {
      expect(
        childLine(
          createRelationshipState({
            relationshipType: RelationshipType.ZeroOne,
          })
        )
      ).toBe('  user_id int -- user(id)');
    });

    it('renders a mandatory one-to-one the same way', () => {
      expect(
        childLine(
          createRelationshipState({
            relationshipType: RelationshipType.OneOnly,
          })
        )
      ).toBe('  user_id int -- user(id)');
    });

    it('drops a relationship whose type is outside the four supported flags', () => {
      expect(childLine(createRelationshipState({ relationshipType: 0 }))).toBe(
        '  user_id int'
      );
    });

    it('quotes both sides of an inline relationship when they need it', () => {
      const state = createRelationshipState();
      state.collections.tableEntities.t1.name = 'legacy user';
      state.collections.tableColumnEntities.c1.name = 'user id';

      expect(
        createCode(state)
          .split('\n')
          .filter(line => line.includes('->'))
      ).toEqual(['  user_id int -> "legacy user"("user id")']);
    });

    it('renders a composite relationship as a trailing rel statement', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'user', columnIds: ['c1', 'c2'] }),
          createTable({ id: 't2', name: 'post', columnIds: ['c3', 'c4'] }),
        ],
        columns: [
          createColumn({ id: 'c1', tableId: 't1', name: 'a', dataType: 'int' }),
          createColumn({ id: 'c2', tableId: 't1', name: 'b', dataType: 'int' }),
          createColumn({ id: 'c3', tableId: 't2', name: 'p', dataType: 'int' }),
          createColumn({ id: 'c4', tableId: 't2', name: 'q', dataType: 'int' }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            start: { tableId: 't1', columnIds: ['c1', 'c2'] },
            end: { tableId: 't2', columnIds: ['c3', 'c4'] },
          }),
        ],
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'post',
        '  p int nullable',
        '  q int nullable',
        '',
        'user',
        '  a int nullable',
        '  b int nullable',
        '',
        'rel post(p, q) -> user(a, b)',
        '',
      ]);
    });

    it('renders a self-referential relationship inline', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'node', columnIds: ['c1', 'c2'] }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'parent_id',
            dataType: 'int',
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            start: { tableId: 't1', columnIds: ['c1'] },
            end: { tableId: 't1', columnIds: ['c2'] },
          }),
        ],
      });

      expect(createCode(state).split('\n')[3]).toBe(
        '  parent_id int nullable -> node(id)'
      );
    });

    it('stacks two relationships leaving the same attribute', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'comments', columnIds: ['c1'] }),
          createTable({ id: 't2', name: 'posts', columnIds: ['c2'] }),
          createTable({ id: 't3', name: 'users', columnIds: ['c3'] }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'item_id',
            dataType: 'int',
            options: ColumnOption.notNull,
          }),
          createColumn({
            id: 'c2',
            tableId: 't2',
            name: 'id',
            dataType: 'int',
          }),
          createColumn({
            id: 'c3',
            tableId: 't3',
            name: 'id',
            dataType: 'int',
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            start: { tableId: 't3', columnIds: ['c3'] },
            end: { tableId: 't1', columnIds: ['c1'] },
          }),
          createRelationship({
            id: 'r2',
            start: { tableId: 't2', columnIds: ['c2'] },
            end: { tableId: 't1', columnIds: ['c1'] },
          }),
        ],
      });

      expect(createCode(state).split('\n')[2]).toBe(
        '  item_id int -> users(id) -> posts(id)'
      );
    });

    it('drops a second relationship sharing the endpoints of the first', () => {
      const state = createRelationshipState();
      state.doc.relationshipIds.push('r2');
      state.collections.relationshipEntities.r2 = createRelationship({
        id: 'r2',
        start: { tableId: 't1', columnIds: ['c1'] },
        end: { tableId: 't2', columnIds: ['c2'] },
      });

      expect(childLine(state)).toBe('  user_id int -> user(id)');
    });

    it('drops a relationship stating the same endpoints in the other direction', () => {
      const state = createRelationshipState();
      state.doc.relationshipIds.push('r2');
      state.collections.relationshipEntities.r2 = createRelationship({
        id: 'r2',
        start: { tableId: 't2', columnIds: ['c2'] },
        end: { tableId: 't1', columnIds: ['c1'] },
      });

      expect(childLine(state)).toBe('  user_id int -> user(id)');
    });

    it('drops a relationship naming a column that does not exist', () => {
      expect(
        childLine(
          createRelationshipState({
            start: { tableId: 't1', columnIds: ['missing'] },
          })
        )
      ).toBe('  user_id int');
    });

    it('drops a relationship naming a column of another table', () => {
      expect(
        childLine(
          createRelationshipState({
            start: { tableId: 't1', columnIds: ['c2'] },
          })
        )
      ).toBe('  user_id int');
    });

    it('drops a relationship with no column on one side', () => {
      expect(
        childLine(
          createRelationshipState({ start: { tableId: 't1', columnIds: [] } })
        )
      ).toBe('  user_id int');
    });

    it('drops a relationship whose sides name a different number of columns', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'user', columnIds: ['c1', 'c2'] }),
          createTable({ id: 't2', name: 'post', columnIds: ['c3'] }),
        ],
        columns: [
          createColumn({ id: 'c1', tableId: 't1', name: 'a', dataType: 'int' }),
          createColumn({ id: 'c2', tableId: 't1', name: 'b', dataType: 'int' }),
          createColumn({ id: 'c3', tableId: 't2', name: 'p', dataType: 'int' }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            start: { tableId: 't1', columnIds: ['c1', 'c2'] },
            end: { tableId: 't2', columnIds: ['c3'] },
          }),
        ],
      });

      expect(relLines(state)).toEqual([]);
    });

    it('names the renamed table on the parent side', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'user', columnIds: ['c1'] }),
          createTable({ id: 't2', name: 'user', columnIds: ['c2'] }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
          }),
          createColumn({
            id: 'c2',
            tableId: 't2',
            name: 'user_id',
            dataType: 'int',
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            start: { tableId: 't2', columnIds: ['c2'] },
            end: { tableId: 't1', columnIds: ['c1'] },
          }),
        ],
      });

      expect(createCode(state).split('\n')[2]).toBe(
        '  id int nullable -> user2(user_id)'
      );
    });
  });

  describe('settings this generator does not read', () => {
    it('leaves the names uncased, because an AML name is the database identifier', () => {
      const state = createSingleColumnState(
        { name: 'created_at' },
        { name: 'user_profile' }
      );
      state.settings.tableNameCase = NameCase.pascalCase;
      state.settings.columnNameCase = NameCase.camelCase;

      expect(createCode(state).split('\n').slice(1, 3)).toEqual([
        'user_profile',
        '  created_at int nullable',
      ]);
    });

    it('produces the same document on every dialect', () => {
      const mysql = createSingleColumnState({ dataType: 'INT' });
      const postgres = createSingleColumnState({ dataType: 'INT' });
      mysql.settings.database = Database.MySQL;
      postgres.settings.database = Database.PostgreSQL;

      expect(createCode(mysql)).toBe(createCode(postgres));
    });
  });

  describe('formatTable', () => {
    it('renders the entity alone, keeping the inline relation AML tolerates', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'user', columnIds: ['c1'] }),
          createTable({ id: 't2', name: 'post', columnIds: ['c2'] }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.notNull,
          }),
          createColumn({
            id: 'c2',
            tableId: 't2',
            name: 'user_id',
            dataType: 'int',
            options: ColumnOption.notNull,
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            start: { tableId: 't1', columnIds: ['c1'] },
            end: { tableId: 't2', columnIds: ['c2'] },
          }),
        ],
      });

      expect(renderTable(state, state.collections.tableEntities.t2)).toEqual([
        'post',
        '  user_id int -> user(id)',
      ]);
    });

    it('leaves out the rel statement of a composite relationship, which is its own statement', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'user', columnIds: ['c1', 'c2'] }),
          createTable({ id: 't2', name: 'post', columnIds: ['c3', 'c4'] }),
        ],
        columns: [
          createColumn({ id: 'c1', tableId: 't1', name: 'a', dataType: 'int' }),
          createColumn({ id: 'c2', tableId: 't1', name: 'b', dataType: 'int' }),
          createColumn({ id: 'c3', tableId: 't2', name: 'p', dataType: 'int' }),
          createColumn({ id: 'c4', tableId: 't2', name: 'q', dataType: 'int' }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            start: { tableId: 't1', columnIds: ['c1', 'c2'] },
            end: { tableId: 't2', columnIds: ['c3', 'c4'] },
          }),
        ],
      });

      expect(renderTable(state, state.collections.tableEntities.t2)).toEqual([
        'post',
        '  p int nullable',
        '  q int nullable',
      ]);
    });

    it('carries the document-wide rename, because a name is only unique against every other table', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'user', columnIds: ['c1'] }),
          createTable({ id: 't2', name: 'user', columnIds: ['c2'] }),
        ],
        columns: [
          createColumn({ id: 'c1', tableId: 't1', name: 'a', dataType: 'int' }),
          createColumn({ id: 'c2', tableId: 't2', name: 'b', dataType: 'int' }),
        ],
      });

      expect(renderTable(state, state.collections.tableEntities.t2)).toEqual([
        'user2',
        '  b int nullable',
      ]);
    });

    it('renders the index constraints of the table it is given', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'user', columnIds: ['c1'] })],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'name',
            dataType: 'varchar',
            options: ColumnOption.notNull,
          }),
        ],
        indexes: [
          createIndex({
            id: 'i1',
            name: 'idx',
            tableId: 't1',
            indexColumnIds: ['ic1'],
            unique: true,
          }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c1' }),
        ],
      });

      expect(renderTable(state, state.collections.tableEntities.t1)).toEqual([
        'user',
        '  name varchar unique=idx',
      ]);
    });

    it('renders an entity with no attribute', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'user' })],
      });

      expect(renderTable(state, state.collections.tableEntities.t1)).toEqual([
        'user',
      ]);
    });

    it('renders nothing for a table outside the document', () => {
      const state = createState({});
      const table = createTable({ id: 't1', name: 'user' });

      expect(renderTable(state, table)).toEqual([]);
    });
  });
});
