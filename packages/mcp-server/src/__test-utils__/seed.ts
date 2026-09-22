import {
  createPeerStore,
  indexActions,
  indexColumnActions,
  memoActions,
  relationshipActions,
  RelationshipType,
  settingsActions,
  tableActions,
  tableColumnActions,
} from '@dineug/erd-editor/peer.js';
import type { AnyAction } from '@dineug/r-html';

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

/**
 * Two related tables, an empty one, a two column index and a memo: every
 * entity an edit can name, and one relationship and index for a removal to
 * cascade into. Built through the reducers, so it is a document they accept.
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
    ]
  );
}

/**
 * A document of its own for the JSON import to replace the seed with: one
 * table, no relationship, index or memo, and a database name of its own.
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
    column('accounts', 'accounts_id', 'id', 'BIGINT')
  );
}

/** A peer holding the seed, ready for one call; the caller destroys it. */
export function createSeededPeer() {
  const peer = createPeerStore({ nickname: 'agent', presence: false });
  peer.setInitialValue(createSeedValue());
  return peer;
}
