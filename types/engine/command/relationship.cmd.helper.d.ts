import { CommandType } from './index';
import { RelationshipType, Relationship } from '../store/relationship.state';
import { Table } from '../store/table.state';

export function addRelationship(
  relationshipType: RelationshipType,
  startTable: Table,
  endTableId: string
): CommandType<'relationship.add'>;

export function removeRelationship(
  relationshipIds: string[]
): CommandType<'relationship.remove'>;

export function changeRelationshipType(
  relationshipId: string,
  relationshipType: RelationshipType
): CommandType<'relationship.changeRelationshipType'>;

export function changeIdentification(
  relationshipId: string,
  identification: boolean
): CommandType<'relationship.changeIdentification'>;

export function loadRelationship(
  relationship: Relationship
): CommandType<'relationship.load'>;
