/** @jsxHost konva */

import { DOMTemplateLiterals } from '@dineug/r-html';

import { RELATIONSHIP_STROKE_WIDTH } from '@/constants/layout';
import { RelationshipType } from '@/constants/schema';
import {
  Circle,
  CIRCLE_RADIUS,
  Line,
  PointToPoint,
  RelationshipPath,
} from '@/utils/draw-relationship';

/**
 * What every decoration node answers a lookup and an ancestor walk with. Konva
 * has no class list, so the one token is both.
 */
export const DECORATION = 'relationship-decoration';

/** Konva takes one flat pair list where svg took four attributes. */
export const segment = ({ x1, y1, x2, y2 }: PointToPoint) => [x1, y1, x2, y2];

/**
 * One stroke of a cardinality marker. The paint, the width and the two naming
 * attributes are per node in konva, so every marker is drawn through here.
 */
export function decorationLine(
  points: PointToPoint,
  stroke: string
): DOMTemplateLiterals {
  return (
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(points)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
  );
}

/** The optional ring of a cardinality marker, at either anchor. */
export function decorationRing(
  { cx, cy }: Circle,
  stroke: string
): DOMTemplateLiterals {
  return (
    <k-circle
      name={DECORATION}
      kind={DECORATION}
      x={cx}
      y={cy}
      radius={CIRCLE_RADIUS}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
  );
}

/**
 * One cardinality at the end anchor: whether it carries a ring, and the end
 * ticks it draws, in the order they are drawn.
 */
type EndShape = {
  ring: boolean;
  ticks: Array<keyof Line['end']>;
};

// 1, 32 and 64 are the RelationshipType members left commented out in
// @dineug/erd-editor-schema; they have no constant, so the bits are spelled out.
const endShapeMap: Record<number, EndShape> = {
  [1]: { ring: true, ticks: ['base', 'left', 'center', 'right'] },
  [RelationshipType.ZeroOne]: { ring: true, ticks: ['base', 'center'] },
  [RelationshipType.ZeroN]: { ring: true, ticks: ['left', 'center', 'right'] },
  [RelationshipType.OneOnly]: {
    ring: false,
    ticks: ['base', 'base2', 'center2'],
  },
  [RelationshipType.OneN]: {
    ring: false,
    ticks: ['base', 'left', 'center2', 'right'],
  },
  [32]: { ring: false, ticks: ['base', 'center2'] },
  [64]: { ring: false, ticks: ['left', 'center2', 'right'] },
};

export function relationshipShape(
  relationshipType: number,
  { path, line }: RelationshipPath,
  stroke: string
): DOMTemplateLiterals | null {
  const endShape = endShapeMap[relationshipType];
  if (!endShape) return null;

  return (
    <>
      {decorationLine(path.line.end, stroke)}
      {endShape.ring ? decorationRing(line.circle, stroke) : null}
      {endShape.ticks.map(tick => decorationLine(line.line.end[tick], stroke))}
    </>
  );
}
