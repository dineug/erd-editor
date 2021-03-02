import {
  RelationshipType,
  Relationship,
} from '@@types/engine/store/relationship.state';
import { Table } from '@@types/engine/store/table.state';
import { createCommand } from './helper';
import { uuid } from '@/core/helper';

export function addRelationship(
  relationshipType: RelationshipType,
  startTable: Table,
  endTableId: string
) {
  const columnIds = startTable.columns
    .filter(column => column.option.primaryKey)
    .map(column => column.id);

  return createCommand('relationship.add', {
    id: uuid(),
    relationshipType,
    start: {
      tableId: startTable.id,
      columnIds,
    },
    end: {
      tableId: endTableId,
      columnIds: columnIds.map(() => uuid()),
    },
  });
}

export const removeRelationship = (relationshipIds: string[]) =>
  createCommand('relationship.remove', { relationshipIds });

export const changeRelationshipType = (
  relationshipId: string,
  relationshipType: RelationshipType
) =>
  createCommand('relationship.changeRelationshipType', {
    relationshipId,
    relationshipType,
  });

export const changeIdentification = (
  relationshipId: string,
  identification: boolean
) =>
  createCommand('relationship.changeIdentification', {
    relationshipId,
    identification,
  });

export const loadRelationship = (relationship: Relationship) =>
  createCommand('relationship.load', relationship);
