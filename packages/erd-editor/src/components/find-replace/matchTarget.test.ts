import { describe, expect, it } from 'vite-plus/test';

import { toErdTarget } from '@/components/find-replace/matchTarget';
import { FocusType } from '@/engine/modules/editor/state';
import { FindField, FindMatch } from '@/utils/find-replace';

const match = (field: FindField, id: string, tableId: string): FindMatch => ({
  field,
  id,
  tableId,
  slot: 0,
  text: 'user',
  start: 0,
  end: 4,
});

describe('toErdTarget', () => {
  it('rings the cell each kind of text is edited in', () => {
    expect(toErdTarget(match(FindField.tableName, 't', 't'))).toEqual({
      kind: 'table',
      tableId: 't',
      focusType: FocusType.tableName,
    });
    expect(toErdTarget(match(FindField.tableComment, 't', 't'))).toEqual({
      kind: 'table',
      tableId: 't',
      focusType: FocusType.tableComment,
    });
    expect(toErdTarget(match(FindField.columnName, 'c', 't'))).toEqual({
      kind: 'column',
      tableId: 't',
      columnId: 'c',
      focusType: FocusType.columnName,
    });
    expect(toErdTarget(match(FindField.columnComment, 'c', 't'))).toEqual({
      kind: 'column',
      tableId: 't',
      columnId: 'c',
      focusType: FocusType.columnComment,
    });
  });

  it('selects the memo a memo match is in', () => {
    expect(toErdTarget(match(FindField.memo, 'm', ''))).toEqual({
      kind: 'memo',
      memoId: 'm',
    });
  });
});
