import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnOption, Database, NameCase } from '@/constants/schema';
import { DatabaseHintMap } from '@/constants/sql/dataType';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import {
  createCode,
  createTableCode,
  formatComment,
  formatTable,
  swiftType,
  toPropertyKey,
  toPropertyName,
  toStringLiteral,
  toStructName,
} from '@/utils/generator-code/swift';

type ColumnInput = {
  name: string;
  dataType?: string;
  comment?: string;
  options?: number;
};

type TableInput = {
  id: string;
  name: string;
  comment?: string;
  columns?: ColumnInput[];
};

const HEADER = ['', 'import Foundation'];
const HEAD = 'nonisolated struct';
const CONFORMANCES = 'Codable, Hashable, Sendable';
const NN = ColumnOption.notNull;
const PK = ColumnOption.primaryKey;

function createState(database: number = Database.PostgreSQL): RootState {
  const state = {
    ...schemaV3Parser({}),
    editor: {} as any,
    lww: {},
  } as RootState;

  state.settings.database = database;
  state.settings.tableNameCase = NameCase.pascalCase;
  state.settings.columnNameCase = NameCase.camelCase;
  return state;
}

function addTable(
  state: RootState,
  { id, name, comment = '', columns = [] }: TableInput
): Table {
  const entities = columns.map((column, index) =>
    createColumn({
      id: `${id}-c${index}`,
      tableId: id,
      name: column.name,
      dataType: column.dataType ?? '',
      comment: column.comment ?? '',
      options: column.options ?? 0,
    })
  );
  const table = createTable({
    id,
    name,
    comment,
    columnIds: entities.map(column => column.id),
  });

  state.collections.tableEntities[table.id] = table;
  entities.forEach(column => {
    state.collections.tableColumnEntities[column.id] = column;
  });
  state.doc.tableIds.push(table.id);

  return table;
}

function tableLines(state: RootState, table: Table): string[] {
  const buffer: string[] = [];

  formatTable(state, { buffer, table });
  return buffer;
}

function commentLines(comment: string, indent = ''): string[] {
  const buffer: string[] = [];

  formatComment(buffer, indent, comment);
  return buffer;
}

describe('swift generator', () => {
  describe('createCode', () => {
    it('writes nothing for a document without tables', () => {
      expect(createCode(createState())).toBe('');
    });

    it('opens on a blank line and the import, then each struct by table name, a blank line apart', () => {
      const state = createState();
      addTable(state, {
        id: 'b',
        name: 'post',
        columns: [{ name: 'id', dataType: 'integer', options: PK }],
      });
      addTable(state, {
        id: 'a',
        name: 'member',
        columns: [{ name: 'id', dataType: 'integer', options: PK }],
      });

      expect(createCode(state).split('\n')).toEqual([
        ...HEADER,
        '',
        `${HEAD} Member: ${CONFORMANCES} {`,
        '    var id: Int32',
        '}',
        '',
        `${HEAD} Post: ${CONFORMANCES} {`,
        '    var id: Int32',
        '}',
        '',
      ]);
    });

    it('writes the PostgreSQL sample with its keys, comments, arrays and keyword', () => {
      const state = createState();
      addTable(state, {
        id: 'u',
        name: 'users',
        comment: 'People who sign in.',
        columns: [
          { name: 'id', dataType: 'bigserial', options: PK },
          {
            name: 'email',
            dataType: 'varchar(255)',
            comment: 'Login address, unique.',
            options: NN,
          },
          { name: 'display_name', dataType: 'varchar(100)' },
          { name: 'is_active', dataType: 'boolean', options: NN },
          { name: 'created_at', dataType: 'timestamptz', options: NN },
        ],
      });
      addTable(state, {
        id: 'o',
        name: 'orders',
        columns: [
          { name: 'id', dataType: 'uuid', options: PK },
          { name: 'user_id', dataType: 'bigint', options: NN },
          { name: 'status', dataType: 'text', options: NN },
          { name: 'total', dataType: 'numeric(12,2)', options: NN },
          {
            name: 'note',
            dataType: 'text',
            comment: 'Shown to the courier.\nNever shown to the customer.',
          },
          { name: 'tags', dataType: 'text[]' },
          { name: 'placed_on', dataType: 'date', options: NN },
          { name: 'deliver_after', dataType: 'time' },
          { name: 'metadata', dataType: 'jsonb' },
        ],
      });
      addTable(state, {
        id: 'i',
        name: 'order_items',
        columns: [
          { name: 'order_id', dataType: 'uuid', options: PK },
          { name: 'line', dataType: 'smallint', options: PK },
          { name: 'sku', dataType: 'char(12)', options: NN },
          { name: 'quantity', dataType: 'integer', options: NN },
          { name: 'unit_price', dataType: 'numeric(12,2)', options: NN },
          { name: 'weight', dataType: 'real' },
          { name: 'photo', dataType: 'bytea' },
          { name: 'default', dataType: 'boolean' },
        ],
      });

      expect(createCode(state)).toBe(
        [
          ...HEADER,
          '',
          `${HEAD} OrderItems: ${CONFORMANCES} {`,
          '    var orderId: UUID',
          '    var line: Int16',
          '    var sku: String',
          '    var quantity: Int32',
          '    var unitPrice: Decimal',
          '    var weight: Float?',
          '    var photo: Data?',
          '    var `default`: Bool?',
          '',
          '    enum CodingKeys: String, CodingKey {',
          '        case orderId = "order_id"',
          '        case line',
          '        case sku',
          '        case quantity',
          '        case unitPrice = "unit_price"',
          '        case weight',
          '        case photo',
          '        case `default`',
          '    }',
          '}',
          '',
          `${HEAD} Orders: ${CONFORMANCES} {`,
          '    var id: UUID',
          '    var userId: Int64',
          '    var status: String',
          '    var total: Decimal',
          '    /// Shown to the courier.',
          '    /// Never shown to the customer.',
          '    var note: String?',
          '    var tags: [String]?',
          '    var placedOn: Date',
          '    var deliverAfter: String?',
          '    var metadata: String?',
          '',
          '    enum CodingKeys: String, CodingKey {',
          '        case id',
          '        case userId = "user_id"',
          '        case status',
          '        case total',
          '        case note',
          '        case tags',
          '        case placedOn = "placed_on"',
          '        case deliverAfter = "deliver_after"',
          '        case metadata',
          '    }',
          '}',
          '',
          '/// People who sign in.',
          `${HEAD} Users: ${CONFORMANCES} {`,
          '    var id: Int64',
          '    /// Login address, unique.',
          '    var email: String',
          '    var displayName: String?',
          '    var isActive: Bool',
          '    var createdAt: Date',
          '',
          '    enum CodingKeys: String, CodingKey {',
          '        case id',
          '        case email',
          '        case displayName = "display_name"',
          '        case isActive = "is_active"',
          '        case createdAt = "created_at"',
          '    }',
          '}',
          '',
        ].join('\n')
      );
    });
  });

  describe('createTableCode', () => {
    it('writes one struct under the import, so a file of its own compiles', () => {
      const state = createState();
      const table = addTable(state, {
        id: 't',
        name: 'tag',
        columns: [{ name: 'id', dataType: 'uuid', options: PK }],
      });

      expect(createTableCode(state, table)).toBe(
        [
          ...HEADER,
          '',
          `${HEAD} Tag: ${CONFORMANCES} {`,
          '    var id: UUID',
          '}',
          '',
        ].join('\n')
      );
    });
  });

  describe('formatTable', () => {
    it('writes an empty table on one line', () => {
      const state = createState();
      const table = addTable(state, { id: 't', name: 'empty' });

      expect(tableLines(state, table)).toEqual([
        `${HEAD} Empty: ${CONFORMANCES} {}`,
      ]);
    });

    it('reads a primary key as NOT NULL with its flag unset, and only an unflagged column as optional', () => {
      const state = createState(Database.MySQL);
      const table = addTable(state, {
        id: 't',
        name: 'account',
        columns: [
          { name: 'id', dataType: 'BIGINT', options: PK },
          { name: 'code', dataType: 'INT', options: PK | NN },
          { name: 'name', dataType: 'VARCHAR(20)', options: NN },
          { name: 'note', dataType: 'TEXT' },
        ],
      });

      expect(tableLines(state, table)).toEqual([
        `${HEAD} Account: ${CONFORMANCES} {`,
        '    var id: Int64',
        '    var code: Int32',
        '    var name: String',
        '    var note: String?',
        '}',
      ]);
    });

    it('writes no coding keys where every property is named as its column', () => {
      const state = createState();
      state.settings.tableNameCase = NameCase.none;
      state.settings.columnNameCase = NameCase.none;
      const table = addTable(state, {
        id: 't',
        name: 'order_items',
        columns: [
          { name: 'order_id', dataType: 'uuid', options: PK },
          { name: 'Type', dataType: 'text', options: NN },
          { name: 'self', dataType: 'text', options: NN },
        ],
      });

      expect(tableLines(state, table)).toEqual([
        `${HEAD} order_items: ${CONFORMANCES} {`,
        '    var order_id: UUID',
        '    var `Type`: String',
        '    var `self`: String',
        '}',
      ]);
    });

    it('renames a CodingKeys and a RawValue property and keys each to its column', () => {
      const state = createState();
      state.settings.tableNameCase = NameCase.none;
      state.settings.columnNameCase = NameCase.none;
      const table = addTable(state, {
        id: 't',
        name: '_',
        columns: [
          { name: 'self', dataType: 'integer', options: NN },
          { name: 'Protocol', dataType: 'integer', options: NN },
          { name: 'CodingKeys', dataType: 'integer', options: NN },
          { name: 'RawValue', dataType: 'integer', options: NN },
        ],
      });

      expect(tableLines(state, table)).toEqual([
        `${HEAD} \`_\`: ${CONFORMANCES} {`,
        '    var `self`: Int32',
        '    var `Protocol`: Int32',
        '    var CodingKeys_: Int32',
        '    var RawValue_: Int32',
        '',
        '    enum CodingKeys: String, CodingKey {',
        '        case `self`',
        '        case `Protocol`',
        '        case CodingKeys_ = "CodingKeys"',
        '        case RawValue_ = "RawValue"',
        '    }',
        '}',
      ]);
    });

    it('renames the RawValue a column name case makes, which would break the String raw type of the coding keys', () => {
      const state = createState();
      state.settings.columnNameCase = NameCase.pascalCase;
      const table = addTable(state, {
        id: 't',
        name: 'product',
        columns: [
          { name: 'id', dataType: 'integer', options: NN },
          { name: 'raw_value', dataType: 'integer', options: NN },
        ],
      });

      expect(tableLines(state, table)).toEqual([
        `${HEAD} Product: ${CONFORMANCES} {`,
        '    var Id: Int32',
        '    var RawValue_: Int32',
        '',
        '    enum CodingKeys: String, CodingKey {',
        '        case Id = "id"',
        '        case RawValue_ = "raw_value"',
        '    }',
        '}',
      ]);
    });

    it('keys a column name with quotes, a backslash and controls through escapes', () => {
      const state = createState();
      const table = addTable(state, {
        id: 't',
        name: 'odd',
        columns: [{ name: 'weird "col\\name\t', dataType: 'text' }],
      });

      expect(tableLines(state, table)).toEqual([
        `${HEAD} Odd: ${CONFORMANCES} {`,
        '    var weirdColName: String?',
        '',
        '    enum CodingKeys: String, CodingKey {',
        '        case weirdColName = "weird \\"col\\\\name\\u{9}"',
        '    }',
        '}',
      ]);
    });

    it('writes the table comment above the struct and each column comment above its property', () => {
      const state = createState();
      state.settings.columnNameCase = NameCase.none;
      const table = addTable(state, {
        id: 't',
        name: 'note',
        comment: 'First\r\n\r\nSecond',
        columns: [{ name: 'body', dataType: 'text', comment: ' Text ' }],
      });

      expect(tableLines(state, table)).toEqual([
        '/// First',
        '///',
        '/// Second',
        `${HEAD} Note: ${CONFORMANCES} {`,
        '    ///  Text',
        '    var body: String?',
        '}',
      ]);
    });

    it.each([
      [NameCase.none, NameCase.none, 'user_account', 'created_at'],
      [NameCase.pascalCase, NameCase.snakeCase, 'UserAccount', 'created_at'],
      [NameCase.camelCase, NameCase.camelCase, 'userAccount', 'createdAt'],
      [NameCase.snakeCase, NameCase.pascalCase, 'user_account', 'CreatedAt'],
    ])(
      'follows the table name case %i and the column name case %i',
      (tableNameCase, columnNameCase, struct, property) => {
        const state = createState();
        state.settings.tableNameCase = tableNameCase;
        state.settings.columnNameCase = columnNameCase;
        const table = addTable(state, {
          id: 't',
          name: 'user_account',
          columns: [{ name: 'created_at', dataType: 'timestamp', options: NN }],
        });
        const lines = tableLines(state, table);

        expect(lines[0]).toBe(`${HEAD} ${struct}: ${CONFORMANCES} {`);
        expect(lines[1]).toBe(`    var ${property}: Date`);
        expect(lines.includes('    enum CodingKeys: String, CodingKey {')).toBe(
          property !== 'created_at'
        );
      }
    );
  });

  describe('names', () => {
    it.each([
      ['Date', 'Date_'],
      ['String', 'String_'],
      ['Codable', 'Codable_'],
      ['CodingKey', 'CodingKey_'],
      ['UInt8', 'UInt8_'],
      ['class', '`class`'],
      ['Self', '`Self`'],
      ['_', '`_`'],
      ['Foundation', 'Foundation'],
      ['Type', 'Type'],
      ['CodingKeys', 'CodingKeys'],
      ['any', 'any'],
      ['user name', 'user name'],
      ['1st', '1st'],
      ['', ''],
    ])('names a struct %j as %s', (name, structName) => {
      expect(toStructName(name)).toBe(structName);
    });

    it.each([
      ['default', '`default`'],
      ['inout', '`inout`'],
      ['Any', '`Any`'],
      ['Type', '`Type`'],
      ['Protocol', '`Protocol`'],
      ['String', 'String'],
      ['actor', 'actor'],
      ['async', 'async'],
      ['hashValue', 'hashValue'],
      ['type', 'type'],
    ])('names a property %j as %s', (key, name) => {
      expect(toPropertyName(key)).toBe(name);
    });

    it('keys a CodingKeys or RawValue property with an underscore after it and leaves every other name', () => {
      expect(toPropertyKey('CodingKeys')).toBe('CodingKeys_');
      expect(toPropertyKey('RawValue')).toBe('RawValue_');
      expect(toPropertyKey('codingKeys')).toBe('codingKeys');
      expect(toPropertyKey('rawValue')).toBe('rawValue');
      expect(toPropertyKey('CodingKeys_')).toBe('CodingKeys_');
      expect(toPropertyKey('RawValue_')).toBe('RawValue_');
    });

    it('writes a repeated or non-identifier name as is', () => {
      const state = createState();
      state.settings.tableNameCase = NameCase.none;
      state.settings.columnNameCase = NameCase.none;
      const table = addTable(state, {
        id: 't',
        name: 'user name',
        columns: [
          { name: 'a', dataType: 'text', options: NN },
          { name: 'a', dataType: 'text', options: NN },
          { name: '1st', dataType: 'text', options: NN },
        ],
      });

      expect(tableLines(state, table)).toEqual([
        `${HEAD} user name: ${CONFORMANCES} {`,
        '    var a: String',
        '    var a: String',
        '    var 1st: String',
        '}',
      ]);
    });
  });

  describe('toStringLiteral', () => {
    it('escapes a quote, a backslash, every C0 control and DEL, and keeps every other character', () => {
      expect(toStringLiteral('plain')).toBe('"plain"');
      expect(toStringLiteral('a"b\\c\\(d)')).toBe('"a\\"b\\\\c\\\\(d)"');
      expect(toStringLiteral('\0\u0001\n\r\u001f\u007f')).toBe(
        '"\\u{0}\\u{1}\\u{A}\\u{D}\\u{1F}\\u{7F}"'
      );
      expect(toStringLiteral('\u0085\u2028\u202E회원 번호😀')).toBe(
        '"\u0085\u2028\u202E회원 번호😀"'
      );
    });
  });

  describe('formatComment', () => {
    it('writes nothing for an empty or blank comment', () => {
      expect(commentLines('')).toEqual([]);
      expect(commentLines(' \n\t\r\n ')).toEqual([]);
    });

    it('splits at every line terminator, a lone CR and U+2028 and U+2029 included', () => {
      expect(commentLines('a\r\nb\rc\nd\u2028e\u2029f', '  ')).toEqual([
        '  /// a',
        '  /// b',
        '  /// c',
        '  /// d',
        '  /// e',
        '  /// f',
      ]);
    });

    it('drops blank lines at either end, keeps those inside bare, and trims line ends', () => {
      expect(commentLines('\n\n  first  \n\n\nlast\t\n\n')).toEqual([
        '///   first',
        '///',
        '///',
        '/// last',
      ]);
    });

    it('writes a NUL as an escape and leaves every other character', () => {
      expect(commentLines('a\0b */ /* \\ \u202E\u0001')).toEqual([
        '/// a\\u{0}b */ /* \\ \u202E\u0001',
      ]);
    });
  });

  describe('swiftType', () => {
    it.each([
      // MySQL: widths, the unsigned forms, BIT and YEAR.
      [Database.MySQL, 'BOOLEAN', 'Bool'],
      [Database.MySQL, 'BIT', 'Bool'],
      [Database.MySQL, 'BIT(1)', 'Bool'],
      [Database.MySQL, 'BIT(8)', 'UInt64'],
      [Database.MySQL, 'TINYINT(1)', 'Int8'],
      [Database.MySQL, 'SMALLINT', 'Int16'],
      [Database.MySQL, 'MEDIUMINT', 'Int32'],
      [Database.MySQL, 'INT', 'Int32'],
      [Database.MySQL, 'BIGINT', 'Int64'],
      [Database.MySQL, 'TINYINT UNSIGNED', 'UInt8'],
      [Database.MySQL, 'SMALLINT UNSIGNED', 'UInt16'],
      [Database.MySQL, 'MEDIUMINT UNSIGNED', 'UInt32'],
      [Database.MySQL, 'INT(11) ZEROFILL', 'UInt32'],
      [Database.MySQL, 'BIGINT UNSIGNED', 'UInt64'],
      [Database.MySQL, 'SERIAL', 'UInt64'],
      [Database.MySQL, 'SMALLINT SIGNED', 'Int16'],
      [Database.MySQL, 'YEAR', 'UInt16'],
      [Database.MySQL, 'FLOAT', 'Float'],
      [Database.MySQL, 'FLOAT(53)', 'Double'],
      [Database.MySQL, 'DOUBLE', 'Double'],
      [Database.MySQL, 'DECIMAL(10,2) UNSIGNED', 'Decimal'],
      [Database.MySQL, "ENUM('a','b')", 'String'],
      [Database.MySQL, "SET('r','w')", 'String'],
      [Database.MySQL, 'JSON', 'String'],
      [Database.MySQL, 'POINT', 'String'],
      [Database.MySQL, 'BLOB', 'Data'],
      [Database.MySQL, 'CHAR(16) BYTE', 'Data'],
      [Database.MySQL, 'DATE', 'Date'],
      [Database.MySQL, 'DATETIME(6)', 'Date'],
      [Database.MySQL, 'TIMESTAMP', 'Date'],
      [Database.MySQL, 'TIME', 'String'],
      // MariaDB sends its UUID as text.
      [Database.MariaDB, 'UUID', 'String'],
      [Database.MariaDB, 'INET6', 'String'],
      [Database.MariaDB, 'NUMBER', 'Double'],
      [Database.MariaDB, 'NUMBER(10,2)', 'Decimal'],
      [Database.MariaDB, 'RAW(16)', 'Data'],
      // PostgreSQL: arrays, money and the system identifiers as text.
      [Database.PostgreSQL, 'smallserial', 'Int16'],
      [Database.PostgreSQL, 'serial', 'Int32'],
      [Database.PostgreSQL, 'bigserial', 'Int64'],
      [Database.PostgreSQL, 'float(24)', 'Float'],
      [Database.PostgreSQL, 'double precision', 'Double'],
      [Database.PostgreSQL, 'numeric(10,2)', 'Decimal'],
      [Database.PostgreSQL, 'money', 'String'],
      [Database.PostgreSQL, 'oid', 'String'],
      [Database.PostgreSQL, 'xid', 'String'],
      [Database.PostgreSQL, 'cid', 'String'],
      [Database.PostgreSQL, 'xid8', 'String'],
      [Database.PostgreSQL, 'bit(8)', 'String'],
      [Database.PostgreSQL, 'varbit', 'String'],
      [Database.PostgreSQL, 'pg_lsn', 'String'],
      [Database.PostgreSQL, 'inet', 'String'],
      [Database.PostgreSQL, 'uuid', 'UUID'],
      [Database.PostgreSQL, 'json', 'String'],
      [Database.PostgreSQL, 'jsonb', 'String'],
      [Database.PostgreSQL, 'bytea', 'Data'],
      [Database.PostgreSQL, 'date', 'Date'],
      [Database.PostgreSQL, 'time', 'String'],
      [Database.PostgreSQL, 'timetz', 'String'],
      [Database.PostgreSQL, 'time with time zone', 'String'],
      [Database.PostgreSQL, 'timestamp(6) without time zone', 'Date'],
      [Database.PostgreSQL, 'timestamptz(3)', 'Date'],
      [Database.PostgreSQL, 'interval', 'String'],
      [Database.PostgreSQL, 'interval year to month', 'String'],
      [Database.PostgreSQL, 'integer[]', '[Int32]'],
      [Database.PostgreSQL, 'integer ARRAY', '[Int32]'],
      [Database.PostgreSQL, 'text[][]', '[[String]]'],
      [Database.PostgreSQL, 'timestamptz[][][]', '[[[Date]]]'],
      [Database.PostgreSQL, 'money[]', '[String]'],
      [Database.PostgreSQL, 'oid[]', '[String]'],
      [Database.PostgreSQL, '"mood"[]', '[String]'],
      // SQL Server: its own bit, tinyint, money, rowversion and GUID.
      [Database.MSSQL, 'bit', 'Bool'],
      [Database.MSSQL, 'tinyint', 'UInt8'],
      [Database.MSSQL, 'money', 'Decimal'],
      [Database.MSSQL, 'smallmoney', 'Decimal'],
      [Database.MSSQL, 'numeric(18,4)', 'Decimal'],
      [Database.MSSQL, 'float(24)', 'Float'],
      [Database.MSSQL, 'uniqueidentifier', 'UUID'],
      [Database.MSSQL, 'rowversion', 'Data'],
      [Database.MSSQL, 'timestamp', 'Data'],
      [Database.MSSQL, 'datetimeoffset', 'Date'],
      [Database.MSSQL, 'time', 'String'],
      [Database.MSSQL, 'nvarchar(max)', 'String'],
      // Oracle stores every integer as a NUMBER(38).
      [Database.Oracle, 'NUMBER', 'Int64'],
      [Database.Oracle, 'NUMBER(9)', 'Int64'],
      [Database.Oracle, 'INTEGER', 'Int64'],
      [Database.Oracle, 'SMALLINT', 'Int64'],
      [Database.Oracle, 'NUMBER(10,2)', 'Decimal'],
      [Database.Oracle, 'NUMBER(*,2)', 'Decimal'],
      [Database.Oracle, 'BINARY_FLOAT', 'Float'],
      [Database.Oracle, 'REAL', 'Double'],
      [Database.Oracle, 'DATE', 'Date'],
      [Database.Oracle, 'TIMESTAMP(6) WITH LOCAL TIME ZONE', 'Date'],
      [Database.Oracle, 'INTERVAL DAY(2) TO SECOND(6)', 'String'],
      [Database.Oracle, 'RAW(16)', 'Data'],
      [Database.Oracle, 'JSON', 'String'],
      // SQLite keeps any integer in up to eight bytes.
      [Database.SQLite, 'INTEGER', 'Int64'],
      [Database.SQLite, 'TINYINT', 'Int64'],
      [Database.SQLite, 'BOOL', 'Bool'],
      [Database.SQLite, 'BOOLEAN', 'Bool'],
      [Database.SQLite, 'TIME', 'String'],
      [Database.SQLite, 'TIMESTAMP', 'Date'],
      [Database.SQLite, 'DATETIME', 'Date'],
      [Database.SQLite, 'DECIMAL(10,5)', 'Decimal'],
      [Database.SQLite, 'REAL', 'Double'],
      [Database.SQLite, 'BLOB', 'Data'],
      // Snowflake: every integer a NUMBER(38,0), semi-structured as text.
      [Database.Snowflake, 'TINYINT', 'Int64'],
      [Database.Snowflake, 'NUMBER(38,0)', 'Int64'],
      [Database.Snowflake, 'NUMBER(10,2)', 'Decimal'],
      [Database.Snowflake, 'UUID', 'UUID'],
      [Database.Snowflake, 'VARIANT', 'String'],
      [Database.Snowflake, 'OBJECT(city VARCHAR)', 'String'],
      [Database.Snowflake, 'TIMESTAMP_TZ(9)', 'Date'],
      [Database.Snowflake, 'TIME', 'String'],
      // Databricks.
      [Database.Databricks, 'BYTE', 'Int8'],
      [Database.Databricks, 'SHORT', 'Int16'],
      [Database.Databricks, 'LONG', 'Int64'],
      [Database.Databricks, 'FLOAT', 'Float'],
      [Database.Databricks, 'TIMESTAMP_NTZ', 'Date'],
      [Database.Databricks, 'ARRAY<INT>', 'String'],
      [Database.Databricks, 'STRUCT<a:INT>', 'String'],
      [Database.Databricks, 'INTERVAL YEAR TO MONTH', 'String'],
      [Database.Databricks, 'VOID', 'String'],
      [Database.Databricks, 'BINARY', 'Data'],
      // A type no vendor list names.
      [Database.MySQL, 'unknown_type', 'String'],
      [Database.MySQL, '', 'String'],
    ])('reads %i %j as %s', (database, dataType, type) => {
      expect(swiftType(dataType, database)).toBe(type);
    });

    it('gives every vendor list name one of the types the output writes', () => {
      const written = new Set([
        'Bool',
        'Data',
        'Date',
        'Decimal',
        'Double',
        'Float',
        'Int16',
        'Int32',
        'Int64',
        'Int8',
        'String',
        'UInt16',
        'UInt64',
        'UInt8',
        'UUID',
      ]);

      Object.entries(DatabaseHintMap).forEach(([database, hints]) => {
        hints.forEach(({ name }) => {
          expect(written.has(swiftType(name, Number(database)))).toBe(true);
        });
      });
    });
  });
});
