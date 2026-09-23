import {
  type ActionType,
  bHas,
  ColumnOption,
  FocusType,
  type GeneratorAction,
  tableColumnActions,
  tableColumnActions$,
} from '@dineug/erd-editor/peer.js';
import { query } from '@dineug/erd-editor-schema';

import type { ActionTool, ToolArg, ToolFocus } from '@/tools/registry';

const TABLE_ID: ToolArg = {
  name: 'tableId',
  kind: { type: 'entityId', entity: 'table' },
  required: true,
};

const COLUMN_ID: ToolArg = {
  name: 'columnId',
  kind: { type: 'entityId', entity: 'column', parentArg: 'tableId' },
  required: true,
};

const TEXT_VALUE: ToolArg = {
  name: 'value',
  kind: { type: 'string' },
  required: true,
};

const FLAG_VALUE: ToolArg = {
  name: 'value',
  kind: { type: 'boolean' },
  required: true,
};

const columnFocus = (focusType: FocusType): ToolFocus => ({
  kind: 'column',
  tableArg: 'tableId',
  columnArg: 'columnId',
  focusType,
});

const columnPath = (field: string) => [
  `tables[tableId].columns[columnId].${field}`,
];

type OptionActionCreator =
  | typeof tableColumnActions.changeColumnPrimaryKeyAction
  | typeof tableColumnActions.changeColumnUniqueAction
  | typeof tableColumnActions.changeColumnNotNullAction
  | typeof tableColumnActions.changeColumnAutoIncrementAction;

/**
 * Sets a column flag outright and yields nothing when it already holds the
 * value. The flag's undo entry stores the negation of the value sent, so a
 * repeated set would otherwise leave an undo that clears a flag never changed.
 */
const setColumnOptionAction$ =
  (creator: OptionActionCreator, option: number) =>
  (tableId: string, columnId: string, value: boolean): GeneratorAction =>
    function* ({ collections }) {
      const column = query(collections)
        .collection('tableColumnEntities')
        .selectById(columnId);
      if (!column || bHas(column.options, option) === value) return;

      yield creator({ tableId, id: columnId, value });
    };

type FlagTool = {
  name: string;
  atomReason: string;
  actionType: ActionType;
  creator: OptionActionCreator;
  option: number;
  focusType: FocusType;
  field: string;
};

const flagTool = ({
  name,
  atomReason,
  actionType,
  creator,
  option,
  focusType,
  field,
}: FlagTool): ActionTool => {
  const toAction$ = setColumnOptionAction$(creator, option);

  return {
    name,
    kind: 'atom',
    atomReason,
    actionTypes: [actionType],
    undoable: true,
    stream: false,
    // Nothing goes out, and nothing is undone, when the flag already holds.
    expectedBatches: { min: 0, max: 1 },
    expectedHistory: { min: 0, max: 1 },
    focus: columnFocus(focusType),
    snapshotPaths: columnPath(field),
    args: [TABLE_ID, COLUMN_ID, FLAG_VALUE],
    toActions: ({ tableId, columnId, value }) => [
      toAction$(tableId, columnId, value),
    ],
  };
};

const valueTool = (
  name: string,
  actionType: ActionType,
  focusType: FocusType,
  field: string
): ActionTool => ({
  name,
  kind: 'generator',
  actionTypes: [actionType],
  undoable: true,
  stream: false,
  expectedBatches: 1,
  expectedHistory: 1,
  focus: columnFocus(focusType),
  snapshotPaths: columnPath(field),
  args: [TABLE_ID, COLUMN_ID, TEXT_VALUE],
  toActions: ({ tableId, columnId, value }) => [
    tableColumnActions$.changeColumnValueAction$(
      focusType,
      tableId,
      columnId,
      value
    ),
  ],
});

const TOGGLE_REASON =
  'toggleColumnValueAction$ flips the flag the state holds, so a repeated call undoes itself';

export const columnTools: readonly ActionTool[] = [
  {
    name: 'erd_add_column',
    kind: 'generator',
    actionTypes: ['column.add'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: ['tables[tableId].columns'],
    args: [TABLE_ID],
    toActions: ({ tableId }) => [tableColumnActions$.addColumnAction$(tableId)],
  },
  {
    name: 'erd_remove_columns',
    kind: 'generator',
    actionTypes: ['column.remove', 'relationship.remove', 'index.remove'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: ['tables[tableId].columns'],
    args: [
      TABLE_ID,
      {
        name: 'columnIds',
        kind: { type: 'entityIdList', entity: 'column', parentArg: 'tableId' },
        required: true,
      },
    ],
    toActions: ({ tableId, columnIds }) => [
      tableColumnActions$.removeColumnAction$(tableId, columnIds),
    ],
  },
  {
    name: 'erd_change_column_data_type',
    kind: 'generator',
    actionTypes: ['column.changeDataType'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    focus: columnFocus(FocusType.columnDataType),
    snapshotPaths: columnPath('dataType'),
    args: [TABLE_ID, COLUMN_ID, TEXT_VALUE],
    toActions: ({ tableId, columnId, value }) => [
      tableColumnActions$.changeColumnDataTypeAction$({
        tableId,
        id: columnId,
        value,
      }),
    ],
  },
  valueTool(
    'erd_change_column_name',
    'column.changeName',
    FocusType.columnName,
    'name'
  ),
  valueTool(
    'erd_change_column_default',
    'column.changeDefault',
    FocusType.columnDefault,
    'default'
  ),
  valueTool(
    'erd_change_column_comment',
    'column.changeComment',
    FocusType.columnComment,
    'comment'
  ),
  flagTool({
    name: 'erd_set_column_primary_key',
    atomReason:
      'changeColumnPrimaryKeyAction$ toggles the key the state holds, so a repeated call flips it back; selectTableAction$ sets a key only while a relationship is drawn, and addRelationshipAction$ only on a new key column of a start table without one. The tool sets the value outright.',
    actionType: 'column.changePrimaryKey',
    creator: tableColumnActions.changeColumnPrimaryKeyAction,
    option: ColumnOption.primaryKey,
    focusType: FocusType.columnName,
    field: 'primaryKey',
  }),
  flagTool({
    name: 'erd_set_column_unique',
    atomReason: `${TOGGLE_REASON}, and pasteTableAction$ writes it only while pasting columns. The tool sets the value outright.`,
    actionType: 'column.changeUnique',
    creator: tableColumnActions.changeColumnUniqueAction,
    option: ColumnOption.unique,
    focusType: FocusType.columnUnique,
    field: 'unique',
  }),
  flagTool({
    name: 'erd_set_column_not_null',
    atomReason: `${TOGGLE_REASON}; pasteTableAction$ and selectTableAction$ write it only while pasting columns or drawing a relationship, and addRelationshipAction$ only on the foreign key columns it adds. The tool sets the value outright.`,
    actionType: 'column.changeNotNull',
    creator: tableColumnActions.changeColumnNotNullAction,
    option: ColumnOption.notNull,
    focusType: FocusType.columnNotNull,
    field: 'notNull',
  }),
  flagTool({
    name: 'erd_set_column_auto_increment',
    atomReason: `${TOGGLE_REASON}, and pasteTableAction$ writes it only while pasting columns. The tool sets the value outright.`,
    actionType: 'column.changeAutoIncrement',
    creator: tableColumnActions.changeColumnAutoIncrementAction,
    option: ColumnOption.autoIncrement,
    focusType: FocusType.columnAutoIncrement,
    field: 'autoIncrement',
  }),
  {
    name: 'erd_move_column',
    kind: 'atom',
    atomReason:
      'The only generator that moves a column, dragoverColumnAction$, reads the drag state a pointer sets up; the tool names the target column directly.',
    actionTypes: ['column.move'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    focus: columnFocus(FocusType.columnName),
    snapshotPaths: ['tables[tableId].columns'],
    args: [
      TABLE_ID,
      COLUMN_ID,
      {
        name: 'targetColumnId',
        kind: { type: 'entityId', entity: 'column', parentArg: 'tableId' },
        required: true,
      },
    ],
    refine: ({ columnId, targetColumnId }) =>
      columnId === targetColumnId
        ? 'targetColumnId must name a different column than columnId'
        : undefined,
    toActions: ({ tableId, columnId, targetColumnId }) => [
      tableColumnActions.moveColumnAction({
        id: columnId,
        tableId,
        targetId: targetColumnId,
      }),
    ],
  },
];
