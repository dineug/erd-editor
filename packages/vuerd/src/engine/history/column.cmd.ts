import { cloneDeep, getData, getIndex } from '@/core/helper';
import {
  loadColumn,
  removeColumn,
  removeOnlyColumn,
} from '@/engine/command/column.cmd.helper';
import { createCommand } from '@/engine/command/helper';
import { loadIndex, removeIndex } from '@/engine/command/index.cmd.helper';
import {
  loadRelationship,
  removeRelationship,
} from '@/engine/command/relationship.cmd.helper';
import { getColumn } from '@/engine/store/helper/column.helper';
import { IStore } from '@/internal-types/store';
import { BatchCommand } from '@@types/engine/command';
import {
  AddColumn,
  AddCustomColumn,
  ChangeColumnOption,
  ChangeColumnValue,
  MoveColumn,
  RemoveColumn,
} from '@@types/engine/command/column.cmd';
import { Relationship } from '@@types/engine/store/relationship.state';
import { Index } from '@@types/engine/store/table.state';
import { Column } from '@@types/engine/store/table.state';

export function executeAddColumn(
  store: IStore,
  batchUndoCommand: BatchCommand,
  data: AddColumn[]
) {
  batchUndoCommand.push(
    ...data.map(addColumn => removeColumn(addColumn.tableId, [addColumn.id]))
  );
}

export function executeAddCustomColumn(
  store: IStore,
  batchUndoCommand: BatchCommand,
  data: AddCustomColumn[]
) {
  batchUndoCommand.push(
    ...data.map(addColumn => removeColumn(addColumn.tableId, [addColumn.id]))
  );
}

export function executeRemoveColumn(
  {
    tableState: { tables, indexes },
    relationshipState: { relationships },
  }: IStore,
  batchUndoCommand: BatchCommand,
  data: RemoveColumn
) {
  const targetRelationships: Relationship[] = [];
  const targetIndexes: Index[] = [];
  const table = getData(tables, data.tableId);
  if (!table) return;

  relationships.forEach(relationship => {
    const { start, end } = relationship;

    if (
      (data.tableId === start.tableId &&
        data.columnIds.some(columnId => start.columnIds.includes(columnId))) ||
      (data.tableId === end.tableId &&
        data.columnIds.some(columnId => end.columnIds.includes(columnId)))
    ) {
      targetRelationships.push(cloneDeep(relationship));
    }
  });

  const tableIndexes = indexes.filter(index => index.tableId === table.id);

  tableIndexes.forEach(index => targetIndexes.push(cloneDeep(index)));

  const columns: Column[] = [];
  const indexList: number[] = [];

  data.columnIds.forEach(columnId => {
    const column = getData(table.columns, columnId);
    const index = getIndex(table.columns, columnId);

    if (column && index !== -1) {
      columns.push(cloneDeep(column));
      indexList.push(index);
    }
  });

  batchUndoCommand.push(loadColumn(data.tableId, columns, indexList));

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

export function executeChangeColumnName(
  { tableState: { tables } }: IStore,
  batchUndoCommand: BatchCommand,
  data: ChangeColumnValue
) {
  const column = getColumn(tables, data.tableId, data.columnId);
  if (!column) return;

  batchUndoCommand.push(
    createCommand('column.changeName', {
      tableId: data.tableId,
      columnId: data.columnId,
      value: column.name,
      width: column.ui.widthName,
    })
  );
}

export function executeChangeColumnComment(
  { tableState: { tables } }: IStore,
  batchUndoCommand: BatchCommand,
  data: ChangeColumnValue
) {
  const column = getColumn(tables, data.tableId, data.columnId);
  if (!column) return;

  batchUndoCommand.push(
    createCommand('column.changeComment', {
      tableId: data.tableId,
      columnId: data.columnId,
      value: column.comment,
      width: column.ui.widthComment,
    })
  );
}

export function executeChangeColumnDataType(
  { tableState: { tables } }: IStore,
  batchUndoCommand: BatchCommand,
  data: ChangeColumnValue
) {
  const column = getColumn(tables, data.tableId, data.columnId);
  if (!column) return;

  batchUndoCommand.push(
    createCommand('column.changeDataType', {
      tableId: data.tableId,
      columnId: data.columnId,
      value: column.dataType,
      width: column.ui.widthDataType,
    })
  );
}

export function executeChangeColumnDefault(
  { tableState: { tables } }: IStore,
  batchUndoCommand: BatchCommand,
  data: ChangeColumnValue
) {
  const column = getColumn(tables, data.tableId, data.columnId);
  if (!column) return;

  batchUndoCommand.push(
    createCommand('column.changeDefault', {
      tableId: data.tableId,
      columnId: data.columnId,
      value: column.default,
      width: column.ui.widthDefault,
    })
  );
}

export function executeChangeColumnAutoIncrement(
  store: IStore,
  batchUndoCommand: BatchCommand,
  data: ChangeColumnOption
) {
  batchUndoCommand.push(
    createCommand('column.changeAutoIncrement', {
      tableId: data.tableId,
      columnId: data.columnId,
      value: !data.value,
    })
  );
}

export function executeChangeColumnPrimaryKey(
  store: IStore,
  batchUndoCommand: BatchCommand,
  data: ChangeColumnOption
) {
  batchUndoCommand.push(
    createCommand('column.changePrimaryKey', {
      tableId: data.tableId,
      columnId: data.columnId,
      value: !data.value,
    })
  );
}

export function executeChangeColumnUnique(
  store: IStore,
  batchUndoCommand: BatchCommand,
  data: ChangeColumnOption
) {
  batchUndoCommand.push(
    createCommand('column.changeUnique', {
      tableId: data.tableId,
      columnId: data.columnId,
      value: !data.value,
    })
  );
}

export function executeChangeColumnNotNull(
  store: IStore,
  batchUndoCommand: BatchCommand,
  data: ChangeColumnOption
) {
  batchUndoCommand.push(
    createCommand('column.changeNotNull', {
      tableId: data.tableId,
      columnId: data.columnId,
      value: !data.value,
    })
  );
}

export function executeMoveColumn(
  {
    tableState: { tables, indexes },
    relationshipState: { relationships },
  }: IStore,
  batchUndoCommand: BatchCommand,
  data: MoveColumn
) {
  const currentTable = getData(tables, data.tableId);
  const currentColumns: Column[] = [];

  data.columnIds.forEach(columnId => {
    const column = getColumn(tables, data.tableId, columnId);
    if (!column) return;

    currentColumns.push(column);
  });

  const targetTable = getData(tables, data.targetTableId);
  const targetColumn = getColumn(
    tables,
    data.targetTableId,
    data.targetColumnId
  );

  if (currentTable && targetTable && currentColumns.length && targetColumn) {
    if (
      data.tableId === data.targetTableId &&
      !data.columnIds.includes(data.targetColumnId)
    ) {
      const columns: Column[] = [];
      const indexList: number[] = [];

      data.columnIds.forEach(columnId => {
        const column = getData(currentTable.columns, columnId);
        const index = getIndex(currentTable.columns, columnId);

        if (column && index !== -1) {
          columns.push(cloneDeep(column));
          indexList.push(index);
        }
      });

      batchUndoCommand.push(
        removeOnlyColumn(data.tableId, data.columnIds),
        loadColumn(data.tableId, columns, indexList)
      );
    } else if (
      data.tableId !== data.targetTableId &&
      !data.columnIds.includes(data.targetColumnId)
    ) {
      const targetRelationships: Relationship[] = [];
      const targetIndexes: Index[] = [];
      const columns: Column[] = [];
      const indexList: number[] = [];

      data.columnIds.forEach(columnId => {
        const column = getData(currentTable.columns, columnId);
        const index = getIndex(currentTable.columns, columnId);

        if (column && index !== -1) {
          columns.push(cloneDeep(column));
          indexList.push(index);
        }
      });

      batchUndoCommand.push(
        removeOnlyColumn(data.targetTableId, data.columnIds),
        loadColumn(data.tableId, columns, indexList)
      );

      relationships.forEach(relationship => {
        const { start, end } = relationship;

        if (
          (data.tableId === start.tableId &&
            data.columnIds.some(columnId =>
              start.columnIds.includes(columnId)
            )) ||
          (data.tableId === end.tableId &&
            data.columnIds.some(columnId => end.columnIds.includes(columnId)))
        ) {
          targetRelationships.push(cloneDeep(relationship));
        }
      });

      const tableIndexes = indexes.filter(
        index => index.tableId === data.tableId
      );

      tableIndexes.forEach(index => targetIndexes.push(cloneDeep(index)));

      if (targetRelationships.length) {
        batchUndoCommand.push(
          removeRelationship(
            targetRelationships.map(relationship => relationship.id)
          ),
          ...targetRelationships.map(relationship =>
            loadRelationship(relationship)
          )
        );
      }

      if (targetIndexes.length) {
        batchUndoCommand.push(
          removeIndex(targetIndexes.map(index => index.id)),
          ...targetIndexes.map(index => loadIndex(index))
        );
      }
    }
  }
}

export const executeColumnCommandMap = {
  'column.add': executeAddColumn,
  'column.addCustom': executeAddCustomColumn,
  'column.remove': executeRemoveColumn,
  'column.changeName': executeChangeColumnName,
  'column.changeComment': executeChangeColumnComment,
  'column.changeDataType': executeChangeColumnDataType,
  'column.changeDefault': executeChangeColumnDefault,
  'column.changeAutoIncrement': executeChangeColumnAutoIncrement,
  'column.changePrimaryKey': executeChangeColumnPrimaryKey,
  'column.changeUnique': executeChangeColumnUnique,
  'column.changeNotNull': executeChangeColumnNotNull,
  'column.move': executeMoveColumn,
};
