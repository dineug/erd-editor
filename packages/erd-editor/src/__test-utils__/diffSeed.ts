import type { AnyAction } from '@dineug/r-html';

import { createTestAppContext } from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import { OrderType } from '@/constants/schema';
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
  changeMemoColorAction,
  changeMemoValueAction,
  resizeMemoAction,
} from '@/engine/modules/memo/atom.actions';
import {
  addRelationshipAction,
  changeRelationshipOnDeleteAction,
  changeRelationshipOnUpdateAction,
} from '@/engine/modules/relationship/atom.actions';
import {
  addTableAction,
  changeTableColorAction,
  changeTableCommentAction,
  changeTableGroupAction,
  changeTableNameAction,
  removeTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnAutoIncrementAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
  changeColumnUniqueAction,
} from '@/engine/modules/table-column/atom.actions';
import {
  addTableGroupAction,
  changeTableGroupColorAction,
  changeTableGroupNameAction,
} from '@/engine/modules/table-group/atom.actions';
import type { RootState } from '@/engine/state';

export type ColumnSeed = {
  id: string;
  name: string;
  comment?: string;
  dataType?: string;
  default?: string;
  pk?: boolean;
  nn?: boolean;
  uq?: boolean;
  ai?: boolean;
};

export type TableSeed = {
  id: string;
  name: string;
  comment?: string;
  x?: number;
  y?: number;
  color?: string;
  group?: string;
  zIndex?: number;
  columns?: ColumnSeed[];
};

export type IndexSeed = {
  id: string;
  tableId: string;
  name: string;
  unique?: boolean;
  /** Each key column by its column id, DESC where so. */
  columns: Array<string | [string, 'DESC']>;
};

export type RelationshipSeed = {
  id: string;
  parent: [string, string[]];
  child: [string, string[]];
  type?: number;
  onDelete?: number;
  onUpdate?: number;
};

export type MemoSeed = {
  id: string;
  value: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: string;
};

export type GroupSeed = {
  id: string;
  name: string;
  color?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

/** A document the diff specs compare, by the ids a spec names, and what it holds removed. */
export type DiffSeed = {
  tables?: TableSeed[];
  indexes?: IndexSeed[];
  relationships?: RelationshipSeed[];
  memos?: MemoSeed[];
  groups?: GroupSeed[];
  /** Index columns are given ids with this tail, so two loads can differ as a v2 file's do. */
  indexColumnTail?: string;
  /** Tables removed once added, which the runtime value keeps as tombstones. */
  removed?: string[];
};

const point = (tableId: string, columnIds: string[]) => ({
  tableId,
  columnIds,
  x: 0,
  y: 0,
  direction: 1,
});

function columnActions(tableId: string, column: ColumnSeed): AnyAction[] {
  const id = column.id;
  return [
    addColumnAction({ id, tableId }),
    changeColumnNameAction({ id, tableId, value: column.name }),
    ...(column.comment !== undefined
      ? [changeColumnCommentAction({ id, tableId, value: column.comment })]
      : []),
    ...(column.dataType !== undefined
      ? [changeColumnDataTypeAction({ id, tableId, value: column.dataType })]
      : []),
    ...(column.default !== undefined
      ? [changeColumnDefaultAction({ id, tableId, value: column.default })]
      : []),
    ...(column.pk
      ? [changeColumnPrimaryKeyAction({ id, tableId, value: true })]
      : []),
    ...(column.nn
      ? [changeColumnNotNullAction({ id, tableId, value: true })]
      : []),
    ...(column.uq
      ? [changeColumnUniqueAction({ id, tableId, value: true })]
      : []),
    ...(column.ai
      ? [changeColumnAutoIncrementAction({ id, tableId, value: true })]
      : []),
  ];
}

/**
 * The state of a document built from a seed, its store let go once built, so
 * nothing its edits set running outlives the spec's environment.
 *
 * @example
 * const prev = diffStateOf({ tables: [{ id: 't', name: 'users' }] });
 */
export function diffStateOf(seed: DiffSeed): RootState {
  const app = createTestAppContext();
  seedDiff(app, seed);
  const { state } = app.store;
  app.store.destroy();
  return state;
}

/** Builds a seed's document in an app a spec keeps, a pane it mounts say. */
export function seedDiff(app: AppContext, seed: DiffSeed): void {
  const tail = seed.indexColumnTail ?? '';
  let zIndex = 1;

  app.store.dispatchSync([
    ...(seed.groups ?? []).flatMap(group => [
      addTableGroupAction({
        id: group.id,
        ui: {
          x: group.x ?? 0,
          y: group.y ?? 0,
          width: group.width ?? 400,
          height: group.height ?? 300,
          zIndex: zIndex++,
        },
      }),
      changeTableGroupNameAction({ id: group.id, value: group.name }),
      ...(group.color
        ? [
            changeTableGroupColorAction({
              id: group.id,
              color: group.color,
              prevColor: '',
            }),
          ]
        : []),
    ]),
    ...(seed.tables ?? []).flatMap(table => [
      addTableAction({
        id: table.id,
        ui: {
          x: table.x ?? 0,
          y: table.y ?? 0,
          zIndex: table.zIndex ?? zIndex++,
        },
      }),
      changeTableNameAction({ id: table.id, value: table.name }),
      ...(table.comment !== undefined
        ? [changeTableCommentAction({ id: table.id, value: table.comment })]
        : []),
      ...(table.color
        ? [
            changeTableColorAction({
              id: table.id,
              color: table.color,
              prevColor: '',
            }),
          ]
        : []),
      ...(table.group
        ? [changeTableGroupAction({ id: table.id, value: table.group })]
        : []),
      ...(table.columns ?? []).flatMap(column =>
        columnActions(table.id, column)
      ),
    ]),
    ...(seed.indexes ?? []).flatMap(index => [
      addIndexAction({ id: index.id, tableId: index.tableId }),
      changeIndexNameAction({
        id: index.id,
        tableId: index.tableId,
        value: index.name,
      }),
      ...(index.unique
        ? [
            changeIndexUniqueAction({
              id: index.id,
              tableId: index.tableId,
              value: true,
            }),
          ]
        : []),
      ...index.columns.flatMap((column, at) => {
        const [columnId, order] =
          typeof column === 'string' ? [column, null] : column;
        const id = `${index.id}.${at}${tail}`;
        return [
          addIndexColumnAction({
            id,
            indexId: index.id,
            tableId: index.tableId,
            columnId,
          }),
          ...(order
            ? [
                changeIndexColumnOrderTypeAction({
                  id,
                  indexId: index.id,
                  columnId,
                  value: OrderType.DESC,
                }),
              ]
            : []),
        ];
      }),
    ]),
    ...(seed.relationships ?? []).flatMap(relationship => [
      addRelationshipAction({
        id: relationship.id,
        relationshipType: relationship.type ?? 16,
        start: point(...relationship.parent),
        end: point(...relationship.child),
      }),
      ...(relationship.onDelete
        ? [
            changeRelationshipOnDeleteAction({
              id: relationship.id,
              value: relationship.onDelete,
            }),
          ]
        : []),
      ...(relationship.onUpdate
        ? [
            changeRelationshipOnUpdateAction({
              id: relationship.id,
              value: relationship.onUpdate,
            }),
          ]
        : []),
    ]),
    ...(seed.memos ?? []).flatMap(memo => [
      addMemoAction({
        id: memo.id,
        ui: { x: memo.x ?? 0, y: memo.y ?? 0, zIndex: zIndex++ },
      }),
      changeMemoValueAction({ id: memo.id, value: memo.value }),
      ...(memo.width !== undefined || memo.height !== undefined
        ? [
            resizeMemoAction({
              id: memo.id,
              x: memo.x ?? 0,
              y: memo.y ?? 0,
              width: memo.width ?? 116,
              height: memo.height ?? 100,
            }),
          ]
        : []),
      ...(memo.color
        ? [
            changeMemoColorAction({
              id: memo.id,
              color: memo.color,
              prevColor: '',
            }),
          ]
        : []),
    ]),
    ...(seed.removed ?? []).map(id => removeTableAction({ id })),
  ]);
}
