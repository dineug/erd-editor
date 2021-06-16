import {
  Relationship,
  RelationshipType,
  StartRelationshipType,
} from '../store/relationship.state';

export interface AddRelationshipPoint {
  tableId: string;
  columnIds: string[];
}

export interface AddRelationship {
  id: string;
  relationshipType: RelationshipType;
  start: AddRelationshipPoint;
  end: AddRelationshipPoint;
  constraintName: string;
}

export interface RemoveRelationship {
  relationshipIds: string[];
}

export interface ChangeRelationshipType {
  relationshipId: string;
  relationshipType: RelationshipType;
}

export interface ChangeStartRelationshipType {
  relationshipId: string;
  startRelationshipType: StartRelationshipType;
}

export interface ChangeIdentification {
  relationshipId: string;
  identification: boolean;
}

export interface RelationshipCommandMap {
  'relationship.add': AddRelationship;
  'relationship.remove': RemoveRelationship;
  'relationship.changeRelationshipType': ChangeRelationshipType;
  'relationship.changeStartRelationshipType': ChangeStartRelationshipType;
  'relationship.changeIdentification': ChangeIdentification;
  'relationship.load': Relationship;
}
