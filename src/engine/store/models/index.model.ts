import { Index, IndexColumn } from '@@types/engine/store/table.state';
import { AddIndex } from '@@types/engine/command/index.cmd';
import { cloneDeep, isString, isBoolean, isArray, uuid } from '@/core/helper';
import { Logger } from '@/core/logger';

interface IndexData {
  addIndex?: AddIndex;
  loadIndex?: Index;
}

const isLoadIndex = (loadIndex: Index) =>
  isString(loadIndex.id) &&
  isString(loadIndex.name) &&
  isString(loadIndex.tableId) &&
  isBoolean(loadIndex.unique) &&
  isArray(loadIndex.columns);

export class IndexModel implements Index {
  id: string;
  name = '';
  tableId: string;
  columns: IndexColumn[] = [];
  unique = false;

  constructor({ addIndex, loadIndex }: IndexData) {
    if (addIndex) {
      const { id, tableId } = addIndex;

      this.id = id;
      this.tableId = tableId;
    } else if (loadIndex && isLoadIndex(loadIndex)) {
      const { id, name, tableId, columns, unique } = cloneDeep(loadIndex);

      this.id = id;
      this.name = name;
      this.tableId = tableId;
      this.columns = columns;
      this.unique = unique;
    } else {
      Logger.warn('not found index');
      this.id = uuid();
      this.tableId = 'not found index';
    }
  }
}
