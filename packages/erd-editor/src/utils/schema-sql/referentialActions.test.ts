import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  ColumnOption,
  Database,
  ReferentialAction,
  ReferentialActionToSQL,
} from '@/constants/schema';
import { RootState } from '@/engine/state';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createSchemaSQL } from '@/utils/schema-sql';

function createState(onDelete: number, onUpdate: number): RootState {
  const state = {
    ...schemaV3Parser({}),
    editor: {},
    lww: {},
  } as unknown as RootState;

  state.collections.tableEntities = {
    'tbl-users': createTable({
      id: 'tbl-users',
      name: 'users',
      columnIds: ['col-id'],
    }),
    'tbl-posts': createTable({
      id: 'tbl-posts',
      name: 'posts',
      columnIds: ['col-post-id', 'col-user-id'],
    }),
  };
  state.collections.tableColumnEntities = {
    'col-id': createColumn({
      id: 'col-id',
      tableId: 'tbl-users',
      name: 'id',
      dataType: 'INT',
      options: ColumnOption.primaryKey | ColumnOption.notNull,
    }),
    'col-post-id': createColumn({
      id: 'col-post-id',
      tableId: 'tbl-posts',
      name: 'id',
      dataType: 'INT',
      options: ColumnOption.primaryKey | ColumnOption.notNull,
    }),
    'col-user-id': createColumn({
      id: 'col-user-id',
      tableId: 'tbl-posts',
      name: 'user_id',
      dataType: 'INT',
    }),
  };
  state.collections.relationshipEntities = {
    'rel-1': createRelationship({
      id: 'rel-1',
      onDelete,
      onUpdate,
      start: { tableId: 'tbl-users', columnIds: ['col-id'] },
      end: { tableId: 'tbl-posts', columnIds: ['col-user-id'] },
    }),
  };
  state.doc.tableIds = ['tbl-users', 'tbl-posts'];
  state.doc.relationshipIds = ['rel-1'];

  return state;
}

const { none, noAction, cascade, setNull, setDefault, restrict } =
  ReferentialAction;
const ACTIONS = [noAction, cascade, setNull, setDefault, restrict];

// What each vendor writes after ON DELETE and after ON UPDATE.
const SUPPORT: Array<[string, number, number[], number[]]> = [
  ['PostgreSQL', Database.PostgreSQL, ACTIONS, ACTIONS],
  ['SQLite', Database.SQLite, ACTIONS, ACTIONS],
  ['Snowflake', Database.Snowflake, ACTIONS, ACTIONS],
  [
    'MySQL',
    Database.MySQL,
    [noAction, cascade, setNull, restrict],
    [noAction, cascade, setNull, restrict],
  ],
  [
    'MariaDB',
    Database.MariaDB,
    [noAction, cascade, setNull, restrict],
    [noAction, cascade, setNull, restrict],
  ],
  [
    'MSSQL',
    Database.MSSQL,
    [noAction, cascade, setNull, setDefault],
    [noAction, cascade, setNull, setDefault],
  ],
  ['Oracle', Database.Oracle, [cascade, setNull], []],
  ['Databricks', Database.Databricks, [noAction], [noAction]],
];

describe('schema-sql referential actions', () => {
  describe.each(SUPPORT)('%s', (_name, database, onDelete, onUpdate) => {
    it('writes nothing for a relationship that sets no action', () => {
      const sql = createSchemaSQL(createState(none, none), database);

      expect(sql).not.toContain('ON DELETE');
      expect(sql).not.toContain('ON UPDATE');
    });

    it.each(ACTIONS)(
      'writes ON DELETE %i only where the vendor takes it',
      action => {
        const sql = createSchemaSQL(createState(action, none), database);
        const clause = `ON DELETE ${ReferentialActionToSQL[action]}`;

        expect(sql.includes(clause)).toBe(onDelete.includes(action));
        expect(sql).not.toContain('ON UPDATE');
      }
    );

    it.each(ACTIONS)(
      'writes ON UPDATE %i only where the vendor takes it',
      action => {
        const sql = createSchemaSQL(createState(none, action), database);
        const clause = `ON UPDATE ${ReferentialActionToSQL[action]}`;

        expect(sql.includes(clause)).toBe(onUpdate.includes(action));
        expect(sql).not.toContain('ON DELETE');
      }
    );
  });

  it.each([
    ['PostgreSQL', Database.PostgreSQL, ';'],
    ['MySQL', Database.MySQL, ';'],
    ['MariaDB', Database.MariaDB, ';'],
    ['Snowflake', Database.Snowflake, ';'],
    ['MSSQL', Database.MSSQL, '\nGO'],
  ])(
    'puts each clause on a line of its own before the end of the %s statement',
    (_name, database, end) => {
      const sql = createSchemaSQL(createState(cascade, setNull), database);
      const references = sql
        .split('\n')
        .findIndex(line => line.trim().startsWith('REFERENCES'));
      const lines = sql.split('\n').slice(references + 1, references + 3);

      expect(lines).toEqual([
        '    ON DELETE CASCADE',
        `    ON UPDATE SET NULL${end === ';' ? ';' : ''}`,
      ]);
      expect(sql).toContain(`    ON UPDATE SET NULL${end}\n`);
    }
  );

  it('writes the Oracle ON DELETE and never an ON UPDATE', () => {
    const sql = createSchemaSQL(createState(setNull, cascade), Database.Oracle);

    expect(sql).toContain(
      '    REFERENCES users (id)\n    ON DELETE SET NULL;\n'
    );
  });

  it('writes the Databricks option before the constraint state', () => {
    const sql = createSchemaSQL(
      createState(noAction, noAction),
      Database.Databricks
    );

    expect(sql).toContain(
      '    REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION NOT ENFORCED RELY;'
    );
  });

  it('writes the SQLite clauses inside the table, after the reference', () => {
    const sql = createSchemaSQL(
      createState(cascade, restrict),
      Database.SQLite
    );

    expect(sql).toContain(
      '  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE RESTRICT\n'
    );
  });
});
