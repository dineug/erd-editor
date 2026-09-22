import { toJson } from '@dineug/erd-editor-schema';
import type { AnyAction } from '@dineug/r-html';
import { cloneDeep } from 'es-toolkit';

import { RelationshipType } from '@/constants/schema';
import { createEngineContext } from '@/engine/context';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import { addIndexAction } from '@/engine/modules/index/atom.actions';
import { addIndexColumnAction } from '@/engine/modules/index-column/atom.actions';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { changeDatabaseNameAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnDataTypeAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import { createPeerStore, type PeerStore } from '@/engine/peer-store';
import { createRxStore, type RxStore } from '@/engine/rx-store';
import { createSharedStore, type SharedStore } from '@/engine/shared-store';
import { defaultToWidth } from '@/engine/to-width';

/**
 * Lets the store hooks a load or an edit schedules run: widths, foreign key
 * marks and relationship sorts land on timers of a few milliseconds.
 */
export const settle = (ms = 30) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

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
  addColumnAction({ id, tableId }),
  changeColumnNameAction({ id, tableId, value: name }),
  changeColumnDataTypeAction({ id, tableId, value: dataType }),
];

const primaryKey = (tableId: string, id: string): AnyAction[] => [
  changeColumnPrimaryKeyAction({ id, tableId, value: true }),
  changeColumnNotNullAction({ id, tableId, value: true }),
];

/** Serializes what a headless store holds once the actions have run. */
function buildValue(...actions: AnyAction[][]): string {
  const store = createRxStore(
    createEngineContext({ toWidth: defaultToWidth }),
    { observable: false }
  );

  store.dispatchSync(
    changeViewportAction({ width: 0, height: 0 }),
    actions.flat()
  );

  const value = toJson(store.state);
  store.destroy();
  return value;
}

/**
 * Two related tables, an empty one, a two column index and a memo: every
 * entity an edit can name, and one relationship and index for a removal to
 * cascade into. Built through the reducers, so it is a document they accept.
 */
export function createSeedValue(): string {
  return buildValue(
    [
      addTableAction({ id: SEED.users, ui: { x: 100, y: 100, zIndex: 2 } }),
      changeTableNameAction({ id: SEED.users, value: 'users' }),
    ],
    column(SEED.users, SEED.userId, 'id', 'INT'),
    primaryKey(SEED.users, SEED.userId),
    column(SEED.users, SEED.userName, 'name', 'VARCHAR(255)'),
    [
      addTableAction({ id: SEED.orders, ui: { x: 500, y: 100, zIndex: 3 } }),
      changeTableNameAction({ id: SEED.orders, value: 'orders' }),
    ],
    column(SEED.orders, SEED.orderId, 'id', 'INT'),
    primaryKey(SEED.orders, SEED.orderId),
    column(SEED.orders, SEED.orderUser, 'user_id', 'INT'),
    column(SEED.orders, SEED.orderNote, 'note', 'TEXT'),
    [
      addTableAction({ id: SEED.empty, ui: { x: 100, y: 500, zIndex: 4 } }),
      changeTableNameAction({ id: SEED.empty, value: 'empty' }),
      addRelationshipAction({
        id: SEED.relationship,
        relationshipType: RelationshipType.OneN,
        start: { tableId: SEED.users, columnIds: [SEED.userId] },
        end: { tableId: SEED.orders, columnIds: [SEED.orderUser] },
      }),
      addIndexAction({ id: SEED.index, tableId: SEED.orders }),
      addIndexColumnAction({
        id: SEED.indexColumn,
        indexId: SEED.index,
        tableId: SEED.orders,
        columnId: SEED.orderNote,
      }),
      addIndexColumnAction({
        id: SEED.userIndexColumn,
        indexId: SEED.index,
        tableId: SEED.orders,
        columnId: SEED.orderUser,
      }),
      addMemoAction({ id: SEED.memo, ui: { x: 900, y: 100, zIndex: 5 } }),
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
      changeDatabaseNameAction({ value: 'imported' }),
      addTableAction({ id: 'accounts', ui: { x: 50, y: 50, zIndex: 2 } }),
      changeTableNameAction({ id: 'accounts', value: 'accounts' }),
    ],
    column('accounts', 'accounts_id', 'id', 'BIGINT')
  );
}

export type SeededStore = {
  rxStore: RxStore;
  sharedStore: SharedStore;
  destroy: () => void;
};

/**
 * The other side of a session: an editor's store pair loaded with a value, as
 * useErdEditorAttachElement builds it, minus the screen. A plain object store
 * keeps it runnable where the reactive proxy's DOM globals are missing.
 */
export function createUserStore(
  value: string,
  toWidth: (text: string) => number = defaultToWidth
): SeededStore {
  const rxStore = createRxStore(createEngineContext({ toWidth }), {
    observable: false,
  });
  rxStore.dispatchSync(
    changeViewportAction({ width: 0, height: 0 }),
    initialLoadJsonAction$(value)
  );
  const sharedStore = createSharedStore(rxStore, {
    getNickname: () => 'user',
  });

  return {
    rxStore,
    sharedStore,
    destroy: () => {
      sharedStore.destroy();
      rxStore.destroy();
    },
  };
}

export type Session = {
  peer: PeerStore;
  user: SeededStore;
  /**
   * Every batch the peer sent, presence included, copied as it left: a store
   * stamps a missing version onto the very object it was handed.
   */
  sent: AnyAction[][];
  /** Hands over what each side sent since the last call, both ways, until quiet. */
  deliver: () => void;
  destroy: () => void;
};

/**
 * A peer and a user store on the same seed, cross wired the way the presence
 * e2e wires two editors. Held, each side's batches wait for deliver(), so two
 * edits can be made before either side has seen the other's.
 */
export function createSession({
  held = false,
  presence = false,
  value = createSeedValue(),
  userToWidth,
}: {
  held?: boolean;
  presence?: boolean;
  value?: string;
  /** The user side's text measure, which a canvas makes unlike the peer's. */
  userToWidth?: (text: string) => number;
} = {}): Session {
  const user = createUserStore(value, userToWidth);
  const peer = createPeerStore({ nickname: 'agent', presence });
  peer.setInitialValue(value);

  const sent: AnyAction[][] = [];
  const toUser: AnyAction[][] = [];
  const toPeer: AnyAction[][] = [];

  const deliver = () => {
    while (toUser.length || toPeer.length) {
      toUser
        .splice(0)
        .forEach(actions => user.sharedStore.dispatchSync(actions));
      toPeer.splice(0).forEach(actions => peer.receive(actions));
    }
  };

  const unsubscribeUser = user.sharedStore.subscribe(actions =>
    held ? toPeer.push(actions) : peer.receive(actions)
  );
  const unsubscribePeer = peer.subscribe(actions => {
    sent.push(cloneDeep(actions));
    held ? toUser.push(actions) : user.sharedStore.dispatch(actions);
  });

  return {
    peer,
    user,
    sent,
    deliver,
    destroy: () => {
      unsubscribeUser();
      unsubscribePeer();
      peer.destroy();
      user.destroy();
    },
  };
}

/**
 * A serialized document with each entity's meta dropped. Every replica stamps
 * createAt and updateAt from its own clock as its reducers run, and they are
 * never replicated, so two converged sides differ there and nowhere else.
 */
export function comparable(value: string) {
  const document = JSON.parse(value);

  for (const entities of Object.values<Record<string, any>>(
    document.collections
  )) {
    for (const entity of Object.values<any>(entities)) {
      delete entity.meta;
    }
  }

  return document;
}
