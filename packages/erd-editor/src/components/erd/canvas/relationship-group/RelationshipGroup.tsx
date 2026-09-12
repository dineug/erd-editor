/** @jsxHost konva */

import { FC, repeat } from '@dineug/r-html';

import Relationship from '@/components/erd/canvas/relationship-group/relationship/Relationship';
import { useSceneSource } from '@/components/sceneSourceContext';
import { RELATIONSHIP_STROKE_WIDTH } from '@/constants/layout';
import { Relationship as RelationshipType } from '@/internal-types';
import {
  type CullingRect,
  isRelationshipVisible,
} from '@/konva/scene/viewport';

export type RelationshipGroupProps = {
  relationships: RelationshipType[];
  viewport?: CullingRect;
  strokeWidth?: number;
  /** The connectors a Flow hover fades, decided once by the scene rather than by each leaf. */
  fadedIds?: Set<string>;
};

/**
 * Culling lives here, not in the parent, because a route is a side channel of
 * the sort: a parent that filtered would have to route every connector to learn
 * where it reaches, which is the work this arrangement avoids.
 */
const RelationshipGroup: FC<RelationshipGroupProps> = (props, ctx) => {
  const sourceRef = useSceneSource(ctx);

  return () => {
    const { relationships, viewport, fadedIds } = props;
    const source = sourceRef.value;
    const strokeWidth = props.strokeWidth ?? RELATIONSHIP_STROKE_WIDTH;
    const visible = viewport
      ? relationships.filter(relationship =>
          isRelationshipVisible(viewport, relationship, strokeWidth, source)
        )
      : relationships;

    return (
      <k-group name="relationship-group" kind="relationship-group">
        {repeat(
          visible,
          relationship => relationship.id,
          relationship => (
            <Relationship
              relationship={relationship}
              strokeWidth={strokeWidth}
              faded={fadedIds?.has(relationship.id) ?? false}
            />
          )
        )}
      </k-group>
    );
  };
};

export default RelationshipGroup;
