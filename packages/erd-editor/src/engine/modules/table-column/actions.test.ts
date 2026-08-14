import { describe, expect, it } from 'vitest';

import { ActionType } from '@/engine/modules/table-column/actions';
import { tableColumnReducers } from '@/engine/modules/table-column/atom.actions';

describe('table-column ActionType', () => {
  it('exposes one entry per table-column reducer', () => {
    expect(Object.keys(ActionType)).toEqual([
      'addColumn',
      'removeColumn',
      'changeColumnName',
      'changeColumnComment',
      'changeColumnDataType',
      'changeColumnDefault',
      'changeColumnAutoIncrement',
      'changeColumnPrimaryKey',
      'changeColumnUnique',
      'changeColumnNotNull',
      'moveColumn',
    ]);
  });

  it('maps every key to its dot-namespaced action type string', () => {
    expect(ActionType).toEqual({
      addColumn: 'column.add',
      removeColumn: 'column.remove',
      changeColumnName: 'column.changeName',
      changeColumnComment: 'column.changeComment',
      changeColumnDataType: 'column.changeDataType',
      changeColumnDefault: 'column.changeDefault',
      changeColumnAutoIncrement: 'column.changeAutoIncrement',
      changeColumnPrimaryKey: 'column.changePrimaryKey',
      changeColumnUnique: 'column.changeUnique',
      changeColumnNotNull: 'column.changeNotNull',
      moveColumn: 'column.move',
    });
  });

  it('namespaces every action type under "column." and keeps them unique', () => {
    const values = Object.values(ActionType);

    expect(values.every(value => value.startsWith('column.'))).toBe(true);
    expect(new Set(values).size).toBe(values.length);
  });

  it('is the exact key set the reducer record is built from', () => {
    expect(Object.keys(tableColumnReducers).sort()).toEqual(
      Object.values(ActionType).sort()
    );
  });
});
