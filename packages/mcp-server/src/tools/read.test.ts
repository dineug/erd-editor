import {
  BracketType,
  createSchemaSQL,
  type DatabaseVendor,
  DatabaseVendorToDatabase,
  LockSettingType,
  SchemaSQLHeaderList,
  SchemaSQLStatementsList,
  settingsActions,
  settingsActions$,
} from '@dineug/erd-editor/peer.js';
import { toJson } from '@dineug/erd-editor-schema';
import { afterAll, describe, expect, it } from 'vite-plus/test';

import { createSeededPeer, SEED } from '@/__test-utils__/seed';
import { createWidePeer, wideTableName } from '@/__test-utils__/wide';
import { MAX_READ_CHARS } from '@/tools/budget';
import { ToolError, ToolErrorCode } from '@/tools/errors';
import {
  READ_FORMATS,
  readDocument,
  type ReadFormat,
  SQL_VENDORS,
} from '@/tools/read';
import { toAgentSnapshot } from '@/tools/snapshot';

const peer = createSeededPeer();

afterAll(() => peer.destroy());

const read = (format: ReadFormat, vendor?: string) =>
  readDocument(peer.state, format, vendor);

function refusal(call: () => string): ToolError {
  try {
    call();
  } catch (error) {
    if (error instanceof ToolError) return error;
    throw error;
  }
  throw new Error('the read was accepted');
}

describe('reading a document (AC-E12)', () => {
  it.each(SQL_VENDORS)(
    'writes the %s DDL byte for byte as the schema-sql generator does',
    vendor => {
      const sql = read('sql', vendor);

      expect(sql).toBe(
        createSchemaSQL(
          peer.state,
          DatabaseVendorToDatabase[vendor as DatabaseVendor]
        )
      );
      expect(sql).toContain('orders');
    }
  );

  it('writes the DDL of the document’s own database when no vendor is named', () => {
    expect(read('sql')).toBe(createSchemaSQL(peer.state));
    expect(read('sql')).toBe(read('sql', 'MySQL'));
  });

  it('gives the JSON the element’s value getter gives', () => {
    expect(read('json')).toBe(toJson(peer.state));
    expect(read('json')).toBe(peer.value);
  });

  it('gives the snapshot as compact JSON', () => {
    const snapshot = read('snapshot');

    expect(snapshot).toBe(JSON.stringify(toAgentSnapshot(peer.state)));
    expect(snapshot).not.toContain('\n');
    expect(JSON.parse(snapshot).tables[0].id).toBe(SEED.users);
  });
});

describe('the DDL of a document whose bracket type is locked', () => {
  it('quotes names as the file saves the bracket type, not as the screen shows it', () => {
    const other = createSeededPeer();
    other.dispatch([
      settingsActions.changeBracketTypeAction({ value: BracketType.backtick }),
    ]);

    expect(other.state.settings.bracketType).toBe(BracketType.backtick);
    expect(readDocument(other.state, 'sql', 'MySQL')).toBe(
      createSchemaSQL(peer.state, DatabaseVendorToDatabase.MySQL)
    );
    expect(
      readDocument(other.state, 'sql', 'MySQL', { tableIds: [SEED.users] })
    ).toContain('CREATE TABLE users');

    other.dispatch([
      settingsActions$.changeLockSettingsAction$(
        LockSettingType.bracketType,
        false
      ),
    ]);

    expect(readDocument(other.state, 'sql', 'MySQL')).toContain(
      'CREATE TABLE `users`'
    );
    other.destroy();
  });
});

describe('what a read refuses', () => {
  it('names every vendor when the one asked for is unknown', () => {
    for (const vendor of ['postgresql', 'Postgres', '']) {
      const error = refusal(() => read('sql', vendor));

      expect(error.code).toBe(ToolErrorCode.invalidArgs);
      expect(error.tool).toBe('erd_read');
      expect(error.message).toBe(
        `vendor ${vendor} is unknown; use one of Databricks, MariaDB, MSSQL, MySQL, Oracle, PostgreSQL, Snowflake, SQLite`
      );
    }
  });

  it('takes a vendor for the sql format only', () => {
    expect(refusal(() => read('json', 'MySQL')).message).toBe(
      'vendor applies to the sql format only, not json'
    );
  });

  it('names the formats when the one asked for is unknown', () => {
    expect(READ_FORMATS).toEqual(['snapshot', 'sql', 'json']);
    expect(refusal(() => read('ddl' as ReadFormat)).message).toBe(
      'format must be one of snapshot, sql, json, got ddl'
    );
  });
});

describe('the DDL of some tables', () => {
  it('holds only the tables named, with the foreign keys they hold', () => {
    const sql = readDocument(peer.state, 'sql', 'MySQL', {
      tableNames: ['ORDERS'],
    });

    expect(sql).toContain('CREATE TABLE orders');
    expect(sql).not.toContain('CREATE TABLE users');
    // orders holds the key of users, so the reference out of the selection shows.
    expect(sql).toMatch(/REFERENCES users/);
    expect(sql).toBe(
      readDocument(peer.state, 'sql', 'MySQL', {
        tableIds: [SEED.orders],
      })
    );
  });

  it('leaves out a foreign key a table left out holds', () => {
    const sql = readDocument(peer.state, 'sql', undefined, {
      tableIds: [SEED.users],
    });

    expect(sql).toContain('CREATE TABLE users');
    expect(sql).not.toContain('REFERENCES');
    expect(sql).not.toContain('CREATE INDEX');
  });

  it('refuses a table it cannot find, a list with none and a format other than sql', () => {
    expect(
      refusal(() =>
        readDocument(peer.state, 'sql', undefined, {
          tableIds: ['gone'],
          tableNames: ['nowhere', 'users'],
        })
      )
    ).toEqual(
      expect.objectContaining({
        code: ToolErrorCode.notFound,
        message: 'gone, nowhere name no live table; erd_list lists them',
      })
    );
    expect(
      refusal(() =>
        readDocument(peer.state, 'sql', undefined, { tableNames: ['x'] })
      ).message
    ).toBe('x names no live table; erd_list lists them');
    expect(
      refusal(() =>
        readDocument(peer.state, 'sql', undefined, { tableIds: [] })
      ).message
    ).toBe('tableIds and tableNames name no table; pass one at least');
    expect(
      refusal(() =>
        readDocument(peer.state, 'snapshot', undefined, { tableIds: [] })
      ).message
    ).toBe(
      'tableIds and tableNames apply to the sql format only, not snapshot; erd_get takes them too'
    );
  });
});

describe('a read too large for one answer', () => {
  const wide = createWidePeer(400);

  afterAll(() => wide.destroy());

  it.each([
    ['sql', /pass tableIds or tableNames for the tables the task needs/],
    ['snapshot', /find tables with erd_list \(query, namesOnly\)/],
    ['json', /read them with erd_get, or the sql format with tableNames$/],
  ] as const)(
    'is refused in the %s format with how to narrow it',
    (format, how) => {
      const error = refusal(() => readDocument(wide.state, format));

      expect(error.code).toBe(ToolErrorCode.tooLarge);
      expect(error.message).toMatch(
        /^this read is [\d,]+ characters, over the 40,000 one read returns; /
      );
      expect(error.message).toMatch(how);
    }
  );

  it('asks for fewer tables when the tables asked for are too many', () => {
    const error = refusal(() =>
      readDocument(wide.state, 'sql', undefined, {
        tableIds: wide.state.doc.tableIds,
      })
    );

    expect(error.code).toBe(ToolErrorCode.tooLarge);
    expect(error.message).toMatch(
      /^the DDL of the tables asked for is [\d,]+ characters, over the 40,000 one read returns; ask for fewer tables at a time$/
    );
  });

  it('answers the DDL of the tables a task needs', () => {
    const sql = readDocument(wide.state, 'sql', undefined, {
      tableNames: [wideTableName(0), wideTableName(1)],
    });

    expect(sql.match(/CREATE TABLE/g)).toHaveLength(2);
  });
});

/** The seed under a database name a header can write, with the scripts given. */
function createNamedPeer(scripts: { before?: string; after?: string } = {}) {
  const named = createSeededPeer();
  named.dispatch([
    settingsActions.changeDatabaseNameAction({ value: 'shop' }),
    ...(['before', 'after'] as const).flatMap(position => {
      const value = scripts[position];
      return value === undefined
        ? []
        : [settingsActions.changeDDLScriptAction({ position, value })];
    }),
  ]);
  return named;
}

describe('the statements and header of the DDL', () => {
  const named = createNamedPeer();

  afterAll(() => named.destroy());

  it('writes every pair for every vendor as the generator does', () => {
    for (const vendor of SQL_VENDORS) {
      const database = DatabaseVendorToDatabase[vendor as DatabaseVendor];
      for (const statements of SchemaSQLStatementsList) {
        for (const header of SchemaSQLHeaderList) {
          expect(
            readDocument(named.state, 'sql', vendor, undefined, {
              statements,
              header,
            }),
            `${vendor} ${statements} ${header}`
          ).toBe(
            createSchemaSQL(named.state, database, undefined, {
              statements,
              header,
            })
          );
        }
      }
    }
  });

  it('writes IF NOT EXISTS and a header where the vendor has them', () => {
    const sql = readDocument(named.state, 'sql', 'MySQL', undefined, {
      statements: 'ifNotExists',
      header: 'createAndUse',
    });

    expect(sql).toMatch(/^\nCREATE DATABASE IF NOT EXISTS shop;\nUSE shop;\n/);
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(
      readDocument(named.state, 'sql', 'PostgreSQL', undefined, {
        statements: 'recreate',
      })
    ).toMatch(/^\nDROP TABLE IF EXISTS /);
  });

  it('falls back to what the vendor has, as the Schema SQL tab does', () => {
    const asked = {
      statements: 'ifNotExists',
      header: 'createAndUse',
    } as const;

    expect(readDocument(named.state, 'sql', 'Oracle', undefined, asked)).toBe(
      readDocument(named.state, 'sql', 'Oracle', undefined, {
        statements: 'create',
        header: 'use',
      })
    );
    expect(
      readDocument(named.state, 'sql', 'SQLite', undefined, { header: 'use' })
    ).toBe(readDocument(named.state, 'sql', 'SQLite'));
  });

  it('writes no header while the database name is no plain identifier', () => {
    expect(
      readDocument(peer.state, 'sql', 'MySQL', undefined, {
        header: 'createAndUse',
      })
    ).toBe(readDocument(peer.state, 'sql', 'MySQL'));
  });

  it('applies the two to the DDL of some tables too', () => {
    const sql = readDocument(
      named.state,
      'sql',
      'MySQL',
      { tableNames: ['orders'] },
      { statements: 'ifNotExists', header: 'use' }
    );

    expect(sql).toMatch(/^\nUSE shop;\n/);
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS orders');
    expect(sql).not.toContain('CREATE TABLE IF NOT EXISTS users');
  });

  it('takes them for the sql format only', () => {
    for (const format of ['json', 'snapshot'] as const) {
      const error = refusal(() =>
        readDocument(named.state, format, undefined, undefined, {
          header: 'use',
        })
      );

      expect(error.code).toBe(ToolErrorCode.invalidArgs);
      expect(error.message).toBe(
        `statements and header apply to the sql format only, not ${format}`
      );
    }
    expect(
      refusal(() =>
        readDocument(named.state, 'json', undefined, undefined, {
          statements: 'recreate',
        })
      ).message
    ).toBe('statements and header apply to the sql format only, not json');
    expect(
      readDocument(named.state, 'json', undefined, undefined, {
        statements: undefined,
        header: undefined,
      })
    ).toBe(toJson(named.state));
  });
});

describe('the before and after scripts in the DDL', () => {
  const before = 'CREATE EXTENSION IF NOT EXISTS pgcrypto;';
  const after = 'GRANT SELECT ON users, orders TO PUBLIC;';

  it('writes them around the whole document, whatever the options', () => {
    const scripted = createNamedPeer({ before, after });

    const sql = readDocument(scripted.state, 'sql', 'PostgreSQL');
    expect(sql).toBe(
      createSchemaSQL(scripted.state, DatabaseVendorToDatabase.PostgreSQL)
    );
    expect(sql.startsWith(`\n${before}\n\nCREATE TABLE`)).toBe(true);
    expect(sql.endsWith(`\n\n${after}\n`)).toBe(true);
    expect(
      readDocument(scripted.state, 'sql', 'PostgreSQL', undefined, {
        statements: 'recreate',
        header: 'createAndUse',
      })
    ).toMatch(
      /^\nCREATE SCHEMA IF NOT EXISTS shop;\nSET search_path TO shop, public;\n\nCREATE EXTENSION IF NOT EXISTS pgcrypto;\n\nDROP TABLE IF EXISTS /
    );
    scripted.destroy();
  });

  it('leaves them out of the DDL of some tables', () => {
    const scripted = createNamedPeer({ before, after });

    const sql = readDocument(scripted.state, 'sql', 'PostgreSQL', {
      tableNames: ['users'],
    });
    expect(sql).toContain('CREATE TABLE users');
    expect(sql).not.toContain(before);
    expect(sql).not.toContain(after);
    scripted.destroy();
  });

  it('refuses a whole read the scripts make too large, which some tables still answer', () => {
    const long = `-- ${'x'.repeat(MAX_READ_CHARS)}`;
    const scripted = createNamedPeer({ after: long });

    const error = refusal(() => readDocument(scripted.state, 'sql'));
    expect(error.code).toBe(ToolErrorCode.tooLarge);
    expect(error.message).toMatch(/pass tableIds or tableNames/);
    expect(
      readDocument(scripted.state, 'sql', undefined, { tableNames: ['users'] })
    ).toContain('CREATE TABLE users');
    scripted.destroy();
  });
});
