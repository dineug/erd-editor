import { DOMTemplateLiterals, svg } from '@dineug/r-html';

import { RelationshipType } from '@/constants/schema';
import { RelationshipPath } from '@/utils/draw-relationship';

const relationshipZeroOneN = ({ path, line }: RelationshipPath) =>
  svg`
    <line
      x1=${path.line.end.x1} y1=${path.line.end.y1}
      x2=${path.line.end.x2} y2=${path.line.end.y2}
      stroke-width="3"
    ></line>
    <circle
      cx=${line.circle.cx} cy=${line.circle.cy} r="8"
      fill-opacity="0.0"
      stroke-width="3"
    ></circle>
    <line
      x1=${line.line.end.base.x1} y1=${line.line.end.base.y1}
      x2=${line.line.end.base.x2} y2=${line.line.end.base.y2}
      stroke-width="3"
    ></line>
    <line
      x1=${line.line.end.left.x1} y1=${line.line.end.left.y1}
      x2=${line.line.end.left.x2} y2=${line.line.end.left.y2}
      stroke-width="3"
    ></line>
    <line
      x1=${line.line.end.center.x1} y1=${line.line.end.center.y1}
      x2=${line.line.end.center.x2} y2=${line.line.end.center.y2}
      stroke-width="3"
    ></line>
    <line
      x1=${line.line.end.right.x1} y1=${line.line.end.right.y1}
      x2=${line.line.end.right.x2} y2=${line.line.end.right.y2}
      stroke-width="3"
    ></line>
  `;

const relationshipZeroOne = ({ path, line }: RelationshipPath) =>
  svg`
    <line
      x1=${path.line.end.x1} y1=${path.line.end.y1}
      x2=${path.line.end.x2} y2=${path.line.end.y2}
      stroke-width="3"
    ></line>
    <circle
      cx=${line.circle.cx} cy=${line.circle.cy} r="8"
      fill-opacity="0.0"
      stroke-width="3"
    ></circle>
    <line
      x1=${line.line.end.base.x1} y1=${line.line.end.base.y1}
      x2=${line.line.end.base.x2} y2=${line.line.end.base.y2}
      stroke-width="3"
    ></line>
    <line
      x1=${line.line.end.center.x1} y1=${line.line.end.center.y1}
      x2=${line.line.end.center.x2} y2=${line.line.end.center.y2}
      stroke-width="3"
    ></line>
  `;

const relationshipZeroN = ({ path, line }: RelationshipPath) =>
  svg`
    <line
      x1=${path.line.end.x1} y1=${path.line.end.y1}
      x2=${path.line.end.x2} y2=${path.line.end.y2}
      stroke-width="3"
    ></line>
    <circle
      cx=${line.circle.cx} cy=${line.circle.cy} r="8"
      fill-opacity="0.0"
      stroke-width="3"
    ></circle>
    <line
      x1=${line.line.end.left.x1} y1=${line.line.end.left.y1}
      x2=${line.line.end.left.x2} y2=${line.line.end.left.y2}
      stroke-width="3"
    ></line>
    <line
      x1=${line.line.end.center.x1} y1=${line.line.end.center.y1}
      x2=${line.line.end.center.x2} y2=${line.line.end.center.y2}
      stroke-width="3"
    ></line>
    <line
      x1=${line.line.end.right.x1} y1=${line.line.end.right.y1}
      x2=${line.line.end.right.x2} y2=${line.line.end.right.y2}
      stroke-width="3"
    ></line>
  `;

const relationshipOneOnly = ({ path, line }: RelationshipPath) =>
  svg`
    <line
      x1=${path.line.end.x1} y1=${path.line.end.y1}
      x2=${path.line.end.x2} y2=${path.line.end.y2}
      stroke-width="3"
    ></line>
    <line
      x1=${line.line.end.base.x1} y1=${line.line.end.base.y1}
      x2=${line.line.end.base.x2} y2=${line.line.end.base.y2}
      stroke-width="3"
    ></line>
    <line
      x1=${line.line.end.base2.x1} y1=${line.line.end.base2.y1}
      x2=${line.line.end.base2.x2} y2=${line.line.end.base2.y2}
      stroke-width="3"
    ></line>
    <line
      x1=${line.line.end.center2.x1} y1=${line.line.end.center2.y1}
      x2=${line.line.end.center2.x2} y2=${line.line.end.center2.y2}
      stroke-width="3"
    ></line>
  `;

const relationshipOneN = ({ path, line }: RelationshipPath) =>
  svg`
    <line
      x1=${path.line.end.x1} y1=${path.line.end.y1}
      x2=${path.line.end.x2} y2=${path.line.end.y2}
      stroke-width="3"
    ></line>
    <line
      x1=${line.line.end.base.x1} y1=${line.line.end.base.y1}
      x2=${line.line.end.base.x2} y2=${line.line.end.base.y2}
      stroke-width="3"
    ></line>
    <line
      x1=${line.line.end.left.x1} y1=${line.line.end.left.y1}
      x2=${line.line.end.left.x2} y2=${line.line.end.left.y2}
      stroke-width="3"
    ></line>
    <line
      x1=${line.line.end.center2.x1} y1=${line.line.end.center2.y1}
      x2=${line.line.end.center2.x2} y2=${line.line.end.center2.y2}
      stroke-width="3"
    ></line>
    <line
      x1=${line.line.end.right.x1} y1=${line.line.end.right.y1}
      x2=${line.line.end.right.x2} y2=${line.line.end.right.y2}
      stroke-width="3"
    ></line>
  `;

const relationshipOne = ({ path, line }: RelationshipPath) =>
  svg`
    <line
      x1=${path.line.end.x1} y1=${path.line.end.y1}
      x2=${path.line.end.x2} y2=${path.line.end.y2}
      stroke-width="3"
    ></line>
    <line
      x1=${line.line.end.base.x1} y1=${line.line.end.base.y1}
      x2=${line.line.end.base.x2} y2=${line.line.end.base.y2}
      stroke-width="3"
    ></line>
    <line
      x1=${line.line.end.center2.x1} y1=${line.line.end.center2.y1}
      x2=${line.line.end.center2.x2} y2=${line.line.end.center2.y2}
      stroke-width="3"
    ></line>
  `;

const relationshipN = ({ path, line }: RelationshipPath) =>
  svg`
    <line
      x1=${path.line.end.x1} y1=${path.line.end.y1}
      x2=${path.line.end.x2} y2=${path.line.end.y2}
      stroke-width="3"
    ></line>
    <line
      x1=${line.line.end.left.x1} y1=${line.line.end.left.y1}
      x2=${line.line.end.left.x2} y2=${line.line.end.left.y2}
      stroke-width="3"
    ></line>
    <line
      x1=${line.line.end.center2.x1} y1=${line.line.end.center2.y1}
      x2=${line.line.end.center2.x2} y2=${line.line.end.center2.y2}
      stroke-width="3"
    ></line>
    <line
      x1=${line.line.end.right.x1} y1=${line.line.end.right.y1}
      x2=${line.line.end.right.x2} y2=${line.line.end.right.y2}
      stroke-width="3"
    ></line>
  `;

export const relationshipShapeMap: Record<
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
