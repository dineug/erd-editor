import { describe, expect, it } from 'vitest';

import { BracketType, ColumnOption, OrderType } from '@/constants/schema';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import {
  autoName,
  formatNames,
  formatSize,
  formatSpace,
  getBracket,
  orderByNameASC,
  primaryKey,
  primaryKeyColumns,
  toOrderName,
  unique,
  uniqueColumns,
} from '@/utils/schema-sql/utils';

describe('schema-sql/utils', () => {
  describe('formatNames', () => {
    it('joins names with ", " when no bracket is given', () => {
      expect(formatNames([{ name: 'a' }, { name: 'b' }, { name: 'c' }])).toBe(
        'a, b, c'
      );
    });

    it('wraps every name with the same bracket on both sides', () => {
      expect(formatNames([{ name: 'a' }, { name: 'b' }], '`')).toBe('`a`, `b`');
    });

    it('uses the second bracket as the closing token when provided', () => {
      expect(formatNames([{ name: 'a' }, { name: 'b' }], '[', ']')).toBe(
        '[a], [b]'
      );
    });

    it('returns an empty string for an empty list', () => {
      expect(formatNames([])).toBe('');
    });

    it('does not append a separator after the last item', () => {
      expect(formatNames([{ name: 'only' }], '"')).toBe('"only"');
    });
  });

  describe('formatSize', () => {
    it('returns the longest name and dataType lengths', () => {
      const columns = [
        createColumn({ name: 'id', dataType: 'INT' }),
        createColumn({ name: 'nickname', dataType: 'VARCHAR(50)' }),
        createColumn({ name: 'age', dataType: 'BIGINT' }),
      ];

      expect(formatSize(columns)).toEqual({ name: 8, dataType: 11 });
    });

    it('returns zeros for an empty column list', () => {
      expect(formatSize([])).toEqual({ name: 0, dataType: 0 });
    });
  });

  describe('formatSpace', () => {
    it('builds a string of the requested length', () => {
      expect(formatSpace(3)).toBe('   ');
      expect(formatSpace(0)).toBe('');
    });

    it('returns an empty string for a negative size', () => {
      expect(formatSpace(-5)).toBe('');
    });
  });

  describe('primaryKey / primaryKeyColumns', () => {
    const columns = [
      createColumn({ name: 'id', options: ColumnOption.primaryKey }),
      createColumn({ name: 'name', options: ColumnOption.notNull }),
      createColumn({
        name: 'code',
        options: ColumnOption.primaryKey | ColumnOption.notNull,
      }),
    ];

    it('detects at least one primary key column', () => {
      expect(primaryKey(columns)).toBe(true);
      expect(primaryKey([createColumn({ options: ColumnOption.unique })])).toBe(
        false
      );
      expect(primaryKey([])).toBe(false);
    });

    it('filters only the primary key columns', () => {
      expect(primaryKeyColumns(columns).map(column => column.name)).toEqual([
        'id',
        'code',
      ]);
    });
  });

  describe('unique / uniqueColumns', () => {
    const columns = [
      createColumn({ name: 'id', options: ColumnOption.primaryKey }),
      createColumn({
        name: 'email',
        options: ColumnOption.unique | ColumnOption.notNull,
      }),
    ];

    it('detects at least one unique column', () => {
      expect(unique(columns)).toBe(true);
      expect(unique([createColumn({ options: ColumnOption.notNull })])).toBe(
        false
      );
      expect(unique([])).toBe(false);
    });

    it('filters only the unique columns', () => {
      expect(uniqueColumns(columns).map(column => column.name)).toEqual([
        'email',
      ]);
    });
  });

  describe('getBracket', () => {
    it('maps every bracket type to its token', () => {
      expect(getBracket(BracketType.none)).toBe('');
      expect(getBracket(BracketType.backtick)).toBe('`');
      expect(getBracket(BracketType.doubleQuote)).toBe('"');
      expect(getBracket(BracketType.singleQuote)).toBe("'");
    });

    it('falls back to an empty string for an unknown bracket type', () => {
      expect(getBracket(9999)).toBe('');
    });
  });

  describe('orderByNameASC', () => {
    it('compares names case-insensitively', () => {
      expect(orderByNameASC({ name: 'apple' }, { name: 'Banana' })).toBe(-1);
      expect(orderByNameASC({ name: 'Banana' }, { name: 'apple' })).toBe(1);
      expect(orderByNameASC({ name: 'Apple' }, { name: 'apple' })).toBe(0);
    });

    it('sorts a list ascending', () => {
      const list = [{ name: 'users' }, { name: 'Comments' }, { name: 'posts' }];

      expect(list.sort(orderByNameASC).map(v => v.name)).toEqual([
        'Comments',
        'posts',
        'users',
      ]);
    });
  });

  describe('autoName', () => {
    it('returns the name untouched when nothing collides', () => {
      expect(autoName([{ id: 'a', name: 'FK_a' }], '', 'FK_b')).toBe('FK_b');
    });

    it('ignores a collision with the entity that owns the id', () => {
      expect(autoName([{ id: 'a', name: 'FK_a' }], 'a', 'FK_a')).toBe('FK_a');
    });

    it('appends an incrementing suffix on collision', () => {
      expect(autoName([{ id: 'a', name: 'FK_a' }], '', 'FK_a')).toBe('FK_a1');
    });

    it('keeps incrementing while suffixed names also collide', () => {
      const list = [
        { id: 'a', name: 'IDX' },
        { id: 'b', name: 'IDX1' },
        { id: 'c', name: 'IDX2' },
      ];

      expect(autoName(list, '', 'IDX')).toBe('IDX3');
    });

    it('strips existing digits before appending the counter', () => {
      const list = [
        { id: 'a', name: 'IDX9' },
        { id: 'b', name: 'IDX1' },
      ];

      expect(autoName(list, '', 'IDX9')).toBe('IDX2');
    });

    it('treats an empty name as always available', () => {
      expect(autoName([{ id: 'a', name: '' }], '', '')).toBe('');
    });

    it('honours a custom starting counter', () => {
      expect(autoName([{ id: 'a', name: 'FK' }], '', 'FK', 5)).toBe('FK5');
    });
  });

  describe('toOrderName', () => {
    it('maps the order types', () => {
      expect(toOrderName(OrderType.ASC)).toBe('ASC');
      expect(toOrderName(OrderType.DESC)).toBe('DESC');
    });

    it('returns an empty string for an unknown order type', () => {
      expect(toOrderName(0)).toBe('');
    });
  });
});
