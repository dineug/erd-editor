import { describe, expect, it } from 'vitest';

import {
  Column,
  ColumnOption,
  ColumnUI,
  ColumnUIKey,
} from '@/v3/schema/tableColumn.entity';

describe('v3/schema/tableColumn.entity', () => {
  describe('ColumnOption', () => {
    it('exposes four distinct single-bit options', () => {
      expect(ColumnOption).toEqual({
        autoIncrement: 1,
        primaryKey: 2,
        unique: 4,
        notNull: 8,
      });
      expect(new Set(Object.values(ColumnOption)).size).toBe(4);
    });

    it('adds and removes options through bit arithmetic', () => {
      let options = 0;
      options |= ColumnOption.primaryKey;
      options |= ColumnOption.notNull;

      expect(options).toBe(10);
      expect(Boolean(options & ColumnOption.primaryKey)).toBe(true);
      expect(Boolean(options & ColumnOption.unique)).toBe(false);

      options &= ~ColumnOption.primaryKey;
      expect(options).toBe(ColumnOption.notNull);
    });

    it('sums all options to a contiguous 4-bit mask', () => {
      const all = Object.values(ColumnOption).reduce(
        (acc, flag) => acc | flag,
        0
      );

      expect(all).toBe(0b1111);
    });
  });

  describe('ColumnUIKey', () => {
    it('exposes primaryKey and foreignKey as single bits', () => {
      expect(ColumnUIKey).toEqual({ primaryKey: 1, foreignKey: 2 });
    });

    it('supports a composite key that is both primary and foreign', () => {
      const keys = ColumnUIKey.primaryKey | ColumnUIKey.foreignKey;

      expect(keys).toBe(3);
      expect(Boolean(keys & ColumnUIKey.primaryKey)).toBe(true);
      expect(Boolean(keys & ColumnUIKey.foreignKey)).toBe(true);
    });

    it('reuses the low bit for primaryKey exactly like ColumnOption does not', () => {
      expect(ColumnUIKey.primaryKey).toBe(1);
      expect(ColumnOption.primaryKey).toBe(2);
      expect(ColumnUIKey.primaryKey).not.toBe(ColumnOption.primaryKey);
    });
  });

  it('describes a column built from the exported constants', () => {
    const ui: ColumnUI = {
      keys: ColumnUIKey.primaryKey,
      widthName: 60,
      widthComment: 60,
      widthDataType: 60,
      widthDefault: 60,
    };
    const column: Column = {
      id: 'column-1',
      tableId: 'table-1',
      name: 'id',
      comment: 'primary identifier',
      dataType: 'int',
      default: '',
      options: ColumnOption.primaryKey | ColumnOption.autoIncrement,
      ui,
      meta: { updateAt: 10, createAt: 10 },
    };

    expect(column.options).toBe(3);
    expect(Boolean(column.options & ColumnOption.notNull)).toBe(false);
    expect(column.ui.keys & ColumnUIKey.foreignKey).toBe(0);
    expect(column.meta.updateAt).toBe(column.meta.createAt);
  });
});
