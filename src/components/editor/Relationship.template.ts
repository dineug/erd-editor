import { Relationship } from '@@types/engine/store/relationship.state';
import { svg } from '@dineug/lit-observable';
import {
  RelationshipPath,
  getRelationshipPath,
} from '@/engine/store/helper/relationship.helper';

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

const relationshipShapeMap = {
  ZeroOneN: relationshipZeroOneN,
  ZeroOne: relationshipZeroOne,
  ZeroN: relationshipZeroN,
  OneOnly: relationshipOneOnly,
  OneN: relationshipOneN,
  One: relationshipOne,
  N: relationshipN,
};

export function relationshipTpl(relationship: Relationship, strokeWidth = 3) {
  const relationshipPath = getRelationshipPath(relationship);
  const { path, line } = relationshipPath;
  const relationshipShapeTpl =
    relationshipShapeMap[relationship.relationshipType];
  const shape = relationshipShapeTpl
    ? relationshipShapeTpl(relationshipPath)
    : null;

  return svg`
    <line
      x1=${path.line.start.x1} y1=${path.line.start.y1}
      x2=${path.line.start.x2} y2=${path.line.start.y2}
      stroke-width="3"
    ></line>
    <path
      d=${path.path.d()}
      stroke-dasharray=${relationship.identification ? 0 : 10}
      stroke-width=${strokeWidth}
      fill="transparent"
    ></path>
    <line
      x1=${line.line.start.x1} y1=${line.line.start.y1}
      x2=${line.line.start.x2} y2=${line.line.start.y2}
      stroke-width="3"
    ></line>
    <line
      x1=${line.line.start2.x1} y1=${line.line.start2.y1}
      x2=${line.line.start2.x2} y2=${line.line.start2.y2}
      stroke-width="3"
    ></line>
    ${shape}
  `;
}
