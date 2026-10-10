import {
  createPeerStore,
  type PeerStore,
  tableActions,
  tableActions$,
  tableColumnActions,
  tableColumnActions$,
} from '@dineug/erd-editor/peer.js';

/**
 * A diagram without a screen, loaded from value: what a tab's editor and its
 * replica hold, or what a joining agent holds. The caller destroys it.
 */
export function createDiagram(value: string): PeerStore {
  const store = createPeerStore({ nickname: 'spec', presence: false });
  store.setInitialValue(value);
  return store;
}

/** The users table with its id and name columns, in the form a file holds. */
export function usersDiagram(): { value: string; tableId: string } {
  const store = createDiagram('');
  const [tableId] = store.dispatch([
    tableActions$.addTableAction$(),
  ]).createdIds;
  store.dispatch([
    tableActions.changeTableNameAction({ id: tableId, value: 'users' }),
  ]);
  for (const name of ['id', 'name']) {
    const [id] = store.dispatch([
      tableColumnActions$.addColumnAction$(tableId),
    ]).createdIds;
    store.dispatch([
      tableColumnActions.changeColumnNameAction({ id, tableId, value: name }),
    ]);
  }
  const { value } = store;
  store.destroy();
  return { value, tableId };
}

/** Removes the table as the user does, one undo unit. */
export function removeTable(store: PeerStore, tableId: string): void {
  store.dispatch([tableActions$.removeTableAction$(tableId)], {
    label: 'removeTable',
  });
}

/** Applies batches another peer sent, as a tab or an agent takes them. */
export function receiveAll(store: PeerStore, batches: unknown[][]): void {
  for (const actions of batches) {
    store.receive(actions as Parameters<PeerStore['receive']>[0]);
  }
}

/** The table's name and column names while the diagram shows it, else null. */
export function shownTable(
  store: PeerStore,
  tableId: string
): { name: string; columns: string[] } | null {
  const { doc, collections } = store.state;
  const table = collections.tableEntities[tableId];
  if (!table || !doc.tableIds.includes(tableId)) return null;
  return {
    name: table.name,
    columns: table.columnIds.map(
      id => collections.tableColumnEntities[id]?.name ?? ''
    ),
  };
}
