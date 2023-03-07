import { ValuesType } from 'utility-types';

export interface RelationshipEntity {
  relationships: Relationship[];
}

export interface Relationship {
  id: string;
  identification: boolean;
  relationshipType: RelationshipType;
  startRelationshipType?: StartRelationshipType; // ADD: version 2.0.3
  start: RelationshipPoint;
  end: RelationshipPoint;
  constraintName?: string; // ADD: version 2.1.0
  visible?: boolean;
}

export interface RelationshipPoint {
  tableId: string;
  columnIds: string[];
  x: number;
  y: number;
  direction: Direction;
}

export const RelationshipType = {
  ZeroOneN: 'ZeroOneN',
  ZeroOne: 'ZeroOne',
  ZeroN: 'ZeroN',
  OneOnly: 'OneOnly',
  OneN: 'OneN',
  One: 'One',
  N: 'N',
} as const;
export type RelationshipType = ValuesType<typeof RelationshipType>;
export const RelationshipTypeList: ReadonlyArray<string> =
  Object.values(RelationshipType);

export const StartRelationshipType = {
  Ring: 'Ring',
  Dash: 'Dash',
} as const;
export type StartRelationshipType = ValuesType<typeof StartRelationshipType>;
export const StartRelationshipTypeList: ReadonlyArray<string> = Object.values(
  StartRelationshipType
);

export const Direction = {
  left: 'left',
  right: 'right',
  top: 'top',
  bottom: 'bottom',
} as const;
export type Direction = ValuesType<typeof Direction>;
export const DirectionList: ReadonlyArray<string> = Object.values(Direction);
