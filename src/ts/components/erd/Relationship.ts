import { svg } from "lit-element";
import { Logger } from "@src/core/Logger";
import { Relationship } from "@src/core/store/Relationship";
import {
  getRelationshipPath,
  RelationshipPath,
} from "@src/core/helper/RelationshipHelper";

export function createRelationship(
  relationship: Relationship,
  strokeWidth = 3
) {
  let shape = svg``;
  const relationshipPath = getRelationshipPath(relationship);
  const { path, line } = relationshipPath;
  switch (relationship.relationshipType) {
    case "ZeroOneN":
      shape = relationshipZeroOneN(relationshipPath);
      break;
    case "ZeroOne":
      shape = relationshipZeroOne(relationshipPath);
      break;
    case "ZeroN":
      shape = relationshipZeroN(relationshipPath);
      break;
    case "OneOnly":
      shape = relationshipOneOnly(relationshipPath);
      break;
    case "OneN":
      shape = relationshipOneN(relationshipPath);
      break;
    case "One":
      shape = relationshipOne(relationshipPath);
      break;
    case "N":
      shape = relationshipN(relationshipPath);
      break;
  }
  return svg`
    <!-- start -->
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
    <!-- end -->
    ${shape}
  `;
}

function relationshipZeroOneN({ path, line }: RelationshipPath) {
  return svg`
    <!-- end -->
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
}

function relationshipZeroOne({ path, line }: RelationshipPath) {
  return svg`
    <!-- end -->
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
}

function relationshipZeroN({ path, line }: RelationshipPath) {
  return svg`
    <!-- end -->
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
}

function relationshipOneOnly({ path, line }: RelationshipPath) {
  return svg`
    <!-- end -->
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
}

function relationshipOneN({ path, line }: RelationshipPath) {
  return svg`
    <!-- end -->
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
}

function relationshipOne({ path, line }: RelationshipPath) {
  return svg`
    <!-- end -->
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
}

function relationshipN({ path, line }: RelationshipPath) {
  return svg`
    <!-- end -->
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
}
