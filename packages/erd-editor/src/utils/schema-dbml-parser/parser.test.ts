import { describe, expect, it } from 'vite-plus/test';

import { parseDBMLModel } from '@/utils/schema-dbml-parser/parser';
import {
  DBMLColumn,
  DBMLModel,
  DBMLTable,
} from '@/utils/schema-dbml-parser/types';

function parse(source: string): DBMLModel {
  const result = parseDBMLModel(source);
  if (!result.ok) throw new Error(result.message);
  return result.model;
}

function firstTable(source: string): DBMLTable {
  const [table] = parse(source).tables;
  if (!table) throw new Error('expected a table');
  return table;
}

function firstColumn(source: string): DBMLColumn {
  const [column] = firstTable(source).columns;
  if (!column) throw new Error('expected a column');
  return column;
}

function column(settings: string): DBMLColumn {
  return firstColumn(`Table t {\n  a int ${settings}\n}`);
}

describe('schema-dbml-parser/parser', () => {
  it('returns an empty model for an empty document', () => {
    expect(parse('')).toEqual({
      tables: [],
      refs: [],
      tableGroups: [],
      enums: {},
      skipped: [],
    });
  });

  it('returns an empty model for a document of comments alone', () => {
    expect(parse('// nothing here\n/* nor here */').tables).toEqual([]);
  });

  describe('tables', () => {
    it('reads a table and its columns', () => {
      const table = firstTable(`Table users {
  id int
  name varchar
}`);

      expect(table.name).toBe('users');
      expect(table.columns.map(entry => entry.name)).toEqual(['id', 'name']);
    });

    it('reads a quoted table and column name', () => {
      const table = firstTable(`Table "user list" {
  "full name" varchar
}`);

      expect(table.name).toBe('user list');
      expect(table.columns[0].name).toBe('full name');
    });

    it('reads a schema-qualified name', () => {
      const table = firstTable(`Table app.users {
  id int
}`);

      expect(table).toMatchObject({ schemaName: 'app', name: 'users' });
    });

    it('reads an alias', () => {
      expect(
        firstTable(`Table users as U {
  id int
}`).alias
      ).toBe('U');
    });

    it('reads a Note entry as the table comment', () => {
      expect(
        firstTable(`Table users {
  id int

  Note: 'people'
}`).comment
      ).toBe('people');
    });

    it('reads a note from the table settings list', () => {
      expect(
        firstTable(`Table users [headercolor: #3498db, note: 'people'] {
  id int
}`).comment
      ).toBe('people');
    });

    it('reads the header color as written, from the tokens it was cut into', () => {
      expect(
        parse(`Table a [headercolor: #3498DB] { id int }
Table b [note: 'x', headercolor: #abc] { id int }
Table c [headercolor: #1e3] { id int }
Table d [headercolor: #e1e1e1] { id int }`).tables.map(table => table.color)
      ).toEqual(['#3498DB', '#abc', '#1e3', '#e1e1e1']);
    });

    it('ignores a header color DBML does not take', () => {
      expect(
        parse(`Table a [headercolor: #aabbccdd] { id int }
Table b [headercolor: '#abc'] { id int }
Table c [headercolor: red] { id int }
Table d [headercolor: #12.5] { id int }
Table e { id int }`).tables.map(table => table.color)
      ).toEqual(['', '', '', '', '']);
    });

    it('ignores a header color with a space inside, which DBML does not take', () => {
      expect(
        parse(`Table a [headercolor: #3498 DB] { id int }
Table b [headercolor: # abc] { id int }`).tables.map(table => table.color)
      ).toEqual(['', '']);
    });

    it('reads a Note block', () => {
      expect(
        firstTable(`Table users {
  id int

  Note {
    'people'
  }
}`).comment
      ).toBe('people');
    });

    it('reads a triple-quoted Note across lines', () => {
      expect(
        firstTable(`Table users {
  id int

  Note: '''
    one
    two
  '''
}`).comment
      ).toBe('one\ntwo');
    });

    it('reads a table whose brace opens on the next line', () => {
      expect(
        firstTable(`Table users
{
  id int
}`).columns
      ).toHaveLength(1);
    });

    it('reads a single-column table written on one line', () => {
      expect(firstTable('Table users { id int }').columns).toHaveLength(1);
    });

    it('tolerates blank lines between columns', () => {
      expect(
        firstTable(`Table users {

  id int


  name varchar

}`).columns
      ).toHaveLength(2);
    });

    it('reads two tables', () => {
      expect(
        parse(`Table a { x int }
Table b { y int }`).tables.map(table => table.name)
      ).toEqual(['a', 'b']);
    });

    it('drops a column with no type, which DBML rejects', () => {
      expect(
        firstTable(`Table users {
  id
  name varchar
}`).columns.map(entry => entry.name)
      ).toEqual(['name']);
    });
  });

  describe('column types', () => {
    it.each([
      ['int', 'int'],
      ['varchar(100)', 'varchar(100)'],
      ['decimal(10,2)', 'decimal(10,2)'],
      ['"character varying"', 'character varying'],
      ['"character varying"(255)', 'character varying(255)'],
      ['varchar(255)[]', 'varchar(255)[]'],
      ["\"enum('x','y')\"", "enum('x','y')"],
    ])('reads %s', (source, expected) => {
      expect(column('').name).toBe('a');
      expect(firstColumn(`Table t {\n  a ${source}\n}`).typeName).toBe(
        expected
      );
    });

    it('keeps the schema of a schema-qualified type apart from its name', () => {
      expect(firstColumn('Table t {\n  a app.status\n}')).toMatchObject({
        typeName: 'status',
        typeSchemaName: 'app',
      });
    });

    it('re-quotes a string argument so an inline enum keeps its members', () => {
      expect(firstColumn("Table t {\n  a enum('x','y')\n}").typeName).toBe(
        "enum('x','y')"
      );
    });

    it('reads an array suffix but not a settings list', () => {
      expect(firstColumn('Table t {\n  a int[] [pk]\n}')).toMatchObject({
        typeName: 'int[]',
        primaryKey: true,
      });
    });
  });

  describe('column settings', () => {
    it('reads pk', () => {
      expect(column('[pk]').primaryKey).toBe(true);
    });

    it('reads the two-word primary key spelling', () => {
      expect(column('[primary key]').primaryKey).toBe(true);
    });

    it('reads unique', () => {
      expect(column('[unique]').unique).toBe(true);
    });

    it('reads not null', () => {
      expect(column('[not null]').notNull).toBe(true);
    });

    it('reads increment', () => {
      expect(column('[increment]').autoIncrement).toBe(true);
    });

    it('reads a note', () => {
      expect(column("[note: 'hello']").comment).toBe('hello');
    });

    it('reads several settings in one list', () => {
      expect(column("[pk, increment, not null, note: 'k']")).toMatchObject({
        primaryKey: true,
        autoIncrement: true,
        notNull: true,
        comment: 'k',
      });
    });

    it('reads a settings list wrapped across lines', () => {
      expect(
        firstColumn(`Table t {
  a int [pk,
    not null]
}`)
      ).toMatchObject({ primaryKey: true, notNull: true });
    });

    it('ignores null, which states nothing', () => {
      expect(column('[null]')).toMatchObject({
        notNull: false,
        primaryKey: false,
      });
    });

    it('ignores an unknown setting rather than failing the column', () => {
      expect(column("[owner: 'data-team', pk]").primaryKey).toBe(true);
    });

    it('ignores a colour setting, whose value is not a name', () => {
      expect(column('[color: #ff0000, pk]').primaryKey).toBe(true);
    });

    it('keeps a comma inside a note out of the setting split', () => {
      expect(column("[note: 'hello, world', pk]")).toMatchObject({
        comment: 'hello, world',
        primaryKey: true,
      });
    });
  });

  describe('column defaults', () => {
    const defaultOf = (value: string) => column(`[default: ${value}]`).default;

    it('reads an integer', () => {
      expect(defaultOf('0')).toBe('0');
    });

    it('reads a negative number', () => {
      expect(defaultOf('-1')).toBe('-1');
    });

    it('reads a decimal', () => {
      expect(defaultOf('1.5')).toBe('1.5');
    });

    it('reads true, false and null verbatim', () => {
      expect(defaultOf('true')).toBe('true');
      expect(defaultOf('false')).toBe('false');
      expect(defaultOf('null')).toBe('null');
    });

    it('re-quotes a string in the SQL spelling the editor stores', () => {
      expect(defaultOf("'pending'")).toBe("'pending'");
    });

    it('doubles a quote inside a string, as SQL spells it', () => {
      expect(defaultOf("'it\\'s'")).toBe("'it''s'");
    });

    it('reads an expression without its backticks', () => {
      expect(defaultOf('`now()`')).toBe('now()');
    });

    it('reads an expression holding a quote', () => {
      expect(defaultOf("`now() - interval '5 days'`")).toBe(
        "now() - interval '5 days'"
      );
    });
  });

  describe('inline refs', () => {
    const refOf = (setting: string) =>
      column(`[ref: ${setting}]`).inlineRefs[0];

    it('reads a many-to-one', () => {
      expect(refOf('> users.id')).toEqual({
        operator: '>',
        target: { schemaName: '', tableName: 'users', columnNames: ['id'] },
      });
    });

    it('reads a one-to-many', () => {
      expect(refOf('< users.id').operator).toBe('<');
    });

    it('reads a one-to-one', () => {
      expect(refOf('- users.id').operator).toBe('-');
    });

    it('reads a many-to-many', () => {
      expect(refOf('<> users.id').operator).toBe('<>');
    });

    it('drops the optionality markers, which state the parent side too', () => {
      expect(refOf('?>? users.id').operator).toBe('>');
      expect(refOf('?<? users.id').operator).toBe('<');
    });

    it('reads a schema-qualified target', () => {
      expect(refOf('> app.users.id').target).toEqual({
        schemaName: 'app',
        tableName: 'users',
        columnNames: ['id'],
      });
    });

    it('reads a quoted target', () => {
      expect(refOf('> "user list"."full name"').target).toMatchObject({
        tableName: 'user list',
        columnNames: ['full name'],
      });
    });

    it('drops a ref with no operator', () => {
      expect(column('[ref: users.id]').inlineRefs).toEqual([]);
    });
  });

  describe('indexes', () => {
    const indexesOf = (body: string) =>
      firstTable(`Table t {
  a int
  b int

  Indexes {
${body}
  }
}`).indexes;

    it('reads a single-column index', () => {
      expect(indexesOf('    a')).toEqual([
        { name: '', unique: false, primaryKey: false, columnNames: ['a'] },
      ]);
    });

    it('reads a composite index', () => {
      expect(indexesOf('    (a, b)')[0].columnNames).toEqual(['a', 'b']);
    });

    it('reads a name and the unique flag', () => {
      expect(indexesOf('    (a) [name: "idx_a", unique]')[0]).toMatchObject({
        name: 'idx_a',
        unique: true,
      });
    });

    it('reads a single-quoted index name', () => {
      expect(indexesOf("    (a) [name: 'idx_a']")[0].name).toBe('idx_a');
    });

    it('reads the composite primary key flag', () => {
      expect(indexesOf('    (a, b) [pk]')[0].primaryKey).toBe(true);
    });

    it('ignores an index type, which the editor has no slot for', () => {
      expect(indexesOf('    (a) [type: hash]')[0]).toMatchObject({
        columnNames: ['a'],
        unique: false,
      });
    });

    it('drops an expression index, which names no column', () => {
      expect(indexesOf('    (`a + 1`)')).toEqual([]);
    });

    it('reads the lowercase spelling of the block', () => {
      expect(
        firstTable(`Table t {
  a int

  indexes {
    a
  }
}`).indexes
      ).toHaveLength(1);
    });

    it('reads several index lines', () => {
      expect(indexesOf('    a\n    (a, b) [unique]')).toHaveLength(2);
    });
  });

  describe('standalone refs', () => {
    const refsOf = (source: string) =>
      parse(`Table a { x int\n y int }
Table b { p int\n q int }
${source}`).refs;

    it('reads the colon form', () => {
      expect(refsOf('Ref: a.x < b.p')).toEqual([
        {
          operator: '<',
          left: { schemaName: '', tableName: 'a', columnNames: ['x'] },
          right: { schemaName: '', tableName: 'b', columnNames: ['p'] },
          onDelete: '',
          onUpdate: '',
        },
      ]);
    });

    it('reads a named ref', () => {
      expect(refsOf('Ref user_post: a.x < b.p')[0].operator).toBe('<');
    });

    it('reads the block form', () => {
      expect(refsOf('Ref r {\n  a.x < b.p\n}')[0].operator).toBe('<');
    });

    it('reads a dash operator, which is not lexed as one', () => {
      expect(refsOf('Ref: a.x - b.p')[0].operator).toBe('-');
    });

    it('reads a composite tuple on both sides', () => {
      expect(refsOf('Ref: a.(x, y) < b.(p, q)')[0]).toMatchObject({
        left: { tableName: 'a', columnNames: ['x', 'y'] },
        right: { tableName: 'b', columnNames: ['p', 'q'] },
      });
    });

    it('reads the fully quoted, space-free spelling sql2dbml emits', () => {
      expect(refsOf('Ref:"a"."x" ?<? "b"."p"')[0]).toEqual({
        operator: '<',
        left: { schemaName: '', tableName: 'a', columnNames: ['x'] },
        right: { schemaName: '', tableName: 'b', columnNames: ['p'] },
        onDelete: '',
        onUpdate: '',
      });
    });

    it('reads a schema on each endpoint', () => {
      expect(refsOf('Ref: s1.a.x < s2.b.p')[0]).toMatchObject({
        left: { schemaName: 's1', tableName: 'a' },
        right: { schemaName: 's2', tableName: 'b' },
      });
    });

    it('reads the referential actions as written', () => {
      expect(
        refsOf('Ref: a.x < b.p [delete: cascade, update: no action]')[0]
      ).toMatchObject({
        operator: '<',
        onDelete: 'cascade',
        onUpdate: 'no action',
      });
      expect(
        refsOf('Ref r {\n  a.x < b.p [update: set default, color: #fff]\n}')[0]
      ).toMatchObject({ onDelete: '', onUpdate: 'set default' });
    });

    it('reads several refs', () => {
      expect(refsOf('Ref: a.x < b.p\nRef: a.y < b.q')).toHaveLength(2);
    });

    it('drops a ref with no operator', () => {
      expect(refsOf('Ref: a.x b.p')).toEqual([]);
    });
  });

  describe('enums', () => {
    it('reads the members', () => {
      expect(
        parse(`Enum status {
  created
  shipped
}`).enums
      ).toEqual({ status: ['created', 'shipped'] });
    });

    it('reads a member note without taking it for a member', () => {
      expect(
        parse(`Enum status {
  created [note: 'first']
  shipped
}`).enums.status
      ).toEqual(['created', 'shipped']);
    });

    it('registers a schema-qualified enum under both spellings', () => {
      expect(
        parse(`Enum app.status {
  created
}`).enums
      ).toEqual({ 'app.status': ['created'], status: ['created'] });
    });

    it('reads a quoted member', () => {
      expect(
        parse(`Enum status {
  "in progress"
}`).enums.status
      ).toEqual(['in progress']);
    });
  });

  describe('table partials', () => {
    it('injects the partial columns where the reference stands', () => {
      expect(
        firstTable(`TablePartial base {
  created_at timestamp
}
Table t {
  ~base
  name varchar
}`).columns.map(entry => entry.name)
      ).toEqual(['created_at', 'name']);
    });

    it('injects at the end when the reference is last', () => {
      expect(
        parse(`TablePartial base {
  created_at timestamp
}
Table t {
  name varchar
  ~base
}`).tables[0].columns.map(entry => entry.name)
      ).toEqual(['name', 'created_at']);
    });

    it('keeps the partial out of the table list', () => {
      expect(
        parse(`TablePartial base {
  created_at timestamp
}
Table t {
  ~base
}`).tables.map(table => table.name)
      ).toEqual(['t']);
    });

    it('leaves the header color of a partial to the partial', () => {
      expect(
        firstTable(`TablePartial base [headercolor: #fff] {
  created_at timestamp
}
Table t {
  ~base
}`).color
      ).toBe('');
    });

    it('ignores a reference to a partial that is not declared', () => {
      expect(
        parse(`Table t {
  ~missing
  name varchar
}`).tables[0].columns.map(entry => entry.name)
      ).toEqual(['name']);
    });
  });

  describe('table groups', () => {
    it('reads the name, the color and one table per line', () => {
      expect(
        parse(`TableGroup billing [color: #3498DB] {
  invoices
  payments
}`).tableGroups
      ).toEqual([
        {
          name: 'billing',
          color: '#3498DB',
          tables: [
            { schemaName: '', tableName: 'invoices' },
            { schemaName: '', tableName: 'payments' },
          ],
        },
      ]);
    });

    it.each(['tablegroup', 'TABLEGROUP', 'tableGroup'])(
      'reads the keyword %s in any letter case',
      keyword => {
        expect(parse(`${keyword} g {\n  a\n}`).tableGroups).toHaveLength(1);
      }
    );

    it('reads a quoted name and schema-qualified, quoted members', () => {
      const [group] = parse(`TableGroup "core tables" {
  sales.orders
  "sales"."order items"
  "users"
}`).tableGroups;

      expect(group.name).toBe('core tables');
      expect(group.tables).toEqual([
        { schemaName: 'sales', tableName: 'orders' },
        { schemaName: 'sales', tableName: 'order items' },
        { schemaName: '', tableName: 'users' },
      ]);
    });

    it('reads a group written on one line', () => {
      expect(parse('TableGroup g { a }').tableGroups[0].tables).toEqual([
        { schemaName: '', tableName: 'a' },
      ]);
    });

    it('reads the last part of a schema-qualified group name, which DBML refuses', () => {
      expect(parse('TableGroup s.g { a }').tableGroups[0].name).toBe('g');
    });

    it('reads a group with no name as an empty name', () => {
      expect(parse('TableGroup { a }').tableGroups[0]).toMatchObject({
        name: '',
        tables: [{ schemaName: '', tableName: 'a' }],
      });
    });

    it('reads the first name of a line naming two, which DBML refuses', () => {
      expect(
        parse('TableGroup g {\n  a b\n  c\n}').tableGroups[0].tables
      ).toEqual([
        { schemaName: '', tableName: 'a' },
        { schemaName: '', tableName: 'c' },
      ]);
    });

    it('keeps every member line, a repeated one too, for convert to resolve', () => {
      expect(
        parse('TableGroup g {\n  a\n  a\n}').tableGroups[0].tables
      ).toHaveLength(2);
    });

    it('reads past comments and lines it cannot read', () => {
      expect(
        parse(`TableGroup g {
  // the first
  a /* inline */
  !!
  b
}`).tableGroups[0].tables.map(({ tableName }) => tableName)
      ).toEqual(['a', 'b']);
    });

    it.each([
      ['#abc', '#abc'],
      ['#3498db', '#3498db'],
      ['red', ''],
      ['#3498DBAA', ''],
      ["'#3498DB'", ''],
      ['#3498 DB', ''],
    ])('reads the color %s as %j', (color, expected) => {
      expect(
        parse(`TableGroup g [color: ${color}] { a }`).tableGroups[0].color
      ).toBe(expected);
    });

    it('records nothing skipped for a group of a name, a color and tables', () => {
      expect(parse('TableGroup g [color: #abc] {\n  a\n}').skipped).toEqual([]);
    });

    it('records nothing for a setting with no key', () => {
      const model = parse("TableGroup g ['loose'] { a }");

      expect(model.skipped).toEqual([]);
      expect(model.tableGroups[0].tables).toHaveLength(1);
    });

    it('drops the note setting and every other setting, recording each kind once', () => {
      const model =
        parse(`TableGroup g1 [note: 'text', anykey: "v", color: #abc] { a }
TableGroup g2 [Note: 'more', anykey: 'w'] { b }`);

      expect(model.skipped).toEqual(['tablegroup note', 'tablegroup anykey']);
      expect(model.tableGroups.map(({ color }) => color)).toEqual(['#abc', '']);
    });

    it.each([
      ['a note entry', "Note: 'inner'"],
      ['a note block', "Note {\n    'inner'\n  }"],
      ['a triple-quoted note', "note: '''\n    inner\n  '''"],
    ])('drops %s, which names no table', (_, note) => {
      const model = parse(`TableGroup g {
  a
  ${note}
  b
}`);

      expect(
        model.tableGroups[0].tables.map(({ tableName }) => tableName)
      ).toEqual(['a', 'b']);
      expect(model.skipped).toEqual(['tablegroup note']);
    });

    it('reads a table named note as a member', () => {
      expect(parse('TableGroup g {\n  note\n}').tableGroups[0].tables).toEqual([
        { schemaName: '', tableName: 'note' },
      ]);
    });

    it('reads an empty group as one with no table', () => {
      expect(parse('TableGroup g {\n}').tableGroups[0].tables).toEqual([]);
    });

    it('reads a group with no body and the table after it', () => {
      const model = parse('TableGroup g\nTable t { a int }');

      expect(model.tableGroups).toEqual([{ name: 'g', color: '', tables: [] }]);
      expect(model.tables.map(({ name }) => name)).toEqual(['t']);
    });

    it('reads a group whose body never closes', () => {
      expect(parse('TableGroup g {\n  a').tableGroups[0].tables).toEqual([
        { schemaName: '', tableName: 'a' },
      ]);
    });

    it('keeps reading the tables after a group', () => {
      const model = parse(`TableGroup g {
  t
}
Table t { a int }`);

      expect(model.tables).toHaveLength(1);
      expect(model.tableGroups).toHaveLength(1);
    });
  });

  describe('elements read and discarded', () => {
    it.each([
      ['project', "Project p {\n  database_type: 'PostgreSQL'\n}"],
      ['note', "Note sticky {\n  'content'\n}"],
      ['unknown', 'unknown thing {\n}'],
    ])('records %s and keeps reading', (kind, source) => {
      const model = parse(`${source}
Table t { a int }`);

      expect(model.skipped).toContain(kind);
      expect(model.tables).toHaveLength(1);
    });

    it('records each kind once', () => {
      expect(
        parse(`Note n1 { 'a' }
Note n2 { 'b' }`).skipped
      ).toEqual(['note']);
    });

    it('skips a checks block inside a table', () => {
      expect(
        firstTable(`Table t {
  a int

  checks {
    (\`a > 0\`) [name: 'positive']
  }
}`).columns.map(entry => entry.name)
      ).toEqual(['a']);
    });

    it('skips a nested block without losing the table that follows', () => {
      expect(
        parse(`Project p {
  Note {
    'inner'
  }
}
Table t { a int }`).tables
      ).toHaveLength(1);
    });
  });

  describe('recovery', () => {
    it('keeps the tables around a line it cannot read', () => {
      expect(
        parse(`Table a { x int }
!! garbage !!
Table b { y int }`).tables.map(table => table.name)
      ).toEqual(['a', 'b']);
    });

    it('keeps the columns around one it cannot read', () => {
      expect(
        firstTable(`Table t {
  a int
  !!!
  b varchar
}`).columns.map(entry => entry.name)
      ).toEqual(['a', 'b']);
    });

    it('reads a table whose body never closes', () => {
      expect(
        firstTable(`Table t {
  a int`).columns
      ).toHaveLength(1);
    });

    it('reads a table with no body at all', () => {
      expect(parse('Table t').tables[0]).toMatchObject({
        name: 't',
        columns: [],
      });
    });

    it('never throws on a truncated document', () => {
      expect(parseDBMLModel('Table t { a int [pk').ok).toBe(true);
    });
  });
});
