import { clamp } from 'es-toolkit';

import {
  type ContentCompass,
  nearestContent,
} from '@/components/erd/content-compass/compassGeometry';
import type { Viewport } from '@/engine/modules/editor/state';
import type { Point } from '@/internal-types';
import type { Rect } from '@/konva/scene/metrics';

import {
  Group,
  linkEnds,
  type VisualizationLink,
  type VisualizationNode,
} from './createVisualization';

// The one fade the graph shares with the Flow scene, kept beside the scene's
// own highlight so the two views cannot drift apart on it.
export { DIM_OPACITY } from '@/konva/scene/viewLayout';

/** The most of a table name a label shows before it is cut. */
export const NAME_MAX_LENGTH = 15;

const ELLIPSIS = '…';

/** What a label reads where a table has no name, the word its input shows. */
const PLACEHOLDER = 'table';

/**
 * A name as its label shows it. The cut counts code points rather than UTF-16
 * units, so a name ending in an emoji or a CJK glyph is never split inside one.
 *
 * @example
 * truncateName('a_very_long_table_name'); // 'a_very_long_tab…'
 */
export function truncateName(name: string): string {
  const chars = Array.from(name);
  if (chars.length <= NAME_MAX_LENGTH) return name;

  return chars.slice(0, NAME_MAX_LENGTH).join('') + ELLIPSIS;
}

/** The text a table's label draws: its name cut to length, or a placeholder. */
export function labelOf(node: Pick<VisualizationNode, 'name'>): string {
  const name = node.name.trim();

  return name ? truncateName(name) : PLACEHOLDER;
}

/** Whether a table has a name of its own, which is what its label is painted by. */
export const hasName = (node: Pick<VisualizationNode, 'name'>): boolean =>
  node.name.trim().length > 0;

export const TABLE_RADIUS = 8;

export const COLUMN_RADIUS = 4;

/** A table draws larger than the columns that hang off it. */
export const nodeRadius = (group: Group): number =>
  group === Group.table ? TABLE_RADIUS : COLUMN_RADIUS;

/** The ids a hovered table lights up: nodes on one side, links on the other. */
export type Highlight = {
  nodeIds: Set<string>;
  linkIds: Set<string>;
};

/**
 * What a hovered table lights: itself, every link at it and whatever sits at
 * the other end of each, which is its own columns and the tables its
 * relationships join either way round. The rest is what the scene fades.
 *
 * @example
 * const { nodeIds, linkIds } = highlightOf(graph.links, 't1');
 */
export function highlightOf(
  links: VisualizationLink[],
  tableId: string
): Highlight {
  const nodeIds = new Set<string>([tableId]);
  const linkIds = new Set<string>();

  links.forEach(link => {
    const [source, target] = linkEnds(link);
    if (source.id !== tableId && target.id !== tableId) return;

    linkIds.add(link.id);
    nodeIds.add(source.id);
    nodeIds.add(target.id);
  });

  return { nodeIds, linkIds };
}

/**
 * The scale a table name is fully gone below and the one it is whole from,
 * fading between the two: the graph reads as shapes from afar and as names at
 * rest, as Obsidian's graph does. A column carries no name at any scale.
 */
export const LABEL_FADE_START = 0.5;

export const LABEL_FADE_END = 1;

const opacityInRange = (value: number) => clamp(value, 0, 1);

export function labelOpacity(scale: number): number {
  return opacityInRange(
    (scale - LABEL_FADE_START) / (LABEL_FADE_END - LABEL_FADE_START)
  );
}

export const ZOOM_MIN = 0.1;

export const ZOOM_MAX = 4;

const zoomInRange = (value: number) => clamp(value, ZOOM_MIN, ZOOM_MAX);

/** Where the scene's origin sits on the stage, and how large a scene unit is. */
export type VisualizationView = {
  x: number;
  y: number;
  scale: number;
};

/** The origin at the middle of the stage, where the forces gather the graph. */
export function createView(width: number, height: number): VisualizationView {
  return { x: width / 2, y: height / 2, scale: 1 };
}

/**
 * The view after a zoom about a stage point. The scene point under that point
 * is held still, so whatever the pointer is over grows or shrinks around it.
 *
 * @example
 * const next = zoomAt(view, { x: event.offsetX, y: event.offsetY }, 1.2);
 */
export function zoomAt(
  view: VisualizationView,
  point: Point,
  factor: number
): VisualizationView {
  const scale = zoomInRange(view.scale * factor);
  const ratio = scale / view.scale;

  return {
    x: point.x - (point.x - view.x) * ratio,
    y: point.y - (point.y - view.y) * ratio,
    scale,
  };
}

/** What a fitted graph leaves clear of the edges of the stage, on every side. */
const FIT_MARGIN = 40;

/** The box a dot takes on the scene, which is the circle its group is drawn at. */
function rectOfNode(node: VisualizationNode): Rect {
  const radius = nodeRadius(node.group);

  return {
    x: node.x - radius,
    y: node.y - radius,
    width: radius * 2,
    height: radius * 2,
  };
}

/** d3 lays an unplaced node on NaN until the first step, and nothing may be measured against that. */
const isPlaced = (node: VisualizationNode): boolean =>
  Number.isFinite(node.x) && Number.isFinite(node.y);

/**
 * The boxes of the dots that stand somewhere, one at a time. A graph carries a
 * dot per table and a dot per column, so a reader that stops on the first box
 * it likes must not be handed an array of all of them first.
 */
function* placedRects(nodes: Iterable<VisualizationNode>): Generator<Rect> {
  for (const node of nodes) {
    if (isPlaced(node)) yield rectOfNode(node);
  }
}

/** The box every dot of the graph stands inside, or null while none of them is placed. */
function boundsOf(nodes: VisualizationNode[]): Rect | null {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;

  for (const rect of placedRects(nodes)) {
    left = Math.min(left, rect.x);
    top = Math.min(top, rect.y);
    right = Math.max(right, rect.x + rect.width);
    bottom = Math.max(bottom, rect.y + rect.height);
  }

  if (left === Infinity) return null;

  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Where the graph shows the scene, in scene units: what the stage covers at its scale. */
function visibleSceneRect(view: VisualizationView, viewport: Viewport): Rect {
  const scale = view.scale || 1;

  return {
    x: -view.x / scale,
    y: -view.y / scale,
    width: viewport.width / scale,
    height: viewport.height / scale,
  };
}

/**
 * The view that stands the whole graph in the middle of the stage, as large as
 * the zoom allows with a margin clear of every edge. A graph with nothing
 * placed yet gets the middle of the stage back, which is where the forces gather it.
 *
 * @example
 * Object.assign(state, fitGraphView(nodes, viewport));
 */
export function fitGraphView(
  nodes: VisualizationNode[],
  viewport: Viewport
): VisualizationView {
  const bounds = boundsOf(nodes);
  if (!bounds || viewport.width <= 0 || viewport.height <= 0) {
    return createView(viewport.width, viewport.height);
  }

  const room = {
    width: Math.max(viewport.width - FIT_MARGIN * 2, 1),
    height: Math.max(viewport.height - FIT_MARGIN * 2, 1),
  };
  const scale = zoomInRange(
    Math.min(
      room.width / Math.max(bounds.width, 1),
      room.height / Math.max(bounds.height, 1)
    )
  );

  return centerGraphView(
    { ...createView(viewport.width, viewport.height), scale },
    { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
    viewport
  );
}

/**
 * The view holding the scene point given under the middle of the stage, at the
 * scale it already stands at. What a press on the compass moves the graph by.
 *
 * @example
 * Object.assign(state, centerGraphView(state, compass.target, viewport));
 */
export function centerGraphView(
  view: VisualizationView,
  target: Point,
  viewport: Viewport
): VisualizationView {
  return {
    x: viewport.width / 2 - target.x * view.scale,
    y: viewport.height / 2 - target.y * view.scale,
    scale: view.scale,
  };
}

/**
 * Which way the nearest dot lies while the stage holds none of them, read the
 * way the scene beside it reads its own. Null while the graph is empty, while
 * the stage has no size, and while any dot reaches the stage.
 *
 * @example
 * const compass = graphCompass(state, nodes, viewport);
 */
export function graphCompass(
  view: VisualizationView,
  nodes: Iterable<VisualizationNode>,
  viewport: Viewport
): ContentCompass | null {
  if (viewport.width <= 0 || viewport.height <= 0) return null;

  // The bar reads this once a simulation step, so the boxes are walked lazily:
  // the first dot that reaches the stage answers the question, and the rest of
  // a graph of thousands is never built.
  return nearestContent(placedRects(nodes), visibleSceneRect(view, viewport));
}

/** What one wheel unit is in px where a host reports lines or pages instead. */
const WHEEL_UNIT_PX: Record<number, number> = { 1: 16, 2: 800 };

/** One notch of a mouse wheel; a trackpad flick past it zooms no faster. */
const WHEEL_DELTA_MAX = 100;

const wheelDeltaInRange = (value: number) =>
  clamp(value, -WHEEL_DELTA_MAX, WHEEL_DELTA_MAX);

/** Per px of wheel travel, so a full notch grows the scale by about a fifth. */
const WHEEL_ZOOM_RATE = 0.002;

/**
 * How much a wheel event scales the view, above one for a wheel rolled away
 * from the user. Exponential in the travel, so a notch each way cancels out.
 */
export function wheelZoomFactor(deltaY: number, deltaMode = 0): number {
  const delta = wheelDeltaInRange(deltaY * (WHEEL_UNIT_PX[deltaMode] ?? 1));

  return Math.exp(-delta * WHEEL_ZOOM_RATE);
}

/**
 * Everything the panel keeps between renders, and none of it in the store: the
 * view is this client's alone and a force layout is not part of the document.
 */
export type VisualizationState = VisualizationView & {
  /** Bumped by every simulation step, which is what redraws the moved graph. */
  tick: number;
  /** A node or the view is being dragged, which is when no preview opens. */
  drag: boolean;
  /** The dot under the pointer, table or column, the one that wears the ring. */
  hoveredId: string | null;
  /**
   * The hovered dot when it is a table, and null over a column: the preview
   * opens for it, and the graph fades around its neighbourhood.
   */
  hoveredTableId: string | null;
  previewX: number;
  previewY: number;
};

export function createVisualizationState(
  width: number,
  height: number
): VisualizationState {
  return {
    ...createView(width, height),
    tick: 0,
    drag: false,
    hoveredId: null,
    hoveredTableId: null,
    previewX: 0,
    previewY: 0,
  };
}
