import type { ErdTarget } from '@/components/erd/goToErdTarget';
import { FocusType } from '@/engine/modules/editor/state';
import {
  FindField,
  type FindMatch,
  isTableLogicalName,
} from '@/utils/find-replace';

/**
 * Where on the ERD canvas a match's text is edited: its table, column cell,
 * memo or table group, with the match, which a cell too wide is scrolled to
 * by. An index goes to its table, a logical name to the cell the view draws.
 */
export function toErdTarget(match: FindMatch): ErdTarget {
  const { field, id, tableId, text, start, end } = match;
  const range = { text, start, end };

  switch (field) {
    case FindField.tableName:
      return { kind: 'table', tableId, focusType: FocusType.tableName, range };
    case FindField.tableComment:
      return {
        kind: 'table',
        tableId,
        focusType: FocusType.tableComment,
        range,
      };
    case FindField.columnName:
      return {
        kind: 'column',
        tableId,
        columnId: id,
        focusType: FocusType.columnName,
        range,
      };
    case FindField.columnComment:
      return {
        kind: 'column',
        tableId,
        columnId: id,
        focusType: FocusType.columnComment,
        range,
      };
    case FindField.memo:
      return { kind: 'memo', memoId: id };
    case FindField.indexName:
      return { kind: 'table', tableId };
    case FindField.tableGroupName:
      return { kind: 'tableGroup', tableGroupId: id };
    case FindField.logicalName:
      return isTableLogicalName(match)
        ? {
            kind: 'table',
            tableId,
            focusType: FocusType.tableLogicalName,
            range,
          }
        : {
            kind: 'column',
            tableId,
            columnId: id,
            focusType: FocusType.columnLogicalName,
            range,
          };
  }
}
