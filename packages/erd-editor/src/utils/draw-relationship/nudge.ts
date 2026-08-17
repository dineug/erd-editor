import { Point } from '@/internal-types';
import {
  countBlocked,
  type Obstacles,
  segmentHitsBox,
} from '@/utils/draw-relationship/route';

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
 * Segments are collected into a channel by proximity, not by a shared
 * coordinate. The complaint is visual — two connectors within a stroke width
 * read as one line — and the benchmark's worst pair in every corpus was 2px
 * apart: indistinguishable to a reader, yet far enough apart that rounding each
 * coordinate to the pixel filed them under different channels, where nothing
 * ever considered separating them.
 *
 * Only interior segments move. The first and last are attached to the guide line
 * carrying the cardinality symbols, and sliding those would detach the connector
 * from its anchor.
 */

/** Separation given to routes sharing a channel. Stroke width is 3. */
const NUDGE_GAP = 10;

/**
 * Separations tried in turn; the first that leaves no overlap wins. Narrower
 * lanes hold each segment nearer the channel the router chose, so a group whose
 * preferred lanes all run into a table can still be pulled apart rather than
 * give up and stay collinear.
 */
const NUDGE_GAPS = [NUDGE_GAP, 7, 4];

/**
 * Closer than this and two segments still read as one line, so this is both what
 * the pass sets out to fix and the floor of the ladder above: a pixel clear of
 * the stroke, because touching is legible and drawn on top of each other is not.
 */
const MIN_NUDGE_GAP = NUDGE_GAPS[NUDGE_GAPS.length - 1];

/** Slack when comparing how far apart two coordinates already are. */
const NUDGE_EPSILON = 0.5;

/**
 * What counts as separated when an attempt is scored.
 *
 * A rung of the ladder places its lanes exactly `gap` apart in exact arithmetic
 * and a hair under it in floating point — `centre - 2` against `centre + 2` came
 * out 3.999999999999982 apart for a centre of 126.8333. Measured against the rung
 * itself, the narrowest one can then never clear a group, and the group is
 * abandoned on the coordinate it started on: whether the pass works at all turns
 * on the fraction in a table's position. 3.5px is still clear of the 3px stroke.
 */
const SEPARATED = MIN_NUDGE_GAP - NUDGE_EPSILON;

/**
 * How many lanes either side of its own a segment may be placed in.
 *
 * A segment blocked out of its own lane is better off in a nearby free one than
 * back on the shared line, but not in a distant one: reaching that means
 * crossing every neighbour in between, and the search for it is what makes this
 * pass quadratic in the size of a group.
 */
const MAX_LANE_DRIFT = 3;

type Slot = {
  relationshipId: string;
  points: Point[];
  /** The segment runs from `points[index]` to `points[index + 1]`. */
  index: number;
  /**
   * False for a connector's first and last run, which are attached to the guide
   * line carrying the cardinality symbols and cannot slide. They are collected
   * all the same: a lane parked on one is as much a doubled line as any other,
   * and a score that could not see them called that a success.
   */
  movable: boolean;
  vertical: boolean;
  /** Where along the free axis the segment currently sits. */
  coordinate: number;
  low: number;
  high: number;
};

/**
 * What a slot's polyline looked like before its group was touched; a nudge may
 * make neither worse. Both are read before the first move rather than per
 * attempt, so the ladder of separations is compared against one reference
 * instead of against whatever the previous attempt left behind.
 */
type Baseline = {
  blocked: number;
  crossed: boolean;
  /**
   * Where the two tables this connector joins sit in `obstacles`, resolved once:
   * `isSafe` runs per lane tried, and finding them by identity there walked every
   * table in the document to reach two boxes.
   */
  own: number[];
  /**
   * How much of the connector already lay inside those two. `countBlocked` skips
   * them, so nothing else would notice a lane that folds the run leaving an
   * anchor back over the table it is anchored to.
   */
  intruded: number;
  /**
   * Which way the run leaving each anchor pointed. A route may only leave its
   * anchor outward — `routeOrthogonal` enforces that when it enumerates
   * candidates — and a lane on the other side of the turning point sends it back
   * over the guide line the cardinality symbols are drawn on.
   */
  beforeDelta: number;
  afterDelta: number;
};

function collectSlots(routes: Map<string, Point[]>): Slot[] {
  const slots: Slot[] = [];

  for (const [relationshipId, points] of routes) {
    for (let index = 0; index < points.length - 1; index++) {
      const a = points[index];
      const b = points[index + 1];
      const vertical = Math.abs(a.x - b.x) < 0.5;
      const horizontal = Math.abs(a.y - b.y) < 0.5;
      if (vertical === horizontal) continue;

      slots.push({
        relationshipId,
        points,
        index,
        movable: index > 0 && index < points.length - 2,
        vertical,
        coordinate: vertical ? a.x : a.y,
        low: vertical ? Math.min(a.y, b.y) : Math.min(a.x, b.x),
        high: vertical ? Math.max(a.y, b.y) : Math.max(a.x, b.x),
      });
    }
  }

  return slots;
}

/** A total order that no iteration order can disturb, so peers nudge alike. */
function compareSlots(a: Slot, b: Slot) {
  if (a.relationshipId !== b.relationshipId) {
    return a.relationshipId < b.relationshipId ? -1 : 1;
  }
  return a.index - b.index;
}

/** Where the route enters the segment, measured along the channel. */
function entryOf(slot: Slot) {
  const entry = slot.points[slot.index - 1];
  return slot.vertical ? entry.y : entry.x;
}

/** Re-reads how far each segment now runs along the axis it is not free on. */
function refreshExtents(slots: Slot[]) {
  for (const slot of slots) {
    const a = slot.points[slot.index];
    const b = slot.points[slot.index + 1];
    slot.low = slot.vertical ? Math.min(a.y, b.y) : Math.min(a.x, b.x);
    slot.high = slot.vertical ? Math.max(a.y, b.y) : Math.max(a.x, b.x);
  }
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

export function nudgeRoutes(
  routes: Map<string, Point[]>,
  obstacles: Obstacles,
  endpoints: Map<string, [string, string]>
) {
  const vertical: Slot[] = [];
  const horizontal: Slot[] = [];

  for (const slot of collectSlots(routes)) {
    (slot.vertical ? vertical : horizontal).push(slot);
  }

  for (const axis of [vertical, horizontal]) {
    // Separating one axis moves the ends of every segment attached to it on the
    // other, so the extents collected before that pass are not the ones it left
    // behind, and a span read from them decides overlap on stale numbers.
    refreshExtents(axis);

    const slots = axis.filter(slot => slot.movable);
    if (slots.length < 2) continue;

    slots.sort((a, b) => a.coordinate - b.coordinate || compareSlots(a, b));

    // A channel is a run of segments each within one gap of the last, so a chain
    // like 0-3-6-9 is one bundle. Grouping generously is the safe direction:
    // separating part of a chain lands it on whatever the chain was cut from.
    let channel: Slot[] = [];
    const flush = () => {
      if (channel.length > 1) {
        separateRuns(channel, axis, obstacles, endpoints);
      }
      channel = [];
    };

    for (const slot of slots) {
      const previous = channel[channel.length - 1];
      if (
        previous &&
        slot.coordinate - previous.coordinate > NUDGE_GAP + NUDGE_EPSILON
      ) {
        flush();
      }
      channel.push(slot);
    }
    flush();
  }
}

/**
 * Splits a channel into the runs that are genuinely drawn over one another. Two
 * segments on the same line that never meet do not overlap and must not be
 * pushed apart.
 */
function separateRuns(
  channel: Slot[],
  axis: Slot[],
  obstacles: Obstacles,
  endpoints: Map<string, [string, string]>
) {
  channel.sort((a, b) => a.low - b.low || compareSlots(a, b));

  let group: Slot[] = [];
  let reach = -Infinity;

  const flush = () => {
    if (group.length > 1) separate(group, axis, obstacles, endpoints);
    group = [];
    // Reset with the group. Carrying the previous group's reach forward makes
    // every later segment on this line join one giant group, which spreads them
    // so far apart that the safety check rejects the move and drops them back
    // onto the coordinate they were meant to leave.
    reach = -Infinity;
  };

  for (const slot of channel) {
    if (group.length && slot.low >= reach) flush();
    group.push(slot);
    reach = Math.max(reach, slot.high);
  }
  flush();
}

/** How far two segments on one axis are drawn over each other. */
function overlapLength(a: Slot, b: Slot) {
  if (Math.abs(a.coordinate - b.coordinate) >= SEPARATED) return 0;
  return Math.max(0, Math.min(a.high, b.high) - Math.max(a.low, b.low));
}

/**
 * How much of the drawing this group is still doubling up, in pixels — which is
 * what an attempt is scored on, rather than how many segments it managed to move.
 * A segment that took a lane while the one it was covering could not is no better
 * off, and counting placements calls that a partial success.
 *
 * Length rather than a count of pairs, because the choices trade against each
 * other: clearing a 750px overlap is worth landing on a 16px one, and a score
 * that counted both as "one pair" could not tell which way round to prefer. It is
 * the question `e2e/bench/geometry.ts` asks of a real scene.
 *
 * `neighbours` are the segments outside the group a lane could reach, movable or
 * not. Left out, a group spreads far enough to land on the channel next to it, or
 * on a run attached to an anchor, and calls that a success: fuzzing 600 scenes
 * over the group alone made the total overlap worse in 17 of them.
 */
function stillOverlapping(group: Slot[], neighbours: Slot[]) {
  let total = 0;

  for (let i = 0; i < group.length; i++) {
    const a = group[i];
    for (let j = i + 1; j < group.length; j++) {
      total += overlapLength(a, group[j]);
    }
    for (const other of neighbours) {
      total += overlapLength(a, other);
    }
  }

  return total;
}

/**
 * The segments outside the group that its lanes could reach, collected once so
 * scoring an attempt stays proportional to the group rather than to the drawing.
 */
function neighboursOf(group: Slot[], axis: Slot[]) {
  const members = new Set(group);
  let low = Infinity;
  let high = -Infinity;
  for (const slot of group) {
    if (slot.coordinate < low) low = slot.coordinate;
    if (slot.coordinate > high) high = slot.coordinate;
  }

  // The furthest a lane can sit from where the group already is, plus the
  // distance at which it would still be read as the same line.
  const reach = (NUDGE_GAP * (group.length - 1)) / 2 + SEPARATED;
  const neighbours: Slot[] = [];

  for (const slot of axis) {
    if (slot.coordinate < low - reach || slot.coordinate > high + reach)
      continue;
    if (members.has(slot)) continue;
    neighbours.push(slot);
  }

  return neighbours;
}

function separate(
  group: Slot[],
  axis: Slot[],
  obstacles: Obstacles,
  endpoints: Map<string, [string, string]>
) {
  // A channel is collected by proximity, so most groups arrive already legible.
  // Leaving those alone is what keeps the pass from re-laning a bundle the router
  // spaced perfectly well, and it is checked before the baselines below, which
  // cost a `countBlocked` each.
  const neighbours = neighboursOf(group, axis);
  const before = stillOverlapping(group, neighbours);
  if (!before) return;

  const baselines = new Map<Slot, Baseline>();
  const originals = group.map(slot => {
    baselines.set(slot, baselineOf(slot, obstacles, endpoints));
    return slot.coordinate;
  });
  const centre =
    originals.reduce((total, value) => total + value, 0) / originals.length;

  const candidates = orderings(group);
  let best: number[] | null = null;
  let bestLeft = Infinity;

  for (const gap of NUDGE_GAPS) {
    for (const ordered of candidates) {
      place(ordered, gap, centre, baselines, obstacles, endpoints);

      const left = stillOverlapping(group, neighbours);
      if (!left) return;

      if (left < bestLeft) {
        best = group.map(slot => slot.coordinate);
        bestLeft = left;
      }
      apply(group, originals);
    }
  }

  // Nothing cleared the group. Take whichever attempt removed the most, and if
  // none removed anything leave the group where the router put it: moving
  // segments that end up as overlapped as they started only adds crossings.
  if (best && bestLeft < before) apply(group, best);
}

/**
 * The orders a bundle can be laid across its lanes, best first.
 *
 * Neither wins everywhere, which is why both are tried and scored. Ordering by
 * where each route came from keeps neighbours together — the benchmark's medium
 * and large corpora prefer it — while ordering by where each segment already sits
 * moves nobody across anybody, which the small corpus needs to clear at all.
 */
function orderings(group: Slot[]): Slot[][] {
  const byEntry = [...group].sort(
    (a, b) =>
      entryOf(a) - entryOf(b) ||
      a.coordinate - b.coordinate ||
      compareSlots(a, b)
  );
  const byCoordinate = [...group].sort(
    (a, b) =>
      a.coordinate - b.coordinate ||
      entryOf(a) - entryOf(b) ||
      compareSlots(a, b)
  );

  // For a tight bundle the two usually agree, and `place` is deterministic, so
  // running the second would repeat every lane test — a `countBlocked` each —
  // for no new information.
  const same = byEntry.every((slot, index) => slot === byCoordinate[index]);
  return same ? [byEntry] : [byEntry, byCoordinate];
}

function apply(group: Slot[], coordinates: number[]) {
  group.forEach((slot, index) => {
    moveSlot(slot, coordinates[index]);
    slot.coordinate = coordinates[index];
  });
}

/**
 * Spreads the group over lanes `gap` apart, centred on where its segments
 * already are, skipping any lane a segment cannot safely take.
 */
function place(
  ordered: Slot[],
  gap: number,
  centre: number,
  baselines: Map<Slot, Baseline>,
  obstacles: Obstacles,
  endpoints: Map<string, [string, string]>
) {
  const first = centre - (gap * (ordered.length - 1)) / 2;
  const taken = new Set<number>();

  ordered.forEach((slot, index) => {
    const baseline = baselines.get(slot);
    if (!baseline) return;

    const tryLane = (laneIndex: number) => {
      if (laneIndex < 0 || laneIndex >= ordered.length) return false;
      if (taken.has(laneIndex)) return false;

      const lane = first + laneIndex * gap;
      moveSlot(slot, lane);
      if (!isSafe(slot, obstacles, endpoints, baseline)) return false;

      slot.coordinate = lane;
      taken.add(laneIndex);
      return true;
    };

    // Own lane first, then outwards, the lower side first at each distance so
    // the choice cannot depend on which way the search walks.
    for (let drift = 0; drift <= MAX_LANE_DRIFT; drift++) {
      if (tryLane(index - drift)) return;
      if (drift > 0 && tryLane(index + drift)) return;
    }

    // `coordinate` is only written once a lane is accepted, so it still holds
    // where this segment started.
    moveSlot(slot, slot.coordinate);
  });
}

function baselineOf(
  slot: Slot,
  obstacles: Obstacles,
  endpoints: Map<string, [string, string]>
): Baseline {
  const pair = endpoints.get(slot.relationshipId);
  const own: number[] = [];

  for (let index = 0; index < obstacles.ids.length; index++) {
    const id = obstacles.ids[index];
    if (id === pair?.[0] || id === pair?.[1]) own.push(index);
  }

  return {
    blocked: countBlocked(
      slot.points,
      obstacles,
      pair?.[0] ?? '',
      pair?.[1] ?? ''
    ),
    crossed: selfCrosses(slot.points),
    own,
    intruded: countIntruded(slot.points, obstacles, own),
    beforeDelta: neighbourDelta(slot, -1),
    afterDelta: neighbourDelta(slot, 1),
  };
}

/**
 * How far, and which way, the segment on one side of a slot reaches. `side` is
 * -1 for the one before it and 1 for the one after.
 */
function neighbourDelta(slot: Slot, side: number) {
  const own = slot.points[side < 0 ? slot.index : slot.index + 1];
  const outer = slot.points[side < 0 ? slot.index - 1 : slot.index + 2];
  return slot.vertical ? outer.x - own.x : outer.y - own.y;
}

/** Whether a run that pointed one way now points the other. */
function reverses(delta: number, was: number) {
  return Math.abs(was) >= 0.5 && delta * was <= 0;
}

/**
 * Segments of the connector that lie inside either table it joins.
 *
 * A route leaves its anchor a stub's length clear of the table, so any overlap
 * with those two boxes is a fold back over the guide line that carries the
 * cardinality symbols.
 */
function countIntruded(points: Point[], obstacles: Obstacles, own: number[]) {
  let count = 0;

  for (const index of own) {
    const left = obstacles.left[index];
    const top = obstacles.top[index];
    const right = obstacles.right[index];
    const bottom = obstacles.bottom[index];

    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      if (segmentHitsBox(a.x, a.y, b.x, b.y, left, top, right, bottom)) {
        count++;
        break;
      }
    }
  }

  return count;
}

/**
 * A nudge that pushes a segment into a table, that folds one of its neighbours
 * back on itself, or that walks the connector across itself, is worse than the
 * overlap it was fixing.
 */
function isSafe(
  slot: Slot,
  obstacles: Obstacles,
  endpoints: Map<string, [string, string]>,
  baseline: Baseline
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

  // Only the runs at either end are checked for reversal: those are the ones
  // attached to the guide line, and the staircase in between may turn either way.
  if (
    slot.index === 1 &&
    reverses(neighbourDelta(slot, -1), baseline.beforeDelta)
  ) {
    return false;
  }
  if (
    slot.index + 2 === slot.points.length - 1 &&
    reverses(neighbourDelta(slot, 1), baseline.afterDelta)
  ) {
    return false;
  }

  if (countIntruded(slot.points, obstacles, baseline.own) > baseline.intruded) {
    return false;
  }

  // Cheap tests first: the ones above and this one read a handful of points,
  // while `countBlocked` walks every table in the document.
  if (!baseline.crossed && selfCrosses(slot.points)) return false;

  const pair = endpoints.get(slot.relationshipId);
  const blocked = countBlocked(
    slot.points,
    obstacles,
    pair?.[0] ?? '',
    pair?.[1] ?? ''
  );
  return blocked <= baseline.blocked;
}

/**
 * Whether the polyline crosses itself.
 *
 * Only one segment moves, but the two either side of it change length, and a
 * lengthened run can reach across a later segment of the same connector — the
 * escape route, which leaves both anchors on the same axis and comes back, is
 * the shape that can do it. The `shrank` test only catches the opposite case, a
 * neighbour collapsing to nothing.
 */
function selfCrosses(points: Point[]) {
  for (let i = 0; i + 1 < points.length; i++) {
    for (let j = i + 2; j + 1 < points.length; j++) {
      if (crosses(points[i], points[i + 1], points[j], points[j + 1])) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Proper crossing of two axis-aligned segments. Parallel ones are excluded: they
 * can lie on top of each other, which is what the rest of this file is about,
 * but they never cross.
 */
function crosses(a1: Point, a2: Point, b1: Point, b2: Point) {
  const aVertical = Math.abs(a1.x - a2.x) < 0.5;
  const bVertical = Math.abs(b1.x - b2.x) < 0.5;
  if (aVertical === bVertical) return false;

  const v1 = aVertical ? a1 : b1;
  const v2 = aVertical ? a2 : b2;
  const h1 = aVertical ? b1 : a1;
  const h2 = aVertical ? b2 : a2;

  return (
    v1.x > Math.min(h1.x, h2.x) &&
    v1.x < Math.max(h1.x, h2.x) &&
    h1.y > Math.min(v1.y, v2.y) &&
    h1.y < Math.max(v1.y, v2.y)
  );
}
