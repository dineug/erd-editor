import { RelationshipType } from '@/v2/schema/relationshipEntity';

const migrationRelationshipTypes: RelationshipType[] = ['ZeroOneN', 'One', 'N'];

const migrationRelationshipTypeMap: Record<string, RelationshipType> = {
  ZeroOneN: 'ZeroN',
  One: 'OneOnly',
  N: 'OneN',
};

export const migrationRelationshipType = (
  relationshipType: RelationshipType
) =>
  migrationRelationshipTypes.includes(relationshipType)
    ? migrationRelationshipTypeMap[relationshipType]
    : relationshipType;
