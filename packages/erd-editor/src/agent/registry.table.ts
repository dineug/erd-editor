import { query } from '@dineug/erd-editor-schema';

import type { ActionTool, ToolArg } from '@/agent/registry';
import type { GeneratorAction } from '@/engine/generator.actions';
import { FocusType } from '@/engine/modules/editor/state';
import { ActionType } from '@/engine/modules/table/actions';
import {
  changeTableColorAction,
  changeTableCommentAction,
  changeTableNameAction,
  moveToTableAction,
  tableReducers,
} from '@/engine/modules/table/atom.actions';
import {
  addTableAction$,
  removeTableAction$,
} from '@/engine/modules/table/generator.actions';

const TABLE_ID: ToolArg = {
  name: 'tableId',
  kind: { type: 'entityId', entity: 'table' },
  required: true,
};

const TEXT_VALUE: ToolArg = {
  name: 'value',
  kind: { type: 'string' },
  required: true,
};

const TABLE_FOCUS = {
  kind: 'table',
  tableArg: 'tableId',
  focusType: FocusType.tableName,
} as const;

/** The stream handler needs the color it replaces, which only the state knows. */
const changeTableColorAction$ = (id: string, color: string): GeneratorAction =>
  function* ({ collections }) {
    const table = query(collections).collection('tableEntities').selectById(id);

    yield changeTableColorAction({
      id,
      color,
      prevColor: table?.ui.color ?? '',
    });
  };

/**
 * Runs the engine's sort once, on copies of the live tables, and places each
 * table at the point it found. A replayed table.sort measures each replica's
 * own text, so only the placed points come out the same everywhere.
 */
const sortTablesAction$ = (): GeneratorAction =>
  function* (state, context) {
    const { doc, collections } = state;
    const copies = query(collections)
      .collection('tableEntities')
      .selectByIds(doc.tableIds)
      .map(table => ({ ...table, ui: { ...table.ui } }));

    tableReducers[ActionType.sortTable](
      {
        ...state,
        collections: {
          ...collections,
          tableEntities: Object.fromEntries(
            copies.map(table => [table.id, table])
          ),
        },
      },
      { type: ActionType.sortTable, payload: undefined },
      context
    );

    yield copies.map(({ id, ui: { x, y } }) => moveToTableAction({ id, x, y }));
  };

export const tableTools: readonly ActionTool[] = [
  {
    name: 'erd_add_table',
    kind: 'generator',
    actionTypes: ['table.add'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: ['tables'],
    args: [],
    toActions: () => [addTableAction$()],
  },
  {
    name: 'erd_remove_table',
    kind: 'generator',
    actionTypes: ['table.remove', 'relationship.remove', 'index.remove'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: ['tables'],
    args: [TABLE_ID],
    toActions: ({ tableId }) => [removeTableAction$(tableId)],
  },
  {
    name: 'erd_change_table_name',
    kind: 'atom',
    atomReason:
      'The table module has no generator that renames a table; the name cell dispatches this atom itself.',
    actionTypes: ['table.changeName'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    focus: TABLE_FOCUS,
    snapshotPaths: ['tables[tableId].name'],
    args: [TABLE_ID, TEXT_VALUE],
    toActions: ({ tableId, value }) => [
      changeTableNameAction({ id: tableId, value }),
    ],
  },
  {
    name: 'erd_change_table_comment',
    kind: 'atom',
    atomReason:
      'The table module has no generator that edits a comment; the comment cell dispatches this atom itself.',
    actionTypes: ['table.changeComment'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    focus: { ...TABLE_FOCUS, focusType: FocusType.tableComment },
    snapshotPaths: ['tables[tableId].comment'],
    args: [TABLE_ID, TEXT_VALUE],
    toActions: ({ tableId, value }) => [
      changeTableCommentAction({ id: tableId, value }),
    ],
  },
  {
    name: 'erd_change_table_color',
    kind: 'atom',
    atomReason:
      'No generator colors one named table: changeColorAllAction$ colors the selection. The tool reads the previous color from the state as that generator does.',
    actionTypes: ['table.changeColor'],
    undoable: true,
    stream: true,
    expectedBatches: 1,
    expectedHistory: 1,
    focus: TABLE_FOCUS,
    snapshotPaths: ['tables[tableId].color'],
    args: [
      TABLE_ID,
      { name: 'color', kind: { type: 'string' }, required: true },
    ],
    toActions: ({ tableId, color }) => [
      changeTableColorAction$(tableId, color),
    ],
  },
  {
    name: 'erd_move_table',
    kind: 'atom',
    atomReason:
      'No generator places one table at a point: moveAllAction$ drags the selection by a relative step.',
    actionTypes: ['table.moveTo'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    focus: TABLE_FOCUS,
    snapshotPaths: ['tables[tableId].x', 'tables[tableId].y'],
    args: [
      TABLE_ID,
      { name: 'x', kind: { type: 'number' }, required: true },
      { name: 'y', kind: { type: 'number' }, required: true },
    ],
    toActions: ({ tableId, x, y }) => [
      moveToTableAction({ id: tableId, x, y }),
    ],
  },
  {
    name: 'erd_sort_tables',
    kind: 'atom',
    atomReason:
      'No generator sorts the tables on its own, and table.sort reruns the layout on every replica against its own text widths, so the tool computes the layout once and places each live table with this atom.',
    actionTypes: ['table.moveTo'],
    undoable: true,
    stream: false,
    // A document with no live table leaves nothing to place and sends nothing.
    expectedBatches: { min: 0, max: 1 },
    expectedHistory: { min: 0, max: 1 },
    snapshotPaths: ['tables'],
    args: [],
    toActions: () => [sortTablesAction$()],
  },
];
