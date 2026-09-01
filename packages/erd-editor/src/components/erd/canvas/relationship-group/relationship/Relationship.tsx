/** @jsxHost konva */

import { FC, observable } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { useThemeContext } from '@/components/themeContext';
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

import {
  DECORATION,
  relationshipShape,
  segment,
} from './Relationship.template';

/** Ten on, ten off: what the svg route spelt as a single dasharray of 10. */
const ROUTE_DASH = [10, 10];

/** An identifying route is solid, and the empty list is konva for no dash. */
const ROUTE_SOLID: number[] = [];

/**
 * The whole connector as one path, for hit-testing only: a pointer finds a
 * konva shape along its hit stroke, so a connector is as easy to hover as its
 * hit width. All three runs fit one shape rather than a band per segment.
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

/**
 * The hit band in scene units. Konva tests a pointer against a raster the layer
 * scale has already been applied to, so dividing by the zoom is what holds the
 * band at one screen width the way the analytic svg hit test did.
 */
function hitBandWidth(zoomLevel: number) {
  return RELATIONSHIP_HIT_STROKE_WIDTH / (zoomLevel > 0 ? zoomLevel : 1);
}

export type RelationshipProps = {
  relationship: RelationshipType;
  strokeWidth: number;
};

const Relationship: FC<RelationshipProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);
  const state = observable({ hover: false });

  const handleMouseenter = () => {
    const { relationship } = props;
    const { store } = app.value;
    state.hover = true;
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
    state.hover = false;
    store.dispatch(hoverColumnMapAction({ columnIds: [] }));
  };

  return () => {
    const { store } = app.value;
    const { editor, settings } = store.state;
    const { relationship, strokeWidth } = props;
    const theme = themeRef.value;
    const relationshipPath = getRelationshipPath(relationship);
    const { path, line } = relationshipPath;
    const lines = path.path.d();
    // Both are read, never short-circuited: an unread one is an untracked one,
    // and the connector would then miss the change that flipped it.
    const mapHover = Boolean(editor.hoverRelationshipMap[relationship.id]);
    const hover = state.hover || mapHover;
    const stroke = hover
      ? theme.relationshipHover
      : relationship.identification
        ? theme.keyPFK
        : theme.keyFK;
    const shape = relationshipShape(
      relationship.relationshipType,
      relationshipPath,
      stroke
    );

    return (
      <k-group
        name={`relationship ${relationship.id}`}
        kind="relationship"
        on:mouseenter={handleMouseenter}
        on:mouseleave={handleMouseleave}
      >
        <k-path
          name="relationship-hit-area"
          kind="relationship-hit-area"
          data={toHitPathD(path, lines)}
          hitStrokeWidth={hitBandWidth(settings.zoomLevel)}
        />
        <k-path
          name="relationship-route"
          kind="relationship-route"
          data={toPathD(lines)}
          dash={relationship.identification ? ROUTE_SOLID : ROUTE_DASH}
          stroke={stroke}
          strokeWidth={strokeWidth}
          listening={false}
        />
        <k-line
          name={DECORATION}
          kind={DECORATION}
          points={segment(path.line.start)}
          stroke={stroke}
          strokeWidth={RELATIONSHIP_STROKE_WIDTH}
          listening={false}
        />
        <k-line
          name={DECORATION}
          kind={DECORATION}
          points={segment(line.line.start.base)}
          stroke={stroke}
          strokeWidth={RELATIONSHIP_STROKE_WIDTH}
          listening={false}
        />
        {relationship.startRelationshipType === StartRelationshipType.ring ? (
          <>
            <k-circle
              name={DECORATION}
              kind={DECORATION}
              x={line.startCircle.cx}
              y={line.startCircle.cy}
              radius={CIRCLE_RADIUS}
              stroke={stroke}
              strokeWidth={RELATIONSHIP_STROKE_WIDTH}
              listening={false}
            />
            <k-line
              name={DECORATION}
              kind={DECORATION}
              points={segment(line.line.start.center)}
              stroke={stroke}
              strokeWidth={RELATIONSHIP_STROKE_WIDTH}
              listening={false}
            />
          </>
        ) : (
          <>
            <k-line
              name={DECORATION}
              kind={DECORATION}
              points={segment(line.line.start.base2)}
              stroke={stroke}
              strokeWidth={RELATIONSHIP_STROKE_WIDTH}
              listening={false}
            />
            <k-line
              name={DECORATION}
              kind={DECORATION}
              points={segment(line.line.start.center2)}
              stroke={stroke}
              strokeWidth={RELATIONSHIP_STROKE_WIDTH}
              listening={false}
            />
          </>
        )}
        {shape}
      </k-group>
    );
  };
};

export default Relationship;
