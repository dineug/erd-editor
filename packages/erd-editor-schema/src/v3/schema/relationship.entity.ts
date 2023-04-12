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
  // ZeroOneN: /* */ 0b0000000000000000000000000000001,
  ZeroOne: /*  */ 0b0000000000000000000000000000010,
  ZeroN: /*    */ 0b0000000000000000000000000000100,
  OneOnly: /*  */ 0b0000000000000000000000000001000,
  OneN: /*     */ 0b0000000000000000000000000010000,
  // One: /*      */ 0b0000000000000000000000000100000,
  // N: /*        */ 0b0000000000000000000000001000000,
} as const;
export const RelationshipTypeList: ReadonlyArray<number> =
  Object.values(RelationshipType);

export const StartRelationshipType = {
  ring: /* */ 0b0000000000000000000000000000001,
  dash: /* */ 0b0000000000000000000000000000010,
} as const;
export const StartRelationshipTypeList: ReadonlyArray<number> = Object.values(
  StartRelationshipType
);

export const Direction = {
  left: /*   */ 0b0000000000000000000000000000001,
  right: /*  */ 0b0000000000000000000000000000010,
  top: /*    */ 0b0000000000000000000000000000100,
  bottom: /* */ 0b0000000000000000000000000001000,
} as const;
export const DirectionList: ReadonlyArray<number> = Object.values(Direction);
