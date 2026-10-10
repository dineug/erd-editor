import { query } from '@dineug/erd-editor-schema';
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from 'd3-force';
import { clamp } from 'es-toolkit';

import { RootState } from '@/engine/state';
import { Table, TableGroup } from '@/internal-types';
import { getContentRect } from '@/konva/scene/contentBounds';
import { type Rect, unionRect } from '@/konva/scene/metrics';
import { calcTableHeight, calcTableWidths } from '@/utils/calcTable';
import { relationshipSort } from '@/utils/draw-relationship/sort';
import { getTableGroupId, padRect } from '@/utils/tableGroup';

/** A table in no group, put at the node less its radius, as it always was. */
type TableNode = {
  id: string;
  r: number;
  x: number;
  y: number;
  ref: Table;
};

/** A member, and where it stands from the corner of its group's box. */
type Member = { ref: Table; dx: number; dy: number };

/**
 * A group with members, moved as one box centred on the node: the members keep
 * where they stand inside it, and the box, their bounds and the padding, is
 * the rect the group is drawn at, so a preview shows the group where it goes.
 */
type GroupNode = {
  id: string;
  r: number;
  x: number;
  y: number;
  group: TableGroup;
  width: number;
  height: number;
  members: Member[];
};

type Node = TableNode | GroupNode;

type Link = {
  source: string;
  target: string;
};

const tableRect = (state: RootState, table: Table): Rect => ({
  x: table.ui.x,
  y: table.ui.y,
  width: calcTableWidths(table, state).width,
  height: calcTableHeight(table),
});

function createTableNode(
  state: RootState,
  table: Table,
  x: number,
  y: number
): TableNode {
  const { width, height } = tableRect(state, table);

  return { id: table.id, r: (width + height) / 4, x, y, ref: table };
}

function createGroupNode(
  state: RootState,
  group: TableGroup,
  tables: Table[],
  x: number,
  y: number
): GroupNode {
  const box = padRect(
    tables.map(table => tableRect(state, table)).reduce(unionRect)
  );

  return {
    id: group.id,
    r: (box.width + box.height) / 4,
    x,
    y,
    group,
    width: box.width,
    height: box.height,
    members: tables.map(ref => ({
      ref,
      dx: ref.ui.x - box.x,
      dy: ref.ui.y - box.y,
    })),
  };
}

function createNodes(
  state: RootState,
  x: number,
  y: number
): [Array<Node>, Array<Link>] {
  const {
    doc: { tableIds, relationshipIds },
    collections,
  } = state;
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds);
  const relationships = query(collections)
    .collection('relationshipEntities')
    .selectByIds(relationshipIds);

  const links: Link[] = [];
  const linkIdSet = new Set<string>();
  const membersByGroup = new Map<string, Table[]>();
  const nodeIdByTable = new Map<string, string>();
  // A group's node stands where its first member would, so the order the
  // simulation reads stays the document's.
  const order: Array<Table | string> = [];

  tables.forEach(table => {
    const groupId = getTableGroupId(state, table);
    const members = groupId ? membersByGroup.get(groupId) : undefined;
    nodeIdByTable.set(table.id, groupId || table.id);

    if (!groupId) {
      order.push(table);
    } else if (members) {
      members.push(table);
    } else {
      membersByGroup.set(groupId, [table]);
      order.push(groupId);
    }
  });

  const nodes = order.map<Node>(entry =>
    typeof entry === 'string'
      ? createGroupNode(
          state,
          collections.tableGroupEntities[entry],
          membersByGroup.get(entry)!,
          x,
          y
        )
      : createTableNode(state, entry, x, y)
  );

  relationships.forEach(relationship => {
    const { start, end } = relationship;
    const source = nodeIdByTable.get(start.tableId) ?? start.tableId;
    const target = nodeIdByTable.get(end.tableId) ?? end.tableId;
    const linkId = `${source}-${target}`;

    if (source !== target && !linkIdSet.has(linkId)) {
      links.push({ source, target });
      linkIdSet.add(linkId);
    }
  });

  return [nodes, links];
}

/** Puts a node's table, or its group's box and members, where the node stands. */
function placeNode(node: Node): void {
  if ('ref' in node) {
    node.ref.ui.x = node.x - node.r;
    node.ref.ui.y = node.y - node.r;
    return;
  }

  const left = node.x - node.width / 2;
  const top = node.y - node.height / 2;

  node.members.forEach(({ ref, dx, dy }) => {
    ref.ui.x = left + dx;
    ref.ui.y = top + dy;
  });
  node.group.ui.x = left;
  node.group.ui.y = top;
  node.group.ui.width = node.width;
  node.group.ui.height = node.height;
}

const progressInRange = (value: number) => clamp(value, 0, 1);

/** The two readings of a simulation's heat that its progress is taken from. */
type Cooling = {
  alpha(): number;
  alphaMin(): number;
};

/**
 * How far a placement has run, from 0 to 1. The simulation cools by a fixed
 * factor a tick until its heat reaches the floor it stops at, so the log of
 * the heat over the log of that floor is the share of the ticks it will take.
 *
 * @example
 * simulation.on('tick.progress', () => {
 *   state.progress = placementProgress(simulation);
 * });
 */
export function placementProgress(simulation: Cooling): number {
  return progressInRange(
    Math.log(simulation.alpha()) / Math.log(simulation.alphaMin())
  );
}

/**
 * The force simulation that places the tables, around the middle of what the
 * document draws. A group with members is one box in it, its members kept
 * where they stand inside, so a group stays together and is drawn where it goes.
 */
export function createAutomaticTablePlacement(state: RootState) {
  // The middle of what the document already draws, so a layout of an empty
  // document settles where its tables were rather than where a box once was.
  const content = getContentRect(state) ?? { x: 0, y: 0, width: 0, height: 0 };
  const centerX = content.x + content.width / 2;
  const centerY = content.y + content.height / 2;
  const [nodes, links] = createNodes(state, centerX, centerY);

  return forceSimulation(nodes)
    .force(
      'link',
      forceLink(links).id((d: any) => d.id)
    )
    .force(
      'collide',
      forceCollide().radius((d: any) => 100 + d.r)
    )
    .force('charge', forceManyBody())
    .force('x', forceX(centerX))
    .force('y', forceY(centerY))
    .on('tick', () => {
      nodes.forEach(placeNode);
      relationshipSort(state);
    });
}
