import { Index } from "../store/Table";
import { AddIndex } from "../command/indexes";

interface IndexData {
  addIndex?: AddIndex;
}

export class IndexModel implements Index {
  id: string;
  name = "";
  tableId: string;
  columnIds: string[] = [];

  constructor(data: IndexData) {
    const { addIndex } = data;
    if (addIndex) {
      const { id, tableId } = addIndex;
      this.id = id;
      this.tableId = tableId;
    } else {
      throw new Error("not found index");
    }
  }
}
