import { RelationshipCommandMap } from '@@types/engine/command/relationship.cmd';
import { State } from '@@types/engine/store';
import {
  AddRelationship,
  RemoveRelationship,
  ChangeRelationshipType,
  ChangeIdentification,
} from '@@types/engine/command/relationship.cmd';
import { Relationship } from '@@types/engine/store/relationship.state';
import { getData } from '@/core/helper';
import { RelationshipModel } from '@/engine/store/models/relationship.model';
import { removeValidRelationshipColumnId } from '@/engine/store/helper/valid.helper';

export function executeAddRelationship(
  { relationshipState: { relationships }, tableState: { tables } }: State,
  data: AddRelationship
) {
  const { start, end } = data;
  const startTable = getData(tables, start.tableId);
  const endTable = getData(tables, end.tableId);
  if (!start.columnIds.length || !startTable || !endTable) return;

  relationships.push(new RelationshipModel({ addRelationship: data }));
}

export function executeRemoveRelationship(
  state: State,
  data: RemoveRelationship
) {
  const {
    relationshipState: { relationships },
  } = state;

  for (let i = 0; i < relationships.length; i++) {
    const relationship = relationships[i];

    if (data.relationshipIds.includes(relationship.id)) {
      relationships.splice(i, 1);
      i--;

      // TODO: Refactoring
      removeValidRelationshipColumnId(
        state,
        relationship.end.tableId,
        relationship.end.columnIds
      );
    }
  }
}

export function executeChangeRelationshipType(
  { relationshipState: { relationships } }: State,
  data: ChangeRelationshipType
) {
  const relationship = getData(relationships, data.relationshipId);
  if (!relationship) return;

  relationship.relationshipType = data.relationshipType;
}

export function executeChangeIdentification(
  { relationshipState: { relationships } }: State,
  data: ChangeIdentification
) {
  const relationship = getData(relationships, data.relationshipId);
  if (!relationship) return;

  relationship.identification = data.identification;
}

export function executeLoadRelationship(
  { relationshipState: { relationships }, tableState: { tables } }: State,
  data: Relationship
) {
  relationships.push(new RelationshipModel({ loadRelationship: data }));

  // valid end column ui key
  const table = getData(tables, data.end.tableId);
  if (!table) return;

  data.end.columnIds.forEach(columnId => {
    const column = getData(table.columns, columnId);
    if (!column) return;

    if (column.option.primaryKey) {
      column.ui.pfk = true;
      column.ui.pk = false;
      column.ui.fk = false;
    } else {
      column.ui.pfk = false;
      column.ui.pk = false;
      column.ui.fk = true;
    }
  });
}

export const executeRelationshipCommandMap: Record<
  keyof RelationshipCommandMap,
  (state: State, data: any) => void
> = {
  'relationship.add': executeAddRelationship,
  'relationship.remove': executeRemoveRelationship,
  'relationship.changeRelationshipType': executeChangeRelationshipType,
  'relationship.changeIdentification': executeChangeIdentification,
  'relationship.load': executeLoadRelationship,
};
