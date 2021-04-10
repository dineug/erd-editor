import {
  Filter,
  ColumnType,
  TextFilterCode,
} from '@@types/engine/store/editor/filter.state';
import { AddFilter } from '@@types/engine/command/editor/filter.cmd';

interface FilterData {
  addFilter?: AddFilter;
}

export class FilterModel implements Filter {
  id: string;
  columnType: ColumnType = 'tableName';
  filterCode: TextFilterCode = 'contain';
  value = '';

  constructor({ addFilter }: FilterData) {
    if (addFilter) {
      this.id = addFilter.id;
    } else {
      throw new Error('not found filter');
    }
  }
}
