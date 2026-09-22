import {
  createSchemaSQL,
  type DatabaseVendor,
  DatabaseVendorToDatabase,
} from '@dineug/erd-editor/peer.js';
import { toJson } from '@dineug/erd-editor-schema';
import { afterAll, describe, expect, it } from 'vite-plus/test';

import { createSeededPeer, SEED } from '@/__test-utils__/seed';
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
