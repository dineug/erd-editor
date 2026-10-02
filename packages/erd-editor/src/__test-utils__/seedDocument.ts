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

/** A document a search spec seeds: tables with the name and comment of each column, and one memo. */
export type SeedDocument = {
  tables: ReadonlyArray<{
    id: string;
    name: string;
    comment: string;
    x: number;
    y: number;
    columns: ReadonlyArray<{ id: string; name: string; comment: string }>;
  }>;
  memo: { id: string; value: string; x: number; y: number };
};

/**
 * Loads a seed into the store in one batch, the memo stacked above every
 * table, and starts its history empty, as a document just opened would.
 */
export function seedDocument(
  app: AppContext,
  { tables, memo }: SeedDocument
): void {
  app.store.dispatchSync([
    ...tables.flatMap((table, index) => [
      addTableAction({
        id: table.id,
        ui: { x: table.x, y: table.y, zIndex: index + 1 },
      }),
      changeTableNameAction({ id: table.id, value: table.name }),
      changeTableCommentAction({ id: table.id, value: table.comment }),
      ...table.columns.flatMap(column => [
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
        }),
      ]),
    ]),
    addMemoAction({
      id: memo.id,
      ui: { x: memo.x, y: memo.y, zIndex: tables.length + 1 },
    }),
    changeMemoValueAction({ id: memo.id, value: memo.value }),
  ]);
  app.store.resetHistory();
}
