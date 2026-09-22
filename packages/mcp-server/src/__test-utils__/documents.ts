import { createPeerStore } from '@dineug/erd-editor/peer.js';

import { runTool } from '@/tools/run';

export const SHOP_SQL = `
CREATE TABLE users (
  id INT NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE orders (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  total DECIMAL(10, 2),
  PRIMARY KEY (id),
  CONSTRAINT fk_orders_users FOREIGN KEY (user_id) REFERENCES users (id)
);
`;

/** A document built the way an import builds it, ids drawn fresh each time. */
export function documentFromSql(sql: string): string {
  const peer = createPeerStore({ nickname: 'seed', presence: false });
  try {
    runTool(peer, 'erd_import_sql', { value: sql });
    return peer.value;
  } finally {
    peer.destroy();
  }
}

export function emptyDocument(): string {
  const peer = createPeerStore({ nickname: 'seed', presence: false });
  try {
    return peer.value;
  } finally {
    peer.destroy();
  }
}

export type SnapshotTable = {
  id: string;
  name: string;
  comment: string;
  color: string;
  x: number;
  y: number;
  columns: Array<{
    id: string;
    name: string;
    dataType: string;
    primaryKey: boolean;
    notNull: boolean;
  }>;
};

export function tableNamed(snapshot: any, name: string): SnapshotTable {
  const table = snapshot.tables.find(
    (candidate: SnapshotTable) => candidate.name === name
  );
  if (!table) throw new Error(`no table named ${name}`);
  return table;
}

export function columnNamed(table: SnapshotTable, name: string) {
  const column = table.columns.find(candidate => candidate.name === name);
  if (!column) throw new Error(`no column ${name} in ${table.name}`);
  return column;
}
