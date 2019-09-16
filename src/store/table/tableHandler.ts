import {Table} from '../table';

export function zIndexNext(tables: Table[]): number {
  let max = 0;
  tables.forEach((table: Table) => {
    if (max < table.ui.zIndex) {
      max = table.ui.zIndex;
    }
  });
  return max + 1;
}
