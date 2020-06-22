import { Command } from "../Command";
import { Logger } from "../Logger";
import { Store } from "../Store";
import { uuid, getData, getIndex } from "../Helper";
import { IndexModel } from "../model/IndexModel";
import { OrderType, Index } from "../store/Table";

export interface AddIndex {
  id: string;
  tableId: string;
}
export function addIndex(tableId: string): Command<"index.add"> {
  return {
    type: "index.add",
    data: {
      id: uuid(),
      tableId,
    },
  };
}
export function executeAddIndex(store: Store, data: AddIndex) {
  Logger.debug("executeAddIndex");
  const { indexes } = store.tableState;
  indexes.push(new IndexModel({ addIndex: data }));
}

export interface RemoveIndex {
  indexIds: string[];
}
export function removeIndex(indexIds: string[]): Command<"index.remove"> {
  return {
    type: "index.remove",
    data: {
      indexIds,
    },
  };
}
export function executeRemoveIndex(store: Store, data: RemoveIndex) {
  Logger.debug("executeRemoveIndex");
  const { indexes } = store.tableState;
  for (let i = 0; i < indexes.length; i++) {
    const id = indexes[i].id;
    if (data.indexIds.some((indexId) => indexId === id)) {
      indexes.splice(i, 1);
      i--;
    }
  }
}

export interface ChangeIndexValue {
  indexId: string;
  value: string;
}
export function changeIndexName(
  indexId: string,
  value: string
): Command<"index.changeName"> {
  return {
    type: "index.changeName",
    data: {
      indexId,
      value,
    },
  };
}
export function executeChangeIndexName(store: Store, data: ChangeIndexValue) {
  Logger.debug("executeChangeIndexName");
  const { indexes } = store.tableState;
  const index = getData(indexes, data.indexId);
  if (index) {
    index.name = data.value;
  }
}

export interface ChangeIndexUnique {
  indexId: string;
  value: boolean;
}
export function changeIndexUnique(
  indexId: string,
  value: boolean
): Command<"index.changeUnique"> {
  return {
    type: "index.changeUnique",
    data: {
      indexId,
      value,
    },
  };
}
export function executeChangeIndexUnique(
  store: Store,
  data: ChangeIndexUnique
) {
  Logger.debug("executeChangeIndexUnique");
  const { indexes } = store.tableState;
  const index = getData(indexes, data.indexId);
  if (index) {
    index.unique = data.value;
  }
}

export interface AddIndexColumn {
  indexId: string;
  columnId: string;
}
export function addIndexColumn(
  indexId: string,
  columnId: string
): Command<"index.addColumn"> {
  return {
    type: "index.addColumn",
    data: {
      indexId,
      columnId,
    },
  };
}
export function executeAddIndexColumn(store: Store, data: AddIndexColumn) {
  Logger.debug("executeAddIndexColumn");
  const { indexes } = store.tableState;
  const index = getData(indexes, data.indexId);
  if (index && !index.columns.some((column) => column.id === data.columnId)) {
    index.columns.push({
      id: data.columnId,
      orderType: "ASC",
    });
  }
}

export interface RemoveIndexColumn {
  indexId: string;
  columnId: string;
}
export function removeIndexColumn(
  indexId: string,
  columnId: string
): Command<"index.removeColumn"> {
  return {
    type: "index.removeColumn",
    data: {
      indexId,
      columnId,
    },
  };
}
export function executeRemoveIndexColumn(
  store: Store,
  data: RemoveIndexColumn
) {
  Logger.debug("executeRemoveIndexColumn");
  const { indexes } = store.tableState;
  const index = getData(indexes, data.indexId);
  if (index) {
    const targetIndex = getIndex(index.columns, data.columnId);
    if (targetIndex !== null) {
      index.columns.splice(targetIndex, 1);
    }
  }
}

export interface MoveIndexColumn {
  indexId: string;
  columnId: string;
  targetColumnId: string;
}
export function moveIndexColumn(
  indexId: string,
  columnId: string,
  targetColumnId: string
): Command<"index.moveColumn"> {
  return {
    type: "index.moveColumn",
    data: {
      indexId,
      columnId,
      targetColumnId,
    },
  };
}
export function executeMoveIndexColumn(store: Store, data: MoveIndexColumn) {
  Logger.debug("executeMoveIndexColumn");
  const { indexes } = store.tableState;
  const index = getData(indexes, data.indexId);
  if (index && data.columnId !== data.targetColumnId) {
    const currentColumn = getData(index.columns, data.columnId);
    const currentIndex = getIndex(index.columns, data.columnId);
    const targetIndex = getIndex(index.columns, data.targetColumnId);
    if (currentColumn && currentIndex !== null && targetIndex !== null) {
      index.columns.splice(currentIndex, 1);
      index.columns.splice(targetIndex, 0, currentColumn);
    }
  }
}

export interface ChangeIndexColumnOrderType {
  indexId: string;
  columnId: string;
  value: OrderType;
}
export function changeIndexColumnOrderType(
  indexId: string,
  columnId: string,
  value: OrderType
): Command<"index.changeColumnOrderType"> {
  return {
    type: "index.changeColumnOrderType",
    data: {
      indexId,
      columnId,
      value,
    },
  };
}
export function executeChangeIndexColumnOrderType(
  store: Store,
  data: ChangeIndexColumnOrderType
) {
  Logger.debug("executeChangeIndexColumnOrderType");
  const { indexes } = store.tableState;
  const index = getData(indexes, data.indexId);
  if (index) {
    const column = getData(index.columns, data.columnId);
    if (column) {
      column.orderType = data.value;
    }
  }
}

export function loadIndex(index: Index): Command<"index.load"> {
  return {
    type: "index.load",
    data: index,
  };
}
export function executeLoadIndex(store: Store, data: Index) {
  Logger.debug("executeLoadIndex");
  const { indexes } = store.tableState;
  indexes.push(new IndexModel({ loadIndex: data }));
}
