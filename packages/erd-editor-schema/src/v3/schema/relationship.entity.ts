import { EntityType } from '@/internal-types';

export type Relationship = EntityType<{
  id: string;
  identification: boolean;
  relationshipType: number;
  startRelationshipType: number;
  start: RelationshipPoint;
  end: RelationshipPoint;
}>;

export type RelationshipPoint = {
  tableId: string;
  columnIds: string[];
  x: number;
  y: number;
  direction: number;
};

export const RelationshipType = {
  // ZeroOneN: 1,
  ZeroOne: 2,
  ZeroN: 4,
  OneOnly: 8,
  OneN: 16,
  // One: 32,
  // N: 64,
} as const;
export const RelationshipTypeList: ReadonlyArray<number> =
  Object.values(RelationshipType);

export const StartRelationshipType = {
  ring: 1,
  dash: 2,
} as const;
export const StartRelationshipTypeList: ReadonlyArray<number> = Object.values(
  StartRelationshipType
);

export const Direction = {
  left: 1,
  right: 2,
  top: 4,
  bottom: 8,
} as const;
export const DirectionList: ReadonlyArray<number> = Object.values(Direction);
