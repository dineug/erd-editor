export interface RelationshipState {
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

export interface Point {
  x: number;
  y: number;
}

export type RelationshipType =
  | 'ZeroOneN'
  | 'ZeroOne'
  | 'ZeroN'
  | 'OneOnly'
  | 'OneN'
  | 'One'
  | 'N';

export type StartRelationshipType = 'Ring' | 'Dash';

export type Direction = 'left' | 'right' | 'top' | 'bottom';
