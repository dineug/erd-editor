import {
  createSchemaSQL,
  type DatabaseVendor,
  DatabaseVendorToDatabase,
} from '@dineug/erd-editor/peer.js';
import { toJson } from '@dineug/erd-editor-schema';
import { afterAll, describe, expect, it } from 'vite-plus/test';

import { createSeededPeer, SEED } from '@/__test-utils__/seed';
import { createWidePeer, wideTableName } from '@/__test-utils__/wide';
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
