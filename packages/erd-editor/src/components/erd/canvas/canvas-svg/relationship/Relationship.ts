import { FC, svg } from '@dineug/r-html';

import { StartRelationshipType } from '@/constants/schema';
import { Relationship as RelationshipType } from '@/internal-types';
import { getRelationshipPath } from '@/utils/draw-relationship/pathFinding';

import { relationshipShapeMap } from './Relationship.template';

export type RelationshipProps = {
  relationship: RelationshipType;
  strokeWidth: number;
};

const Relationship: FC<RelationshipProps> = (props, ctx) => {
  return () => {
    const { relationship, strokeWidth } = props;
    const relationshipPath = getRelationshipPath(relationship);
    const { path, line } = relationshipPath;
    const relationshipShapeTpl =
      relationshipShapeMap[relationship.relationshipType];
    const shape = relationshipShapeTpl
      ? relationshipShapeTpl(relationshipPath)
      : null;

    const d = path.path.d();

    return svg`
      <path
        d=${d}
        stroke-dasharray=${relationship.identification ? 0 : 10}
        stroke-width=${strokeWidth}
        fill="transparent"
      ></path>
      <line
        x1=${path.line.start.x1} y1=${path.line.start.y1}
        x2=${path.line.start.x2} y2=${path.line.start.y2}
        stroke-width="3"
      ></line>
      <line
        x1=${line.line.start.base.x1} y1=${line.line.start.base.y1}
        x2=${line.line.start.base.x2} y2=${line.line.start.base.y2}
        stroke-width="3"
      ></line>
      ${
        relationship.startRelationshipType === StartRelationshipType.ring
          ? svg`
            <circle
              cx=${line.startCircle.cx} cy=${line.startCircle.cy} r="8"
              fill-opacity="0.0"
              stroke-width="3"
            ></circle>
            <line
              x1=${line.line.start.center.x1} y1=${line.line.start.center.y1}
              x2=${line.line.start.center.x2} y2=${line.line.start.center.y2}
              stroke-width="3"
            ></line>
      `
          : svg`
            <line
              x1=${line.line.start.base2.x1} y1=${line.line.start.base2.y1}
              x2=${line.line.start.base2.x2} y2=${line.line.start.base2.y2}
              stroke-width="3"
            ></line>
            <line
              x1=${line.line.start.center2.x1} y1=${line.line.start.center2.y1}
              x2=${line.line.start.center2.x2} y2=${line.line.start.center2.y2}
              stroke-width="3"
            ></line>
      `
      }
      ${shape}
    `;
  };
};

export default Relationship;
