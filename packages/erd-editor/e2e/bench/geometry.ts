import type { Page } from '@playwright/test';

import { RELATIONSHIP_STROKE_WIDTH } from '@/constants/layout';

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
  /** Infinity when no table side carries two anchors. */
  minAnchorPitch: number;
  totalLengthPx: number;
  /**
   * Longest single collinear overlap and enough context to act on it. Two
   * relationships leaving one side share a corridor only if slotting failed;
   * two leaving different tables share one because nothing coordinates them.
   */
  worstCollinear: {
    length: number;
    axis: string;
    a: string;
    b: string;
    aEnds: string;
    bEnds: string;
    /** The two polylines, so a stubborn overlap can be read directly. */
    aPath: string;
    bPath: string;
  } | null;
};

/**
 * Reads the drawn routing segments and the table boxes in canvas coordinates.
 * The route name is what selects the polyline, because the same group holds a
 * hit band of the same shape, and only the canvas stage carries scene ids.
 */
export async function readScene(page: Page): Promise<Scene> {
  return page.evaluate(() => {
    const host = document.querySelector('erd-editor');
    if (!host) throw new Error('erd-editor is not mounted');

    /** The shape of a konva node this reader reaches through, and no more. */
    type SceneNode = {
      id(): string;
      name(): string;
      x(): number;
      y(): number;
      width(): number;
      height(): number;
      strokeWidth(): number;
      getAttr(name: string): unknown;
      find(selector: string): SceneNode[];
      findOne(selector: string): SceneNode | undefined;
    };

    const stages = Reflect.get(window, '__erdStages') as
      | Record<string, SceneNode>
      | undefined;
    const stage = stages?.canvas;
    if (!stage) throw new Error('the canvas konva stage is not registered');

    const segments: Segment[] = [];
    for (const group of stage.find('.relationship')) {
      const relationshipId = group.name().split(/\s+/)[1] ?? '';
      const route = group.findOne('.relationship-route');
      const numbers = String(route?.getAttr('data') ?? '').match(
        /-?\d+(?:\.\d+)?/g
      );
      if (!numbers) continue;

      for (let index = 2; index + 1 < numbers.length; index += 2) {
        segments.push({
          relationshipId,
          x1: Number(numbers[index - 2]),
          y1: Number(numbers[index - 1]),
          x2: Number(numbers[index]),
          y2: Number(numbers[index + 1]),
        });
      }
    }

    const rects: TableRect[] = [];
    for (const table of stage.find('.table')) {
      // The body rect is the box itself; the group holds its position, and the
      // border straddles the edge, so half a stroke reaches past on each side.
      const body = table.findOne('.table-body');
      if (!body) continue;
      const border = body.strokeWidth();
      rects.push({
        id: table.id().replace(/^table-/, ''),
        x: table.x() + body.x() - border / 2,
        y: table.y() + body.y() - border / 2,
        width: body.width() + border,
        height: body.height() + border,
      });
    }

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
 * How far two connectors run close enough to read as one line. Read from the
 * width the editor draws with, so two are within a band exactly when their
 * strokes overlap. Pairs are compared directly, since a band is no equivalence.
 */
const OVERLAP_BAND = RELATIONSHIP_STROKE_WIDTH;

type Run = {
  low: number;
  high: number;
  coordinate: number;
  relationshipId: string;
};

export function collinearOverlap(segments: Segment[], band = OVERLAP_BAND) {
  const byAxis: Record<'h' | 'v', Run[]> = { h: [], v: [] };

  for (const segment of segments) {
    const horizontal = Math.abs(segment.y1 - segment.y2) < 0.5;
    const vertical = Math.abs(segment.x1 - segment.x2) < 0.5;
    if (horizontal === vertical) continue;

    byAxis[horizontal ? 'h' : 'v'].push(
      horizontal
        ? {
            low: Math.min(segment.x1, segment.x2),
            high: Math.max(segment.x1, segment.x2),
            coordinate: segment.y1,
            relationshipId: segment.relationshipId,
          }
        : {
            low: Math.min(segment.y1, segment.y2),
            high: Math.max(segment.y1, segment.y2),
            coordinate: segment.x1,
            relationshipId: segment.relationshipId,
          }
    );
  }

  let total = 0;
  let worst: {
    length: number;
    axis: string;
    a: string;
    b: string;
  } | null = null;

  for (const axis of ['h', 'v'] as const) {
    const runs = byAxis[axis];
    for (let i = 0; i < runs.length; i++) {
      for (let j = i + 1; j < runs.length; j++) {
        if (runs[i].relationshipId === runs[j].relationshipId) continue;
        if (Math.abs(runs[i].coordinate - runs[j].coordinate) >= band) continue;
        const low = Math.max(runs[i].low, runs[j].low);
        const high = Math.min(runs[i].high, runs[j].high);
        if (high <= low) continue;
        const length = high - low;
        total += length;
        if (!worst || length > worst.length) {
          worst = {
            length: Math.round(length),
            axis: axis === 'h' ? 'horizontal' : 'vertical',
            a: runs[i].relationshipId,
            b: runs[j].relationshipId,
          };
        }
      }
    }
  }
  return { total, worst };
}

/** Direction bits are horizontal when the anchor sits on a left or right side. */
const HORIZONTAL_SIDE = 3;

/**
 * Smallest gap between two anchors on the same table side, read from the
 * document rather than the drawn segments, whose polyline starts a stub away
 * from the table. Infinity means no side carries two anchors, a real answer.
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

  // One connector through one table is one defect however many runs it is drawn
  // in. Counted per segment — which is what this did until metrics v3 — cutting
  // the corners of a route inflated it by a third without anything moving.
  const penetrated = new Set<string>();
  for (const segment of segments) {
    const own = endpoints[segment.relationshipId] ?? [];
    for (const rect of rects) {
      if (own.includes(rect.id)) continue;
      if (penetrated.has(`${segment.relationshipId}:${rect.id}`)) continue;
      if (segmentIntersectsRect(segment, rect)) {
        penetrated.add(`${segment.relationshipId}:${rect.id}`);
      }
    }
  }
  const nodeCrossings = penetrated.size;

  const totalLengthPx = segments.reduce(
    (sum, segment) =>
      sum + Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1),
    0
  );

  const collinear = collinearOverlap(segments);
  const pitch = minAnchorPitch(scene);

  const pathOf = (relationshipId: string) =>
    segments
      .filter(segment => segment.relationshipId === relationshipId)
      .map(
        segment =>
          `(${segment.x1.toFixed(0)},${segment.y1.toFixed(0)})-(${segment.x2.toFixed(0)},${segment.y2.toFixed(0)})`
      )
      .join(' ');

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
          aPath: pathOf(collinear.worst.a),
          bPath: pathOf(collinear.worst.b),
        }
      : null,
  };
}
