import { State, RelationshipType, Relationship } from "../relationship";
import { Column, Commit as TableCommit, Table } from "@/store/table";
import { Commit as MemoCommit } from "@/store/memo";
import { getData, log } from "@/ts/util";
import StoreManagement from "@/store/StoreManagement";
import RelationshipDrawModel from "@/models/RelationshipDrawModel";
import RelationshipModel from "@/models/RelationshipModel";
import {
  createPrimaryKey,
  relationshipSort,
  getColumn
} from "./relationshipHelper";
import { Bus } from "@/ts/EventBus";

export function relationshipAdd(
  state: State,
  payload: { table: Table; store: StoreManagement }
) {
  log.debug("relationshipController relationshipAdd");
  const { table, store } = payload;
  if (state.draw && state.draw.start) {
    state.relationships.push(
      new RelationshipModel(
        store,
        state.draw.relationshipType,
        state.draw.start,
        table
      )
    );
    relationshipSort(store.tableStore.state.tables, state.relationships);
    store.eventBus.$emit(Bus.ERD.change);
  }
}

export function relationshipDraw(
  state: State,
  payload: { x: number; y: number }
) {
  log.debug("relationshipController relationshipDraw");
  const { x, y } = payload;
  if (state.draw) {
    state.draw.end.x = x;
    state.draw.end.y = y;
  }
}

export function relationshipDrawStart(
  state: State,
  payload: {
    relationshipType: RelationshipType;
    store: StoreManagement;
  }
) {
  log.debug("relationshipController relationshipEditStart");
  const { relationshipType, store } = payload;
  if (state.draw && state.draw.relationshipType === relationshipType) {
    state.draw = null;
  } else {
    store.tableStore.commit(TableCommit.tableSelectAllEnd);
    store.memoStore.commit(MemoCommit.memoSelectAllEnd);
    state.draw = new RelationshipDrawModel(relationshipType);
  }
}

export function relationshipDrawStartAdd(
  state: State,
  payload: { table: Table; store: StoreManagement }
) {
  log.debug("relationshipController relationshipDrawStartAdd");
  const { table, store } = payload;
  if (state.draw) {
    createPrimaryKey(store, table);
    state.draw.start = {
      table,
      x: table.ui.left,
      y: table.ui.top
    };
  }
}

export function relationshipDrawEnd(
  state: State,
  payload: { table: Table; store: StoreManagement }
) {
  log.debug("relationshipController relationshipEditEnd");
  if (state.draw && state.draw.start) {
    relationshipAdd(state, payload);
  }
  state.draw = null;
}

export function relationshipIdentification(
  state: State,
  payload: { table: Table; column: Column }
) {
  log.debug("relationshipController relationshipIdentification");
  const { table, column } = payload;
  state.relationships.forEach(relationship => {
    if (
      relationship.end.tableId === table.id &&
      relationship.end.columnIds.indexOf(column.id) !== -1
    ) {
      relationship.identification = !relationship.end.columnIds.some(
        columnId => {
          const targetColumn = getData(table.columns, columnId);
          if (targetColumn) {
            return !targetColumn.option.primaryKey;
          }
          return true;
        }
      );
    }
  });
}

export function relationshipIdentificationAll(
  state: State,
  payload: { relationship: Relationship; store: StoreManagement }
) {
  log.debug("relationshipController relationshipIdentificationAll");
  const { relationship, store } = payload;
  relationship.identification = !relationship.end.columnIds.some(columnId => {
    const column = getColumn(
      store.tableStore.state.tables,
      relationship.end.tableId,
      columnId
    );
    if (column) {
      return !column.option.primaryKey;
    }
    return true;
  });
}

export function relationshipRemoveTable(
  state: State,
  payload: { table: Table; store: StoreManagement }
) {
  log.debug("relationshipController relationshipRemoveTable");
  const { table, store } = payload;
  for (let i = 0; i < state.relationships.length; i++) {
    const relationship = state.relationships[i];
    if (
      relationship.start.tableId === table.id ||
      relationship.end.tableId === table.id
    ) {
      if (relationship.start.tableId === table.id) {
        relationship.end.columnIds.forEach(columnId => {
          const column = getColumn(
            store.tableStore.state.tables,
            relationship.end.tableId,
            columnId
          );
          if (column) {
            if (column.ui.fk) {
              column.ui.fk = false;
            } else if (column.ui.pfk) {
              column.ui.pfk = false;
              column.ui.pk = true;
            }
          }
        });
      }
      state.relationships.splice(i, 1);
      i--;
    }
  }
}

export function relationshipRemoveColumn(
  state: State,
  payload: { table: Table; column: Column; store: StoreManagement }
) {
  log.debug("relationshipController relationshipRemoveColumn");
  const { table, column, store } = payload;

  if (column.ui.fk) {
    column.ui.fk = false;
  }

  state.relationships.forEach(relationship => {
    if (
      (relationship.start.tableId === table.id &&
        relationship.start.columnIds.indexOf(column.id) !== -1) ||
      (relationship.end.tableId === table.id &&
        relationship.end.columnIds.indexOf(column.id) !== -1)
    ) {
      let index = -1;
      if (relationship.start.tableId === table.id) {
        index = relationship.start.columnIds.indexOf(column.id);
        const endColumnId = relationship.end.columnIds[index];
        const endColumn = getColumn(
          store.tableStore.state.tables,
          relationship.end.tableId,
          endColumnId
        );
        if (endColumn) {
          if (endColumn.ui.pfk) {
            endColumn.ui.pk = true;
            endColumn.ui.pfk = false;
          } else if (endColumn.ui.fk) {
            endColumn.ui.fk = false;
          }
        }
      } else {
        index = relationship.end.columnIds.indexOf(column.id);
      }
      relationship.start.columnIds.splice(index, 1);
      relationship.end.columnIds.splice(index, 1);
      relationshipIdentificationAll(state, {
        relationship,
        store
      });
    }
  });

  for (let i = 0; i < state.relationships.length; i++) {
    if (state.relationships[i].start.columnIds.length === 0) {
      state.relationships.splice(i, 1);
      i--;
    }
  }
}

export function relationshipActive(
  state: State,
  payload: { relationship: Relationship; store: StoreManagement }
) {
  log.debug("relationshipController relationshipActive");
  const { relationship, store } = payload;
  store.tableStore.commit(TableCommit.columnActive, {
    tableId: relationship.start.tableId,
    columnIds: relationship.start.columnIds
  });
  store.tableStore.commit(TableCommit.columnActive, {
    tableId: relationship.end.tableId,
    columnIds: relationship.end.columnIds
  });
}

export function relationshipActiveEnd(
  state: State,
  payload: { relationship: Relationship; store: StoreManagement }
) {
  log.debug("relationshipController relationshipActiveEnd");
  const { relationship, store } = payload;
  store.tableStore.commit(
    TableCommit.columnActiveEnd,
    relationship.start.tableId
  );
  store.tableStore.commit(
    TableCommit.columnActiveEnd,
    relationship.end.tableId
  );
}
