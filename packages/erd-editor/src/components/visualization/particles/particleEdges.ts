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
  if (!segments.length) return [start, end];

  return [
    start,
    { x: path.line.start.x2, y: path.line.start.y2 },
    ...segments.map(([, point]) => point),
    { x: path.line.end.x2, y: path.line.end.y2 },
    end,
  ];
}

/**
 * The connectors a view lights, measured for the particles to ride: those the
 * hover or the pin reaches, in the order the view shows them. None for the
 * document, none at rest, and none past the cap, where the light stands alone.
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
