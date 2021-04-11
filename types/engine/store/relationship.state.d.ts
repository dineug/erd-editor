export interface RelationshipState {
  relationships: Relationship[];
}

export interface Relationship {
  id: string;
  identification: boolean;
  relationshipType: RelationshipType;
  start: RelationshipPoint;
  end: RelationshipPoint;
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

export type Direction = 'left' | 'right' | 'top' | 'bottom';
