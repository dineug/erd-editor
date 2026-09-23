import { createPeerStore, type PeerStore } from '@dineug/erd-editor/peer.js';

import { runTool } from '@/tools/run';

const WORDS = ['customer', 'order', 'payment', 'product', 'shipment'];

/** The name of table i of a wide schema, padded out to length when one is given. */
export function wideTableName(i: number, length = 0): string {
  const name = `${WORDS[i % WORDS.length]}_${String(i).padStart(4, '0')}`;
  return name.padEnd(length, '_x');
}

/**
 * MySQL DDL of n tables named by wideTableName, each with a key, a code, a
 * commented amount and indexes on its code, every table after the first
 * holding a foreign key to the table at half its index.
 */
export function wideSchemaSql(n: number, nameLength = 0, indexes = 0): string {
  const name = (i: number) => wideTableName(i, nameLength);
  const indexSql = (i: number) =>
    Array.from(
      { length: indexes },
      (_, k) => `\nCREATE INDEX ix_${i}_${k} ON ${name(i)} (code);`
    ).join('');
  return Array.from({ length: n }, (_, i) => {
    const lines = [
      'id BIGINT NOT NULL',
      'code VARCHAR(40) NOT NULL',
      "amount DECIMAL(12,2) NULL COMMENT 'charged total'",
      'PRIMARY KEY (id)',
    ];
    if (i > 0) {
      const parent = name(Math.floor(i / 2));
      lines.splice(3, 0, `${parent}_id BIGINT NULL`);
      lines.push(`FOREIGN KEY (${parent}_id) REFERENCES ${parent} (id)`);
    }
    return `CREATE TABLE ${name(i)} (\n  ${lines.join(',\n  ')}\n);${indexSql(i)}`;
  }).join('\n\n');
}

/** A peer holding a wide schema of n tables, imported as the MCP server would. */
export function createWidePeer(
  n: number,
  nameLength = 0,
  indexes = 0
): PeerStore {
  const peer = createPeerStore({ nickname: 'wide', presence: false });
  runTool(peer, 'erd_import_sql', {
    value: wideSchemaSql(n, nameLength, indexes),
  });
  return peer;
}

/** MySQL DDL of a tenant table and n tables that each hold a foreign key to it. */
export function hubSchemaSql(n: number): string {
  const tenant =
    'CREATE TABLE tenant (\n  id BIGINT NOT NULL,\n  PRIMARY KEY (id)\n);';
  return [
    tenant,
    ...Array.from(
      { length: n },
      (_, i) =>
        `CREATE TABLE ${wideTableName(i)} (\n  id BIGINT NOT NULL,\n  tenant_id BIGINT NOT NULL,\n  PRIMARY KEY (id),\n  FOREIGN KEY (tenant_id) REFERENCES tenant (id)\n);`
    ),
  ].join('\n\n');
}

/** A peer holding a tenant table that n tables refer to, the shape of a multi-tenant schema. */
export function createHubPeer(n: number): PeerStore {
  const peer = createPeerStore({ nickname: 'hub', presence: false });
  runTool(peer, 'erd_import_sql', { value: hubSchemaSql(n) });
  return peer;
}
