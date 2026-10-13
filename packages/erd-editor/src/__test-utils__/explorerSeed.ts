import type { AppContext } from '@/components/appContext';
import { OrderType, RelationshipType } from '@/constants/schema';
import {
  addIndexAction,
  changeIndexNameAction,
  changeIndexUniqueAction,
} from '@/engine/modules/index/atom.actions';
import {
  addIndexColumnAction,
  changeIndexColumnOrderTypeAction,
} from '@/engine/modules/index-column/atom.actions';
import {
  addMemoAction,
  changeMemoValueAction,
} from '@/engine/modules/memo/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  addTableAction,
  changeTableGroupAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnDataTypeAction,
  changeColumnNameAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import { validateForeignKeys } from '@/engine/modules/table-column/keys';
import {
  addTableGroupAction,
  changeTableGroupColorAction,
  changeTableGroupNameAction,
} from '@/engine/modules/table-group/atom.actions';

const column = (
  id: string,
  tableId: string,
  name: string,
  dataType: string
) => [
  addColumnAction({ id, tableId }),
  changeColumnNameAction({ id, tableId, value: name }),
  changeColumnDataTypeAction({ id, tableId, value: dataType }),
];

/**
 * The document the Explorer specs walk: users, orders and Apple, created in
 * that order so the name order differs; a foreign key from orders to users;
 * a unique index on orders; a group holding orders and an empty one; a memo.
 */
export function seedExplorerDocument(app: AppContext): void {
  const { store } = app;
  store.dispatchSync(
    addTableAction({ id: 'users', ui: { x: 600, y: 60, zIndex: 1 } }),
    changeTableNameAction({ id: 'users', value: 'users' }),
    ...column('users.id', 'users', 'id', 'BIGINT'),
    ...column('users.email', 'users', 'email', 'VARCHAR(255)'),
    changeColumnPrimaryKeyAction({
      id: 'users.id',
      tableId: 'users',
      value: true,
    }),
    addTableAction({ id: 'orders', ui: { x: 60, y: 60, zIndex: 2 } }),
    changeTableNameAction({ id: 'orders', value: 'orders' }),
    ...column('orders.id', 'orders', 'id', 'BIGINT'),
    ...column('orders.user_id', 'orders', 'user_id', 'BIGINT'),
    ...column('orders.total', 'orders', 'total', 'NUMERIC'),
    changeColumnPrimaryKeyAction({
      id: 'orders.id',
      tableId: 'orders',
      value: true,
    }),
    addTableAction({ id: 'apple', ui: { x: 60, y: 600, zIndex: 3 } }),
    changeTableNameAction({ id: 'apple', value: 'Apple' }),
    addRelationshipAction({
      id: 'rel',
      relationshipType: RelationshipType.OneN,
      start: { tableId: 'users', columnIds: ['users.id'] } as any,
      end: { tableId: 'orders', columnIds: ['orders.user_id'] } as any,
    }),
    addIndexAction({ id: 'idx', tableId: 'orders' }),
    changeIndexNameAction({
      id: 'idx',
      tableId: 'orders',
      value: 'orders_user_idx',
    }),
    changeIndexUniqueAction({ id: 'idx', tableId: 'orders', value: true }),
    addIndexColumnAction({
      id: 'idx.user',
      indexId: 'idx',
      tableId: 'orders',
      columnId: 'orders.user_id',
    }),
    changeIndexColumnOrderTypeAction({
      id: 'idx.user',
      indexId: 'idx',
      columnId: 'orders.user_id',
      value: OrderType.DESC,
    }),
    addIndexColumnAction({
      id: 'idx.total',
      indexId: 'idx',
      tableId: 'orders',
      columnId: 'orders.total',
    }),
    addTableGroupAction({
      id: 'billing',
      ui: { x: 0, y: 0, width: 600, height: 400, zIndex: 1 },
    }),
    changeTableGroupNameAction({ id: 'billing', value: 'Billing' }),
    changeTableGroupColorAction({
      id: 'billing',
      color: '#ff0000',
      prevColor: '',
    }),
    changeTableGroupAction({ id: 'orders', value: 'billing' }),
    addTableGroupAction({
      id: 'empty',
      ui: { x: 0, y: 900, width: 300, height: 200, zIndex: 2 },
    }),
    changeTableGroupNameAction({ id: 'empty', value: 'accounts' }),
    addMemoAction({ id: 'note', ui: { x: 900, y: 600, zIndex: 4 } }),
    changeMemoValueAction({
      id: 'note',
      value: 'Order states\nmore detail',
    })
  );
  validateForeignKeys(store.state);
}
