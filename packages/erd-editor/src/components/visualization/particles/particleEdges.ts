import { query } from '@dineug/erd-editor-schema';

import { RootState } from '@/engine/state';
import type { Point, Relationship } from '@/internal-types';
import { getHighlightIds } from '@/konva/scene/viewLayout';
import { getAnchors } from '@/utils/draw-relationship';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import { getRelationshipPath } from '@/utils/draw-relationship/pathFinding';

import {
  type MeasuredPath,
  measurePath,
  PARTICLE_EDGE_MAX,
} from './particlePath';

/** One lit connector as the particles ride it, from its PK end to its FK end. */
export type ParticleEdge = {
  id: string;
  path: MeasuredPath;
};

/**
 * The run of one connector from its PK end to its FK end as a polyline: the
 * start anchor, the stub end, the route, the far stub end and the end anchor,
 * which is the hit path's run without its markers, read from the view's own channel.
 */
function connectorPoints(
  relationship: Relationship,
  source: GeometrySource
): Point[] {
  const { start, end } = getAnchors(relationship, source);
  const { path } = getRelationshipPath(relationship, source);
  const segments = path.path.d();
  const from = { x: start.x, y: start.y };
  const to = { x: end.x, y: end.y };
  if (!segments.length) return [from, to];

  return [
    from,
    { x: path.line.start.x2, y: path.line.start.y2 },
    ...segments.map(([, point]) => ({ x: point.x, y: point.y })),
    { x: path.line.end.x2, y: path.line.end.y2 },
    to,
  ];
}

/**
 * The connectors a view lights, measured for the particles to ride: those at
 * a center or the hovered table, in the order the view shows them. None for
 * the document, and none past the cap, where the fade and the highlight stand alone.
 */
export function getParticleEdges(
  state: RootState,
  source: GeometrySource = 'document'
): ParticleEdge[] {
  if (source === 'document') return [];

  const { relationshipIds } = getHighlightIds(state, source);
  if (!relationshipIds.size || relationshipIds.size > PARTICLE_EDGE_MAX) {
    return [];
  }

  return query(state.collections)
    .collection('relationshipEntities')
    .selectByIds([...relationshipIds])
    .map(relationship => ({
      id: relationship.id,
      path: measurePath(connectorPoints(relationship, source)),
    }));
}
