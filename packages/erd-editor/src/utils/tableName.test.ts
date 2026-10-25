import { describe, expect, it } from 'vite-plus/test';

import { BracketType, ColumnOption, Database } from '@/constants/schema';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import {
  autoName,
  autoNameIgnoreCase,
  getBracket,
  orderByNameASC,
  primaryKeyColumns,
  splitsTableName,
  splitTableName,
  tableNamePart,
} from '@/utils/tableName';

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

describe('splitTableName / tableNamePart', () => {
  it('splits an unquoted name at its last dot', () => {
    expect(splitTableName('sales.users', BracketType.none)).toEqual([
      'sales',
      'users',
    ]);
    expect(splitTableName('erp.sales.users', BracketType.none)).toEqual([
      'erp.sales',
      'users',
    ]);
    expect(tableNamePart('erp.sales.users', BracketType.none)).toBe('users');
  });

  it('leaves a name without a dot whole with an empty schema', () => {
    expect(splitTableName('users', BracketType.none)).toEqual(['', 'users']);
    expect(tableNamePart('users', BracketType.none)).toBe('users');
  });

  it('keeps a quoted name whole, the dot being part of one identifier', () => {
    for (const bracketType of [
      BracketType.doubleQuote,
      BracketType.backtick,
      BracketType.singleQuote,
    ]) {
      expect(splitTableName('sales.users', bracketType)).toEqual([
        '',
        'sales.users',
      ]);
      expect(tableNamePart('sales.users', bracketType)).toBe('sales.users');
    }
  });

  it('splits under an unknown bracket type, which writes the name unquoted', () => {
    expect(tableNamePart('sales.users', 9999)).toBe('users');
  });

  // A dot inside brackets or double quotes belongs to the name, and the table
  // part loses one enclosing pair, as the MSSQL comment levels read a name.
  it.each([
    ['[sales].[users]', '[sales]', '[users]', 'users'],
    ['"sales"."users"', '"sales"', '"users"', 'users'],
    ['shop.[sales].[users]', 'shop.[sales]', '[users]', 'users'],
    ['[sales.v2].users', '[sales.v2]', 'users', 'users'],
    ['[x.y.z]', '', '[x.y.z]', 'x.y.z'],
    ['[x]]y]', '', '[x]]y]', 'x]y'],
    ['"x""y"', '', '"x""y"', 'x"y'],
    ['[Order]', '', '[Order]', 'Order'],
    ['[sales.users', '[sales', 'users', 'users'],
  ])(
    'splits the unquoted name %s outside brackets and quotes',
    (name, schema, table, part) => {
      expect(splitTableName(name, BracketType.none)).toEqual([schema, table]);
      expect(tableNamePart(name, BracketType.none)).toBe(part);
    }
  );

  it('keeps a quoted name holding brackets whole', () => {
    expect(splitTableName('[sales].[users]', BracketType.doubleQuote)).toEqual([
      '',
      '[sales].[users]',
    ]);
    expect(tableNamePart('[sales].[users]', BracketType.doubleQuote)).toBe(
      '[sales].[users]'
    );
  });
});

describe('splitsTableName', () => {
  it('holds for the six generators that name keys after the table part', () => {
    for (const database of [
      Database.MariaDB,
      Database.MSSQL,
      Database.MySQL,
      Database.Oracle,
      Database.PostgreSQL,
      Database.SQLite,
    ]) {
      expect(splitsTableName(database)).toBe(true);
    }
  });

  it('fails for Databricks, Snowflake and an unknown database', () => {
    expect(splitsTableName(Database.Databricks)).toBe(false);
    expect(splitsTableName(Database.Snowflake)).toBe(false);
    expect(splitsTableName(0)).toBe(false);
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

  it('keeps a name that differs from an earlier one only in case', () => {
    expect(autoName([{ id: 'a', name: 'IDX_users' }], '', 'IDX_Users')).toBe(
      'IDX_Users'
    );
  });
});

describe('autoNameIgnoreCase', () => {
  it('numbers a name equal to an earlier one but for case and keeps its own case', () => {
    expect(
      autoNameIgnoreCase(
        [{ id: 'a', name: 'FK_users_TO_orders' }],
        'FK_Users_TO_orders'
      )
    ).toBe('FK_Users_TO_orders1');
  });

  it('keeps the bytes of a name that differs in more than case', () => {
    expect(
      autoNameIgnoreCase(
        [{ id: 'a', name: 'FK_users_TO_orders' }],
        'FK_customers_TO_orders'
      )
    ).toBe('FK_customers_TO_orders');
  });

  it('keeps numbering while a numbered name also matches but for case', () => {
    const names = [
      { id: 'a', name: 'IDX_users' },
      { id: 'b', name: 'idx_USERS1' },
    ];

    expect(autoNameIgnoreCase(names, 'IDX_Users')).toBe('IDX_Users2');
  });

  it('numbers an exact repeat as autoName does', () => {
    expect(autoNameIgnoreCase([{ id: 'a', name: 'SEQ_t' }], 'SEQ_t')).toBe(
      'SEQ_t1'
    );
  });

  it('treats an empty name as always available', () => {
    expect(autoNameIgnoreCase([{ id: 'a', name: '' }], '')).toBe('');
  });
});

describe('primaryKeyColumns', () => {
  it('filters only the primary key columns', () => {
    const columns = [
      createColumn({ name: 'id', options: ColumnOption.primaryKey }),
      createColumn({ name: 'name', options: ColumnOption.notNull }),
      createColumn({
        name: 'code',
        options: ColumnOption.primaryKey | ColumnOption.notNull,
      }),
    ];

    expect(primaryKeyColumns(columns).map(column => column.name)).toEqual([
      'id',
      'code',
    ]);
  });
});
