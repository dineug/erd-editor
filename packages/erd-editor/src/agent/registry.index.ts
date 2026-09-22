import { query } from '@dineug/erd-editor-schema';

import type { ActionTool, ToolArg } from '@/agent/registry';
import { OrderType } from '@/constants/schema';
import type { GeneratorAction } from '@/engine/generator.actions';
import {
  changeIndexNameAction,
  changeIndexUniqueAction,
  removeIndexAction,
} from '@/engine/modules/index/atom.actions';
import { addIndexAction$ } from '@/engine/modules/index/generator.actions';
import { changeIndexColumnOrderTypeAction } from '@/engine/modules/index-column/atom.actions';
import {
  addIndexColumnAction$,
  moveIndexColumnAction$,
  removeIndexColumnAction$,
} from '@/engine/modules/index-column/generator.actions';
import type { Collections } from '@/internal-types';

const INDEX_ID: ToolArg = {
  name: 'indexId',
  kind: { type: 'entityId', entity: 'index' },
  required: true,
};

const indexColumnArg = (name: string): ToolArg => ({
  name,
  kind: { type: 'entityId', entity: 'indexColumn', parentArg: 'indexId' },
  required: true,
});

const INDEX_COLUMN_ID = indexColumnArg('indexColumnId');

const indexPath = (field: string) => [`indexes[indexId].${field}`];

const indexOf = (collections: Collections, indexId: string) =>
  query(collections).collection('indexEntities').selectById(indexId);

const indexColumnOf = (collections: Collections, indexColumnId: string) =>
  query(collections)
    .collection('indexColumnEntities')
    .selectById(indexColumnId);

/** The name atom wants the index's table, which only the state knows. */
const changeIndexNameAction$ = (
  indexId: string,
  value: string
): GeneratorAction =>
  function* ({ collections }) {
    const index = indexOf(collections, indexId);
    if (!index) return;

    yield changeIndexNameAction({ id: indexId, tableId: index.tableId, value });
  };

/**
 * Sets the flag outright and yields nothing when it already holds: its undo
 * entry stores the negation of the value sent, so a repeated set would leave
 * an undo that flips a flag never changed.
 */
const setIndexUniqueAction$ = (
  indexId: string,
  value: boolean
): GeneratorAction =>
  function* ({ collections }) {
    const index = indexOf(collections, indexId);
    if (!index || index.unique === value) return;

    yield changeIndexUniqueAction({
      id: indexId,
      tableId: index.tableId,
      value,
    });
  };

/**
 * Adds a column the index does not cover yet. A covered one is left alone,
 * since the add would reuse its id and its undo would take the column out.
 */
const addIndexColumnOnceAction$ = (
  indexId: string,
  columnId: string
): GeneratorAction =>
  function* ({ collections }) {
    const index = indexOf(collections, indexId);
    const covered = query(collections)
      .collection('indexColumnEntities')
      .selectByIds(index?.indexColumnIds ?? [])
      .some(indexColumn => indexColumn.columnId === columnId);
    if (!index || covered) return;

    yield addIndexColumnAction$(indexId, columnId);
  };

/** The generator removes by the table column, which the index column names. */
const removeIndexColumnByIdAction$ = (
  indexId: string,
  indexColumnId: string
): GeneratorAction =>
  function* ({ collections }) {
    const indexColumn = indexColumnOf(collections, indexColumnId);
    if (!indexColumn) return;

    yield removeIndexColumnAction$(indexId, indexColumn.columnId);
  };

/** Sets the order outright, so a repeated call leaves no empty undo entry. */
const setIndexColumnOrderAction$ = (
  indexColumnId: string,
  orderType: number
): GeneratorAction =>
  function* ({ collections }) {
    const indexColumn = indexColumnOf(collections, indexColumnId);
    if (!indexColumn || indexColumn.orderType === orderType) return;

    yield changeIndexColumnOrderTypeAction({
      id: indexColumnId,
      indexId: indexColumn.indexId,
      columnId: indexColumn.columnId,
      value: orderType,
    });
  };

export const indexTools: readonly ActionTool[] = [
  {
    name: 'erd_add_index',
    kind: 'generator',
    actionTypes: ['index.add'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: ['indexes'],
    args: [
      {
        name: 'tableId',
        kind: { type: 'entityId', entity: 'table' },
        required: true,
      },
    ],
    toActions: ({ tableId }) => [addIndexAction$(tableId)],
  },
  {
    name: 'erd_remove_index',
    kind: 'atom',
    atomReason:
      'No generator removes one named index: removeTableAction$ and removeColumnAction$ drop only the indexes of what they remove. The index panel dispatches this atom itself.',
    actionTypes: ['index.remove'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: ['indexes'],
    args: [INDEX_ID],
    toActions: ({ indexId }) => [removeIndexAction({ id: indexId })],
  },
  {
    name: 'erd_change_index_name',
    kind: 'atom',
    atomReason:
      'The index module has no generator that renames an index; the index panel dispatches this atom itself. The tool reads the index table from the state.',
    actionTypes: ['index.changeName'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: indexPath('name'),
    args: [
      INDEX_ID,
      { name: 'value', kind: { type: 'string' }, required: true },
    ],
    toActions: ({ indexId, value }) => [changeIndexNameAction$(indexId, value)],
  },
  {
    name: 'erd_set_index_unique',
    kind: 'atom',
    atomReason:
      'changeIndexUniqueAction$ flips the flag the state holds, so a repeated call undoes itself. The tool sets the value outright.',
    actionTypes: ['index.changeUnique'],
    undoable: true,
    stream: false,
    // Nothing goes out, and nothing is undone, when the flag already holds.
    expectedBatches: { min: 0, max: 1 },
    expectedHistory: { min: 0, max: 1 },
    snapshotPaths: indexPath('unique'),
    args: [
      INDEX_ID,
      { name: 'value', kind: { type: 'boolean' }, required: true },
    ],
    toActions: ({ indexId, value }) => [setIndexUniqueAction$(indexId, value)],
  },
  {
    name: 'erd_add_index_column',
    kind: 'generator',
    actionTypes: ['indexColumn.add'],
    undoable: true,
    stream: false,
    // A column the index already covers is left as it is.
    expectedBatches: { min: 0, max: 1 },
    expectedHistory: { min: 0, max: 1 },
    snapshotPaths: indexPath('columns'),
    args: [
      INDEX_ID,
      {
        name: 'columnId',
        kind: { type: 'entityId', entity: 'column', parentArg: 'indexId' },
        required: true,
      },
    ],
    toActions: ({ indexId, columnId }) => [
      addIndexColumnOnceAction$(indexId, columnId),
    ],
  },
  {
    name: 'erd_remove_index_column',
    kind: 'generator',
    actionTypes: ['indexColumn.remove'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: indexPath('columns'),
    args: [INDEX_ID, INDEX_COLUMN_ID],
    toActions: ({ indexId, indexColumnId }) => [
      removeIndexColumnByIdAction$(indexId, indexColumnId),
    ],
  },
  {
    name: 'erd_move_index_column',
    kind: 'generator',
    actionTypes: ['indexColumn.move'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: indexPath('columns'),
    args: [INDEX_ID, INDEX_COLUMN_ID, indexColumnArg('targetIndexColumnId')],
    refine: ({ indexColumnId, targetIndexColumnId }) =>
      indexColumnId === targetIndexColumnId
        ? 'targetIndexColumnId must name a different index column than indexColumnId'
        : undefined,
    toActions: ({ indexColumnId, targetIndexColumnId }) => [
      moveIndexColumnAction$(indexColumnId, targetIndexColumnId),
    ],
  },
  {
    name: 'erd_set_index_column_order',
    kind: 'atom',
    atomReason:
      'changeIndexColumnOrderTypeAction$ flips the order the state holds, so a repeated call undoes itself. The tool sets the order outright.',
    actionTypes: ['indexColumn.changeOrderType'],
    undoable: true,
    stream: false,
    // Nothing goes out, and nothing is undone, when the order already holds.
    expectedBatches: { min: 0, max: 1 },
    expectedHistory: { min: 0, max: 1 },
    snapshotPaths: indexPath('columns[indexColumnId].orderType'),
    args: [
      INDEX_ID,
      INDEX_COLUMN_ID,
      {
        name: 'orderType',
        kind: { type: 'enum', values: OrderType },
        required: true,
      },
    ],
    toActions: ({ indexColumnId, orderType }) => [
      setIndexColumnOrderAction$(indexColumnId, orderType),
    ],
  },
];
