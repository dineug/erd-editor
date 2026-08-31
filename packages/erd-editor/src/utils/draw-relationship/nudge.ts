import { Point } from '@/internal-types';
import { type NudgeMemo } from '@/utils/draw-relationship/incremental';
import {
  countBlocked,
  type Obstacles,
  segmentHitsBox,
} from '@/utils/draw-relationship/route';

/** Separation given to routes sharing a channel. The connector is 2 wide. */
const NUDGE_GAP = 10;

/**
 * Separations tried in turn; the first that leaves no overlap wins. The floor is
 * 4 rather than the 3 a 2px connector allows, because a narrower rung lets a
 * group settle where a wider one would have pushed it somewhere better.
 */
const NUDGE_GAPS = [NUDGE_GAP, 7, 4];

/**
 * Closer than this and two segments still read as one line, which is both what
 * the pass sets out to fix and the floor of the ladder above.
 */
const MIN_NUDGE_GAP = NUDGE_GAPS[NUDGE_GAPS.length - 1];

/** Slack when comparing how far apart two coordinates already are. */
const NUDGE_EPSILON = 0.5;

/**
 * What counts as separated when an attempt is scored. A rung places its lanes a
 * hair under gap apart in floating point, so scoring against the rung itself
 * would leave the narrowest one unable to ever clear a group.
 */
const SEPARATED = MIN_NUDGE_GAP - NUDGE_EPSILON;

/**
 * How many lanes either side of its own a segment may be placed in. A distant
 * lane means crossing every neighbour on the way, and searching for one is what
 * makes this pass quadratic in the size of a group.
 */
const MAX_LANE_DRIFT = 3;

type Slot = {
  relationshipId: string;
  points: Point[];
  /** The segment runs from points[index] to points[index + 1]. */
  index: number;
  /**
   * False for a connector's first and last run, which are attached to the guide
   * line carrying the cardinality symbols. Collected all the same: a lane parked
   * on one is as much a doubled line as any other.
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
 * make neither worse. Read once rather than per attempt, so every rung of the
 * ladder is compared against one reference.
 */
type Baseline = {
  blocked: number;
  crossed: boolean;
  /**
   * Where the two tables this connector joins sit in obstacles, resolved once:
   * isSafe runs per lane tried, and finding them by identity there walked every
   * table in the document.
   */
  own: number[];
  /**
   * How much of the connector already lay inside those two. countBlocked skips
   * them, so nothing else notices a lane that folds an anchor run back over the
   * table it is anchored to.
   */
  intruded: number;
  /**
   * Which way the run leaving each anchor pointed. A route may only leave its
   * anchor outward, and a lane past the turning point sends it back over the
   * guide line the cardinality symbols are drawn on.
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
  endpoints: Map<string, [string, string]>,
  memo?: NudgeMemo
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
        separateRuns(channel, axis, obstacles, endpoints, memo);
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
  endpoints: Map<string, [string, string]>,
  memo?: NudgeMemo
) {
  channel.sort((a, b) => a.low - b.low || compareSlots(a, b));

  let group: Slot[] = [];
  let reach = -Infinity;

  const flush = () => {
    if (group.length > 1) separate(group, axis, obstacles, endpoints, memo);
    group = [];
    // Reset with the group. Carrying the previous reach forward joins every
    // later segment on this line into one giant group, spread so far apart that
    // the safety check rejects the move.
    reach = -Infinity;
  };

  for (const slot of channel) {
    if (group.length && slot.low >= reach) flush();
    group.push(slot);
    reach = Math.max(reach, slot.high);
  }
  flush();
}

/**
 * Whether two segments are too close along a lane to share it. Clearance rather
 * than a bare touch: two that meet end to end overlap by no length, yet their
 * corners land on one point and read as a connector that is not there.
 */
function crowdsLane(a: Slot, b: Slot) {
  return a.high + NUDGE_GAP > b.low && b.high + NUDGE_GAP > a.low;
}

/** How far two segments on one axis are drawn over each other. */
function overlapLength(a: Slot, b: Slot) {
  if (Math.abs(a.coordinate - b.coordinate) >= SEPARATED) return 0;
  return Math.max(0, Math.min(a.high, b.high) - Math.max(a.low, b.low));
}

/**
 * How much of the drawing this group is still doubling up, in pixels, which is
 * what an attempt is scored on. Length rather than a count of pairs, because
 * clearing a wide overlap is worth landing on a narrow one.
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

/**
 * Splits a group into tracks of segments that never meet, the fewest lanes it
 * can be drawn in. The group arrives ordered by where each segment starts, and
 * colouring intervals by left endpoint never opens a track it could avoid.
 */
function colourGroup(group: Slot[]): Slot[][] {
  const tracks: Slot[][] = [];

  for (const slot of group) {
    const track = tracks.find(
      members => !crowdsLane(members[members.length - 1], slot)
    );
    if (track) {
      track.push(slot);
    } else {
      tracks.push([slot]);
    }
  }

  return tracks;
}

function separate(
  group: Slot[],
  axis: Slot[],
  obstacles: Obstacles,
  endpoints: Map<string, [string, string]>,
  memo?: NudgeMemo
) {
  if (memo && replay(group, memo)) return;

  const before = memo ? group.map(slot => slot.coordinate) : null;
  separateGroup(group, axis, obstacles, endpoints);
  if (memo && before) markMoved(group, before, memo);
}

function separateGroup(
  group: Slot[],
  axis: Slot[],
  obstacles: Obstacles,
  endpoints: Map<string, [string, string]>
) {
  // A channel is collected by proximity, so most groups arrive already legible.
  // Checked before the baselines below, which cost a countBlocked each.
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

  const candidates = laneModels(group);
  let best: number[] | null = null;
  let bestLeft = Infinity;

  for (const gap of NUDGE_GAPS) {
    // Every layout that clears the channel is measured, not just the first
    // found: otherwise list order decides between two that both work, and the
    // compact one lengthens the anchor runs this pass cannot move.
    let cleared: number[] | null = null;
    let clearedDrift = Infinity;

    for (const tracks of candidates) {
      place(tracks, gap, centre, baselines, obstacles, endpoints);

      const left = stillOverlapping(group, neighbours);
      if (!left) {
        const drift = totalDrift(group, originals);
        if (drift < clearedDrift) {
          clearedDrift = drift;
          cleared = group.map(slot => slot.coordinate);
        }
      } else if (left < bestLeft) {
        best = group.map(slot => slot.coordinate);
        bestLeft = left;
      }

      apply(group, originals);
    }

    if (cleared) {
      apply(group, cleared);
      return;
    }
  }

  // Nothing cleared the group. Take whichever attempt removed the most, and if
  // none removed anything leave the group where the router put it: moving
  // segments that end up as overlapped as they started only adds crossings.
  if (best && bestLeft < before) apply(group, best);
}

/**
 * Puts a group back where the last sort drew it, when nothing this sort changed
 * can reach it. The routes are the ones that sort ended with, so the layout it
 * chose is still the answer and none of the scoring below has to run.
 */
function replay(group: Slot[], memo: NudgeMemo) {
  const coordinates: number[] = [];

  for (const slot of group) {
    if (memo.dirty.has(slot.relationshipId)) return false;

    const coordinate = memo.coordinate(
      slot.relationshipId,
      slot.index,
      slot.vertical
    );
    if (coordinate === undefined) return false;
    if (
      memo.lanes.hits(
        slot.vertical,
        slot.coordinate,
        coordinate,
        slot.low,
        slot.high
      )
    ) {
      return false;
    }

    coordinates.push(coordinate);
  }

  apply(group, coordinates);
  return true;
}

/**
 * Records where a group that was actually laid out ended up, so the groups after
 * it see the change. The runs on either side keep their own lane and change
 * length, so the far end of each is marked on the other axis.
 */
function markMoved(group: Slot[], before: number[], memo: NudgeMemo) {
  group.forEach((slot, index) => {
    const from = before[index];
    const to = slot.coordinate;
    if (Math.abs(to - from) < 0.5) return;

    memo.lanes.markSpan(slot.vertical, from, to, slot.low, slot.high);

    const a = slot.points[slot.index];
    const b = slot.points[slot.index + 1];
    const low = Math.min(from, to);
    const high = Math.max(from, to);
    const first = slot.vertical ? a.y : a.x;
    const second = slot.vertical ? b.y : b.x;
    memo.lanes.markSpan(!slot.vertical, first, first, low, high);
    memo.lanes.markSpan(!slot.vertical, second, second, low, high);
  });
}

/**
 * The ways a group can be laid out, best first. Fewer lanes moves each segment
 * least, but a lane is also how one gets away from something outside the group,
 * so both layouts are scored and the group takes whichever clears it.
 */
function laneModels(group: Slot[]): Slot[][][] {
  const coloured = colourGroup(group);
  const compact = orderings(coloured);

  return coloured.length === group.length
    ? compact
    : [...compact, ...orderings(group.map(slot => [slot]))];
}

/**
 * The orders a bundle can be laid across its lanes, best first. Neither wins
 * everywhere: entry order keeps neighbours together, coordinate order moves
 * nobody across anybody, so both are tried and scored.
 */
function orderings(tracks: Slot[][]): Slot[][][] {
  const mean = (track: Slot[], of: (slot: Slot) => number) =>
    track.reduce((total, slot) => total + of(slot), 0) / track.length;

  const byEntry = [...tracks].sort(
    (a, b) =>
      mean(a, entryOf) - mean(b, entryOf) ||
      mean(a, coordinateOf) - mean(b, coordinateOf) ||
      compareSlots(a[0], b[0])
  );
  const byCoordinate = [...tracks].sort(
    (a, b) =>
      mean(a, coordinateOf) - mean(b, coordinateOf) ||
      mean(a, entryOf) - mean(b, entryOf) ||
      compareSlots(a[0], b[0])
  );

  // For a tight bundle the two usually agree, and place is deterministic, so
  // running the second repeats every lane test for no new information.
  const same = byEntry.every((track, index) => track === byCoordinate[index]);
  return same ? [byEntry] : [byEntry, byCoordinate];
}

function coordinateOf(slot: Slot) {
  return slot.coordinate;
}

/** How far the group moved in total, which is what the extra crossings cost. */
function totalDrift(group: Slot[], originals: number[]) {
  return group.reduce(
    (total, slot, index) =>
      total + Math.abs(slot.coordinate - originals[index]),
    0
  );
}

function apply(group: Slot[], coordinates: number[]) {
  group.forEach((slot, index) => {
    moveSlot(slot, coordinates[index]);
    slot.coordinate = coordinates[index];
  });
}

/**
 * Spreads the group over lanes gap apart, centred on where its segments
 * already are, skipping any lane a segment cannot safely take.
 */
function place(
  tracks: Slot[][],
  gap: number,
  centre: number,
  baselines: Map<Slot, Baseline>,
  obstacles: Obstacles,
  endpoints: Map<string, [string, string]>
) {
  const first = centre - (gap * (tracks.length - 1)) / 2;
  const occupants: Slot[][] = tracks.map(() => []);

  tracks.forEach((track, index) => {
    for (const slot of track) {
      const baseline = baselines.get(slot);
      if (!baseline) continue;

      const tryLane = (laneIndex: number) => {
        if (laneIndex < 0 || laneIndex >= tracks.length) return false;
        // A lane holds as many segments as never meet on it, which is what
        // colouring the group first buys. Spans only: the coordinate this
        // segment is about to take is the lane, not the one it still holds.
        if (occupants[laneIndex].some(other => crowdsLane(slot, other))) {
          return false;
        }

        const lane = first + laneIndex * gap;
        moveSlot(slot, lane);
        if (!isSafe(slot, obstacles, endpoints, baseline)) return false;

        slot.coordinate = lane;
        occupants[laneIndex].push(slot);
        return true;
      };

      // Own lane first, then outwards, the lower side first at each distance so
      // the choice cannot depend on which way the search walks.
      let placed = false;
      for (let drift = 0; drift <= MAX_LANE_DRIFT && !placed; drift++) {
        placed =
          tryLane(index - drift) || (drift > 0 && tryLane(index + drift));
      }

      // coordinate is only written once a lane is accepted, so it still holds
      // where this segment started.
      if (!placed) moveSlot(slot, slot.coordinate);
    }
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
 * How far, and which way, the segment on one side of a slot reaches. side is
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
 * Segments of the connector that lie inside either table it joins. A route
 * leaves its anchor a stub clear of the table, so any overlap with those two
 * boxes is a fold back over the cardinality guide line.
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
  // while countBlocked walks every table in the document.
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
 * Whether the polyline crosses itself. One segment moves but its neighbours
 * change length, and a lengthened run can reach across a later segment of the
 * same connector, which the shrank test does not catch.
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
