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
  vx: number;
  vy: number;
  ref: Table;
  width: number;
  height: number;
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
  vx: number;
  vy: number;
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

  return {
    id: table.id,
    r: (width + height) / 4,
    x,
    y,
    vx: 0,
    vy: 0,
    ref: table,
    width,
    height,
  };
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
    vx: 0,
    vy: 0,
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

/** The least room a group's box keeps from another group's box or a table. */
export const GROUP_BOX_GAP = 100;

/** The box a node draws where this tick's velocity takes it, as placeNode puts it. */
function nextBox(node: Node): Rect {
  const x = node.x + node.vx;
  const y = node.y + node.vy;
  const { width, height } = node;

  return 'ref' in node
    ? { x: x - node.r, y: y - node.r, width, height }
    : { x: x - width / 2, y: y - height / 2, width, height };
}

/** How far two spans run into each other, the gap counted in; none at zero or less. */
const overlapOf = (
  start: number,
  size: number,
  other: number,
  otherSize: number
) =>
  Math.min(start + size, other + otherSize) -
  Math.max(start, other) +
  GROUP_BOX_GAP;

/**
 * Pushes two boxes apart along the axis they run into each other least, the
 * smaller node taking more of the push, as forceCollide shares one; boxes on
 * one spot part in a direction the simulation's random source picks.
 */
function separate(a: Node, b: Node, random: () => number): void {
  const boxA = nextBox(a);
  const boxB = nextBox(b);
  const overlapX = overlapOf(boxA.x, boxA.width, boxB.x, boxB.width);
  const overlapY = overlapOf(boxA.y, boxA.height, boxB.y, boxB.height);
  if (overlapX <= 0 || overlapY <= 0) return;

  const across = overlapX < overlapY;
  const apart = across
    ? boxB.x + boxB.width / 2 - (boxA.x + boxA.width / 2)
    : boxB.y + boxB.height / 2 - (boxA.y + boxA.height / 2);
  const push =
    Math.sign(apart || random() - 0.5) * Math.min(overlapX, overlapY);
  const share = (b.r * b.r) / (a.r * a.r + b.r * b.r);

  if (across) {
    a.vx -= push * share;
    b.vx += push * (1 - share);
  } else {
    a.vy -= push * share;
    b.vy += push * (1 - share);
  }
}

/**
 * Keeps each group's box clear of every other box by GROUP_BOX_GAP, which no
 * circle does for a box several members wide without claiming room far above
 * and below it. A document with no group has no pair to part.
 */
function forceGroupBoxes() {
  let groups: GroupNode[] = [];
  let tables: TableNode[] = [];
  let random: () => number;

  const force = () => {
    groups.forEach((group, index) => {
      groups.slice(index + 1).forEach(other => separate(group, other, random));
      tables.forEach(table => separate(group, table, random));
    });
  };

  force.initialize = (nodes: Node[], source: () => number) => {
    groups = nodes.filter((node): node is GroupNode => !('ref' in node));
    tables = nodes.filter((node): node is TableNode => 'ref' in node);
    random = source;
  };

  return force;
}

/**
 * The circle forceCollide keeps a node in: a table's padded by 100, as it
 * always was, and a group's the one inside its box, which claims no room past
 * the box, so forceGroupBoxes alone sets the room round a group.
 */
const collideRadius = (node: Node) =>
  'ref' in node ? 100 + node.r : Math.min(node.width, node.height) / 2;

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
 * inside and the box kept clear of the others, so it is drawn where it goes.
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
    .force('collide', forceCollide<Node>().radius(collideRadius))
    .force('groupBoxes', forceGroupBoxes())
    .force('charge', forceManyBody())
    .force('x', forceX(centerX))
    .force('y', forceY(centerY))
    .on('tick', () => {
      nodes.forEach(placeNode);
      relationshipSort(state);
    });
}
