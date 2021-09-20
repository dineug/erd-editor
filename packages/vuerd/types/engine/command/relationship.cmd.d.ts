import {
  Relationship,
  RelationshipType,
  RelationshipUI,
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
  ui?: RelationshipUI;
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

export interface HideRelationship {
  relationshipId: string;
}

export interface ShowRelationship {
  relationshipId: string;
}

export interface ColorRelationship {
  relationshipId: string;
  color: string;
}

export interface RelationshipCommandMap {
  'relationship.add': AddRelationship;
  'relationship.remove': RemoveRelationship;
  'relationship.changeRelationshipType': ChangeRelationshipType;
  'relationship.changeStartRelationshipType': ChangeStartRelationshipType;
  'relationship.changeIdentification': ChangeIdentification;
  'relationship.load': Relationship;
  'relationship.hide': HideRelationship;
  'relationship.show': ShowRelationship;
  'relationship.color': ColorRelationship;
}
