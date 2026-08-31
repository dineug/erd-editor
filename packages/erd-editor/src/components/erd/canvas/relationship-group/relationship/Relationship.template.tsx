/** @jsxHost konva */

import { DOMTemplateLiterals } from '@dineug/r-html';

import { RELATIONSHIP_STROKE_WIDTH } from '@/constants/layout';
import { RelationshipType } from '@/constants/schema';
import {
  CIRCLE_RADIUS,
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

const relationshipZeroOneN = (
  { path, line }: RelationshipPath,
  stroke: string
) => (
  <>
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(path.line.end)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-circle
      name={DECORATION}
      kind={DECORATION}
      x={line.circle.cx}
      y={line.circle.cy}
      radius={CIRCLE_RADIUS}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(line.line.end.base)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(line.line.end.left)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(line.line.end.center)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(line.line.end.right)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
  </>
);

const relationshipZeroOne = (
  { path, line }: RelationshipPath,
  stroke: string
) => (
  <>
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(path.line.end)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-circle
      name={DECORATION}
      kind={DECORATION}
      x={line.circle.cx}
      y={line.circle.cy}
      radius={CIRCLE_RADIUS}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(line.line.end.base)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(line.line.end.center)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
  </>
);

const relationshipZeroN = (
  { path, line }: RelationshipPath,
  stroke: string
) => (
  <>
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(path.line.end)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-circle
      name={DECORATION}
      kind={DECORATION}
      x={line.circle.cx}
      y={line.circle.cy}
      radius={CIRCLE_RADIUS}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(line.line.end.left)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(line.line.end.center)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(line.line.end.right)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
  </>
);

const relationshipOneOnly = (
  { path, line }: RelationshipPath,
  stroke: string
) => (
  <>
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(path.line.end)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(line.line.end.base)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(line.line.end.base2)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(line.line.end.center2)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
  </>
);

const relationshipOneN = ({ path, line }: RelationshipPath, stroke: string) => (
  <>
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(path.line.end)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(line.line.end.base)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(line.line.end.left)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(line.line.end.center2)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(line.line.end.right)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
  </>
);

const relationshipOne = ({ path, line }: RelationshipPath, stroke: string) => (
  <>
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(path.line.end)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(line.line.end.base)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(line.line.end.center2)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
  </>
);

const relationshipN = ({ path, line }: RelationshipPath, stroke: string) => (
  <>
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(path.line.end)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(line.line.end.left)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(line.line.end.center2)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
    <k-line
      name={DECORATION}
      kind={DECORATION}
      points={segment(line.line.end.right)}
      stroke={stroke}
      strokeWidth={RELATIONSHIP_STROKE_WIDTH}
      listening={false}
    />
  </>
);

// 1, 32 and 64 are the RelationshipType members left commented out in
// @dineug/erd-editor-schema; they have no constant, so the bits are spelled out.
const relationshipShapeMap: Record<
  number,
  (value: RelationshipPath, stroke: string) => DOMTemplateLiterals
> = {
  [1]: relationshipZeroOneN,
  [RelationshipType.ZeroOne]: relationshipZeroOne,
  [RelationshipType.ZeroN]: relationshipZeroN,
  [RelationshipType.OneOnly]: relationshipOneOnly,
  [RelationshipType.OneN]: relationshipOneN,
  [32]: relationshipOne,
  [64]: relationshipN,
};

export function relationshipShape(
  relationshipType: number,
  relationshipPath: RelationshipPath,
  stroke: string
): DOMTemplateLiterals | null {
  const relationshipShapeTpl = relationshipShapeMap[relationshipType];
  return relationshipShapeTpl?.(relationshipPath, stroke) ?? null;
}
