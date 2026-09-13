/** @jsxHost konva */

import { FC, repeat } from '@dineug/r-html';

import Relationship from '@/components/erd/canvas/relationship-group/relationship/Relationship';
import { useSceneSource } from '@/components/sceneSourceContext';
import { Relationship as RelationshipType } from '@/internal-types';
import {
  type CullingRect,
  isRelationshipVisible,
} from '@/konva/scene/viewport';
import { relationshipStrokeWidth } from '@/utils/draw-relationship';

export type RelationshipGroupProps = {
  relationships: RelationshipType[];
  viewport?: CullingRect;
  strokeWidth?: number;
  /** The connectors a view lights, decided once by the scene rather than by each leaf. */
  litIds?: Set<string>;
};

/**
 * Culling lives here, not in the parent, because a route is a side channel of
 * the sort: a parent that filtered would have to route every connector to learn
 * where it reaches, which is the work this arrangement avoids.
 */
const RelationshipGroup: FC<RelationshipGroupProps> = (props, ctx) => {
  const sourceRef = useSceneSource(ctx);

  return () => {
    const { relationships, viewport, litIds } = props;
    const source = sourceRef.value;
    const strokeWidth = props.strokeWidth ?? relationshipStrokeWidth(source);
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
              lit={litIds?.has(relationship.id) ?? false}
            />
          )
        )}
      </k-group>
    );
  };
};

export default RelationshipGroup;
