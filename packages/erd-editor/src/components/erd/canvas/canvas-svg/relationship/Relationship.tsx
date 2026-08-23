import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import {
  RELATIONSHIP_HIT_STROKE_WIDTH,
  RELATIONSHIP_STROKE_WIDTH,
} from '@/constants/layout';
import { StartRelationshipType } from '@/constants/schema';
import { hoverColumnMapAction } from '@/engine/modules/editor/atom.actions';
import { Point, Relationship as RelationshipType } from '@/internal-types';
import { CIRCLE_RADIUS, RelationshipPath } from '@/utils/draw-relationship';
import {
  getRelationshipPath,
  toPathD,
} from '@/utils/draw-relationship/pathFinding';

import { relationshipShape } from './Relationship.template';

/**
 * The whole connector as one path, from one cardinality decoration to the other.
 *
 * Only for hit-testing: a pointer finds an SVG path along its painted stroke, so
 * a connector is exactly as easy to hover as it is thick — and thinning it to
 * `RELATIONSHIP_STROKE_WIDTH` halved a target that was already the width of a
 * line. The guide lines either side of the route start and end where the route
 * does, so all three fit in one extra element instead of one band per segment.
 */
function toHitPathD(
  { line }: RelationshipPath['path'],
  segments: Array<[Point, Point]>
) {
  return toPathD([
    [
      { x: line.start.x1, y: line.start.y1 },
      { x: line.start.x2, y: line.start.y2 },
    ],
    ...segments,
    [
      { x: line.end.x2, y: line.end.y2 },
      { x: line.end.x1, y: line.end.y1 },
    ],
  ]);
}

export type RelationshipProps = {
  relationship: RelationshipType;
  strokeWidth: number;
};

const Relationship: FC<RelationshipProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const handleMouseenter = (relationship: RelationshipType) => {
    const { store } = app.value;
    store.dispatch(
      hoverColumnMapAction({
        columnIds: [
          ...relationship.start.columnIds,
          ...relationship.end.columnIds,
        ],
      })
    );
  };

  const handleMouseleave = () => {
    const { store } = app.value;
    store.dispatch(hoverColumnMapAction({ columnIds: [] }));
  };

  return () => {
    const { store } = app.value;
    const { editor } = store.state;
    const { relationship, strokeWidth } = props;
    const relationshipPath = getRelationshipPath(relationship);
    const { path, line } = relationshipPath;
    const lines = path.path.d();
    const shape = relationshipShape(
      relationship.relationshipType,
      relationshipPath
    );
    const hover = Boolean(editor.hoverRelationshipMap[relationship.id]);

    return (
      <g
        class={[
          'relationship',
          { identification: relationship.identification },
        ]}
        data-id={relationship.id}
        bool:data-hover={hover}
        on:mouseenter={() => handleMouseenter(relationship)}
        on:mouseleave={handleMouseleave}
      >
        <path
          class="hit-area"
          d={toHitPathD(path, lines)}
          stroke-width={RELATIONSHIP_HIT_STROKE_WIDTH}
          stroke="transparent"
          pointer-events="stroke"
          fill="none"
        ></path>
        <path
          class="route"
          d={toPathD(lines)}
          stroke-dasharray={relationship.identification ? 0 : 10}
          stroke-width={strokeWidth}
          fill="none"
        ></path>
        <line
          x1={path.line.start.x1}
          y1={path.line.start.y1}
          x2={path.line.start.x2}
          y2={path.line.start.y2}
          stroke-width={RELATIONSHIP_STROKE_WIDTH}
        ></line>
        <line
          x1={line.line.start.base.x1}
          y1={line.line.start.base.y1}
          x2={line.line.start.base.x2}
          y2={line.line.start.base.y2}
          stroke-width={RELATIONSHIP_STROKE_WIDTH}
        ></line>
        {relationship.startRelationshipType === StartRelationshipType.ring ? (
          <>
            <circle
              cx={line.startCircle.cx}
              cy={line.startCircle.cy}
              r={CIRCLE_RADIUS}
              fill-opacity="0.0"
              stroke-width={RELATIONSHIP_STROKE_WIDTH}
            ></circle>
            <line
              x1={line.line.start.center.x1}
              y1={line.line.start.center.y1}
              x2={line.line.start.center.x2}
              y2={line.line.start.center.y2}
              stroke-width={RELATIONSHIP_STROKE_WIDTH}
            ></line>
          </>
        ) : (
          <>
            <line
              x1={line.line.start.base2.x1}
              y1={line.line.start.base2.y1}
              x2={line.line.start.base2.x2}
              y2={line.line.start.base2.y2}
              stroke-width={RELATIONSHIP_STROKE_WIDTH}
            ></line>
            <line
              x1={line.line.start.center2.x1}
              y1={line.line.start.center2.y1}
              x2={line.line.start.center2.x2}
              y2={line.line.start.center2.y2}
              stroke-width={RELATIONSHIP_STROKE_WIDTH}
            ></line>
          </>
        )}
        {shape}
      </g>
    );
  };
};

export default Relationship;
