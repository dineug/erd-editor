/** @jsxHost konva */

import { FC, repeat } from '@dineug/r-html';

import Relationship from '@/components/erd/canvas/relationship-group/relationship/Relationship';
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
};

/**
 * Culling lives here, not in the parent, because a route is a side channel of
 * the sort: a parent that filtered would have to route every connector to learn
 * where it reaches, which is the work this arrangement avoids.
 */
const RelationshipGroup: FC<RelationshipGroupProps> = props => () => {
  const { relationships, viewport } = props;
  const strokeWidth = props.strokeWidth ?? RELATIONSHIP_STROKE_WIDTH;
  const visible = viewport
    ? relationships.filter(relationship =>
        isRelationshipVisible(viewport, relationship, strokeWidth)
      )
    : relationships;

  return (
    <k-group name="relationship-group" kind="relationship-group">
      {repeat(
        visible,
        relationship => relationship.id,
        relationship => (
          <Relationship relationship={relationship} strokeWidth={strokeWidth} />
        )
      )}
    </k-group>
  );
};

export default RelationshipGroup;
