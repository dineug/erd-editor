/** @jsxHost konva */

import { FC, observable } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { useThemeContext } from '@/components/themeContext';
import { RELATIONSHIP_HIT_STROKE_WIDTH } from '@/constants/layout';
import { Direction, StartRelationshipType } from '@/constants/schema';
import { hoverColumnMapAction } from '@/engine/modules/editor/atom.actions';
import {
  Point,
  Relationship as RelationshipType,
  RelationshipPoint,
} from '@/internal-types';
import {
  CIRCLE_HEIGHT,
  CIRCLE_RADIUS,
  LINE_HEIGHT,
  LINE_SIZE,
  RelationshipPath,
} from '@/utils/draw-relationship';
import {
  getRelationshipPath,
  toPathD,
} from '@/utils/draw-relationship/pathFinding';

import {
  decorationLine,
  decorationRing,
  relationshipShape,
} from './Relationship.template';

/** Ten on, ten off: what the svg route spelt as a single dasharray of 10. */
const ROUTE_DASH = [10, 10];

/** An identifying route is solid, and the empty list is konva for no dash. */
const ROUTE_SOLID: number[] = [];

/**
 * Which way a connector leaves its anchor, as the unit pair every marker is
 * placed with: one step outward along the axis, one step across it.
 */
function anchorAxes({ direction }: RelationshipPoint) {
  const outward =
    direction === Direction.left || direction === Direction.top ? -1 : 1;
  const horizontal =
    direction === Direction.left || direction === Direction.right;

  return horizontal
    ? { along: { x: outward, y: 0 }, across: { x: 0, y: 1 } }
    : { along: { x: 0, y: outward }, across: { x: 1, y: 0 } };
}

type AnchorAxes = ReturnType<typeof anchorAxes>;

/** A point so far out from the anchor and so far across the axis. */
function anchorPoint(
  { x, y }: RelationshipPoint,
  { along, across }: AnchorAxes,
  out: number,
  side: number
): Point {
  return {
    x: x + along.x * out + across.x * side,
    y: y + along.y * out + across.y * side,
  };
}

/**
 * The full circle as one subpath, since konva parses the svg arc command the
 * same way the browser did. Two half turns, because a single one from a point
 * back to itself draws nothing at all.
 */
function circleD({ x, y }: Point, radius: number) {
  return `M${x - radius} ${y}A${radius} ${radius} 0 0 1 ${x + radius} ${y}A${radius} ${radius} 0 0 1 ${x - radius} ${y}`;
}

/**
 * Every cardinality marker either anchor can draw, traced so the hit band
 * follows each of them. Which ones this connector actually drew does not
 * matter: a trace over an unused one costs a band nothing is painted under.
 */
function anchorMarkersD(point: RelationshipPoint) {
  const axes = anchorAxes(point);
  const at = (out: number, side: number) => anchorPoint(point, axes, out, side);
  const tip = at(LINE_HEIGHT, 0);

  return [
    toPathD([[at(LINE_HEIGHT, -LINE_SIZE), at(LINE_HEIGHT, LINE_SIZE)]]),
    toPathD([[at(CIRCLE_HEIGHT, -LINE_SIZE), at(CIRCLE_HEIGHT, LINE_SIZE)]]),
    toPathD([[tip, at(0, LINE_SIZE)]]),
    toPathD([[tip, at(0, -LINE_SIZE)]]),
    circleD(at(CIRCLE_HEIGHT, 0), CIRCLE_RADIUS),
  ].join('');
}

/**
 * The whole connector as one path, for hit-testing only: a pointer finds a
 * konva shape along its hit stroke, and nothing else here listens, so the run
 * reaches both anchors and a marker trace carries the band over each end.
 */
function toHitPathD(
  { start, end }: RelationshipType,
  { line }: RelationshipPath['path'],
  segments: Array<[Point, Point]>
) {
  const run = toPathD([
    [
      { x: start.x, y: start.y },
      { x: line.start.x2, y: line.start.y2 },
    ],
    ...segments,
    [
      { x: line.end.x2, y: line.end.y2 },
      { x: end.x, y: end.y },
    ],
  ]);

  return `${run}${anchorMarkersD(start)}${anchorMarkersD(end)}`;
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
          data={toHitPathD(relationship, path, lines)}
          hitStrokeWidth={hitBandWidth(settings.zoomLevel)}
          lineCap="round"
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
        {decorationLine(path.line.start, stroke)}
        {decorationLine(line.line.start.base, stroke)}
        {relationship.startRelationshipType === StartRelationshipType.ring ? (
          <>
            {decorationRing(line.startCircle, stroke)}
            {decorationLine(line.line.start.center, stroke)}
          </>
        ) : (
          <>
            {decorationLine(line.line.start.base2, stroke)}
            {decorationLine(line.line.start.center2, stroke)}
          </>
        )}
        {shape}
      </k-group>
    );
  };
};

export default Relationship;
