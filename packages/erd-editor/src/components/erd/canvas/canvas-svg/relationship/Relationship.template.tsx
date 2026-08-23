import { DOMTemplateLiterals } from '@dineug/r-html';

import { RELATIONSHIP_STROKE_WIDTH } from '@/constants/layout';
import { RelationshipType } from '@/constants/schema';
import { CIRCLE_RADIUS, RelationshipPath } from '@/utils/draw-relationship';

const relationshipZeroOneN = ({ path, line }: RelationshipPath) => (
  <>
    <line
      x1={path.line.end.x1}
      y1={path.line.end.y1}
      x2={path.line.end.x2}
      y2={path.line.end.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
    <circle
      cx={line.circle.cx}
      cy={line.circle.cy}
      r={CIRCLE_RADIUS}
      fill-opacity="0.0"
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></circle>
    <line
      x1={line.line.end.base.x1}
      y1={line.line.end.base.y1}
      x2={line.line.end.base.x2}
      y2={line.line.end.base.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
    <line
      x1={line.line.end.left.x1}
      y1={line.line.end.left.y1}
      x2={line.line.end.left.x2}
      y2={line.line.end.left.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
    <line
      x1={line.line.end.center.x1}
      y1={line.line.end.center.y1}
      x2={line.line.end.center.x2}
      y2={line.line.end.center.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
    <line
      x1={line.line.end.right.x1}
      y1={line.line.end.right.y1}
      x2={line.line.end.right.x2}
      y2={line.line.end.right.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
  </>
);

const relationshipZeroOne = ({ path, line }: RelationshipPath) => (
  <>
    <line
      x1={path.line.end.x1}
      y1={path.line.end.y1}
      x2={path.line.end.x2}
      y2={path.line.end.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
    <circle
      cx={line.circle.cx}
      cy={line.circle.cy}
      r={CIRCLE_RADIUS}
      fill-opacity="0.0"
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></circle>
    <line
      x1={line.line.end.base.x1}
      y1={line.line.end.base.y1}
      x2={line.line.end.base.x2}
      y2={line.line.end.base.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
    <line
      x1={line.line.end.center.x1}
      y1={line.line.end.center.y1}
      x2={line.line.end.center.x2}
      y2={line.line.end.center.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
  </>
);

const relationshipZeroN = ({ path, line }: RelationshipPath) => (
  <>
    <line
      x1={path.line.end.x1}
      y1={path.line.end.y1}
      x2={path.line.end.x2}
      y2={path.line.end.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
    <circle
      cx={line.circle.cx}
      cy={line.circle.cy}
      r={CIRCLE_RADIUS}
      fill-opacity="0.0"
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></circle>
    <line
      x1={line.line.end.left.x1}
      y1={line.line.end.left.y1}
      x2={line.line.end.left.x2}
      y2={line.line.end.left.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
    <line
      x1={line.line.end.center.x1}
      y1={line.line.end.center.y1}
      x2={line.line.end.center.x2}
      y2={line.line.end.center.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
    <line
      x1={line.line.end.right.x1}
      y1={line.line.end.right.y1}
      x2={line.line.end.right.x2}
      y2={line.line.end.right.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
  </>
);

const relationshipOneOnly = ({ path, line }: RelationshipPath) => (
  <>
    <line
      x1={path.line.end.x1}
      y1={path.line.end.y1}
      x2={path.line.end.x2}
      y2={path.line.end.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
    <line
      x1={line.line.end.base.x1}
      y1={line.line.end.base.y1}
      x2={line.line.end.base.x2}
      y2={line.line.end.base.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
    <line
      x1={line.line.end.base2.x1}
      y1={line.line.end.base2.y1}
      x2={line.line.end.base2.x2}
      y2={line.line.end.base2.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
    <line
      x1={line.line.end.center2.x1}
      y1={line.line.end.center2.y1}
      x2={line.line.end.center2.x2}
      y2={line.line.end.center2.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
  </>
);

const relationshipOneN = ({ path, line }: RelationshipPath) => (
  <>
    <line
      x1={path.line.end.x1}
      y1={path.line.end.y1}
      x2={path.line.end.x2}
      y2={path.line.end.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
    <line
      x1={line.line.end.base.x1}
      y1={line.line.end.base.y1}
      x2={line.line.end.base.x2}
      y2={line.line.end.base.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
    <line
      x1={line.line.end.left.x1}
      y1={line.line.end.left.y1}
      x2={line.line.end.left.x2}
      y2={line.line.end.left.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
    <line
      x1={line.line.end.center2.x1}
      y1={line.line.end.center2.y1}
      x2={line.line.end.center2.x2}
      y2={line.line.end.center2.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
    <line
      x1={line.line.end.right.x1}
      y1={line.line.end.right.y1}
      x2={line.line.end.right.x2}
      y2={line.line.end.right.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
  </>
);

const relationshipOne = ({ path, line }: RelationshipPath) => (
  <>
    <line
      x1={path.line.end.x1}
      y1={path.line.end.y1}
      x2={path.line.end.x2}
      y2={path.line.end.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
    <line
      x1={line.line.end.base.x1}
      y1={line.line.end.base.y1}
      x2={line.line.end.base.x2}
      y2={line.line.end.base.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
    <line
      x1={line.line.end.center2.x1}
      y1={line.line.end.center2.y1}
      x2={line.line.end.center2.x2}
      y2={line.line.end.center2.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
  </>
);

const relationshipN = ({ path, line }: RelationshipPath) => (
  <>
    <line
      x1={path.line.end.x1}
      y1={path.line.end.y1}
      x2={path.line.end.x2}
      y2={path.line.end.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
    <line
      x1={line.line.end.left.x1}
      y1={line.line.end.left.y1}
      x2={line.line.end.left.x2}
      y2={line.line.end.left.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
    <line
      x1={line.line.end.center2.x1}
      y1={line.line.end.center2.y1}
      x2={line.line.end.center2.x2}
      y2={line.line.end.center2.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
    <line
      x1={line.line.end.right.x1}
      y1={line.line.end.right.y1}
      x2={line.line.end.right.x2}
      y2={line.line.end.right.y2}
      stroke-width={RELATIONSHIP_STROKE_WIDTH}
    ></line>
  </>
);

const relationshipShapeMap: Record<
  number,
  (value: RelationshipPath) => DOMTemplateLiterals
> = {
  [0b0000000000000000000000000000001]: relationshipZeroOneN,
  [RelationshipType.ZeroOne]: relationshipZeroOne,
  [RelationshipType.ZeroN]: relationshipZeroN,
  [RelationshipType.OneOnly]: relationshipOneOnly,
  [RelationshipType.OneN]: relationshipOneN,
  [0b0000000000000000000000000100000]: relationshipOne,
  [0b0000000000000000000000001000000]: relationshipN,
};

export function relationshipShape(
  relationshipType: number,
  relationshipPath: RelationshipPath
): DOMTemplateLiterals | null {
  const relationshipShapeTpl = relationshipShapeMap[relationshipType];
  return relationshipShapeTpl?.(relationshipPath) ?? null;
}
