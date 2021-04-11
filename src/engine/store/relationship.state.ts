import {
  RelationshipState,
  RelationshipType,
} from '@@types/engine/store/relationship.state';

export const oneRelationshipTypes: RelationshipType[] = [
  'ZeroOne',
  'OneOnly',
  'One',
];

export const nRelationshipTypes: RelationshipType[] = [
  'ZeroOneN',
  'ZeroN',
  'OneN',
  'N',
];

export const createRelationshipState = (): RelationshipState => ({
  relationships: [],
});
