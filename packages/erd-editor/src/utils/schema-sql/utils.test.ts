import { describe, expect, it } from 'vite-plus/test';

import {
  BracketType,
  ColumnOption,
  Database,
  OrderType,
  ReferentialAction,
} from '@/constants/schema';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import {
  ALL_REFERENTIAL_ACTIONS,
  autoName,
  formatDefault,
  formatNames,
  formatReferentialActions,
  formatSize,
  formatSpace,
  getBracket,
  orderByNameASC,
  primaryKey,
  primaryKeyColumns,
  splitsTableName,
  splitTableName,
  tableNamePart,
  toOrderName,
  toStringLiteral,
  unique,
  uniqueColumns,
  withoutReferentialAction,
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

  describe('formatReferentialActions', () => {
    it('writes ON DELETE before ON UPDATE', () => {
      expect(
        formatReferentialActions(
          {
            onDelete: ReferentialAction.setDefault,
            onUpdate: ReferentialAction.noAction,
          },
          ALL_REFERENTIAL_ACTIONS
        )
      ).toEqual(['ON DELETE SET DEFAULT', 'ON UPDATE NO ACTION']);
    });

    it('writes nothing for none or for an action outside the support', () => {
      expect(
        formatReferentialActions(
          {
            onDelete: ReferentialAction.none,
            onUpdate: ReferentialAction.restrict,
          },
          { onDelete: ALL_REFERENTIAL_ACTIONS.onDelete, onUpdate: [] }
        )
      ).toEqual([]);
    });
  });

  describe('withoutReferentialAction', () => {
    it('drops the refused actions from both events', () => {
      const support = withoutReferentialAction(
        ReferentialAction.restrict,
        ReferentialAction.setDefault
      );

      expect(support.onDelete).toEqual([
        ReferentialAction.noAction,
        ReferentialAction.cascade,
        ReferentialAction.setNull,
      ]);
      expect(support.onUpdate).toEqual(support.onDelete);
    });
  });

  describe('toStringLiteral', () => {
    it('quotes the text and doubles every quote inside it', () => {
      expect(toStringLiteral('user id')).toBe("'user id'");
      expect(toStringLiteral("it's the 'id'")).toBe("'it''s the ''id'''");
      expect(toStringLiteral('')).toBe("''");
    });
  });

  describe('formatDefault', () => {
    const bare = (database: number, values: string[], dataType?: string) =>
      values.map(value => formatDefault(value, database, dataType));
    const wrapped = (values: string[]) => values.map(value => `(${value})`);

    it('keeps what MySQL takes bare and wraps any other expression', () => {
      const literals = [
        '0',
        '-1.5',
        '1e3',
        '.5',
        '0x1F',
        '0b101',
        "'it''s'",
        "'it\\'s'",
        "N'abc'",
        "_utf8mb4'abc'",
        '"x"',
        "X'1F'",
        "b'1'",
        "DATE '2026-10-04'",
        'NULL',
        'true',
        'CURRENT_TIMESTAMP',
        'CURRENT_TIMESTAMP(3)',
        'now()',
        'LOCALTIMESTAMP',
        'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
        'NULL ON UPDATE now(6)',
        '(uuid())',
      ];
      const expressions = [
        'uuid()',
        'CURRENT_DATE',
        'now() + interval 1 day',
        '(a) + (b)',
        "concat('a', 'b')",
      ];

      expect(bare(Database.MySQL, literals, 'DATETIME')).toEqual(literals);
      expect(bare(Database.MySQL, expressions, 'DATETIME')).toEqual(
        wrapped(expressions)
      );
    });

    it('wraps any MySQL default but NULL on a type that reads one only in parentheses', () => {
      const types = [
        'TEXT',
        'tinytext',
        'MEDIUMBLOB',
        'longtext',
        'json',
        'GEOMETRY',
        'point',
        'MultiPolygon',
        'geomcollection',
      ];
      const values = ["''", "_utf8mb4'{}'", '0x00', '0', 'CURRENT_TIMESTAMP'];

      for (const dataType of types) {
        expect(bare(Database.MySQL, values, dataType)).toEqual(wrapped(values));
        expect(formatDefault('NULL', Database.MySQL, dataType)).toBe('NULL');
      }
      expect(bare(Database.MySQL, values, ' VARCHAR(20) ')).toEqual([
        "''",
        "_utf8mb4'{}'",
        '0x00',
        '0',
        '(CURRENT_TIMESTAMP)',
      ]);
    });

    it('wraps a MySQL literal default on a LONG type, which MySQL reads as MEDIUMTEXT or MEDIUMBLOB', () => {
      const types = [
        'LONG',
        'long varchar',
        'LONG VARBINARY',
        'Long Char Varying',
        'LONG CHARACTER SET latin1',
      ];
      const values = ["''", "'x'", '0x00', '0'];

      for (const dataType of types) {
        expect(bare(Database.MySQL, values, dataType)).toEqual(wrapped(values));
        expect(formatDefault('NULL', Database.MySQL, dataType)).toBe('NULL');
      }
    });

    it('keeps the current time bare for MySQL only on a TIMESTAMP or DATETIME column', () => {
      const times = ['now()', 'CURRENT_TIMESTAMP(3)', 'localtime'];

      expect(bare(Database.MySQL, times, 'timestamp')).toEqual(times);
      expect(bare(Database.MySQL, times, 'datetime(3)')).toEqual(times);
      expect(bare(Database.MySQL, times, 'date')).toEqual(wrapped(times));
      expect(bare(Database.MySQL, times, 'INT')).toEqual(wrapped(times));
      expect(bare(Database.MySQL, times)).toEqual(wrapped(times));
      expect(
        formatDefault(
          'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
          Database.MySQL,
          'INT'
        )
      ).toBe('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    });

    it('keeps the calls and names MariaDB takes bare and wraps an operator', () => {
      const values = [
        "'a'",
        'current_timestamp()',
        'uuid()',
        'seq.nextval()',
        'b',
      ];
      const expressions = ['1 + 1', 'uuid() + 1', 'NEXT VALUE FOR s'];

      expect(bare(Database.MariaDB, values)).toEqual(values);
      expect(bare(Database.MariaDB, expressions)).toEqual(wrapped(expressions));
    });

    it('keeps what SQLite takes bare and wraps any other expression', () => {
      const literals = [
        '-1',
        '1.5',
        '0x1F',
        "'C:\\'",
        "x'00'",
        'CURRENT_TIMESTAMP',
        'NULL',
        'abc',
        '"x"',
        '`x`',
        '[x]',
        "(datetime('now'))",
      ];
      const expressions = ["datetime('now')", '1 + 1', "strftime('%s', 'now')"];

      expect(bare(Database.SQLite, literals)).toEqual(literals);
      expect(bare(Database.SQLite, expressions)).toEqual(wrapped(expressions));
    });

    it('wraps only what PostgreSQL reads in a full expression', () => {
      const values = [
        'now()',
        "nextval('s'::regclass)",
        "now() + '1 day'::interval",
        "'a' || 'b'",
        "'at the end'",
        "lower('x' IS NULL)",
        'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
        "(now() AT TIME ZONE 'utc')",
      ];
      const expressions = [
        "now() AT TIME ZONE 'utc'::text",
        'a IS NOT NULL',
        '\'a\' COLLATE "C"',
        'x BETWEEN 1 AND 2',
        "'x'::text = ANY (ARRAY['a'::text])",
        '1 > ALL (ARRAY[0])',
        '1 = SOME (ARRAY[1])',
      ];

      expect(bare(Database.PostgreSQL, values)).toEqual(values);
      expect(bare(Database.PostgreSQL, expressions)).toEqual(
        wrapped(expressions)
      );
    });

    it('writes the default as it is for the other databases', () => {
      for (const database of [
        Database.MSSQL,
        Database.Oracle,
        Database.Snowflake,
        Database.Databricks,
      ]) {
        expect(formatDefault('getdate() + 1', database)).toBe('getdate() + 1');
      }
    });

    it('wraps the default without the spaces around it', () => {
      expect(formatDefault('  uuid() ', Database.MySQL)).toBe('(uuid())');
      expect(formatDefault(' 0 ', Database.MySQL)).toBe(' 0 ');
    });
  });
});
