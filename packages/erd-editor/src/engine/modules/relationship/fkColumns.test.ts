import { describe, expect, it } from 'vite-plus/test';

import { toForeignKeyActions } from '@/engine/modules/relationship/fkColumns';
import {
  addColumnAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
} from '@/engine/modules/table-column/atom.actions';
import { Column } from '@/internal-types';
import { createColumn } from '@/utils/collection/tableColumn.entity';

function makeColumn(value: Partial<Column>): Column {
  return createColumn(value as any);
}

describe('toForeignKeyActions', () => {
  it('returns nothing for no start columns', () => {
    expect(toForeignKeyActions([], 't2', [])).toEqual([]);
  });

  it('adds a NOT NULL copy per start column under the id at the same index', () => {
    const startColumns = [
      makeColumn({
        id: 'c1',
        tableId: 't1',
        name: 'id',
        dataType: 'int',
        default: '0',
        comment: 'pk',
        options: 1,
      }),
      makeColumn({
        id: 'c2',
        tableId: 't1',
        name: 'code',
        dataType: 'char(2)',
        default: "'kr'",
        comment: '',
      }),
    ];

    expect(toForeignKeyActions(startColumns, 't2', ['f1', 'f2'])).toEqual([
      addColumnAction({ id: 'f1', tableId: 't2' }),
      changeColumnNotNullAction({ id: 'f1', tableId: 't2', value: true }),
      changeColumnNameAction({ id: 'f1', tableId: 't2', value: 'id' }),
      changeColumnDataTypeAction({ id: 'f1', tableId: 't2', value: 'int' }),
      changeColumnDefaultAction({ id: 'f1', tableId: 't2', value: '0' }),
      changeColumnCommentAction({ id: 'f1', tableId: 't2', value: 'pk' }),
      addColumnAction({ id: 'f2', tableId: 't2' }),
      changeColumnNotNullAction({ id: 'f2', tableId: 't2', value: true }),
      changeColumnNameAction({ id: 'f2', tableId: 't2', value: 'code' }),
      changeColumnDataTypeAction({
        id: 'f2',
        tableId: 't2',
        value: 'char(2)',
      }),
      changeColumnDefaultAction({ id: 'f2', tableId: 't2', value: "'kr'" }),
      changeColumnCommentAction({ id: 'f2', tableId: 't2', value: '' }),
    ]);
  });

  it('marks the copy NOT NULL even when the start column allows null', () => {
    const actions = toForeignKeyActions(
      [makeColumn({ id: 'c1', tableId: 't1', options: 0 })],
      't1',
      ['f1']
    );

    expect(actions[1]).toEqual(
      changeColumnNotNullAction({ id: 'f1', tableId: 't1', value: true })
    );
  });
});
