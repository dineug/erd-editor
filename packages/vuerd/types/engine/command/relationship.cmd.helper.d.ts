import {
  Relationship,
  RelationshipType,
  StartRelationshipType,
} from '../store/relationship.state';
import { Table } from '../store/table.state';
import { CommandType } from './index';

export function addRelationship(
  relationshipType: RelationshipType,
  startTable: Table,
  endTableId: string,
  constraintName: string
): CommandType<'relationship.add'>;

export function removeRelationship(
  relationshipIds: string[]
): CommandType<'relationship.remove'>;

export function changeRelationshipType(
  relationshipId: string,
  relationshipType: RelationshipType
): CommandType<'relationship.changeRelationshipType'>;

export function changeStartRelationshipType(
  relationshipId: string,
  startRelationshipType: StartRelationshipType
): CommandType<'relationship.changeStartRelationshipType'>;

export function changeIdentification(
  relationshipId: string,
  identification: boolean
): CommandType<'relationship.changeIdentification'>;

export function loadRelationship(
  relationship: Relationship
): CommandType<'relationship.load'>;
