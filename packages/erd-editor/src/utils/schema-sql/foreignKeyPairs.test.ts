import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnOption, Database } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createSchemaSQL } from '@/utils/schema-sql';

const KEY = ColumnOption.primaryKey | ColumnOption.notNull;

/**
 * A parent whose primary key is declared b then a, and a child holding a column
 * for each parent column. No relationship yet.
 */
function createDocument(): RootState {
  const state = {
    ...schemaV3Parser({}),
    editor: {},
    lww: {},
  } as unknown as RootState;
  const columns = [
    createColumn({ id: 'p-b', tableId: 'parent', name: 'b', options: KEY }),
    createColumn({ id: 'p-a', tableId: 'parent', name: 'a', options: KEY }),
    createColumn({ id: 'p-code', tableId: 'parent', name: 'code' }),
    createColumn({ id: 'c-id', tableId: 'child', name: 'id', options: KEY }),
    createColumn({ id: 'c-a', tableId: 'child', name: 'parent_a' }),
    createColumn({ id: 'c-b', tableId: 'child', name: 'parent_b' }),
    createColumn({ id: 'c-code', tableId: 'child', name: 'parent_code' }),
  ];
  columns.forEach(column => {
    column.dataType = 'INT';
    state.collections.tableColumnEntities[column.id] = column;
  });
  state.collections.tableEntities = {
    parent: createTable({
      id: 'parent',
      name: 'parent',
      columnIds: ['p-b', 'p-a', 'p-code'],
    }),
    child: createTable({
      id: 'child',
      name: 'child',
      columnIds: ['c-id', 'c-a', 'c-b', 'c-code'],
    }),
  };
  state.doc.tableIds = ['parent', 'child'];
  state.doc.relationshipIds = [];

  return state;
}

function relate(state: RootState, id: string, start: string[], end: string[]) {
  state.collections.relationshipEntities[id] = createRelationship({
    id,
    start: { tableId: 'parent', columnIds: start },
    end: { tableId: 'child', columnIds: end },
  });
  state.doc.relationshipIds.push(id);
}

/** The export of the same document with one relationship left unlisted. */
function withoutRelationship(state: RootState, id: string): RootState {
  return {
    ...state,
    doc: {
      ...state.doc,
      relationshipIds: state.doc.relationshipIds.filter(value => value !== id),
    },
  };
}

type ForeignKey = { name: string; columns: string[]; references: string[] };

function alterTable(end: string) {
  return ({ name, columns, references }: ForeignKey) =>
    [
      'ALTER TABLE child',
      `  ADD CONSTRAINT ${name}`,
      `    FOREIGN KEY (${columns.join(', ')})`,
      `    REFERENCES parent (${references.join(', ')})${end}`,
    ].join('\n');
}

function databricks({ name, columns, references }: ForeignKey) {
  const quote = (names: string[]) => names.map(v => `\`${v}\``).join(', ');
  return [
    'ALTER TABLE `child`',
    `  ADD CONSTRAINT \`${name}\``,
    `    FOREIGN KEY (${quote(columns)})`,
    `    REFERENCES \`parent\` (${quote(references)}) NOT ENFORCED RELY;`,
  ].join('\n');
}

// The seven databases that add a foreign key after the tables, each with the
// statement it writes for one.
const ALTER_TABLE: Array<[string, number, (key: ForeignKey) => string]> = [
  ['MySQL', Database.MySQL, alterTable(';')],
  ['MariaDB', Database.MariaDB, alterTable(';')],
  ['PostgreSQL', Database.PostgreSQL, alterTable(';')],
  ['MSSQL', Database.MSSQL, alterTable('\nGO')],
  ['Oracle', Database.Oracle, alterTable(';')],
  ['Snowflake', Database.Snowflake, alterTable(';')],
  ['Databricks', Database.Databricks, databricks],
];

describe.each(ALTER_TABLE)(
  'schema-sql/%s foreign key pairs',
  (_, database, statement) => {
    // With no index in the document the foreign keys end the export, one blank
    // line before each statement.
    const expectForeignKeys = (sql: string, keys: ForeignKey[]) => {
      const tail = `\n\n${keys.map(statement).join('\n\n')}\n`;

      expect(sql.slice(-tail.length)).toBe(tail);
      expect(sql.split('FOREIGN KEY')).toHaveLength(keys.length + 1);
    };

    it("orders a foreign key's pairs by the parent primary key", () => {
      const state = createDocument();
      relate(state, 'r1', ['p-a', 'p-b'], ['c-a', 'c-b']);

      expectForeignKeys(createSchemaSQL(state, database), [
        {
          name: 'FK_parent_TO_child',
          columns: ['parent_b', 'parent_a'],
          references: ['b', 'a'],
        },
      ]);
    });

    it('keeps the stored order when the start columns are not the primary key', () => {
      const state = createDocument();
      relate(state, 'r1', ['p-code', 'p-a'], ['c-code', 'c-a']);

      expectForeignKeys(createSchemaSQL(state, database), [
        {
          name: 'FK_parent_TO_child',
          columns: ['parent_code', 'parent_a'],
          references: ['code', 'a'],
        },
      ]);
    });

    it('skips a pair one of whose columns is gone, keeping the others paired', () => {
      const state = createDocument();
      relate(state, 'r1', ['p-a', 'p-b', 'p-code'], ['c-a', 'c-b', 'c-code']);
      state.collections.tableEntities.child.columnIds = [
        'c-id',
        'c-a',
        'c-code',
      ];

      expectForeignKeys(createSchemaSQL(state, database), [
        {
          name: 'FK_parent_TO_child',
          columns: ['parent_a', 'parent_code'],
          references: ['a', 'code'],
        },
      ]);
    });

    it('skips a relationship whose table is gone from the document', () => {
      const state = createDocument();
      relate(state, 'r1', ['p-a', 'p-b'], ['c-a', 'c-b']);
      state.doc.tableIds = ['parent'];

      const sql = createSchemaSQL(state, database);

      expect(sql).not.toContain('FOREIGN KEY');
      expect(sql).toBe(
        createSchemaSQL(withoutRelationship(state, 'r1'), database)
      );
    });

    it('writes nothing for a relationship with no pair left', () => {
      const state = createDocument();
      relate(state, 'r1', ['p-a', 'p-b'], ['c-a', 'c-b']);
      state.collections.tableEntities.child.columnIds = ['c-id', 'c-code'];

      const sql = createSchemaSQL(state, database);

      expect(sql).not.toContain('FOREIGN KEY');
      expect(sql).toBe(
        createSchemaSQL(withoutRelationship(state, 'r1'), database)
      );
    });

    it('skips a dangling relationship without using up a constraint name', () => {
      const state = createDocument();
      relate(state, 'r1', ['p-a', 'p-b'], ['c-a', 'c-b']);
      relate(state, 'r2', ['p-code'], ['c-removed']);
      relate(state, 'r3', ['p-code'], ['c-code']);

      const sql = createSchemaSQL(state, database);

      expectForeignKeys(sql, [
        {
          name: 'FK_parent_TO_child',
          columns: ['parent_b', 'parent_a'],
          references: ['b', 'a'],
        },
        {
          name: 'FK_parent_TO_child1',
          columns: ['parent_code'],
          references: ['code'],
        },
      ]);
      expect(sql).toBe(
        createSchemaSQL(withoutRelationship(state, 'r2'), database)
      );
    });

    it('writes the tables named and the foreign keys they hold, to a parent it leaves out', () => {
      const state = createDocument();
      relate(state, 'r1', ['p-a', 'p-b'], ['c-a', 'c-b']);

      const sql = createSchemaSQL(state, database, ['child']);

      expect(sql).toMatch(/CREATE TABLE \W?child/);
      expect(sql).not.toMatch(/CREATE TABLE \W?parent/);
      expectForeignKeys(sql, [
        {
          name: 'FK_parent_TO_child',
          columns: ['parent_b', 'parent_a'],
          references: ['b', 'a'],
        },
      ]);
    });

    it('leaves out a foreign key a table left out holds', () => {
      const state = createDocument();
      relate(state, 'r1', ['p-a', 'p-b'], ['c-a', 'c-b']);

      const sql = createSchemaSQL(state, database, ['parent']);

      expect(sql).toMatch(/CREATE TABLE \W?parent/);
      expect(sql).not.toMatch(/CREATE TABLE \W?child/);
      expect(sql).not.toContain('FOREIGN KEY');
    });

    it('skips the foreign key of a table named whose parent is gone from the document', () => {
      const state = createDocument();
      relate(state, 'r1', ['p-a', 'p-b'], ['c-a', 'c-b']);
      state.doc.tableIds = ['child'];

      expect(createSchemaSQL(state, database, ['child'])).not.toContain(
        'FOREIGN KEY'
      );
    });
  }
);

describe('schema-sql/SQLite foreign key pairs', () => {
  const childTable = (...clauses: string[]) =>
    [
      'CREATE TABLE child',
      '(',
      '  id          INT NOT NULL,',
      '  parent_a    INT NULL    ,',
      '  parent_b    INT NULL    ,',
      '  parent_code INT NULL    ,',
      ...clauses,
      ');',
    ].join('\n');

  it("orders a foreign key's pairs by the parent primary key", () => {
    const state = createDocument();
    relate(state, 'r1', ['p-a', 'p-b'], ['c-a', 'c-b']);

    expect(createSchemaSQL(state, Database.SQLite)).toContain(
      childTable(
        '  PRIMARY KEY (id),',
        '  FOREIGN KEY (parent_b, parent_a) REFERENCES parent (b, a)'
      )
    );
  });

  it('keeps the stored order when the start columns are not the primary key', () => {
    const state = createDocument();
    relate(state, 'r1', ['p-code', 'p-a'], ['c-code', 'c-a']);

    expect(createSchemaSQL(state, Database.SQLite)).toContain(
      childTable(
        '  PRIMARY KEY (id),',
        '  FOREIGN KEY (parent_code, parent_a) REFERENCES parent (code, a)'
      )
    );
  });

  it('skips a pair one of whose columns is gone, keeping the others paired', () => {
    const state = createDocument();
    relate(state, 'r1', ['p-a', 'p-b', 'p-code'], ['c-a', 'c-b', 'c-code']);
    state.collections.tableEntities.parent.columnIds = ['p-a', 'p-code'];

    expect(createSchemaSQL(state, Database.SQLite)).toContain(
      childTable(
        '  PRIMARY KEY (id),',
        '  FOREIGN KEY (parent_a, parent_code) REFERENCES parent (a, code)'
      )
    );
  });

  it('skips a relationship whose table is gone from the document', () => {
    const state = createDocument();
    relate(state, 'r1', ['p-a', 'p-b'], ['c-a', 'c-b']);
    state.doc.tableIds = ['child'];

    expect(createSchemaSQL(state, Database.SQLite)).toBe(
      `\n${childTable('  PRIMARY KEY (id)')}\n`
    );
  });

  it('writes nothing for a relationship with no pair left', () => {
    const state = createDocument();
    relate(state, 'r1', ['p-a', 'p-b'], ['c-removed-a', 'c-removed-b']);

    expect(createSchemaSQL(state, Database.SQLite)).toContain(
      childTable('  PRIMARY KEY (id)')
    );
  });

  it('writes the tables named and the foreign keys they hold, to a parent it leaves out', () => {
    const state = createDocument();
    relate(state, 'r1', ['p-a', 'p-b'], ['c-a', 'c-b']);

    expect(createSchemaSQL(state, Database.SQLite, ['child'])).toBe(
      `\n${childTable(
        '  PRIMARY KEY (id),',
        '  FOREIGN KEY (parent_b, parent_a) REFERENCES parent (b, a)'
      )}\n`
    );
  });

  it('skips the foreign key of a table named whose parent is gone from the document', () => {
    const state = createDocument();
    relate(state, 'r1', ['p-a', 'p-b'], ['c-a', 'c-b']);
    state.doc.tableIds = ['child'];

    expect(createSchemaSQL(state, Database.SQLite, ['child'])).toBe(
      `\n${childTable('  PRIMARY KEY (id)')}\n`
    );
  });

  it('skips a dangling relationship between two it writes', () => {
    const state = createDocument();
    relate(state, 'r1', ['p-a', 'p-b'], ['c-a', 'c-b']);
    relate(state, 'r2', ['p-code'], ['c-removed']);
    relate(state, 'r3', ['p-code'], ['c-code']);

    expect(createSchemaSQL(state, Database.SQLite)).toContain(
      childTable(
        '  PRIMARY KEY (id),',
        '  FOREIGN KEY (parent_b, parent_a) REFERENCES parent (b, a),',
        '  FOREIGN KEY (parent_code) REFERENCES parent (code)'
      )
    );
  });
});
