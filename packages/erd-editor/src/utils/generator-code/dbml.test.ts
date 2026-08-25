import { Compiler, DEFAULT_ENTRY, MemoryProjectLayout } from '@dbml/parse';
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
import { createCode, formatTable } from '@/utils/generator-code/dbml';

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

function columnLine(state: RootState): string {
  return createCode(state).split('\n')[2];
}

function render(state: RootState, table: Table): string[] {
  const buffer: string[] = [];
  formatTable(state, { buffer, table });
  return buffer;
}

function parseDBML(source: string) {
  const compiler = new Compiler(
    new MemoryProjectLayout({ [DEFAULT_ENTRY.absolute]: source })
  );

  return {
    errors: compiler.parse.errors().map(error => error.message),
    db: compiler.parse.rawDb(),
  };
}

describe('generator-code/dbml', () => {
  describe('createCode', () => {
    it('returns an empty string when the document has no tables', () => {
      expect(createCode(createState({}))).toBe('');
    });

    it('renders a table as a quoted Table block', () => {
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
        'Table "user" {',
        '  "created_at" INT [not null]',
        '}',
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
          .filter(line => line.startsWith('Table'))
      ).toEqual(['Table "Album" {', 'Table "comment" {', 'Table "post" {']);
    });

    it('renders a table comment as a Note entry separated from the columns', () => {
      const state = createSingleColumnState({}, { comment: 'Store users' });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'Table "user" {',
        '  "id" int',
        '',
        "  Note: 'Store users'",
        '}',
        '',
      ]);
    });

    it('omits the Note entry for a blank table comment', () => {
      const state = createSingleColumnState({}, { comment: '   ' });

      expect(createCode(state)).not.toContain('Note:');
    });
  });

  describe('column settings', () => {
    it('renders no bracket list for a column carrying no option', () => {
      expect(columnLine(createSingleColumnState({}))).toBe('  "id" int');
    });

    it('renders every option in a stable order', () => {
      const state = createSingleColumnState({
        options:
          ColumnOption.primaryKey |
          ColumnOption.autoIncrement |
          ColumnOption.unique |
          ColumnOption.notNull,
        default: '1',
        comment: 'surrogate key',
      });

      expect(columnLine(state)).toBe(
        '  "id" int [pk, increment, unique, not null, default: 1, note: \'surrogate key\']'
      );
    });

    it('renders a primary key as pk', () => {
      expect(
        columnLine(
          createSingleColumnState({ options: ColumnOption.primaryKey })
        )
      ).toBe('  "id" int [pk]');
    });

    it('renders auto increment as increment', () => {
      expect(
        columnLine(
          createSingleColumnState({ options: ColumnOption.autoIncrement })
        )
      ).toBe('  "id" int [increment]');
    });

    it('renders not null as two words', () => {
      expect(
        columnLine(createSingleColumnState({ options: ColumnOption.notNull }))
      ).toBe('  "id" int [not null]');
    });

    it('omits a blank default and a blank comment', () => {
      expect(
        columnLine(createSingleColumnState({ default: '  ', comment: '  ' }))
      ).toBe('  "id" int');
    });
  });

  describe('data types', () => {
    it('leaves a bare identifier type unquoted', () => {
      expect(columnLine(createSingleColumnState({ dataType: 'bigint' }))).toBe(
        '  "id" bigint'
      );
    });

    it('leaves a numeric argument list unquoted', () => {
      expect(
        columnLine(createSingleColumnState({ dataType: 'varchar(100)' }))
      ).toBe('  "id" varchar(100)');
    });

    it('leaves a multi-argument numeric list unquoted', () => {
      expect(
        columnLine(createSingleColumnState({ dataType: 'decimal(10,2)' }))
      ).toBe('  "id" decimal(10,2)');
    });

    it('quotes an argument list holding a space, which the bare form would normalize away', () => {
      expect(
        columnLine(createSingleColumnState({ dataType: 'decimal(10, 2)' }))
      ).toBe('  "id" "decimal(10, 2)"');
    });

    it('quotes a multi-word type name', () => {
      expect(
        columnLine(createSingleColumnState({ dataType: 'character varying' }))
      ).toBe('  "id" "character varying"');
    });

    it('quotes an enum type, whose quoted members the bare form would mangle', () => {
      expect(
        columnLine(createSingleColumnState({ dataType: "enum('a','b')" }))
      ).toBe('  "id" "enum(\'a\',\'b\')"');
    });

    it('quotes an array type', () => {
      expect(
        columnLine(createSingleColumnState({ dataType: 'varchar(255)[]' }))
      ).toBe('  "id" "varchar(255)[]"');
    });

    it('trims the surrounding whitespace of a type', () => {
      expect(columnLine(createSingleColumnState({ dataType: '  int  ' }))).toBe(
        '  "id" int'
      );
    });

    it('drops a column with no type, which DBML cannot express', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'user', columnIds: ['c1', 'c2'] }),
        ],
        columns: [
          createColumn({ id: 'c1', tableId: 't1', name: 'id', dataType: '' }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'name',
            dataType: 'varchar',
          }),
        ],
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'Table "user" {',
        '  "name" varchar',
        '}',
        '',
      ]);
    });
  });

  describe('defaults', () => {
    const defaultOf = (value: string) =>
      columnLine(createSingleColumnState({ default: value }));

    it('emits an integer literal bare', () => {
      expect(defaultOf('0')).toBe('  "id" int [default: 0]');
    });

    it('emits a negative literal bare', () => {
      expect(defaultOf('-1')).toBe('  "id" int [default: -1]');
    });

    it('emits a decimal literal bare', () => {
      expect(defaultOf('1.5')).toBe('  "id" int [default: 1.5]');
    });

    it('emits a signed-positive literal as an expression, which the bare form would normalize', () => {
      expect(defaultOf('+1')).toBe('  "id" int [default: `+1`]');
    });

    it('emits true, false and null bare and lowercased', () => {
      expect(defaultOf('TRUE')).toBe('  "id" int [default: true]');
      expect(defaultOf('False')).toBe('  "id" int [default: false]');
      expect(defaultOf('NULL')).toBe('  "id" int [default: null]');
    });

    it('rewrites a SQL string literal into a DBML string', () => {
      expect(defaultOf("'pending'")).toBe('  "id" int [default: \'pending\']');
    });

    it('unescapes a doubled quote inside a SQL string literal', () => {
      expect(defaultOf("'it''s'")).toBe("  \"id\" int [default: 'it\\'s']");
    });

    it('emits anything else as a backtick expression', () => {
      expect(defaultOf('now()')).toBe('  "id" int [default: `now()`]');
    });

    it('falls back to a string when the value holds a backtick, which no expression can escape', () => {
      expect(defaultOf('`now`()')).toBe('  "id" int [default: \'`now`()\']');
    });
  });

  describe('identifier and note escaping', () => {
    it('escapes a double quote in a name', () => {
      const state = createSingleColumnState(
        { name: 'we"ird' },
        { name: 'ta"ble' }
      );

      expect(createCode(state).split('\n').slice(1, 3)).toEqual([
        'Table "ta\\"ble" {',
        '  "we\\"ird" int',
      ]);
    });

    it('escapes a backslash in a name', () => {
      expect(columnLine(createSingleColumnState({ name: 'a\\b' }))).toBe(
        '  "a\\\\b" int'
      );
    });

    it('escapes a line terminator in a name, which DBML rejects raw', () => {
      expect(columnLine(createSingleColumnState({ name: 'a\nb\rc' }))).toBe(
        '  "a\\nb\\rc" int'
      );
    });

    it('keeps a non-ASCII name, which the always-quoted form makes legal', () => {
      const state = createSingleColumnState(
        { name: '이름' },
        { name: '사용자' }
      );

      expect(createCode(state).split('\n').slice(1, 3)).toEqual([
        'Table "사용자" {',
        '  "이름" int',
      ]);
    });

    it('keeps an empty name, which the always-quoted form makes legal', () => {
      const state = createSingleColumnState({ name: '' }, { name: '' });

      expect(createCode(state).split('\n').slice(1, 3)).toEqual([
        'Table "" {',
        '  "" int',
      ]);
    });

    it('escapes a single quote and a backslash in a note', () => {
      expect(
        columnLine(createSingleColumnState({ comment: "it's a \\ path" }))
      ).toBe("  \"id\" int [note: 'it\\'s a \\\\ path']");
    });

    it('escapes a line terminator in a note, which DBML rejects raw inside a string', () => {
      const state = createSingleColumnState({}, { comment: 'line1\nline2' });

      expect(createCode(state)).toContain("  Note: 'line1\\nline2'");
    });
  });

  describe('names DBML rejects', () => {
    it('drops a table left with no column, which DBML cannot express', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'empty', columnIds: [] }),
          createTable({ id: 't2', name: 'user', columnIds: ['c1'] }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't2',
            name: 'id',
            dataType: 'int',
          }),
        ],
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'Table "user" {',
        '  "id" int',
        '}',
        '',
      ]);
    });

    it('drops a table whose every column lost its type', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'user', columnIds: ['c1'] })],
        columns: [
          createColumn({ id: 'c1', tableId: 't1', name: 'id', dataType: '' }),
        ],
      });

      expect(createCode(state)).toBe('');
    });

    it('drops the second column of a duplicated name, which DBML rejects', () => {
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
        'Table "user" {',
        '  "id" int',
        '}',
        '',
      ]);
    });

    it('renames the second table of a duplicated name, which DBML rejects', () => {
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
          .filter(line => line.startsWith('Table'))
      ).toEqual(['Table "user" {', 'Table "user2" {']);
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
          .filter(line => line.startsWith('Table'))
      ).toEqual(['Table "user" {', 'Table "user2" {', 'Table "user22" {']);
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
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'created_at',
            dataType: 'int',
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

    it('renders a single-column index inside an Indexes block', () => {
      expect(createCode(createIndexState({})).split('\n')).toEqual([
        '',
        'Table "user" {',
        '  "name" varchar',
        '  "created_at" int',
        '',
        '  Indexes {',
        '    ("name")',
        '  }',
        '}',
        '',
      ]);
    });

    it('renders a composite index as a column tuple', () => {
      expect(createCode(createIndexState({}, ['ic1', 'ic2']))).toContain(
        '    ("name", "created_at")'
      );
    });

    it('renders the index name as a quoted setting', () => {
      expect(createCode(createIndexState({ name: 'idx_user_name' }))).toContain(
        '    ("name") [name: "idx_user_name"]'
      );
    });

    it('renders a unique index', () => {
      expect(createCode(createIndexState({ unique: true }))).toContain(
        '    ("name") [unique]'
      );
    });

    it('renders a named unique index with both settings', () => {
      expect(
        createCode(createIndexState({ name: 'uq_name', unique: true }))
      ).toContain('    ("name") [name: "uq_name", unique]');
    });

    it('omits a blank index name', () => {
      expect(createCode(createIndexState({ name: '   ' }))).toContain(
        '    ("name")'
      );
    });

    it('drops the descending order of a column, which DBML has no spelling for', () => {
      expect(createCode(createIndexState({}, ['ic2']))).toContain(
        '    ("created_at")'
      );
    });

    it('drops an index whose columns all failed to resolve', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'user', columnIds: ['c1'] })],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
          }),
        ],
        indexes: [
          createIndex({ id: 'i1', tableId: 't1', indexColumnIds: ['ic1'] }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'missing' }),
        ],
      });

      expect(createCode(state)).not.toContain('Indexes');
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

      expect(createCode(state)).not.toContain('Indexes');
    });

    it('drops an index column whose column lost its type', () => {
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
            name: 'name',
            dataType: '',
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

      expect(createCode(state)).toContain('    ("id")');
    });

    it('places the Note before the Indexes block', () => {
      const state = createIndexState({});
      state.collections.tableEntities.t1.comment = 'people';

      expect(createCode(state).split('\n')).toEqual([
        '',
        'Table "user" {',
        '  "name" varchar',
        '  "created_at" int',
        '',
        "  Note: 'people'",
        '',
        '  Indexes {',
        '    ("name")',
        '  }',
        '}',
        '',
      ]);
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
            options: ColumnOption.primaryKey,
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
            start: { tableId: 't1', columnIds: ['c1'] },
            end: { tableId: 't2', columnIds: ['c2'] },
            ...relationship,
          }),
        ],
        ...extra,
      });
    }

    function refLines(state: RootState): string[] {
      return createCode(state)
        .split('\n')
        .filter(line => line.startsWith('Ref:'));
    }

    it('renders a one-to-many relationship with the parent on the left', () => {
      expect(refLines(createRelationshipState())).toEqual([
        'Ref: "user"."id" < "post"."user_id"',
      ]);
    });

    it('renders a mandatory one-to-many the same way', () => {
      expect(
        refLines(
          createRelationshipState({ relationshipType: RelationshipType.OneN })
        )
      ).toEqual(['Ref: "user"."id" < "post"."user_id"']);
    });

    it('renders a one-to-one relationship with a dash', () => {
      expect(
        refLines(
          createRelationshipState({
            relationshipType: RelationshipType.ZeroOne,
          })
        )
      ).toEqual(['Ref: "user"."id" - "post"."user_id"']);
    });

    it('renders a mandatory one-to-one the same way', () => {
      expect(
        refLines(
          createRelationshipState({
            relationshipType: RelationshipType.OneOnly,
          })
        )
      ).toEqual(['Ref: "user"."id" - "post"."user_id"']);
    });

    it('drops a relationship whose type is outside the four supported flags', () => {
      expect(
        refLines(createRelationshipState({ relationshipType: 0 }))
      ).toEqual([]);
    });

    it('places the relationships after every table block', () => {
      expect(createCode(createRelationshipState()).split('\n')).toEqual([
        '',
        'Table "post" {',
        '  "user_id" int',
        '}',
        '',
        'Table "user" {',
        '  "id" int [pk]',
        '}',
        '',
        'Ref: "user"."id" < "post"."user_id"',
        '',
      ]);
    });

    it('renders a composite relationship as two column tuples', () => {
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

      expect(refLines(state)).toEqual([
        'Ref: "user".("a", "b") < "post".("p", "q")',
      ]);
    });

    it('renders a self-referential relationship', () => {
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

      expect(refLines(state)).toEqual([
        'Ref: "node"."id" < "node"."parent_id"',
      ]);
    });

    it('keeps two relationships between one pair of tables', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'user', columnIds: ['c1', 'c2'] }),
          createTable({ id: 't2', name: 'post', columnIds: ['c3', 'c4'] }),
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
            name: 'code',
            dataType: 'int',
          }),
          createColumn({
            id: 'c3',
            tableId: 't2',
            name: 'author_id',
            dataType: 'int',
          }),
          createColumn({
            id: 'c4',
            tableId: 't2',
            name: 'editor_code',
            dataType: 'int',
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            start: { tableId: 't1', columnIds: ['c1'] },
            end: { tableId: 't2', columnIds: ['c3'] },
          }),
          createRelationship({
            id: 'r2',
            start: { tableId: 't1', columnIds: ['c2'] },
            end: { tableId: 't2', columnIds: ['c4'] },
          }),
        ],
      });

      expect(refLines(state)).toEqual([
        'Ref: "user"."id" < "post"."author_id"',
        'Ref: "user"."code" < "post"."editor_code"',
      ]);
    });

    it('drops a second relationship sharing the endpoints of the first', () => {
      const state = createRelationshipState();
      state.doc.relationshipIds.push('r2');
      state.collections.relationshipEntities.r2 = createRelationship({
        id: 'r2',
        start: { tableId: 't1', columnIds: ['c1'] },
        end: { tableId: 't2', columnIds: ['c2'] },
      });

      expect(refLines(state)).toEqual(['Ref: "user"."id" < "post"."user_id"']);
    });

    it('drops a relationship stating the same endpoints in the other direction', () => {
      const state = createRelationshipState();
      state.doc.relationshipIds.push('r2');
      state.collections.relationshipEntities.r2 = createRelationship({
        id: 'r2',
        start: { tableId: 't2', columnIds: ['c2'] },
        end: { tableId: 't1', columnIds: ['c1'] },
      });

      expect(refLines(state)).toEqual(['Ref: "user"."id" < "post"."user_id"']);
    });

    it('drops a relationship whose table was dropped', () => {
      const state = createRelationshipState();
      state.collections.tableColumnEntities.c2.dataType = '';

      expect(refLines(state)).toEqual([]);
    });

    it('drops a relationship naming a column that does not exist', () => {
      const state = createRelationshipState({
        end: { tableId: 't2', columnIds: ['missing'] },
      });

      expect(refLines(state)).toEqual([]);
    });

    it('drops a relationship naming a column of another table', () => {
      const state = createRelationshipState({
        end: { tableId: 't2', columnIds: ['c1'] },
      });

      expect(refLines(state)).toEqual([]);
    });

    it('drops a relationship with no column on one side', () => {
      const state = createRelationshipState({
        end: { tableId: 't2', columnIds: [] },
      });

      expect(refLines(state)).toEqual([]);
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

      expect(refLines(state)).toEqual([]);
    });

    it('names the renamed table on both sides of a ref', () => {
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
            start: { tableId: 't1', columnIds: ['c1'] },
            end: { tableId: 't2', columnIds: ['c2'] },
          }),
        ],
      });

      expect(refLines(state)).toEqual(['Ref: "user"."id" < "user2"."user_id"']);
    });
  });

  describe('settings this generator does not read', () => {
    it('leaves the table name uncased, because a DBML name is the database identifier', () => {
      const state = createSingleColumnState(
        { name: 'created_at' },
        { name: 'user_profile' }
      );
      state.settings.tableNameCase = NameCase.pascalCase;
      state.settings.columnNameCase = NameCase.camelCase;

      expect(createCode(state).split('\n').slice(1, 3)).toEqual([
        'Table "user_profile" {',
        '  "created_at" int',
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
    it('renders the table block alone, without the Ref lines it cannot resolve', () => {
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
            name: 'user_id',
            dataType: 'int',
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

      expect(render(state, state.collections.tableEntities.t1)).toEqual([
        'Table "user" {',
        '  "id" int',
        '}',
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

      expect(render(state, state.collections.tableEntities.t2)).toEqual([
        'Table "user2" {',
        '  "b" int',
        '}',
      ]);
    });

    it('renders the Indexes block of the table it is given', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'user', columnIds: ['c1'] })],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'name',
            dataType: 'varchar',
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

      expect(render(state, state.collections.tableEntities.t1)).toEqual([
        'Table "user" {',
        '  "name" varchar',
        '',
        '  Indexes {',
        '    ("name") [name: "idx", unique]',
        '  }',
        '}',
      ]);
    });

    it('renders nothing for a table DBML cannot express', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'user', columnIds: [] })],
      });

      expect(render(state, state.collections.tableEntities.t1)).toEqual([]);
    });
  });

  describe('the real DBML parser', () => {
    it('accepts the document and reads back every column setting', () => {
      const state = createSingleColumnState({
        name: 'id',
        dataType: 'int',
        options:
          ColumnOption.primaryKey |
          ColumnOption.autoIncrement |
          ColumnOption.unique |
          ColumnOption.notNull,
        default: '1',
        comment: 'surrogate key',
      });
      const { errors, db } = parseDBML(createCode(state));

      expect(errors).toEqual([]);
      expect(db?.tables[0].fields[0]).toMatchObject({
        name: 'id',
        pk: true,
        unique: true,
        increment: true,
        not_null: true,
        dbdefault: { type: 'number', value: 1 },
        note: { value: 'surrogate key' },
      });
    });

    it('reads back a name holding a quote, a backslash and a line terminator', () => {
      const state = createSingleColumnState(
        { name: 'we"ird\\path\nbreak' },
        { name: 'ta"ble' }
      );
      const { errors, db } = parseDBML(createCode(state));

      expect(errors).toEqual([]);
      expect(db?.tables[0].name).toBe('ta"ble');
      expect(db?.tables[0].fields[0].name).toBe('we"ird\\path\nbreak');
    });

    it('reads back a note holding a quote, a backslash and a line terminator', () => {
      const state = createSingleColumnState(
        { comment: "it's a \\ path" },
        { comment: 'line1\nline2' }
      );
      const { errors, db } = parseDBML(createCode(state));

      expect(errors).toEqual([]);
      expect(db?.tables[0].note?.value).toBe('line1\nline2');
      expect(db?.tables[0].fields[0].note?.value).toBe("it's a \\ path");
    });

    it('reads back a non-ASCII and an empty name', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: '사용자', columnIds: ['c1'] }),
          createTable({ id: 't2', name: '', columnIds: ['c2'] }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: '이름',
            dataType: 'varchar',
          }),
          createColumn({ id: 'c2', tableId: 't2', name: '', dataType: 'int' }),
        ],
      });
      const { errors, db } = parseDBML(createCode(state));

      expect(errors).toEqual([]);
      expect(db?.tables.map(table => table.name).sort()).toEqual([
        '',
        '사용자',
      ]);
    });

    it('reads back a type whose spelling the bare form would mangle', () => {
      const state = createState({
        tables: [
          createTable({
            id: 't1',
            name: 'user',
            columnIds: ['c1', 'c2', 'c3'],
          }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'a',
            dataType: "enum('x','y')",
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'b',
            dataType: 'character varying(255)',
          }),
          createColumn({
            id: 'c3',
            tableId: 't1',
            name: 'c',
            dataType: 'decimal(10, 2)',
          }),
        ],
      });
      const { errors, db } = parseDBML(createCode(state));

      expect(errors).toEqual([]);
      expect(db?.tables[0].fields.map(field => field.type.type_name)).toEqual([
        "enum('x','y')",
        'character varying(255)',
        'decimal(10, 2)',
      ]);
    });

    it('reads back every default form', () => {
      const values = ['0', '-1', '1.5', '+1', 'TRUE', "'it''s'", 'now()'];
      const state = createState({
        tables: [
          createTable({
            id: 't1',
            name: 'user',
            columnIds: values.map((_, index) => `c${index}`),
          }),
        ],
        columns: values.map((value, index) =>
          createColumn({
            id: `c${index}`,
            tableId: 't1',
            name: `d${index}`,
            dataType: 'varchar',
            default: value,
          })
        ),
      });
      const { errors, db } = parseDBML(createCode(state));

      expect(errors).toEqual([]);
      expect(db?.tables[0].fields.map(field => field.dbdefault)).toEqual([
        { type: 'number', value: 0 },
        { type: 'number', value: -1 },
        { type: 'number', value: 1.5 },
        { type: 'expression', value: '+1' },
        { type: 'boolean', value: 'true' },
        { type: 'string', value: "it's" },
        { type: 'expression', value: 'now()' },
      ]);
    });

    it('folds a two-column primary key into one composite key', () => {
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
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'group_id',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
        ],
      });
      const { errors, db } = parseDBML(createCode(state));

      expect(errors).toEqual([]);
      expect(db?.tables[0].indexes[0]).toMatchObject({
        pk: true,
        columns: [
          { value: 'user_id', type: 'column' },
          { value: 'group_id', type: 'column' },
        ],
      });
    });

    it('accepts a document whose duplicated table name was renamed', () => {
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
      const { errors, db } = parseDBML(createCode(state));

      expect(errors).toEqual([]);
      expect(db?.tables.map(table => table.name)).toEqual(['user', 'user2']);
    });

    it('resolves a one-to-many, a one-to-one and a composite ref', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'user', columnIds: ['c1', 'c2'] }),
          createTable({ id: 't2', name: 'post', columnIds: ['c3'] }),
          createTable({ id: 't3', name: 'profile', columnIds: ['c4'] }),
          createTable({ id: 't4', name: 'pair', columnIds: ['c5', 'c6'] }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'code',
            dataType: 'int',
          }),
          createColumn({
            id: 'c3',
            tableId: 't2',
            name: 'user_id',
            dataType: 'int',
          }),
          createColumn({
            id: 'c4',
            tableId: 't3',
            name: 'user_id',
            dataType: 'int',
          }),
          createColumn({ id: 'c5', tableId: 't4', name: 'x', dataType: 'int' }),
          createColumn({ id: 'c6', tableId: 't4', name: 'y', dataType: 'int' }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            start: { tableId: 't1', columnIds: ['c1'] },
            end: { tableId: 't2', columnIds: ['c3'] },
          }),
          createRelationship({
            id: 'r2',
            relationshipType: RelationshipType.ZeroOne,
            start: { tableId: 't1', columnIds: ['c1'] },
            end: { tableId: 't3', columnIds: ['c4'] },
          }),
          createRelationship({
            id: 'r3',
            start: { tableId: 't1', columnIds: ['c1', 'c2'] },
            end: { tableId: 't4', columnIds: ['c5', 'c6'] },
          }),
        ],
      });
      const { errors, db } = parseDBML(createCode(state));

      expect(errors).toEqual([]);
      expect(
        db?.refs.map(ref =>
          ref.endpoints.map(endpoint => [
            endpoint.tableName,
            endpoint.fieldNames.join(','),
            endpoint.relation,
          ])
        )
      ).toEqual([
        [
          ['user', 'id', '1'],
          ['post', 'user_id', '*'],
        ],
        [
          ['user', 'id', '1'],
          ['profile', 'user_id', '1'],
        ],
        [
          ['user', 'id,code', '1'],
          ['pair', 'x,y', '*'],
        ],
      ]);
    });

    it('accepts an Indexes block naming a quoted column', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'user', columnIds: ['c1', 'c2'] }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'full name',
            dataType: 'varchar',
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'created_at',
            dataType: 'int',
          }),
        ],
        indexes: [
          createIndex({
            id: 'i1',
            name: 'idx user',
            tableId: 't1',
            indexColumnIds: ['ic1', 'ic2'],
            unique: true,
          }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c1' }),
          createIndexColumn({ id: 'ic2', indexId: 'i1', columnId: 'c2' }),
        ],
      });
      const { errors, db } = parseDBML(createCode(state));

      expect(errors).toEqual([]);
      expect(db?.tables[0].indexes[0]).toMatchObject({
        name: 'idx user',
        unique: true,
        columns: [
          { value: 'full name', type: 'column' },
          { value: 'created_at', type: 'column' },
        ],
      });
    });

    it('accepts a per-table snippet on its own', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'user', columnIds: ['c1'] })],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
        ],
      });
      const { errors } = parseDBML(
        render(state, state.collections.tableEntities.t1).join('\n')
      );

      expect(errors).toEqual([]);
    });
  });
});
