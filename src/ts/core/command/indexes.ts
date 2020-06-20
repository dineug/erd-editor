import { Command } from "../Command";
import { Logger } from "../Logger";
import { Store } from "../Store";
import { uuid, getData } from "../Helper";
import { IndexModel } from "../model/IndexModel";

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
  if (index && !index.columnIds.includes(data.columnId)) {
    index.columnIds.push(data.columnId);
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
    const targetIndex = index.columnIds.indexOf(data.columnId);
    if (targetIndex !== -1) {
      index.columnIds.splice(targetIndex, 1);
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
    const currentIndex = index.columnIds.indexOf(data.columnId);
    const targetIndex = index.columnIds.indexOf(data.targetColumnId);
    if (currentIndex !== -1 && targetIndex !== -1) {
      index.columnIds.splice(currentIndex, 1);
      index.columnIds.splice(targetIndex, 0, data.columnId);
    }
  }
}
