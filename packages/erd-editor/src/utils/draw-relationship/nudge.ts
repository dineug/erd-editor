import { Point } from '@/internal-types';
import { countBlocked, type Obstacles } from '@/utils/draw-relationship/route';

/**
 * Pulls apart routes that ended up running down the same line.
 *
 * Orthogonal routing and this pass are one change, not two. Turning the old
 * 45-degree middle segment into a right angle costs nothing in segment count and
 * cuts table penetrations, but on its own it raises collinear overlap by nearly
 * eight times: two connectors between neighbouring tables pick the same channel
 * and are drawn exactly on top of each other, where diagonals had drifted apart
 * on their own. Measured, not predicted.
 *
 * Only interior segments move. The first and last are attached to the guide line
 * carrying the cardinality symbols, and sliding those would detach the connector
 * from its anchor.
 */

/** Separation given to routes sharing a channel. Stroke width is 3. */
const NUDGE_GAP = 10;
/** Coordinates within this are treated as the same channel. */
const CHANNEL_EPSILON = 1;

type Slot = {
  relationshipId: string;
  points: Point[];
  /** The segment runs from `points[index]` to `points[index + 1]`. */
  index: number;
  vertical: boolean;
  /** Where along the free axis the segment currently sits. */
  coordinate: number;
  low: number;
  high: number;
};

function collectSlots(routes: Map<string, Point[]>): Slot[] {
  const slots: Slot[] = [];

  for (const [relationshipId, points] of routes) {
    for (let index = 1; index < points.length - 2; index++) {
      const a = points[index];
      const b = points[index + 1];
      const vertical = Math.abs(a.x - b.x) < 0.5;
      const horizontal = Math.abs(a.y - b.y) < 0.5;
      if (vertical === horizontal) continue;

      slots.push({
        relationshipId,
        points,
        index,
        vertical,
        coordinate: vertical ? a.x : a.y,
        low: vertical ? Math.min(a.y, b.y) : Math.min(a.x, b.x),
        high: vertical ? Math.max(a.y, b.y) : Math.max(a.x, b.x),
      });
    }
  }

  return slots;
}

function moveSlot(slot: Slot, coordinate: number) {
  const a = slot.points[slot.index];
  const b = slot.points[slot.index + 1];
  if (slot.vertical) {
    a.x = coordinate;
    b.x = coordinate;
  } else {
    a.y = coordinate;
    b.y = coordinate;
  }
}

/**
 * A nudge that pushes a segment into a table, or that folds one of its
 * neighbours back on itself, is worse than the overlap it was fixing.
 */
function isSafe(
  slot: Slot,
  obstacles: Obstacles,
  endpoints: Map<string, [string, string]>,
  blockedBefore: number
) {
  const before = slot.points[slot.index - 1];
  const a = slot.points[slot.index];
  const b = slot.points[slot.index + 1];
  const after = slot.points[slot.index + 2];

  // The neighbours run along the other axis, so a nudge changes their length.
  const shrank = slot.vertical
    ? Math.abs(before.x - a.x) < 0.5 || Math.abs(after.x - b.x) < 0.5
    : Math.abs(before.y - a.y) < 0.5 || Math.abs(after.y - b.y) < 0.5;
  if (shrank) return false;

  const pair = endpoints.get(slot.relationshipId);
  const blocked = countBlocked(
    slot.points,
    obstacles,
    pair?.[0] ?? '',
    pair?.[1] ?? ''
  );
  return blocked <= blockedBefore;
}

export function nudgeRoutes(
  routes: Map<string, Point[]>,
  obstacles: Obstacles,
  endpoints: Map<string, [string, string]>
) {
  const buckets = new Map<string, Slot[]>();

  for (const slot of collectSlots(routes)) {
    const key = `${slot.vertical ? 'v' : 'h'}:${Math.round(slot.coordinate / CHANNEL_EPSILON)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(slot);
    } else {
      buckets.set(key, [slot]);
    }
  }

  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;

    // Overlapping runs form one group; two segments on the same line that never
    // meet are not drawn on top of each other and must not be pushed apart.
    bucket.sort(
      (a, b) => a.low - b.low || (a.relationshipId < b.relationshipId ? -1 : 1)
    );

    let group: Slot[] = [];
    let reach = -Infinity;

    const flush = () => {
      if (group.length > 1) separate(group, obstacles, endpoints);
      group = [];
      // Reset with the group. Carrying the previous group's reach forward makes
      // every later segment on this line join one giant group, which spreads
      // them so far apart that the safety check rejects the move and drops them
      // back onto the coordinate they were meant to leave.
      reach = -Infinity;
    };

    for (const slot of bucket) {
      if (group.length && slot.low >= reach) flush();
      group.push(slot);
      reach = Math.max(reach, slot.high);
    }
    flush();
  }
}

function separate(
  group: Slot[],
  obstacles: Obstacles,
  endpoints: Map<string, [string, string]>
) {
  // Stable and geometry-led: order along the channel by where each route came
  // from, so neighbours stay neighbours instead of swapping across each other.
  const ordered = [...group].sort((a, b) => {
    const aEntry = a.points[a.index - 1];
    const bEntry = b.points[b.index - 1];
    const key = a.vertical ? 'y' : 'x';
    return (
      aEntry[key] - bEntry[key] ||
      (a.relationshipId < b.relationshipId ? -1 : 1)
    );
  });

  const centre = ordered[0].coordinate;
  const first = centre - (NUDGE_GAP * (ordered.length - 1)) / 2;
  const lanes = ordered.map((_, index) => first + index * NUDGE_GAP);
  const taken = new Set<number>();

  ordered.forEach((slot, index) => {
    const pair = endpoints.get(slot.relationshipId);
    const blockedBefore = countBlocked(
      slot.points,
      obstacles,
      pair?.[0] ?? '',
      pair?.[1] ?? ''
    );
    const original = slot.coordinate;

    // Preferred lane first, then outwards. A segment that cannot take its own
    // lane — because that one runs into a table — is still better off in some
    // other free lane than back on the shared line with everything else.
    const order = lanes
      .map((lane, laneIndex) => ({ lane, laneIndex }))
      .sort(
        (a, b) => Math.abs(a.laneIndex - index) - Math.abs(b.laneIndex - index)
      );

    for (const { lane, laneIndex } of order) {
      if (taken.has(laneIndex)) continue;

      moveSlot(slot, lane);
      if (isSafe(slot, obstacles, endpoints, blockedBefore)) {
        slot.coordinate = lane;
        taken.add(laneIndex);
        return;
      }
    }

    moveSlot(slot, original);
  });
}
