import { BatchCommand } from '@@types/engine/command';
import { PureTable, Index } from '@@types/engine/store/table.state';
import { Relationship } from '@@types/engine/store/relationship.state';
import {
  AddTable,
  RemoveTable,
  ChangeTableValue,
} from '@@types/engine/command/table.cmd';
import { IStore } from '@/internal-types/store';
import { createCommand } from '@/engine/command/helper';
import { getData, cloneDeep } from '@/core/helper';
import { createJsonStringify } from '@/core/file';
import { removeTable, loadTable } from '@/engine/command/table.cmd.helper';
import { loadJson$ } from '@/engine/command/editor.cmd.helper';
import {
  removeRelationship,
  loadRelationship,
} from '@/engine/command/relationship.cmd.helper';
import { removeIndex, loadIndex } from '@/engine/command/index.cmd.helper';

export function executeAddTable(
  store: IStore,
  batchUndoCommand: BatchCommand,
  data: AddTable
) {
  batchUndoCommand.push(removeTable(store, data.id));
}

export function executeRemoveTable(
  {
    tableState: { tables, indexes },
    relationshipState: { relationships },
  }: IStore,
  batchUndoCommand: BatchCommand,
  { tableIds }: RemoveTable
) {
  const targetTables: PureTable[] = [];
  const targetRelationships: Relationship[] = [];
  const targetIndexes: Index[] = [];

  tableIds.forEach(tableId => {
    const table = getData(tables, tableId);
    if (!table) return;

    targetTables.push(cloneDeep(table));

    relationships.forEach(relationship => {
      const { start, end } = relationship;

      if (tableId === start.tableId || tableId === end.tableId) {
        targetRelationships.push(cloneDeep(relationship));
      }
    });

    const tableIndexes = indexes.filter(index => index.tableId === table.id);

    tableIndexes.forEach(index => targetIndexes.push(cloneDeep(index)));
  });

  if (!targetTables.length) return;

  batchUndoCommand.push(...targetTables.map(table => loadTable(table)));

  if (targetRelationships.length) {
    batchUndoCommand.push(
      removeRelationship(
        targetRelationships.map(relationship => relationship.id)
      ),
      ...targetRelationships.map(relationship => loadRelationship(relationship))
    );
  }

  if (targetIndexes.length) {
    batchUndoCommand.push(
      removeIndex(targetIndexes.map(index => index.id)),
      ...targetIndexes.map(index => loadIndex(index))
    );
  }
}

export function executeChangeTableName(
  { tableState: { tables } }: IStore,
  batchUndoCommand: BatchCommand,
  data: ChangeTableValue
) {
  const table = getData(tables, data.tableId);
  if (!table) return;

  batchUndoCommand.push(
    createCommand('table.changeName', {
      tableId: table.id,
      value: table.name,
      width: table.ui.widthName,
    })
  );
}

export function executeChangeTableComment(
  { tableState: { tables } }: IStore,
  batchUndoCommand: BatchCommand,
  data: ChangeTableValue
) {
  const table = getData(tables, data.tableId);
  if (!table) return;

  batchUndoCommand.push(
    createCommand('table.changeComment', {
      tableId: table.id,
      value: table.comment,
      width: table.ui.widthComment,
    })
  );
}

export function executeSortTable(
  store: IStore,
  batchUndoCommand: BatchCommand
) {
  batchUndoCommand.push(loadJson$(createJsonStringify(store)));
}

export const executeTableCommandMap = {
  'table.add': executeAddTable,
  'table.remove': executeRemoveTable,
  'table.changeName': executeChangeTableName,
  'table.changeComment': executeChangeTableComment,
  'table.sort': executeSortTable,
};
