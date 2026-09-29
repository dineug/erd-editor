import type { ErdTarget } from '@/components/erd/goToErdTarget';
import { FocusType } from '@/engine/modules/editor/state';
import { FindField, type FindMatch } from '@/utils/find-replace';

/** Where on the ERD canvas the text of a match is edited: its table, its column cell or its memo. */
export function toErdTarget({ field, id, tableId }: FindMatch): ErdTarget {
  switch (field) {
    case FindField.tableName:
      return { kind: 'table', tableId, focusType: FocusType.tableName };
    case FindField.tableComment:
      return { kind: 'table', tableId, focusType: FocusType.tableComment };
    case FindField.columnName:
      return {
        kind: 'column',
        tableId,
        columnId: id,
        focusType: FocusType.columnName,
      };
    case FindField.columnComment:
      return {
        kind: 'column',
        tableId,
        columnId: id,
        focusType: FocusType.columnComment,
      };
    case FindField.memo:
      return { kind: 'memo', memoId: id };
  }
}
