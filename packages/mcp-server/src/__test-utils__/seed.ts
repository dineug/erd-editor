import {
  createPeerStore,
  indexActions,
  indexColumnActions,
  memoActions,
  type PeerStore,
  relationshipActions,
  RelationshipType,
  settingsActions,
  tableActions,
  tableColumnActions,
  tableGroupActions,
} from '@dineug/erd-editor/peer.js';
import type { AnyAction } from '@dineug/r-html';
import { cloneDeep } from 'es-toolkit';

import { runTool } from '@/tools/run';

/** Fixed ids, so a spec names the seed's entities without reading them back. */
export const SEED = {
  users: 'users',
  userId: 'users_id',
  userName: 'users_name',
  orders: 'orders',
  orderId: 'orders_id',
  orderUser: 'orders_user_id',
  orderNote: 'orders_note',
  empty: 'empty_table',
  relationship: 'users_orders',
  index: 'orders_note_index',
  indexColumn: 'orders_note_index_column',
  userIndexColumn: 'orders_user_id_index_column',
  memo: 'memo',
  group: 'users_group',
} as const;

const column = (
  tableId: string,
  id: string,
  name: string,
  dataType: string
): AnyAction[] => [
  tableColumnActions.addColumnAction({ id, tableId }),
  tableColumnActions.changeColumnNameAction({ id, tableId, value: name }),
  tableColumnActions.changeColumnDataTypeAction({
    id,
    tableId,
    value: dataType,
  }),
];

const primaryKey = (tableId: string, id: string): AnyAction[] => [
  tableColumnActions.changeColumnPrimaryKeyAction({ id, tableId, value: true }),
  tableColumnActions.changeColumnNotNullAction({ id, tableId, value: true }),
];

/** Serializes what a peer holds once the actions have run through its reducers. */
function buildValue(...actions: AnyAction[][]): string {
  const peer = createPeerStore({ nickname: 'seed', presence: false });
  try {
    peer.dispatch(actions.flat());
    return peer.value;
  } finally {
    peer.destroy();
  }
}

/** A group named and placed, with the tables given as its members. */
const group = (
  id: string,
  name: string,
  ui: { x: number; y: number; width: number; height: number },
  tableIds: string[]
): AnyAction[] => [
  tableGroupActions.addTableGroupAction({ id, ui: { ...ui, zIndex: 1 } }),
  tableGroupActions.changeTableGroupNameAction({ id, value: name }),
  ...tableIds.map(tableId =>
    tableActions.changeTableGroupAction({ id: tableId, value: id })
  ),
];

/**
 * Two related tables, an empty one, a two column index, a memo and a group of
 * the first table: every entity an edit can name, and one relationship and
 * index for a removal to cascade into. Built through the reducers.
 */
export function createSeedValue(): string {
  return buildValue(
    [
      tableActions.addTableAction({
        id: SEED.users,
        ui: { x: 100, y: 100, zIndex: 2 },
      }),
      tableActions.changeTableNameAction({ id: SEED.users, value: 'users' }),
    ],
    column(SEED.users, SEED.userId, 'id', 'INT'),
    primaryKey(SEED.users, SEED.userId),
    column(SEED.users, SEED.userName, 'name', 'VARCHAR(255)'),
    [
      tableActions.addTableAction({
        id: SEED.orders,
        ui: { x: 500, y: 100, zIndex: 3 },
      }),
      tableActions.changeTableNameAction({ id: SEED.orders, value: 'orders' }),
    ],
    column(SEED.orders, SEED.orderId, 'id', 'INT'),
    primaryKey(SEED.orders, SEED.orderId),
    column(SEED.orders, SEED.orderUser, 'user_id', 'INT'),
    column(SEED.orders, SEED.orderNote, 'note', 'TEXT'),
    [
      tableActions.addTableAction({
        id: SEED.empty,
        ui: { x: 100, y: 500, zIndex: 4 },
      }),
      tableActions.changeTableNameAction({ id: SEED.empty, value: 'empty' }),
      relationshipActions.addRelationshipAction({
        id: SEED.relationship,
        relationshipType: RelationshipType.OneN,
        start: { tableId: SEED.users, columnIds: [SEED.userId] },
        end: { tableId: SEED.orders, columnIds: [SEED.orderUser] },
      }),
      indexActions.addIndexAction({ id: SEED.index, tableId: SEED.orders }),
      indexColumnActions.addIndexColumnAction({
        id: SEED.indexColumn,
        indexId: SEED.index,
        tableId: SEED.orders,
        columnId: SEED.orderNote,
      }),
      indexColumnActions.addIndexColumnAction({
        id: SEED.userIndexColumn,
        indexId: SEED.index,
        tableId: SEED.orders,
        columnId: SEED.orderUser,
      }),
      memoActions.addMemoAction({
        id: SEED.memo,
        ui: { x: 900, y: 100, zIndex: 5 },
      }),
    ],
    group(SEED.group, 'accounts', { x: 40, y: 20, width: 560, height: 300 }, [
      SEED.users,
    ])
  );
}

/**
 * A document of its own for the JSON import to replace the seed with: one
 * table in a group of its own, no relationship, index or memo, and a database
 * name of its own.
 */
export function createImportValue(): string {
  return buildValue(
    [
      settingsActions.changeDatabaseNameAction({ value: 'imported' }),
      tableActions.addTableAction({
        id: 'accounts',
        ui: { x: 50, y: 50, zIndex: 2 },
      }),
      tableActions.changeTableNameAction({
        id: 'accounts',
        value: 'accounts',
      }),
    ],
    column('accounts', 'accounts_id', 'id', 'BIGINT'),
    group('billing', 'billing', { x: 20, y: 0, width: 300, height: 200 }, [
      'accounts',
    ])
  );
}

/** A peer holding the seed, ready for one call; the caller destroys it. */
export function createSeededPeer() {
  const peer = createPeerStore({ nickname: 'agent', presence: false });
  peer.setInitialValue(createSeedValue());
  return peer;
}

export type PeerSession = {
  agent: PeerStore;
  other: PeerStore;
  /**
   * Every batch the agent sent, copied as it left: a store stamps a missing
   * version onto the very object it was handed.
   */
  sent: AnyAction[][];
  destroy: () => void;
};

/**
 * Two peers on the same seed, cross wired the way the hub wires this agent to
 * the editor's replica: each side receives the other's batches as they leave.
 */
export function createPeerSession({
  otherToWidth,
}: {
  /** The other side's text measure, which a canvas makes unlike the agent's. */
  otherToWidth?: (text: string) => number;
} = {}): PeerSession {
  const value = createSeedValue();
  const agent = createPeerStore({ nickname: 'agent', presence: false });
  const other = createPeerStore({
    nickname: 'user',
    presence: false,
    toWidth: otherToWidth,
  });
  agent.setInitialValue(value);
  other.setInitialValue(value);

  const sent: AnyAction[][] = [];

  const unsubscribeAgent = agent.subscribe(actions => {
    sent.push(cloneDeep(actions));
    other.receive(actions);
  });
  const unsubscribeOther = other.subscribe(actions => agent.receive(actions));

  return {
    agent,
    other,
    sent,
    destroy: () => {
      unsubscribeAgent();
      unsubscribeOther();
      agent.destroy();
      other.destroy();
    },
  };
}

/**
 * A seeded peer once two peers' edits crossed: one removed orders and the name
 * column of users while the other related users to orders, indexed orders and
 * indexed users by name, so the runtime value keeps what the file form drops.
 */
export function createCrossedRemovalPeer() {
  const peer = createSeededPeer();
  const other = createSeededPeer();
  const fromPeer: AnyAction[][] = [];
  const fromOther: AnyAction[][] = [];
  peer.subscribe(actions => void fromPeer.push(actions));
  other.subscribe(actions => void fromOther.push(actions));

  runTool(peer, 'erd_remove_table', { tableId: SEED.orders });
  runTool(peer, 'erd_remove_columns', {
    tableId: SEED.users,
    columnIds: [SEED.userName],
  });
  const [relationship] = runTool(other, 'erd_add_relationship', {
    startTableId: SEED.users,
    endTableId: SEED.orders,
    relationshipType: 'ZeroN',
  }).createdIds.slice(-1);
  const [ordersIndex] = runTool(other, 'erd_add_index', {
    tableId: SEED.orders,
  }).createdIds;
  const [usersIndex] = runTool(other, 'erd_add_index', {
    tableId: SEED.users,
  }).createdIds;
  const [nameColumn] = runTool(other, 'erd_add_index_column', {
    indexId: usersIndex,
    columnId: SEED.userName,
  }).createdIds;
  const [idColumn] = runTool(other, 'erd_add_index_column', {
    indexId: usersIndex,
    columnId: SEED.userId,
  }).createdIds;

  const sent = fromPeer.splice(0).flat();
  peer.receive(fromOther.splice(0).flat());
  other.receive(sent);
  other.destroy();

  return {
    peer,
    orphans: { relationship, ordersIndex, nameColumn },
    kept: { usersIndex, idColumn },
  };
}
