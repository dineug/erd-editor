import { describe, expect, it } from 'vite-plus/test';

import { toErdTarget } from '@/components/erd/erdTarget';
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
  /** The match the four fields below are found as, which a jump scrolls a cell too wide to. */
  const range = { text: 'user', start: 0, end: 4 };

  it('rings the cell each kind of text is edited in, carrying the match', () => {
    expect(toErdTarget(match(FindField.tableName, 't', 't'))).toEqual({
      kind: 'table',
      tableId: 't',
      focusType: FocusType.tableName,
      range,
    });
    expect(toErdTarget(match(FindField.tableComment, 't', 't'))).toEqual({
      kind: 'table',
      tableId: 't',
      focusType: FocusType.tableComment,
      range,
    });
    expect(toErdTarget(match(FindField.columnName, 'c', 't'))).toEqual({
      kind: 'column',
      tableId: 't',
      columnId: 'c',
      focusType: FocusType.columnName,
      range,
    });
    expect(toErdTarget(match(FindField.columnComment, 'c', 't'))).toEqual({
      kind: 'column',
      tableId: 't',
      columnId: 'c',
      focusType: FocusType.columnComment,
      range,
    });
  });

  it("rings a table's or a column's logical name cell, which the view draws in the name's place or beside it", () => {
    expect(toErdTarget(match(FindField.logicalName, 't', 't'))).toEqual({
      kind: 'table',
      tableId: 't',
      focusType: FocusType.tableLogicalName,
      range,
    });
    expect(toErdTarget(match(FindField.logicalName, 'c', 't'))).toEqual({
      kind: 'column',
      tableId: 't',
      columnId: 'c',
      focusType: FocusType.columnLogicalName,
      range,
    });
  });

  it('carries where in its text the match stands', () => {
    const found = {
      ...match(FindField.columnComment, 'c', 't'),
      text: 'the user id',
      start: 4,
      end: 8,
    };

    expect(toErdTarget(found)).toMatchObject({
      range: { text: 'the user id', start: 4, end: 8 },
    });
  });

  it('selects the memo a memo match is in', () => {
    expect(toErdTarget(match(FindField.memo, 'm', ''))).toEqual({
      kind: 'memo',
      memoId: 'm',
    });
  });

  it('goes to the table an index name is on, and to the group a group name names', () => {
    expect(toErdTarget(match(FindField.indexName, 'i', 't'))).toEqual({
      kind: 'table',
      tableId: 't',
    });
    expect(toErdTarget(match(FindField.tableGroupName, 'g', ''))).toEqual({
      kind: 'tableGroup',
      tableGroupId: 'g',
    });
  });
});
