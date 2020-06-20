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
