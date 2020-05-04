import { FilterState, FilterColumnType, TextFilterCode } from "../store/Editor";
import { AddFilterState } from "../command/editor";

interface FilterStateData {
  addFilterState: AddFilterState;
}

export class FilterStateModel implements FilterState {
  id: string;
  columnType: FilterColumnType = "tableName";
  filterCode: TextFilterCode = "contain";
  value = "";

  constructor(data: FilterStateData) {
    const { addFilterState } = data;
    if (addFilterState) {
      const { id } = addFilterState;
      this.id = id;
    } else {
      throw new Error("not found filter");
    }
  }
}
