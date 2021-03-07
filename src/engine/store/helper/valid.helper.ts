import { Table } from '@@types/engine/store/table.state';
import { State } from '@@types/engine/store';
import { getData } from '@/core/helper';
import { getColumns } from '@/engine/store/helper/column.helper';
import {
  executeChangeIdentification,
  executeRemoveRelationship,
} from '@/engine/command/relationship.cmd';

/**
 * TODO: Refactoring
 */

export function validIdentification(state: State) {
  const { relationships } = state.relationshipState;
  const { tables } = state.tableState;

  relationships.forEach(relationship => {
    const { end } = relationship;
    const table = getData(tables, end.tableId);
    if (!table) return;

    const columns = getColumns(table, end.columnIds);
    const identification = !columns.some(column => !column.option.primaryKey);
    if (identification !== relationship.identification) {
      executeChangeIdentification(state, {
        relationshipId: relationship.id,
        identification,
      });
    }
  });
}

export function removeValidTableRelationship(state: State, tableIds: string[]) {
  const { relationships } = state.relationshipState;
  const removeRelationshipIds: string[] = [];

  relationships.forEach(relationship => {
    const { start, end } = relationship;
    if (
      !tableIds.some(
        tableId => tableId === start.tableId || tableId === end.tableId
      )
    )
      return;

    removeRelationshipIds.push(relationship.id);
  });

  if (removeRelationshipIds.length !== 0) {
    executeRemoveRelationship(state, {
      relationshipIds: removeRelationshipIds,
    });
  }
}

interface ValidColumnUIKey {
  startTableId: string;
  endTableId: string;
  columnIds: string[];
}
export function removeValidColumnRelationship(
  state: State,
  table: Table,
  columnIds: string[]
) {
  const { relationships } = state.relationshipState;
  const removeRelationshipIds: string[] = [];
  const validColumnUIKeyList: ValidColumnUIKey[] = [];

  relationships.forEach(relationship => {
    const { start, end } = relationship;
    const validColumnUIKey: ValidColumnUIKey = {
      startTableId: start.tableId,
      endTableId: end.tableId,
      columnIds: [],
    };

    if (table.id === start.tableId) {
      for (let i = 0; i < start.columnIds.length; i++) {
        const id = start.columnIds[i];
        if (!columnIds.some(columnId => columnId === id)) return;

        validColumnUIKey.columnIds.push(end.columnIds[i]);
        start.columnIds.splice(i, 1);
        end.columnIds.splice(i, 1);
        i--;
      }
    } else if (table.id === end.tableId) {
      for (let i = 0; i < end.columnIds.length; i++) {
        const id = end.columnIds[i];
        if (!columnIds.some(columnId => columnId === id)) return;

        validColumnUIKey.columnIds.push(id);
        start.columnIds.splice(i, 1);
        end.columnIds.splice(i, 1);
        i--;
      }
    }

    if (start.columnIds.length === 0) {
      removeRelationshipIds.push(relationship.id);
    }

    validColumnUIKeyList.push(validColumnUIKey);
  });

  if (removeRelationshipIds.length !== 0) {
    executeRemoveRelationship(state, {
      relationshipIds: removeRelationshipIds,
    });
  }

  validColumnUIKeyList.forEach(validColumnUIKey => {
    if (validColumnUIKey.columnIds.length === 0) return;

    removeValidRelationshipColumnId(
      state,
      validColumnUIKey.startTableId,
      validColumnUIKey.columnIds
    );
    removeValidRelationshipColumnId(
      state,
      validColumnUIKey.endTableId,
      validColumnUIKey.columnIds
    );
  });
}

export function removeValidRelationshipColumnId(
  state: State,
  tableId: string,
  columnIds: string[]
) {
  const { tables } = state.tableState;
  const table = getData(tables, tableId);
  if (!table) return;

  columnIds.forEach(columnId => {
    const column = getData(table.columns, columnId);
    if (!column) return;

    if (column.ui.fk) {
      column.ui.fk = false;
    } else if (column.ui.pfk) {
      column.ui.pfk = false;
      column.ui.pk = true;
    }
  });
}

export function removeValidColumnIndex(
  state: State,
  table: Table,
  columnIds: string[]
) {
  const { indexes } = state.tableState;
  const tableIndexes = indexes.filter(index => index.tableId === table.id);

  tableIndexes.forEach(index => {
    for (let i = 0; i < index.columns.length; i++) {
      const id = index.columns[i].id;

      if (columnIds.includes(id)) {
        index.columns.splice(i, 1);
        i--;
      }
    }
  });
}

export function removeValidTableIndex(state: State, tableIds: string[]) {
  const { indexes } = state.tableState;

  for (let i = 0; i < indexes.length; i++) {
    const id = indexes[i].tableId;

    if (tableIds.some(tableId => tableId === id)) {
      indexes.splice(i, 1);
      i--;
    }
  }
}
