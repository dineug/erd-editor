import {
  type GeneratorAction,
  getTablesGroupRect,
  type RootState,
  TABLE_GROUP_MIN_HEIGHT,
  TABLE_GROUP_MIN_WIDTH,
  tableGroupActions,
  tableGroupActions$,
} from '@dineug/erd-editor/peer.js';
import { query } from '@dineug/erd-editor-schema';

import type { ActionTool, ToolArg, ToolArgValues } from '@/tools/registry';
import { toTableGroupMembers } from '@/tools/snapshot';

const GROUP_ID: ToolArg = {
  name: 'groupId',
  kind: { type: 'entityId', entity: 'tableGroup' },
  required: true,
};

const TABLE_IDS: ToolArg = {
  name: 'tableIds',
  kind: { type: 'entityIdList', entity: 'table' },
  required: true,
};

const numberArg = (name: string, required = true): ToolArg => ({
  name,
  kind: { type: 'number' },
  required,
});

const RECT_ARGS = ['x', 'y', 'width', 'height'] as const;

const groupPath = (...fields: string[]) =>
  fields.map(field => `tableGroups[groupId].${field}`);

const groupOf = (state: Pick<RootState, 'collections'>, id: string) =>
  query(state.collections).collection('tableGroupEntities').selectById(id);

const MIN_SIZE = `width must be at least ${TABLE_GROUP_MIN_WIDTH} and height at least ${TABLE_GROUP_MIN_HEIGHT}`;

const isTooSmall = ({ width, height }: { width: number; height: number }) =>
  width < TABLE_GROUP_MIN_WIDTH || height < TABLE_GROUP_MIN_HEIGHT;

/** A new group takes tableIds or a whole rect, never both, and a rect no smaller than the editor draws. */
function refineAdd(args: ToolArgValues): string | undefined {
  const given = RECT_ARGS.filter(name => args[name] !== undefined);
  if (args.tableIds) {
    return given.length
      ? `pass tableIds or a rect (x, y, width, height), not both; ${given.join(', ')} came with tableIds`
      : undefined;
  }
  if (given.length < RECT_ARGS.length) {
    return 'pass tableIds, or x, y, width and height together for a rect';
  }
  return isTooSmall(args as { width: number; height: number })
    ? MIN_SIZE
    : undefined;
}

/** The rect a resize writes: the corner given, or the one the group stores. */
const resizedRect = (
  { ui }: { ui: { x: number; y: number } },
  { x, y, width, height }: ToolArgValues
) => ({
  x: (x as number | undefined) ?? ui.x,
  y: (y as number | undefined) ?? ui.y,
  width: width as number,
  height: height as number,
});

/**
 * A resize as the editor's sash allows it: no smaller than the least a group
 * takes, nor than its tables' bounds with the padding around them, which the
 * sash stops at; the message names the box the rect must hold.
 */
function refineResize(
  args: ToolArgValues,
  state: RootState
): string | undefined {
  const group = groupOf(state, args.groupId);
  if (!group) return undefined;
  const rect = resizedRect(group, args);
  if (isTooSmall(rect)) return MIN_SIZE;

  const box = getTablesGroupRect(
    state,
    toTableGroupMembers(state).get(args.groupId) ?? []
  );
  if (
    !box ||
    (rect.x <= box.x &&
      rect.y <= box.y &&
      box.x + box.width <= rect.x + rect.width &&
      box.y + box.height <= rect.y + rect.height)
  ) {
    return undefined;
  }
  return `the rect must hold the group's tables with their padding: x at most ${Math.floor(box.x)}, y at most ${Math.floor(box.y)}, x + width at least ${Math.ceil(box.x + box.width)} and y + height at least ${Math.ceil(box.y + box.height)}`;
}

/** The stream handler needs the color it replaces, which only the state knows. */
const changeTableGroupColorAction$ = (
  id: string,
  color: string
): GeneratorAction =>
  function* (state) {
    yield tableGroupActions.changeTableGroupColorAction({
      id,
      color,
      prevColor: groupOf(state, id)?.color ?? '',
    });
  };

/**
 * Moves a group to a point by the relative step the editor's drag sends, its
 * tables by the same step, so a peer's concurrent move adds up; a group
 * already there sends nothing.
 */
const moveTableGroupToAction$ = (
  id: string,
  x: number,
  y: number
): GeneratorAction =>
  function* (state) {
    const group = groupOf(state, id);
    if (!group || (group.ui.x === x && group.ui.y === y)) return;

    yield tableGroupActions$.moveTableGroupAction$(
      [id],
      x - group.ui.x,
      y - group.ui.y
    );
  };

/** Writes the rect the call names, nothing when the group stores it already. */
const resizeTableGroupAction$ = (args: ToolArgValues): GeneratorAction =>
  function* (state) {
    const group = groupOf(state, args.groupId);
    if (!group) return;
    const rect = resizedRect(group, args);
    const { ui } = group;
    if (
      ui.x === rect.x &&
      ui.y === rect.y &&
      ui.width === rect.width &&
      ui.height === rect.height
    ) {
      return;
    }

    yield tableGroupActions.resizeTableGroupAction({
      id: args.groupId,
      ...rect,
    });
  };

export const tableGroupTools: readonly ActionTool[] = [
  {
    name: 'erd_add_table_group',
    kind: 'generator',
    actionTypes: [
      'tableGroup.add',
      'tableGroup.changeName',
      'table.changeGroup',
    ],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: ['tableGroups', 'tables'],
    args: [
      { name: 'name', kind: { type: 'string' }, required: true },
      { name: 'color', kind: { type: 'string' }, required: false },
      ...RECT_ARGS.map(name => numberArg(name, false)),
      { ...TABLE_IDS, required: false },
    ],
    refine: refineAdd,
    toActions: ({ name, color, tableIds, x, y, width, height }) => [
      tableIds
        ? tableGroupActions$.addTableGroupFromTablesAction$(tableIds, {
            name,
            color,
          })
        : tableGroupActions$.addTableGroupAction$(
            { x, y, width, height },
            { name, color }
          ),
    ],
  },
  {
    name: 'erd_remove_table_group',
    kind: 'generator',
    actionTypes: ['table.changeGroup', 'tableGroup.remove'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: ['tableGroups', 'tables'],
    args: [GROUP_ID],
    toActions: ({ groupId }) => [
      tableGroupActions$.removeTableGroupAction$(groupId),
    ],
  },
  {
    name: 'erd_change_table_group_name',
    kind: 'atom',
    atomReason:
      'No generator renames a group: addTableGroupAction$ and addTableGroupFromTablesAction$ name only the group they add, and the name editor dispatches this atom itself.',
    actionTypes: ['tableGroup.changeName'],
    undoable: true,
    stream: false,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: groupPath('name'),
    args: [
      GROUP_ID,
      { name: 'value', kind: { type: 'string' }, required: true },
    ],
    toActions: ({ groupId, value }) => [
      tableGroupActions.changeTableGroupNameAction({ id: groupId, value }),
    ],
  },
  {
    name: 'erd_change_table_group_color',
    kind: 'atom',
    atomReason:
      'No generator colors one named group: changeColorAllAction$ colors the selection. The tool reads the previous color from the state as that generator does.',
    actionTypes: ['tableGroup.changeColor'],
    undoable: true,
    stream: true,
    expectedBatches: 1,
    expectedHistory: 1,
    snapshotPaths: groupPath('color'),
    args: [
      GROUP_ID,
      { name: 'color', kind: { type: 'string' }, required: true },
    ],
    toActions: ({ groupId, color }) => [
      changeTableGroupColorAction$(groupId, color),
    ],
  },
  {
    name: 'erd_move_table_group',
    kind: 'generator',
    actionTypes: ['tableGroup.move', 'table.move'],
    undoable: true,
    stream: true,
    // A group already at the point sends nothing, and the history keeps no
    // entry for a move shorter than its threshold, 20 pixels in all.
    expectedBatches: { min: 0, max: 1 },
    expectedHistory: { min: 0, max: 1 },
    snapshotPaths: [...groupPath('x', 'y'), 'tables'],
    args: [GROUP_ID, numberArg('x'), numberArg('y')],
    toActions: ({ groupId, x, y }) => [moveTableGroupToAction$(groupId, x, y)],
  },
  {
    name: 'erd_resize_table_group',
    kind: 'atom',
    atomReason:
      'No generator resizes one named group to a rect: the sash dispatches this atom itself as its drag ends, and sortTablesToMoveAction$ fits every group with tables round where the sort puts them.',
    actionTypes: ['tableGroup.resize'],
    undoable: true,
    stream: false,
    // A rect the group stores already sends nothing.
    expectedBatches: { min: 0, max: 1 },
    expectedHistory: { min: 0, max: 1 },
    snapshotPaths: groupPath('x', 'y', 'width', 'height'),
    args: [
      GROUP_ID,
      numberArg('x', false),
      numberArg('y', false),
      numberArg('width'),
      numberArg('height'),
    ],
    refine: refineResize,
    toActions: args => [resizeTableGroupAction$(args)],
  },
  {
    name: 'erd_set_table_group',
    kind: 'generator',
    actionTypes: ['table.changeGroup'],
    undoable: true,
    stream: false,
    // Tables already where they go send nothing.
    expectedBatches: { min: 0, max: 1 },
    expectedHistory: { min: 0, max: 1 },
    snapshotPaths: ['tables', 'tableGroups'],
    args: [
      TABLE_IDS,
      {
        name: 'groupId',
        kind: { type: 'entityId', entity: 'tableGroup', orNone: true },
        required: true,
      },
    ],
    toActions: ({ tableIds, groupId }) => [
      tableGroupActions$.setTableGroupAction$(tableIds, groupId),
    ],
  },
];
