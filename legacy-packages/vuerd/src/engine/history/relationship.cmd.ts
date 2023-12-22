import { cloneDeep, getData } from '@/core/helper';
import { createCommand } from '@/engine/command/helper';
import {
  changeIdentification,
  hideRelationship,
  loadRelationship,
  removeRelationship,
  showRelationship,
} from '@/engine/command/relationship.cmd.helper';
import { IStore } from '@/internal-types/store';
import { BatchCommand } from '@@types/engine/command';
import {
  AddRelationship,
  ChangeIdentification,
  ChangeRelationshipType,
  ChangeStartRelationshipType,
  HideRelationship,
  RemoveRelationship,
  ShowRelationship,
} from '@@types/engine/command/relationship.cmd';
import { Relationship } from '@@types/engine/store/relationship.state';

export function executeAddRelationship(
  store: IStore,
  batchUndoCommand: BatchCommand,
  data: AddRelationship
) {
  batchUndoCommand.push(removeRelationship([data.id]));
}

export function executeRemoveRelationship(
  { relationshipState: { relationships } }: IStore,
  batchUndoCommand: BatchCommand,
  { relationshipIds }: RemoveRelationship
) {
  const targetRelationships = relationshipIds
    .map(id => getData(relationships, id))
    .filter(relationship => !!relationship) as Relationship[];
  if (!targetRelationships.length) return;

  batchUndoCommand.push(
    ...targetRelationships.map(relationship =>
      loadRelationship(cloneDeep(relationship))
    )
  );
}

export function executeChangeRelationshipType(
  { relationshipState: { relationships } }: IStore,
  batchUndoCommand: BatchCommand,
  data: ChangeRelationshipType
) {
  const relationship = getData(relationships, data.relationshipId);
  if (!relationship) return;

  batchUndoCommand.push(
    createCommand('relationship.changeRelationshipType', {
      relationshipId: relationship.id,
      relationshipType: relationship.relationshipType,
    })
  );
}

export function executeChangeStartRelationshipType(
  { relationshipState: { relationships } }: IStore,
  batchUndoCommand: BatchCommand,
  data: ChangeStartRelationshipType
) {
  const relationship = getData(relationships, data.relationshipId);
  if (!relationship) return;

  batchUndoCommand.push(
    createCommand('relationship.changeStartRelationshipType', {
      relationshipId: relationship.id,
      startRelationshipType: relationship.startRelationshipType ?? 'Dash',
    })
  );
}

export function executeChangeIdentification(
  store: IStore,
  batchUndoCommand: BatchCommand,
  { relationshipId, identification }: ChangeIdentification
) {
  batchUndoCommand.push(changeIdentification(relationshipId, !identification));
}

export function executeHideRelationship(
  store: IStore,
  batchUndoCommand: BatchCommand,
  { relationshipId }: HideRelationship
) {
  batchUndoCommand.push(showRelationship(relationshipId));
}

export function executeShowRelationship(
  store: IStore,
  batchUndoCommand: BatchCommand,
  { relationshipId }: ShowRelationship
) {
  batchUndoCommand.push(hideRelationship(relationshipId));
}

export const executeRelationshipCommandMap = {
  'relationship.add': executeAddRelationship,
  'relationship.remove': executeRemoveRelationship,
  'relationship.changeRelationshipType': executeChangeRelationshipType,
  'relationship.changeStartRelationshipType':
    executeChangeStartRelationshipType,
  'relationship.changeIdentification': executeChangeIdentification,
  'relationship.hide': executeHideRelationship,
  'relationship.show': executeShowRelationship,
};
