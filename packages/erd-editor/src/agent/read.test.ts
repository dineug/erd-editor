// @vitest-environment node

import { toJson } from '@dineug/erd-editor-schema';
import { afterAll, describe, expect, it } from 'vite-plus/test';

import {
  createSeedValue,
  createUserStore,
  SEED,
} from '@/__test-utils__/agentSeed';
import { AgentToolError, AgentToolErrorCode } from '@/agent/errors';
import { createAgentPeer } from '@/agent/peer';
import { READ_FORMATS, readDocument, SQL_VENDORS } from '@/agent/read';
import { toAgentSnapshot } from '@/agent/snapshot';
import {
  type DatabaseVendor,
  DatabaseVendorToDatabase,
} from '@/constants/sql/database';
import { createSchemaSQL } from '@/utils/schema-sql';

const peer = createAgentPeer({ nickname: 'agent', presence: false });
peer.setInitialValue(createSeedValue());

afterAll(() => peer.destroy());

function refusal(read: () => string): AgentToolError {
  try {
    read();
  } catch (error) {
    if (error instanceof AgentToolError) return error;
    throw error;
  }
  throw new Error('the read was accepted');
}

describe('reading a document (AC-E12)', () => {
  it.each(SQL_VENDORS)(
    'writes the %s DDL byte for byte as the schema-sql generator does',
    vendor => {
      const sql = peer.read('sql', vendor);

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
    expect(peer.read('sql')).toBe(createSchemaSQL(peer.state));
    expect(peer.read('sql')).toBe(peer.read('sql', 'MySQL'));
  });

  it('gives the JSON the element’s value getter gives', () => {
    expect(peer.read('json')).toBe(toJson(peer.state));
    expect(peer.read('json')).toBe(peer.value);
  });

  it('gives the snapshot as compact JSON', () => {
    const snapshot = peer.read('snapshot');

    expect(snapshot).toBe(JSON.stringify(toAgentSnapshot(peer.state)));
    expect(snapshot).not.toContain('\n');
    expect(JSON.parse(snapshot).tables[0].id).toBe(SEED.users);
  });

  it('reads a headless store the way it reads the peer', () => {
    const user = createUserStore(createSeedValue());

    for (const format of ['snapshot', 'sql'] as const) {
      expect(readDocument(user.rxStore.state, format), format).toBe(
        peer.read(format)
      );
    }
    expect(readDocument(user.rxStore.state, 'json')).toBe(
      toJson(user.rxStore.state)
    );
    expect(READ_FORMATS).toEqual(['snapshot', 'sql', 'json']);

    user.destroy();
  });
});

describe('what a read refuses', () => {
  it('names every vendor when the one asked for is unknown', () => {
    for (const vendor of ['postgresql', 'Postgres', '']) {
      const error = refusal(() => peer.read('sql', vendor));

      expect(error.code).toBe(AgentToolErrorCode.invalidArgs);
      expect(error.tool).toBe('erd_read');
      expect(error.message).toBe(
        `vendor ${vendor} is unknown; use one of Databricks, MariaDB, MSSQL, MySQL, Oracle, PostgreSQL, Snowflake, SQLite`
      );
    }
  });

  it('takes a vendor for the sql format only', () => {
    expect(refusal(() => peer.read('json', 'MySQL')).message).toBe(
      'vendor applies to the sql format only, not json'
    );
  });

  it('names the formats when the one asked for is unknown', () => {
    expect(refusal(() => peer.read('ddl' as 'sql')).message).toBe(
      'format must be one of snapshot, sql, json, got ddl'
    );
  });

  it('refuses a read once the session is closed', () => {
    const closed = createAgentPeer({ nickname: 'agent', presence: false });
    closed.destroy();

    expect(refusal(() => closed.read('json')).code).toBe(
      AgentToolErrorCode.destroyed
    );
  });
});
