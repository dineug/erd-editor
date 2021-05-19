import { RelationshipType } from '@@types/engine/store/relationship.state';

const migrationRelationshipTypes = ['ZeroOneN', 'One', 'N'];

const migrationRelationshipTypeMap = {
  ZeroOneN: 'ZeroN',
  One: 'OneOnly',
  N: 'OneN',
};

export const migrationRelationshipType = (relationshipType: RelationshipType) =>
  migrationRelationshipTypes.includes(relationshipType)
    ? (migrationRelationshipTypeMap as any)[relationshipType]
    : relationshipType;
