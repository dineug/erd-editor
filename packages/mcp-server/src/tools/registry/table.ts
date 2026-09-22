import {
  FocusType,
  type GeneratorAction,
  tableActions,
  tableActions$,
} from '@dineug/erd-editor/peer.js';
import { query } from '@dineug/erd-editor-schema';

import type { ActionTool, ToolArg } from '@/tools/registry';

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

    yield tableActions.changeTableColorAction({
      id,
      color,
      prevColor: table?.ui.color ?? '',
    });
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
    toActions: () => [tableActions$.addTableAction$()],
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
    toActions: ({ tableId }) => [tableActions$.removeTableAction$(tableId)],
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
      tableActions.changeTableNameAction({ id: tableId, value }),
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
      tableActions.changeTableCommentAction({ id: tableId, value }),
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
      'No generator places one named table at a point: moveAllAction$ drags the selection by a relative step, and sortTablesToMoveAction$ places every table where the sort puts it.',
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
      tableActions.moveToTableAction({ id: tableId, x, y }),
    ],
  },
  {
    name: 'erd_sort_tables',
    kind: 'generator',
    actionTypes: ['table.moveTo'],
    undoable: true,
    stream: false,
    // A document with no live table leaves nothing to place and sends nothing.
    expectedBatches: { min: 0, max: 1 },
    expectedHistory: { min: 0, max: 1 },
    snapshotPaths: ['tables'],
    args: [],
    toActions: () => [tableActions$.sortTablesToMoveAction$()],
  },
];
