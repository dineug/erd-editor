/** @jsxHost konva */

import { FC, observable, repeat } from '@dineug/r-html';

import Relationship from '@/components/erd/canvas/relationship-group/relationship/Relationship';
import RelationshipActionLabel from '@/components/erd/canvas/relationship-group/relationship/RelationshipActionLabel';
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
  // The connector the pointer rests on, read by the labels alone, so a hover
  // redraws the two labels it moves between and no connector.
  const hovered = observable({ id: '' });

  const handleHover = (id: string, hover: boolean) => {
    if (hover) hovered.id = id;
    else if (hovered.id === id) hovered.id = '';
  };

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
              onHover={handleHover}
            />
          )
        )}
        {repeat(
          visible,
          relationship => relationship.id,
          relationship => (
            <RelationshipActionLabel
              relationship={relationship}
              hovered={hovered}
            />
          )
        )}
      </k-group>
    );
  };
};

export default RelationshipGroup;
