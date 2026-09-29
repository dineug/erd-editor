import type { AnyAction } from '@dineug/r-html';

import type { AppContext } from '@/components/appContext';
import {
  addMemoAction,
  changeMemoValueAction,
} from '@/engine/modules/memo/atom.actions';
import {
  addTableAction,
  changeTableCommentAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnCommentAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';

/**
 * The document the find and replace specs search: two tables whose names,
 * comments and columns hold "user" in every field a search covers, and a memo
 * holding it twice. Ids name what they are, so a spec can say which it expects.
 */
export const FIND_SEED = {
  tables: [
    {
      id: 'orders',
      name: 'orders',
      comment: 'Customer orders',
      x: 60,
      y: 60,
      columns: [
        { id: 'order_id', name: 'order_id', comment: 'primary id' },
        {
          id: 'orders_user_id',
          name: 'user_id',
          comment: 'buyer of the order',
        },
        { id: 'total', name: 'total', comment: '' },
      ],
    },
    {
      id: 'users',
      name: 'users',
      comment: '',
      x: 600,
      y: 60,
      columns: [
        { id: 'users_id', name: 'id', comment: 'user id' },
        { id: 'email', name: 'email', comment: 'login email' },
      ],
    },
  ],
  memo: {
    id: 'note',
    value: 'Every user_id points at users.id',
    x: 60,
    y: 480,
  },
} as const;

/** The actions that build FIND_SEED, one batch, with no history of their own worth keeping. */
export function findSeedActions(): AnyAction[] {
  const actions: AnyAction[] = [];

  FIND_SEED.tables.forEach((table, index) => {
    actions.push(
      addTableAction({
        id: table.id,
        ui: { x: table.x, y: table.y, zIndex: index + 1 },
      }),
      changeTableNameAction({ id: table.id, value: table.name }),
      changeTableCommentAction({ id: table.id, value: table.comment })
    );
    for (const column of table.columns) {
      actions.push(
        addColumnAction({ id: column.id, tableId: table.id }),
        changeColumnNameAction({
          id: column.id,
          tableId: table.id,
          value: column.name,
        }),
        changeColumnCommentAction({
          id: column.id,
          tableId: table.id,
          value: column.comment,
        })
      );
    }
  });

  const { memo } = FIND_SEED;
  actions.push(
    addMemoAction({ id: memo.id, ui: { x: memo.x, y: memo.y, zIndex: 3 } }),
    changeMemoValueAction({ id: memo.id, value: memo.value })
  );

  return actions;
}

/** Loads FIND_SEED into the store and starts its history empty, as a document just opened would. */
export function seedFindDocument(app: AppContext): void {
  app.store.dispatchSync(findSeedActions());
  app.store.resetHistory();
}
