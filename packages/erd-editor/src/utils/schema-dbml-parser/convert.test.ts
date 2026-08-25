import { ERDEditorSchemaV3 } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { COLUMN_MIN_WIDTH } from '@/constants/layout';
import {
  ColumnOption,
  ColumnUIKey,
  Database,
  OrderType,
  RelationshipType,
} from '@/constants/schema';
import { createEngineContext } from '@/engine/context';
import { Column, Table } from '@/internal-types';
import { convertToSchema } from '@/utils/schema-dbml-parser/convert';
import { parseDBMLModel } from '@/utils/schema-dbml-parser/parser';

const ctx = createEngineContext({ toWidth: text => text.length * 10 });

function convert(
  source: string,
  database: number = Database.MySQL
): ERDEditorSchemaV3 {
  const result = parseDBMLModel(source);
  if (!result.ok) throw new Error(result.message);
  return convertToSchema(result.model, ctx, database);
}

const tablesOf = (schema: ERDEditorSchemaV3): Table[] =>
  schema.doc.tableIds.map(id => schema.collections.tableEntities[id]);

const tableNames = (schema: ERDEditorSchemaV3): string[] =>
  tablesOf(schema).map(table => table.name);

function tableOf(schema: ERDEditorSchemaV3, name: string): Table {
  const table = tablesOf(schema).find(entry => entry.name === name);
  if (!table) throw new Error(`no table named ${name}`);
  return table;
}

const columnsOf = (schema: ERDEditorSchemaV3, name: string): Column[] =>
  tableOf(schema, name).columnIds.map(
    id => schema.collections.tableColumnEntities[id]
  );

function columnOf(
  schema: ERDEditorSchemaV3,
  tableName: string,
  columnName: string
): Column {
  const column = columnsOf(schema, tableName).find(
    entry => entry.name === columnName
  );
  if (!column) throw new Error(`no column named ${columnName}`);
  return column;
}

const relationshipsOf = (schema: ERDEditorSchemaV3) =>
  schema.doc.relationshipIds.map(
    id => schema.collections.relationshipEntities[id]
  );

const edgesOf = (schema: ERDEditorSchemaV3): string[] =>
  relationshipsOf(schema).map(relationship => {
    const names = (tableId: string, columnIds: string[]) =>
      `${schema.collections.tableEntities[tableId].name}(${columnIds
        .map(id => schema.collections.tableColumnEntities[id].name)
        .join(',')})`;

    return `${names(
      relationship.start.tableId,
      relationship.start.columnIds
    )} -> ${names(relationship.end.tableId, relationship.end.columnIds)}`;
  });

const indexesOf = (schema: ERDEditorSchemaV3) =>
  schema.doc.indexIds.map(id => schema.collections.indexEntities[id]);

const TWO_TABLES = `Table users {
  id int [pk]
}
Table posts {
  user_id int
}
`;

describe('schema-dbml-parser/convert', () => {
  it('produces an empty document for an empty model', () => {
    const schema = convert('');

    expect(schema.doc.tableIds).toEqual([]);
    expect(schema.doc.relationshipIds).toEqual([]);
    expect(schema.doc.indexIds).toEqual([]);
  });

  describe('tables', () => {
    it('registers the table under doc and collections', () => {
      const schema = convert('Table users { id int }');

      expect(tableNames(schema)).toEqual(['users']);
      expect(schema.doc.tableIds).toHaveLength(1);
    });

    it('carries the table comment', () => {
      expect(
        tableOf(convert("Table users [note: 'people'] { id int }"), 'users')
          .comment
      ).toBe('people');
    });

    it('measures the name and the comment', () => {
      const table = tableOf(
        convert("Table user_account [note: 'the people table'] { id int }"),
        'user_account'
      );

      expect(table.ui.widthName).toBe(120);
      expect(table.ui.widthComment).toBe(160);
    });

    it('never measures below the column minimum', () => {
      expect(tableOf(convert('Table u { id int }'), 'u').ui.widthName).toBe(
        COLUMN_MIN_WIDTH
      );
    });

    it('fills seqColumnIds alongside columnIds', () => {
      const table = tableOf(
        convert('Table users {\n  id int\n  name varchar\n}'),
        'users'
      );

      expect(table.seqColumnIds).toEqual(table.columnIds);
      expect(table.columnIds).toHaveLength(2);
    });
  });

  describe('schema qualification', () => {
    it('drops the schema when the document declares only one', () => {
      expect(
        tableNames(
          convert('Table app.users { id int }\nTable app.posts { id int }')
        )
      ).toEqual(['users', 'posts']);
    });

    it('prefixes the non-default schema when the document declares several', () => {
      expect(
        tableNames(
          convert('Table a.users { id int }\nTable b.users { id int }')
        )
      ).toEqual(['a_users', 'b_users']);
    });

    it('leaves the unqualified table bare beside a qualified one', () => {
      expect(
        tableNames(convert('Table users { id int }\nTable b.users { id int }'))
      ).toEqual(['users', 'b_users']);
    });

    it('treats an explicit public schema as the default one', () => {
      expect(
        tableNames(
          convert('Table public.users { id int }\nTable b.users { id int }')
        )
      ).toEqual(['users', 'b_users']);
    });
  });

  describe('columns', () => {
    const optionsOf = (settings: string) =>
      columnOf(convert(`Table t { a int ${settings} }`), 't', 'a').options;

    it('reads pk into the option bitmask', () => {
      expect(optionsOf('[pk]') & ColumnOption.primaryKey).toBeTruthy();
    });

    it('reads increment, unique and not null into the bitmask', () => {
      const options = optionsOf('[increment, unique, not null]');

      expect(options).toBe(
        ColumnOption.autoIncrement | ColumnOption.unique | ColumnOption.notNull
      );
    });

    it('writes the primary key bit into ui.keys as well as options', () => {
      expect(
        columnOf(convert('Table t { a int [pk] }'), 't', 'a').ui.keys
      ).toBe(ColumnUIKey.primaryKey);
    });

    it('carries the type, the default and the note', () => {
      expect(
        columnOf(
          convert(
            "Table t { a varchar(50) [default: 'x', note: 'the a column'] }"
          ),
          't',
          'a'
        )
      ).toMatchObject({
        dataType: 'varchar(50)',
        default: "'x'",
        comment: 'the a column',
      });
    });

    it('measures the type and the default', () => {
      const column = columnOf(
        convert("Table t { a varchar(50) [default: 'x'] }"),
        't',
        'a'
      );

      expect(column.ui.widthDataType).toBe(110);
      expect(column.ui.widthDefault).toBe(COLUMN_MIN_WIDTH);
    });

    it('reads a composite primary key from the index that declares it', () => {
      const schema = convert(`Table membership {
  user_id int
  group_id int
  joined_at timestamp

  Indexes {
    (user_id, group_id) [pk]
  }
}`);

      expect(
        columnsOf(schema, 'membership').map(column => [
          column.name,
          Boolean(column.options & ColumnOption.primaryKey),
        ])
      ).toEqual([
        ['user_id', true],
        ['group_id', true],
        ['joined_at', false],
      ]);
    });

    it('keeps the primary key index out of the index list', () => {
      expect(
        indexesOf(
          convert(`Table t {
  a int
  b int

  Indexes {
    (a, b) [pk]
  }
}`)
        )
      ).toEqual([]);
    });
  });

  describe('enum columns', () => {
    const ENUM_SOURCE = `Enum status {
  created
  shipped
}
Table orders {
  state status
}`;

    it('spells the members out on a dialect with an enum column', () => {
      expect(
        columnOf(convert(ENUM_SOURCE, Database.MySQL), 'orders', 'state')
      ).toMatchObject({
        dataType: "ENUM('created','shipped')",
        comment: '',
      });
    });

    it('keeps the members in the comment where the column cannot hold them', () => {
      expect(
        columnOf(convert(ENUM_SOURCE, Database.PostgreSQL), 'orders', 'state')
      ).toMatchObject({
        dataType: 'varchar(255)',
        comment: 'status: created | shipped',
      });
    });

    it('appends the members to a note the column already carries', () => {
      expect(
        columnOf(
          convert(
            `Enum status { created }
Table orders {
  state status [note: 'lifecycle']
}`,
            Database.PostgreSQL
          ),
          'orders',
          'state'
        ).comment
      ).toBe('lifecycle status: created');
    });
  });

  describe('standalone refs', () => {
    it('reads a one-to-many with the parent on the left', () => {
      const schema = convert(`${TWO_TABLES}Ref: users.id < posts.user_id`);

      expect(edgesOf(schema)).toEqual(['users(id) -> posts(user_id)']);
    });

    it('reads the reverse operator as the same relationship', () => {
      const schema = convert(`${TWO_TABLES}Ref: posts.user_id > users.id`);

      expect(edgesOf(schema)).toEqual(['users(id) -> posts(user_id)']);
    });

    it('reads a one-to-one with the left endpoint as the parent', () => {
      const schema = convert(`${TWO_TABLES}Ref: users.id - posts.user_id`);

      expect(edgesOf(schema)).toEqual(['users(id) -> posts(user_id)']);
      expect(relationshipsOf(schema)[0].relationshipType).toBe(
        RelationshipType.ZeroOne
      );
    });

    it('reads a composite ref as two positional lists', () => {
      const schema = convert(`Table a {
  x int
  y int
}
Table b {
  p int
  q int
}
Ref: a.(x, y) < b.(p, q)`);

      expect(edgesOf(schema)).toEqual(['a(x,y) -> b(p,q)']);
    });

    it('resolves an endpoint written against the alias', () => {
      const schema = convert(`Table users as U {
  id int [pk]
}
Table posts {
  user_id int
}
Ref: U.id < posts.user_id`);

      expect(edgesOf(schema)).toEqual(['users(id) -> posts(user_id)']);
    });

    it('resolves a schema-qualified endpoint against the right table', () => {
      const schema = convert(`Table a.users { id int }
Table b.users { id int }
Table posts { user_id int }
Ref: b.users.id < posts.user_id`);

      expect(edgesOf(schema)).toEqual(['b_users(id) -> posts(user_id)']);
    });

    it('marks the child columns as foreign keys', () => {
      const schema = convert(`${TWO_TABLES}Ref: users.id < posts.user_id`);

      expect(columnOf(schema, 'posts', 'user_id').ui.keys).toBe(
        ColumnUIKey.foreignKey
      );
    });

    it('keeps the primary key bit on a child column that is also a key', () => {
      const schema = convert(`Table users { id int [pk] }
Table profiles { user_id int [pk] }
Ref: users.id - profiles.user_id`);

      expect(columnOf(schema, 'profiles', 'user_id').ui.keys).toBe(
        ColumnUIKey.primaryKey | ColumnUIKey.foreignKey
      );
      expect(relationshipsOf(schema)[0].identification).toBe(true);
    });

    it('leaves a non-key child relationship unidentifying', () => {
      const schema = convert(`${TWO_TABLES}Ref: users.id < posts.user_id`);

      expect(relationshipsOf(schema)[0].identification).toBe(false);
    });

    it.each([
      ['<', false, RelationshipType.ZeroN],
      ['<', true, RelationshipType.OneN],
      ['-', false, RelationshipType.ZeroOne],
      ['-', true, RelationshipType.OneOnly],
    ])(
      'reads %s with a %s child column as the matching cardinality',
      (operator, mandatory, expected) => {
        const schema = convert(`Table users { id int [pk] }
Table posts { user_id int ${mandatory ? '[not null]' : ''} }
Ref: users.id ${operator} posts.user_id`);

        expect(relationshipsOf(schema)[0].relationshipType).toBe(expected);
      }
    );

    it('ignores the optionality markers and reads the child column instead', () => {
      const schema = convert(`Table users { id int [pk] }
Table posts { user_id int [not null] }
Ref: users.id ?<? posts.user_id`);

      expect(relationshipsOf(schema)[0].relationshipType).toBe(
        RelationshipType.OneN
      );
    });

    it('drops a ref naming a table that is not there', () => {
      expect(
        relationshipsOf(convert(`${TWO_TABLES}Ref: users.id < missing.user_id`))
      ).toEqual([]);
    });

    it('drops a ref naming a column that is not there', () => {
      expect(
        relationshipsOf(convert(`${TWO_TABLES}Ref: users.id < posts.missing`))
      ).toEqual([]);
    });

    it('drops a ref whose sides name a different number of columns', () => {
      expect(
        relationshipsOf(
          convert(`Table a {
  x int
  y int
}
Table b { p int }
Ref: a.(x, y) < b.p`)
        )
      ).toEqual([]);
    });

    it('drops the second ref between the same child columns', () => {
      expect(
        relationshipsOf(
          convert(`${TWO_TABLES}Ref: users.id < posts.user_id
Ref: users.id < posts.user_id`)
        )
      ).toHaveLength(1);
    });

    it('keeps two refs between one pair of tables on different columns', () => {
      const schema = convert(`Table users {
  id int [pk]
  code int
}
Table posts {
  author_id int
  editor_code int
}
Ref: users.id < posts.author_id
Ref: users.code < posts.editor_code`);

      expect(edgesOf(schema)).toEqual([
        'users(id) -> posts(author_id)',
        'users(code) -> posts(editor_code)',
      ]);
    });

    it('reads a self-referential ref', () => {
      const schema = convert(`Table node {
  id int [pk]
  parent_id int
}
Ref: node.id < node.parent_id`);

      expect(edgesOf(schema)).toEqual(['node(id) -> node(parent_id)']);
    });
  });

  describe('inline refs', () => {
    it('makes the annotated column the child for the many-to-one form', () => {
      const schema = convert(`Table users { id int [pk] }
Table posts { user_id int [ref: > users.id] }`);

      expect(edgesOf(schema)).toEqual(['users(id) -> posts(user_id)']);
    });

    it('makes the annotated column the parent for the one-to-many form', () => {
      const schema = convert(`Table users { id int [pk, ref: < posts.user_id] }
Table posts { user_id int }`);

      expect(edgesOf(schema)).toEqual(['users(id) -> posts(user_id)']);
    });

    it('makes the annotated column the child for the one-to-one form', () => {
      const schema = convert(`Table users { id int [pk] }
Table profiles { user_id int [ref: - users.id] }`);

      expect(edgesOf(schema)).toEqual(['users(id) -> profiles(user_id)']);
      expect(relationshipsOf(schema)[0].relationshipType).toBe(
        RelationshipType.ZeroOne
      );
    });

    it('resolves a target written against the alias', () => {
      const schema = convert(`Table users as U { id int [pk] }
Table posts { user_id int [ref: > U.id] }`);

      expect(edgesOf(schema)).toEqual(['users(id) -> posts(user_id)']);
    });

    it('drops an inline ref naming a table that is not there', () => {
      expect(
        relationshipsOf(convert('Table posts { user_id int [ref: > gone.id] }'))
      ).toEqual([]);
    });

    it('drops an inline ref naming a column that is not there', () => {
      expect(
        relationshipsOf(
          convert(`Table users { id int }
Table posts { user_id int [ref: > users.missing] }`)
        )
      ).toEqual([]);
    });

    it('does not repeat a ref the standalone form already stated', () => {
      expect(
        relationshipsOf(
          convert(`Table users { id int [pk] }
Table posts { user_id int [ref: > users.id] }
Ref: users.id < posts.user_id`)
        )
      ).toHaveLength(1);
    });
  });

  describe('many-to-many', () => {
    const MANY = `Table users { id int [pk] }
Table groups { id int [pk] }
Ref: users.id <> groups.id`;

    it('invents the junction table the diagram has no other way to hold', () => {
      expect(tableNames(convert(MANY))).toEqual([
        'users',
        'groups',
        'users_groups',
      ]);
    });

    it('says in the diagram that the table was inferred', () => {
      expect(tableOf(convert(MANY), 'users_groups').comment).toBe(
        'Junction table inferred from users <-> groups'
      );
    });

    it('gives the junction a key column per parent key', () => {
      expect(
        columnsOf(convert(MANY), 'users_groups').map(column => [
          column.name,
          column.dataType,
          column.options,
        ])
      ).toEqual([
        ['users_id', 'int', ColumnOption.primaryKey | ColumnOption.notNull],
        ['groups_id', 'int', ColumnOption.primaryKey | ColumnOption.notNull],
      ]);
    });

    it('binds the junction to both parents', () => {
      expect(edgesOf(convert(MANY))).toEqual([
        'users(id) -> users_groups(users_id)',
        'groups(id) -> users_groups(groups_id)',
      ]);
    });

    it('drops a many-to-many whose parent has no key', () => {
      expect(
        tableNames(
          convert(`Table users { id int }
Table groups { id int [pk] }
Ref: users.id <> groups.id`)
        )
      ).toEqual(['users', 'groups']);
    });
  });

  describe('indexes', () => {
    const INDEXED = `Table users {
  name varchar
  created_at timestamp

  Indexes {
    (name, created_at) [name: 'idx_user', unique]
  }
}`;

    it('registers the index with its name and flag', () => {
      expect(indexesOf(convert(INDEXED))[0]).toMatchObject({
        name: 'idx_user',
        unique: true,
      });
    });

    it('binds the index columns in the order they were named', () => {
      const schema = convert(INDEXED);
      const index = indexesOf(schema)[0];

      expect(
        index.indexColumnIds.map(
          id =>
            schema.collections.tableColumnEntities[
              schema.collections.indexColumnEntities[id].columnId
            ].name
        )
      ).toEqual(['name', 'created_at']);
    });

    it('fills seqIndexColumnIds alongside indexColumnIds', () => {
      const index = indexesOf(convert(INDEXED))[0];

      expect(index.seqIndexColumnIds).toEqual(index.indexColumnIds);
    });

    it('orders every index column ascending, which is all DBML states', () => {
      const schema = convert(INDEXED);

      expect(
        Object.values(schema.collections.indexColumnEntities).map(
          indexColumn => indexColumn.orderType
        )
      ).toEqual([OrderType.ASC, OrderType.ASC]);
    });

    it('drops an index whose columns all failed to resolve', () => {
      expect(
        indexesOf(
          convert(`Table users {
  name varchar

  Indexes {
    missing
  }
}`)
        )
      ).toEqual([]);
    });

    it('keeps the columns of an index that resolved in part', () => {
      const schema = convert(`Table users {
  name varchar

  Indexes {
    (name, missing)
  }
}`);

      expect(indexesOf(schema)[0].indexColumnIds).toHaveLength(1);
    });
  });
});
