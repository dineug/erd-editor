import type { Page } from '@playwright/test';

/**
 * Overlap metrics, computed from what the editor actually drew.
 *
 * The segments are read back out of the canvas SVG rather than recomputed from
 * the document, so these numbers describe the rendered picture — a routing
 * change that only edits anchors but never reaches the path still moves them.
 *
 * Two counts are kept apart on purpose. `crossingsShared` are between
 * relationships that touch the same table, which anchor ordering can drive to
 * zero on its own; `crossingsFree` are between relationships with no table in
 * common, which only side re-assignment can reduce. Summing them hides which
 * change did the work.
 */

export type Segment = {
  relationshipId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type TableRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Anchor = {
  relationshipId: string;
  tableId: string;
  /** Schema bit: left 1, right 2, top 4, bottom 8. */
  direction: number;
  x: number;
  y: number;
};

export type Scene = {
  segments: Segment[];
  rects: TableRect[];
  /** relationshipId -> the two tables it connects. */
  endpoints: Record<string, [string, string]>;
  /** Both ends of every relationship, read from the document. */
  anchors: Anchor[];
};

export type QualityMetrics = {
  segments: number;
  crossingsShared: number;
  crossingsFree: number;
  nodeCrossings: number;
  collinearOverlapPx: number;
  /** `Infinity` when no table side carries two anchors. */
  minAnchorPitch: number;
  totalLengthPx: number;
  /**
   * Longest single collinear overlap and enough context to act on it: which
   * relationships, which axis, and which table side each end sits on. Two
   * relationships leaving the *same* side share a corridor only if slotting
   * failed; two leaving *different* tables share one because nothing coordinates
   * across tables at all.
   */
  worstCollinear: {
    length: number;
    axis: string;
    a: string;
    b: string;
    aEnds: string;
    bEnds: string;
  } | null;
};

/**
 * Reads the drawn routing segments and the table boxes, both in canvas
 * coordinates.
 *
 * `Relationship.tsx` renders the routing polyline as the only `<line>`s that
 * carry `fill="transparent"`; every cardinality decoration is a bare
 * `stroke-width="3"` line. Scoping to `[data-testid="erd-canvas"]` keeps the
 * minimap's second copy of the same SVG out of the count.
 */
export async function readScene(page: Page): Promise<Scene> {
  return page.evaluate(() => {
    const host = document.querySelector('erd-editor');
    const root = (host as HTMLElement & { shadowRoot: ShadowRoot | null })
      ?.shadowRoot;
    if (!root) throw new Error('shadow root is not reachable');

    const canvas = root.querySelector('[data-testid="erd-canvas"]');
    if (!canvas) throw new Error('canvas is not rendered');

    const segments: Segment[] = [];
    canvas.querySelectorAll('g.relationship').forEach(group => {
      const relationshipId = group.getAttribute('data-id') ?? '';
      group.querySelectorAll('line[fill="transparent"]').forEach(line => {
        segments.push({
          relationshipId,
          x1: Number(line.getAttribute('x1')),
          y1: Number(line.getAttribute('y1')),
          x2: Number(line.getAttribute('x2')),
          y2: Number(line.getAttribute('y2')),
        });
      });
    });

    const rects: TableRect[] = [];
    canvas.querySelectorAll('.table[data-id]').forEach(element => {
      const table = element as HTMLElement;
      // `offsetWidth` is layout px, so the canvas zoom transform does not scale
      // it; `left`/`top` are the inline position the editor writes from ui.x/y.
      rects.push({
        id: table.getAttribute('data-id') ?? '',
        x: table.offsetLeft,
        y: table.offsetTop,
        width: table.offsetWidth,
        height: table.offsetHeight,
      });
    });

    const editor = host as HTMLElement & { value: string };
    type Point = {
      tableId: string;
      x: number;
      y: number;
      direction: number;
    };
    const value = JSON.parse(editor.value) as {
      doc: { relationshipIds: string[] };
      collections: {
        relationshipEntities: Record<string, { start: Point; end: Point }>;
      };
    };

    const endpoints: Record<string, [string, string]> = {};
    const anchors: Anchor[] = [];
    for (const id of value.doc.relationshipIds) {
      const relationship = value.collections.relationshipEntities[id];
      if (!relationship) continue;
      endpoints[id] = [relationship.start.tableId, relationship.end.tableId];
      for (const point of [relationship.start, relationship.end]) {
        anchors.push({
          relationshipId: id,
          tableId: point.tableId,
          direction: point.direction,
          x: point.x,
          y: point.y,
        });
      }
    }

    return { segments, rects, endpoints, anchors };
  });
}

const EPSILON = 1e-9;

function orientation(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
) {
  const value = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (value > EPSILON) return 1;
  if (value < -EPSILON) return -1;
  return 0;
}

/**
 * Proper crossing only — segments that share an endpoint, or merely touch, are
 * not counted. Two relationships leaving the same anchor are not a defect.
 */
export function segmentsCross(a: Segment, b: Segment) {
  const o1 = orientation(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1);
  const o2 = orientation(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2);
  const o3 = orientation(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1);
  const o4 = orientation(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
  return o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0 && o1 !== o2 && o3 !== o4;
}

function segmentIntersectsRect(segment: Segment, rect: TableRect) {
  const { x, y, width, height } = rect;
  const inside = (px: number, py: number) =>
    px >= x && px <= x + width && py >= y && py <= y + height;

  if (inside(segment.x1, segment.y1) || inside(segment.x2, segment.y2)) {
    return true;
  }

  const corners: Array<[number, number, number, number]> = [
    [x, y, x + width, y],
    [x + width, y, x + width, y + height],
    [x + width, y + height, x, y + height],
    [x, y + height, x, y],
  ];
  return corners.some(([ax, ay, bx, by]) =>
    segmentsCross(segment, {
      relationshipId: '',
      x1: ax,
      y1: ay,
      x2: bx,
      y2: by,
    })
  );
}

/**
 * Overlap length between segments that lie on the same axis-aligned line.
 * This is the direct read-out for stub sharing: two relationships leaving the
 * same table side currently run down the identical corridor.
 */
type Span = { low: number; high: number; relationshipId: string };

export function collinearOverlap(segments: Segment[]) {
  const buckets = new Map<string, Span[]>();

  for (const segment of segments) {
    const horizontal = Math.abs(segment.y1 - segment.y2) < 0.5;
    const vertical = Math.abs(segment.x1 - segment.x2) < 0.5;
    if (!horizontal && !vertical) continue;

    const key = horizontal
      ? `h:${segment.y1.toFixed(1)}`
      : `v:${segment.x1.toFixed(1)}`;
    const span: Span = horizontal
      ? {
          low: Math.min(segment.x1, segment.x2),
          high: Math.max(segment.x1, segment.x2),
          relationshipId: segment.relationshipId,
        }
      : {
          low: Math.min(segment.y1, segment.y2),
          high: Math.max(segment.y1, segment.y2),
          relationshipId: segment.relationshipId,
        };

    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(span);
    } else {
      buckets.set(key, [span]);
    }
  }

  let total = 0;
  let worst: {
    length: number;
    axis: string;
    a: string;
    b: string;
  } | null = null;
  for (const [key, spans] of buckets.entries()) {
    for (let i = 0; i < spans.length; i++) {
      for (let j = i + 1; j < spans.length; j++) {
        if (spans[i].relationshipId === spans[j].relationshipId) continue;
        const low = Math.max(spans[i].low, spans[j].low);
        const high = Math.min(spans[i].high, spans[j].high);
        if (high <= low) continue;
        const length = high - low;
        total += length;
        if (!worst || length > worst.length) {
          worst = {
            length: Math.round(length),
            axis: key.startsWith('h') ? 'horizontal' : 'vertical',
            a: spans[i].relationshipId,
            b: spans[j].relationshipId,
          };
        }
      }
    }
  }
  return { total, worst };
}

/** Direction bits are horizontal when the anchor sits on a left or right side. */
const HORIZONTAL_SIDE = 0b0011;

/**
 * Smallest gap between two anchors on the same table side.
 *
 * Read from the document rather than from the drawn segments: the routing
 * polyline starts at the *turning point*, one stub away from the table, so no
 * segment endpoint is an anchor. An earlier version of this scanned segment
 * ends for points that happened to sit near a table box and silently reported
 * whatever it found — including nothing at all once stub lengths changed.
 *
 * `Infinity` means no side carries two anchors, which is a real answer and not
 * a failure; callers render it as such rather than folding it into zero.
 */
export function minAnchorPitch(scene: Scene) {
  const sides = new Map<string, number[]>();

  for (const anchor of scene.anchors) {
    const key = `${anchor.tableId}:${anchor.direction}`;
    // Along a left/right side an anchor moves in y; along top/bottom, in x.
    const position = anchor.direction & HORIZONTAL_SIDE ? anchor.y : anchor.x;
    const list = sides.get(key);
    if (list) {
      list.push(position);
    } else {
      sides.set(key, [position]);
    }
  }

  let smallest = Infinity;
  for (const positions of sides.values()) {
    if (positions.length < 2) continue;
    const sorted = [...positions].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      smallest = Math.min(smallest, sorted[i] - sorted[i - 1]);
    }
  }
  return smallest;
}

export function measureQuality(scene: Scene): QualityMetrics {
  const { segments, rects, endpoints } = scene;

  let crossingsShared = 0;
  let crossingsFree = 0;
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i];
      const b = segments[j];
      if (a.relationshipId === b.relationshipId) continue;
      if (!segmentsCross(a, b)) continue;

      const ea = endpoints[a.relationshipId];
      const eb = endpoints[b.relationshipId];
      const shares =
        !!ea &&
        !!eb &&
        (ea[0] === eb[0] ||
          ea[0] === eb[1] ||
          ea[1] === eb[0] ||
          ea[1] === eb[1]);
      if (shares) {
        crossingsShared++;
      } else {
        crossingsFree++;
      }
    }
  }

  let nodeCrossings = 0;
  for (const segment of segments) {
    const own = endpoints[segment.relationshipId] ?? [];
    for (const rect of rects) {
      if (own.includes(rect.id)) continue;
      if (segmentIntersectsRect(segment, rect)) nodeCrossings++;
    }
  }

  const totalLengthPx = segments.reduce(
    (sum, segment) =>
      sum + Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1),
    0
  );

  const collinear = collinearOverlap(segments);
  const pitch = minAnchorPitch(scene);

  const sideOf = (relationshipId: string) => {
    const ends = scene.anchors.filter(a => a.relationshipId === relationshipId);
    const NAME: Record<number, string> = {
      1: 'left',
      2: 'right',
      4: 'top',
      8: 'bottom',
    };
    return ends
      .map(end => `${end.tableId}.${NAME[end.direction] ?? end.direction}`)
      .join('→');
  };

  return {
    segments: segments.length,
    crossingsShared,
    crossingsFree,
    nodeCrossings,
    collinearOverlapPx: Math.round(collinear.total),
    minAnchorPitch: Number.isFinite(pitch)
      ? Math.round(pitch * 10) / 10
      : Infinity,
    totalLengthPx: Math.round(totalLengthPx),
    worstCollinear: collinear.worst
      ? {
          ...collinear.worst,
          aEnds: sideOf(collinear.worst.a),
          bEnds: sideOf(collinear.worst.b),
        }
      : null,
  };
}
