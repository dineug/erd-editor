import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  BracketType,
  ColumnOption,
  Database,
  OrderType,
  ReferentialAction,
} from '@/constants/schema';
import { RootState } from '@/engine/state';
import { createIndex } from '@/utils/collection/index.entity';
import { createIndexColumn } from '@/utils/collection/indexColumn.entity';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import {
  createSchemaSQL,
  oracleLongNames,
  SchemaSQLHeader,
  SchemaSQLHeaderList,
  SchemaSQLStatements,
  SchemaSQLStatementsList,
  schemaSQLTables,
} from '@/utils/schema-sql';

import { createSchema as createSchemaDatabricks } from './Databricks';
import { createSchema as createSchemaMariaDB } from './MariaDB';
import { createSchema as createSchemaMSSQL } from './MSSQL';
import { createSchema as createSchemaMySQL } from './MySQL';
import { createSchema as createSchemaOracle } from './Oracle';
import { createSchema as createSchemaPostgreSQL } from './PostgreSQL';
import { createSchema as createSchemaSnowflake } from './Snowflake';
import { createSchema as createSchemaSQLite } from './SQLite';

const VENDORS = [
  'MySQL',
  'MariaDB',
  'PostgreSQL',
  'Oracle',
  'MSSQL',
  'SQLite',
  'Snowflake',
  'Databricks',
] as const;
type Vendor = (typeof VENDORS)[number];

const CREATE_SCHEMA: Record<
  Vendor,
  (state: RootState, tableIds?: readonly string[]) => string
> = {
  MySQL: createSchemaMySQL,
  MariaDB: createSchemaMariaDB,
  PostgreSQL: createSchemaPostgreSQL,
  Oracle: createSchemaOracle,
  MSSQL: createSchemaMSSQL,
  SQLite: createSchemaSQLite,
  Snowflake: createSchemaSnowflake,
  Databricks: createSchemaDatabricks,
};

type Scripts = { before: string; after: string };

// The pair each vendor's script fixtures were written with: SQL that vendor
// runs, the MSSQL after script already ending its batch.
const SCRIPTS: Record<Vendor, Scripts> = {
  MySQL: {
    before: 'SET NAMES utf8mb4;',
    after:
      'CREATE OR REPLACE VIEW member_email AS SELECT id, email FROM member;',
  },
  MariaDB: {
    before: 'SET NAMES utf8mb4;',
    after:
      'CREATE OR REPLACE VIEW member_email AS SELECT id, email FROM member;',
  },
  PostgreSQL: {
    before: 'CREATE EXTENSION IF NOT EXISTS pgcrypto;',
    after: 'GRANT SELECT ON member, post TO PUBLIC;',
  },
  Oracle: {
    before: "BEGIN\n  DBMS_OUTPUT.PUT_LINE('ddl start');\nEND;\n/",
    after:
      'CREATE OR REPLACE VIEW member_email AS SELECT id, email FROM member;',
  },
  MSSQL: {
    before: 'CREATE SCHEMA app',
    after:
      'CREATE OR ALTER VIEW member_email AS SELECT id, email FROM member\nGO',
  },
  SQLite: {
    before: 'PRAGMA journal_mode=WAL;',
    after:
      'CREATE VIEW IF NOT EXISTS member_email AS SELECT id, email FROM member;',
  },
  Snowflake: {
    before: "ALTER SESSION SET TIMEZONE = 'UTC';",
    after: 'ALTER TABLE post CLUSTER BY (title);',
  },
  Databricks: {
    before: "SET TIME ZONE 'UTC';",
    after: 'ALTER TABLE `post` CLUSTER BY (`member_id`);',
  },
};

type Combination = [SchemaSQLStatements, SchemaSQLHeader];

// create with no header, then the editor default and drop and re-create under
// its header, each as the vendor writes it.
const SCRIPT_COMBINATIONS: Record<Vendor, Combination[]> = {
  MySQL: [
    ['create', 'none'],
    ['ifNotExists', 'createAndUse'],
    ['recreate', 'createAndUse'],
  ],
  MariaDB: [
    ['create', 'none'],
    ['ifNotExists', 'createAndUse'],
    ['recreate', 'createAndUse'],
  ],
  PostgreSQL: [
    ['create', 'none'],
    ['ifNotExists', 'createAndUse'],
    ['recreate', 'createAndUse'],
  ],
  Oracle: [
    ['create', 'none'],
    ['create', 'use'],
    ['recreate', 'use'],
  ],
  MSSQL: [
    ['create', 'none'],
    ['create', 'createAndUse'],
    ['recreate', 'createAndUse'],
  ],
  SQLite: [
    ['create', 'none'],
    ['ifNotExists', 'none'],
    ['recreate', 'none'],
  ],
  Snowflake: [
    ['create', 'none'],
    ['create', 'createAndUse'],
    ['recreate', 'createAndUse'],
  ],
  Databricks: [
    ['create', 'none'],
    ['ifNotExists', 'createAndUse'],
    ['recreate', 'createAndUse'],
  ],
};

interface SampleVariant {
  memberName?: string;
  memberIdType?: string;
  postMemberIdType?: string;
  databaseName?: string;
  bracketType?: number;
  ddlScripts?: Scripts;
}

// The two-table sample every options fixture was written from; a variant
// changes a name, the key types, the database name or the scripts.
function createSampleState({
  memberName = 'member',
  memberIdType = 'INT',
  postMemberIdType = 'INT',
  databaseName = 'shop',
  bracketType = BracketType.none,
  ddlScripts,
}: SampleVariant = {}): RootState {
  const state = {
    ...schemaV3Parser(ddlScripts ? { settings: { ddlScripts } } : {}),
    editor: {},
    lww: {},
  } as unknown as RootState;
  const key =
    ColumnOption.primaryKey | ColumnOption.notNull | ColumnOption.autoIncrement;
  const columns = [
    createColumn({
      id: 'm1',
      tableId: 'tm',
      name: 'id',
      dataType: memberIdType,
      options: key,
    }),
    createColumn({
      id: 'm2',
      tableId: 'tm',
      name: 'email',
      dataType: 'VARCHAR(255)',
      options: ColumnOption.notNull | ColumnOption.unique,
    }),
    createColumn({
      id: 'p1',
      tableId: 'tp',
      name: 'id',
      dataType: 'INT',
      options: key,
    }),
    createColumn({
      id: 'p2',
      tableId: 'tp',
      name: 'member_id',
      dataType: postMemberIdType,
      options: ColumnOption.notNull,
    }),
    createColumn({
      id: 'p3',
      tableId: 'tp',
      name: 'title',
      dataType: 'VARCHAR(200)',
      options: ColumnOption.notNull,
    }),
  ];

  state.settings.databaseName = databaseName;
  state.settings.bracketType = bracketType;
  state.collections.tableEntities = {
    tm: createTable({
      id: 'tm',
      name: memberName,
      comment: 'Members',
      columnIds: ['m1', 'm2'],
    }),
    tp: createTable({ id: 'tp', name: 'post', columnIds: ['p1', 'p2', 'p3'] }),
  };
  state.collections.tableColumnEntities = Object.fromEntries(
    columns.map(column => [column.id, column])
  );
  state.collections.relationshipEntities = {
    rp: createRelationship({
      id: 'rp',
      onDelete: ReferentialAction.cascade,
      start: { tableId: 'tm', columnIds: ['m1'] },
      end: { tableId: 'tp', columnIds: ['p2'] },
    }),
  };
  state.collections.indexEntities = {
    ix: createIndex({
      id: 'ix',
      name: 'idx_post_title',
      tableId: 'tp',
      indexColumnIds: ['ic'],
    }),
  };
  state.collections.indexColumnEntities = {
    ic: createIndexColumn({
      id: 'ic',
      indexId: 'ix',
      columnId: 'p3',
      orderType: OrderType.ASC,
    }),
  };
  state.doc.tableIds = ['tm', 'tp'];
  state.doc.relationshipIds = ['rp'];
  state.doc.indexIds = ['ix'];

  return state;
}

/** Adds, last in the document, an index whose one column has left its table, which no vendor writes. */
function withDeadIndex(state: RootState): RootState {
  state.collections.indexEntities.dead = createIndex({
    id: 'dead',
    name: 'idx_member_gone',
    tableId: 'tm',
    indexColumnIds: ['gone'],
  });
  state.collections.indexColumnEntities.gone = createIndexColumn({
    id: 'gone',
    indexId: 'dead',
    columnId: 'removed',
    orderType: OrderType.ASC,
  });
  state.doc.indexIds = [...state.doc.indexIds, 'dead'];
  return state;
}

function createEmptyState(ddlScripts?: Scripts): RootState {
  const state = {
    ...schemaV3Parser(ddlScripts ? { settings: { ddlScripts } } : {}),
    editor: {},
    lww: {},
  } as unknown as RootState;
  state.settings.databaseName = 'shop';
  return state;
}

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  '__fixtures__',
  'options'
);

function readFixture(path: string): string {
  return readFileSync(join(FIXTURES, path), 'utf8');
}

describe('createSchemaSQL options', () => {
  describe.each(VENDORS)('%s', vendor => {
    const combinations = SchemaSQLStatementsList.flatMap(statements =>
      SchemaSQLHeaderList.map(header => [statements, header] as Combination)
    );

    it.each(combinations)(
      'writes %s with the %s header',
      (statements, header) => {
        expect(
          createSchemaSQL(createSampleState(), Database[vendor], undefined, {
            statements,
            header,
          })
        ).toBe(readFixture(`${vendor}/${statements}-${header}.sql`));
      }
    );

    it.each(SCRIPT_COMBINATIONS[vendor])(
      'writes the scripts around %s with the %s header',
      (statements, header) => {
        const state = createSampleState({ ddlScripts: SCRIPTS[vendor] });

        expect(
          createSchemaSQL(state, Database[vendor], undefined, {
            statements,
            header,
          })
        ).toBe(readFixture(`${vendor}/${statements}-${header}-scripts.sql`));
      }
    );

    it.each(SCRIPT_COMBINATIONS[vendor])(
      'keeps one blank line before the after script past an index it cannot write, around %s with the %s header',
      (statements, header) => {
        const state = withDeadIndex(
          createSampleState({ ddlScripts: SCRIPTS[vendor] })
        );

        expect(
          createSchemaSQL(state, Database[vendor], undefined, {
            statements,
            header,
          })
        ).toBe(readFixture(`${vendor}/${statements}-${header}-scripts.sql`));
      }
    );

    it('ends as the vendor always has past an index it cannot write, given no script', () => {
      const state = withDeadIndex(createSampleState());

      expect(createSchemaSQL(state, Database[vendor])).toBe(
        CREATE_SCHEMA[vendor](state)
      );
    });

    it('writes the create batch with no header when given no options', () => {
      const state = createSampleState();

      expect(createSchemaSQL(state, Database[vendor])).toBe(
        readFixture(`${vendor}/create-none.sql`)
      );
      expect(createSchemaSQL(state, Database[vendor])).toBe(
        CREATE_SCHEMA[vendor](state)
      );
    });

    it('writes the document scripts when given no options', () => {
      const state = createSampleState({ ddlScripts: SCRIPTS[vendor] });

      expect(createSchemaSQL(state, Database[vendor])).toBe(
        readFixture(`${vendor}/create-none-scripts.sql`)
      );
    });

    it('writes no script for a few tables, only the statements and header', () => {
      const state = createSampleState({ ddlScripts: SCRIPTS[vendor] });
      const options = { statements: 'recreate', header: 'none' } as const;

      expect(
        createSchemaSQL(state, Database[vendor], ['tm', 'tp'], options)
      ).toBe(readFixture(`${vendor}/recreate-none.sql`));
    });

    it('writes an empty document as the empty string, whatever the options', () => {
      const state = createEmptyState();

      combinations.forEach(([statements, header]) => {
        expect(
          createSchemaSQL(state, Database[vendor], undefined, {
            statements,
            header,
          })
        ).toBe('');
      });
    });
  });

  it('writes the scripts of a document without tables, the header first', () => {
    const state = createEmptyState({ before: 'SET a;', after: 'SET b;' });

    expect(createSchemaSQL(state, Database.MySQL)).toBe('\nSET a;\n\nSET b;\n');
    expect(
      createSchemaSQL(state, Database.MySQL, undefined, {
        statements: 'recreate',
        header: 'use',
      })
    ).toBe('\nUSE shop;\n\nSET a;\n\nSET b;\n');
  });

  it('writes nothing for a document without tables given table ids', () => {
    const state = createEmptyState({ before: 'SET a;', after: 'SET b;' });

    expect(createSchemaSQL(state, Database.MySQL, [])).toBe('');
  });

  it('writes one script alone where the other is empty', () => {
    const state = createSampleState({
      ddlScripts: { before: '', after: 'GRANT SELECT ON member TO PUBLIC;' },
    });

    expect(createSchemaSQL(state, Database.PostgreSQL)).toBe(
      readFixture('PostgreSQL/create-none.sql').replace(
        /\n$/,
        '\n\nGRANT SELECT ON member TO PUBLIC;\n'
      )
    );
  });

  it('reads a state without scripts as having none', () => {
    const state = createSampleState();
    delete (state.settings as Partial<RootState['settings']>).ddlScripts;

    expect(createSchemaSQL(state, Database.MySQL)).toBe(
      readFixture('MySQL/create-none.sql')
    );
  });

  it('writes no header and no schema on a DROP for a name that is no identifier', () => {
    const state = createSampleState({ databaseName: 'my shop' });

    expect(
      createSchemaSQL(state, Database.MySQL, undefined, {
        statements: 'ifNotExists',
        header: 'createAndUse',
      })
    ).toBe(readFixture('MySQL/ifNotExists-createAndUse-invalid-name.sql'));
    expect(
      createSchemaSQL(state, Database.PostgreSQL, undefined, {
        statements: 'recreate',
        header: 'createAndUse',
      })
    ).toBe(readFixture('PostgreSQL/recreate-createAndUse-invalid-name.sql'));
  });

  it('writes no header for an empty database name', () => {
    const state = createSampleState({ databaseName: '' });

    expect(
      createSchemaSQL(state, Database.MSSQL, undefined, {
        header: 'createAndUse',
      })
    ).toBe(readFixture('MSSQL/create-none.sql'));
  });

  it('reads an unknown statements or header value as create and none', () => {
    const state = createSampleState();

    expect(
      createSchemaSQL(state, Database.MySQL, undefined, {
        statements: 'merge',
        header: 'switch',
      } as never)
    ).toBe(readFixture('MySQL/create-none.sql'));
  });

  it('follows settings.database when no database is given', () => {
    const state = createSampleState();
    state.settings.database = Database.SQLite;

    expect(
      createSchemaSQL(state, undefined, undefined, {
        statements: 'ifNotExists',
      })
    ).toBe(readFixture('SQLite/ifNotExists-none.sql'));
  });

  it('writes nothing for a database it does not know', () => {
    const state = createSampleState({ ddlScripts: SCRIPTS.MySQL });

    expect(createSchemaSQL(state, 3)).toBe('');
  });

  it('writes the identity comment under the PostgreSQL defaults', () => {
    const state = createSampleState({
      memberIdType: 'UUID',
      postMemberIdType: 'UUID',
    });

    expect(
      createSchemaSQL(state, Database.PostgreSQL, undefined, {
        statements: 'ifNotExists',
        header: 'createAndUse',
      })
    ).toBe(
      readFixture('PostgreSQL/d14-1-uuid-pk-ifNotExists-createAndUse.sql')
    );
  });

  it('writes the long Oracle names as they are', () => {
    const state = createSampleState({
      memberName: 'member_notification_settings',
    });

    expect(createSchemaSQL(state, Database.Oracle)).toBe(
      readFixture('Oracle/d14-2-long-names-create-none.sql')
    );
    expect(oracleLongNames(state)).toEqual(
      JSON.parse(readFixture('Oracle/d14-2-long-names.json')).over30Bytes
    );
  });

  it('quotes the header name as the tables are', () => {
    const state = createSampleState({ bracketType: BracketType.backtick });

    expect(
      createSchemaSQL(state, Database.MySQL, undefined, {
        header: 'createAndUse',
      })
    ).toMatch(/^\nCREATE DATABASE IF NOT EXISTS `shop`;\nUSE `shop`;\n\n/);
  });
});

describe('schemaSQLTables', () => {
  it('names the tables in the order the DDL writes them', () => {
    const state = createSampleState({ memberName: 'Zebra' });

    expect(schemaSQLTables(state)).toEqual(['post', 'Zebra']);
    expect(schemaSQLTables(createEmptyState())).toEqual([]);
  });
});
