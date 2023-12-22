import { createJsonStringify } from '@/core/file';
import { cloneDeep, getData } from '@/core/helper';
import { loadJson$ } from '@/engine/command/editor.cmd.helper';
import { createCommand } from '@/engine/command/helper';
import { loadIndex, removeIndex } from '@/engine/command/index.cmd.helper';
import {
  loadRelationship,
  removeRelationship,
} from '@/engine/command/relationship.cmd.helper';
import {
  hideTable,
  loadTable,
  removeTable,
  showTable,
} from '@/engine/command/table.cmd.helper';
import { IStore } from '@/internal-types/store';
import { BatchCommand } from '@@types/engine/command';
import {
  AddTable,
  ChangeTableValue,
  HideTable,
  RemoveTable,
  ShowTable,
} from '@@types/engine/command/table.cmd';
import { Relationship } from '@@types/engine/store/relationship.state';
import { Index, PureTable } from '@@types/engine/store/table.state';

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

export function executeHideTable(
  store: IStore,
  batchUndoCommand: BatchCommand,
  { tableId }: HideTable
) {
  batchUndoCommand.push(showTable(tableId));
}

export function executeShowTable(
  store: IStore,
  batchUndoCommand: BatchCommand,
  { tableId }: ShowTable
) {
  batchUndoCommand.push(hideTable(tableId));
}

export const executeTableCommandMap = {
  'table.add': executeAddTable,
  'table.remove': executeRemoveTable,
  'table.changeName': executeChangeTableName,
  'table.changeComment': executeChangeTableComment,
  'table.sort': executeSortTable,
  'table.hide': executeHideTable,
  'table.show': executeShowTable,
};
