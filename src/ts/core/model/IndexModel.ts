import { Index, IndexColumn } from "../store/Table";
import { AddIndex } from "../command/indexes";
import { cloneDeep } from "../Helper";

interface IndexData {
  addIndex?: AddIndex;
  loadIndex?: Index;
}

export class IndexModel implements Index {
  id: string;
  name = "";
  tableId: string;
  columns: IndexColumn[] = [];
  unique = false;

  constructor(data: IndexData) {
    const { addIndex, loadIndex } = data;
    if (addIndex) {
      const { id, tableId } = addIndex;
      this.id = id;
      this.tableId = tableId;
    } else if (
      loadIndex &&
      typeof loadIndex.id === "string" &&
      typeof loadIndex.name === "string" &&
      typeof loadIndex.tableId === "string" &&
      typeof loadIndex.unique === "boolean" &&
      Array.isArray(loadIndex.columns)
    ) {
      const { id, name, tableId, columns, unique } = loadIndex;
      this.id = id;
      this.name = name;
      this.tableId = tableId;
      this.columns = cloneDeep(columns);
      this.unique = unique;
    } else {
      throw new Error("not found index");
    }
  }
}
