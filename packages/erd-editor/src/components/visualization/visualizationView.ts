import { createInRange } from '@dineug/shared';

import type { Point } from '@/internal-types';

import { Group, type VisualizationNode } from './createVisualization';

/** The most of a table or column name a label shows before it is cut. */
export const NAME_MAX_LENGTH = 15;

const ELLIPSIS = '…';

/** What a label reads where a name is empty, the words the preview's inputs use. */
const PLACEHOLDER: Record<Group, string> = {
  [Group.table]: 'table',
  [Group.column]: 'column',
};

/**
 * A name as its label shows it. The cut counts code points rather than UTF-16
 * units, so a name ending in an emoji or a CJK glyph is never split inside one.
 *
 * @example
 * truncateName('a_very_long_column_name'); // 'a_very_long_col…'
 */
export function truncateName(name: string): string {
  const chars = Array.from(name);
  if (chars.length <= NAME_MAX_LENGTH) return name;

  return chars.slice(0, NAME_MAX_LENGTH).join('') + ELLIPSIS;
}

/** The text a node's label draws: its name cut to length, or a placeholder. */
export function labelOf(
  node: Pick<VisualizationNode, 'name' | 'group'>
): string {
  const name = node.name.trim();

  return name ? truncateName(name) : PLACEHOLDER[node.group];
}

/** Whether a node has a name of its own, which is what its label is painted by. */
export const hasName = (node: Pick<VisualizationNode, 'name'>): boolean =>
  node.name.trim().length > 0;

export const TABLE_RADIUS = 8;

export const COLUMN_RADIUS = 4;

/** A table draws larger than the columns that hang off it. */
export const nodeRadius = (group: Group): number =>
  group === Group.table ? TABLE_RADIUS : COLUMN_RADIUS;

/** The scale a label is fully gone below, and the one it is whole from. */
export type LabelFade = {
  start: number;
  end: number;
};

/**
 * Where each kind of name fades in. A table name arrives first and a column
 * name only closer up, so the graph reads as shapes from afar, as tables at
 * rest and as every name once the reader leans in, as Obsidian's graph does.
 */
export const LABEL_FADE: Record<Group, LabelFade> = {
  [Group.table]: { start: 0.5, end: 1 },
  [Group.column]: { start: 1, end: 1.5 },
};

const opacityInRange = createInRange(0, 1);

export function labelOpacity(scale: number, group: Group): number {
  const { start, end } = LABEL_FADE[group];

  return opacityInRange((scale - start) / (end - start));
}

export const ZOOM_MIN = 0.1;

export const ZOOM_MAX = 4;

const zoomInRange = createInRange(ZOOM_MIN, ZOOM_MAX);

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

/** What one wheel unit is in px where a host reports lines or pages instead. */
const WHEEL_UNIT_PX: Record<number, number> = { 1: 16, 2: 800 };

/** One notch of a mouse wheel; a trackpad flick past it zooms no faster. */
const WHEEL_DELTA_MAX = 100;

const wheelDeltaInRange = createInRange(-WHEEL_DELTA_MAX, WHEEL_DELTA_MAX);

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
  hoveredId: string | null;
  previewTableId: string | null;
  previewColumnId: string | null;
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
    previewTableId: null,
    previewColumnId: null,
    previewX: 0,
    previewY: 0,
  };
}
