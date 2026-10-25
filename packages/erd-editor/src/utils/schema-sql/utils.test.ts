import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  ColumnOption,
  Database,
  OrderType,
  ReferentialAction,
} from '@/constants/schema';
import { RootState } from '@/engine/state';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import {
  ALL_REFERENTIAL_ACTIONS,
  commentToWrite,
  formatDefault,
  formatNames,
  formatReferentialActions,
  formatSize,
  formatSpace,
  primaryKey,
  toForeignKeyPairs,
  toOrderName,
  toStringLiteral,
  unique,
  uniqueColumns,
  withoutReferentialAction,
} from '@/utils/schema-sql/utils';

describe('schema-sql/utils', () => {
  describe('commentToWrite', () => {
    it('keeps a comment that is not blank, whatever the option', () => {
      const entity = { comment: ' paid ', logicalName: 'Order' };

      expect(commentToWrite(entity)).toBe(' paid ');
      expect(commentToWrite(entity, true)).toBe(' paid ');
    });

    it('takes the logical name for a blank comment only under the option', () => {
      const entity = { comment: '  ', logicalName: 'Order' };

      expect(commentToWrite(entity, true)).toBe('Order');
      expect(commentToWrite(entity, false)).toBe('');
      expect(commentToWrite(entity)).toBe('');
    });

    it('writes nothing where the logical name is blank too', () => {
      expect(commentToWrite({ comment: '', logicalName: ' ' }, true)).toBe('');
      expect(commentToWrite({ comment: '', logicalName: '' }, true)).toBe('');
    });
  });

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

  describe('primaryKey', () => {
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

  describe('toForeignKeyPairs', () => {
    const KEY = ColumnOption.primaryKey | ColumnOption.notNull;

    // A parent keyed on (b, a) in that order, with a unique code and a plain
    // note, and a child with a column for each.
    function createDocument() {
      const state = schemaV3Parser({}) as unknown as RootState;
      [
        createColumn({ id: 'b', tableId: 'p', name: 'b', options: KEY }),
        createColumn({ id: 'a', tableId: 'p', name: 'a', options: KEY }),
        createColumn({
          id: 'code',
          tableId: 'p',
          name: 'code',
          options: ColumnOption.unique,
        }),
        createColumn({ id: 'note', tableId: 'p', name: 'note' }),
        createColumn({ id: 'cb', tableId: 'c', name: 'cb' }),
        createColumn({ id: 'ca', tableId: 'c', name: 'ca' }),
        createColumn({ id: 'ccode', tableId: 'c', name: 'ccode' }),
        createColumn({ id: 'cnote', tableId: 'c', name: 'cnote' }),
      ].forEach(column => {
        state.collections.tableColumnEntities[column.id] = column;
      });
      state.collections.tableEntities = {
        p: createTable({
          id: 'p',
          name: 'parent',
          columnIds: ['b', 'a', 'code', 'note'],
        }),
        c: createTable({
          id: 'c',
          name: 'child',
          columnIds: ['cb', 'ca', 'ccode', 'cnote'],
        }),
      };
      state.doc.tableIds = ['p', 'c'];
      return state;
    }

    const relationship = (start: string[], end: string[]) =>
      createRelationship({
        start: { tableId: 'p', columnIds: start },
        end: { tableId: 'c', columnIds: end },
      });

    const namesOf = (state: RootState, start: string[], end: string[]) => {
      const pairs = toForeignKeyPairs(state, relationship(start, end));
      return (
        pairs && [
          pairs.start.map(column => column.name),
          pairs.end.map(column => column.name),
        ]
      );
    };

    it.each([
      [
        'the key in declaration order',
        ['b', 'a'],
        ['cb', 'ca'],
        [
          ['b', 'a'],
          ['cb', 'ca'],
        ],
      ],
      [
        'the key in another order',
        ['a', 'b'],
        ['ca', 'cb'],
        [
          ['b', 'a'],
          ['cb', 'ca'],
        ],
      ],
      [
        'the key with its pairs crossed',
        ['a', 'b'],
        ['cb', 'ca'],
        [
          ['b', 'a'],
          ['ca', 'cb'],
        ],
      ],
      ['part of the key', ['a'], ['ca'], [['a'], ['ca']]],
      [
        'the key and one more column',
        ['note', 'a', 'b'],
        ['cnote', 'ca', 'cb'],
        [
          ['note', 'a', 'b'],
          ['cnote', 'ca', 'cb'],
        ],
      ],
      ['a unique column', ['code'], ['ccode'], [['code'], ['ccode']]],
      [
        'columns that are no key',
        ['note', 'code'],
        ['cnote', 'ccode'],
        [
          ['note', 'code'],
          ['cnote', 'ccode'],
        ],
      ],
      [
        'more start columns than end columns',
        ['a', 'b'],
        ['ca'],
        [['a'], ['ca']],
      ],
      [
        'more end columns than start columns',
        ['b'],
        ['cb', 'ca'],
        [['b'], ['cb']],
      ],
      [
        'a start column that does not exist',
        ['a', 'ghost'],
        ['ca', 'cb'],
        [['a'], ['ca']],
      ],
      [
        'an end column that does not exist',
        ['b', 'a'],
        ['ghost', 'ca'],
        [['a'], ['ca']],
      ],
      ['no column that exists', ['ghost'], ['ghost'], null],
      ['no column', [], [], null],
    ])('reads %s', (_, start, end, expected) => {
      expect(namesOf(createDocument(), start, end)).toEqual(expected);
    });

    it('drops a pair whose start column has left its table, the entity kept', () => {
      const state = createDocument();
      state.collections.tableEntities.p.columnIds = ['a', 'code', 'note'];

      expect(namesOf(state, ['a', 'b', 'code'], ['ca', 'cb', 'ccode'])).toEqual(
        [
          ['a', 'code'],
          ['ca', 'ccode'],
        ]
      );
    });

    it('drops a pair whose end column has left its table, the entity kept', () => {
      const state = createDocument();
      state.collections.tableEntities.c.columnIds = ['cb', 'ccode'];

      expect(namesOf(state, ['b', 'a'], ['cb', 'ca'])).toEqual([['b'], ['cb']]);
    });

    it('drops a pair whose column its table lists without an entity', () => {
      const state = createDocument();
      state.collections.tableEntities.c.columnIds.push('ghost');

      expect(namesOf(state, ['b', 'a'], ['ghost', 'ca'])).toEqual([
        ['a'],
        ['ca'],
      ]);
    });

    it('follows the key as the table orders it now', () => {
      const state = createDocument();
      state.collections.tableEntities.p.columnIds = ['a', 'note', 'code', 'b'];

      expect(namesOf(state, ['b', 'a'], ['cb', 'ca'])).toEqual([
        ['a', 'b'],
        ['ca', 'cb'],
      ]);
    });

    it.each([
      ['start', ['c']],
      ['end', ['p']],
    ])(
      'gives nothing when the %s table is gone from the document',
      (_, tableIds) => {
        const state = createDocument();
        state.doc.tableIds = tableIds;

        expect(namesOf(state, ['b', 'a'], ['cb', 'ca'])).toBeNull();
      }
    );

    it('gives nothing when a listed table has no entity', () => {
      const state = createDocument();
      Reflect.deleteProperty(state.collections.tableEntities, 'p');

      expect(namesOf(state, ['b', 'a'], ['cb', 'ca'])).toBeNull();
    });

    it('hands back both tables with the pairs', () => {
      const state = createDocument();
      const pairs = toForeignKeyPairs(state, relationship(['code'], ['ccode']));

      expect(pairs?.startTable).toBe(state.collections.tableEntities.p);
      expect(pairs?.endTable).toBe(state.collections.tableEntities.c);
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
