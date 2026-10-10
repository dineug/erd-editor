import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { Database, NameCase } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Column, Table } from '@/internal-types';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import {
  createCode,
  formatLineComment,
  formatTable,
  getJvmType,
  toJavaClassName,
  toJavaFieldName,
} from '@/utils/generator-code/java';

type StateInput = {
  tables?: Table[];
  columns?: Column[];
  settings?: Partial<RootState['settings']>;
};

function createState({
  tables = [],
  columns = [],
  settings,
}: StateInput): RootState {
  const state = schemaV3Parser({}) as unknown as RootState;
  state.doc.tableIds = tables.map(table => table.id);
  tables.forEach(table => {
    state.collections.tableEntities[table.id] = table;
  });
  columns.forEach(column => {
    state.collections.tableColumnEntities[column.id] = column;
  });
  Object.assign(state.settings, settings);
  return state;
}

/** The field each data type writes on a database, one column per type. */
function fieldsOf(
  database: number,
  dataTypes: Array<[dataType: string, javaType: string]>
) {
  const columns = dataTypes.map(([dataType], index) =>
    createColumn({
      id: `c${index}`,
      tableId: 't1',
      name: `c${index}`,
      dataType,
    })
  );
  const table = createTable({
    id: 't1',
    name: 'types',
    columnIds: columns.map(column => column.id),
  });
  const state = createState({
    tables: [table],
    columns,
    settings: { database },
  });
  const buffer: string[] = [];

  formatTable(state, { buffer, table });

  return {
    actual: buffer.slice(2, -1),
    expected: dataTypes.map(
      ([, javaType], index) => `  private ${javaType} c${index};`
    ),
  };
}

describe('generator-code/java', () => {
  describe('createCode', () => {
    it('renders every table sorted by name, separated by blank lines', () => {
      const alpha = createTable({ id: 't1', name: 'alpha', columnIds: ['c1'] });
      const zeta = createTable({
        id: 't2',
        name: 'zeta_table',
        comment: 'zeta comment',
        columnIds: ['c2'],
      });
      const state = createState({
        // deliberately out of order so the sort is observable
        tables: [zeta, alpha],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'INT',
          }),
          createColumn({
            id: 'c2',
            tableId: 't2',
            name: 'created_at',
            dataType: 'DATE',
            comment: 'when',
          }),
        ],
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        '@Data',
        'public class Alpha {',
        '  private Integer id;',
        '}',
        '',
        '// zeta comment',
        '@Data',
        'public class ZetaTable {',
        '  // when',
        '  private LocalDate createdAt;',
        '}',
        '',
      ]);
    });

    it('returns only the leading newline when there are no tables', () => {
      expect(createCode(createState({}))).toBe('');
    });

    it('skips table ids that are not in the collection', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'alpha' })],
      });
      state.doc.tableIds = ['missing', 't1'];

      expect(createCode(state).split('\n')).toEqual([
        '',
        '@Data',
        'public class Alpha {',
        '}',
        '',
      ]);
    });
  });

  describe('formatTable', () => {
    it('maps MySQL data types onto Java types', () => {
      const dataTypes: Array<[string, string, string]> = [
        ['a', 'INT', 'Integer'],
        ['b', 'BIGINT', 'Long'],
        ['c', 'FLOAT', 'Float'],
        ['d', 'DOUBLE', 'Double'],
        ['e', 'DECIMAL', 'BigDecimal'],
        ['f', 'BOOLEAN', 'Boolean'],
        ['g', 'VARCHAR(10)', 'String'],
        ['h', 'TEXT', 'String'],
        ['i', 'DATE', 'LocalDate'],
        ['j', 'TIME', 'LocalTime'],
        ['k', 'UNKNOWN_TYPE', 'String'],
      ];
      const columns = dataTypes.map(([name, dataType]) =>
        createColumn({ id: name, tableId: 't1', name, dataType })
      );
      const table = createTable({
        id: 't1',
        name: 'types',
        columnIds: columns.map(column => column.id),
      });
      const state = createState({
        tables: [table],
        columns,
        settings: { database: Database.MySQL },
      });
      const buffer: string[] = [];

      formatTable(state, { buffer, table });

      expect(buffer).toEqual([
        '@Data',
        'public class Types {',
        ...dataTypes.map(
          ([name, , javaType]) => `  private ${javaType} ${name};`
        ),
        '}',
      ]);
    });

    it('gives MySQL integers their width, an unsigned one the next wider type', () => {
      const { actual, expected } = fieldsOf(Database.MySQL, [
        ['TINYINT', 'Byte'],
        ['TINYINT(1)', 'Byte'],
        ['SMALLINT', 'Short'],
        ['MEDIUMINT', 'Integer'],
        ['TINYINT UNSIGNED', 'Short'],
        ['SMALLINT UNSIGNED', 'Integer'],
        ['MEDIUMINT UNSIGNED', 'Integer'],
        ['INT UNSIGNED', 'Long'],
        ['INT(11) ZEROFILL', 'Long'],
        ['BIGINT UNSIGNED', 'Long'],
        ['SERIAL', 'Long'],
        ['YEAR', 'Integer'],
      ]);

      expect(actual).toEqual(expected);
    });

    it('maps MySQL bits, floats, binaries, JSON and timestamps by their facts', () => {
      const { actual, expected } = fieldsOf(Database.MySQL, [
        ['BIT', 'Boolean'],
        ['BIT(1)', 'Boolean'],
        ['BIT(8)', 'Long'],
        ['FLOAT(24)', 'Float'],
        ['FLOAT(53)', 'Double'],
        ['BINARY(16)', 'byte[]'],
        ['VARBINARY(255)', 'byte[]'],
        ['BLOB', 'byte[]'],
        ['LONGBLOB', 'byte[]'],
        ['JSON', 'String'],
        ["ENUM('a','b')", 'String'],
        ['DATETIME(6)', 'LocalDateTime'],
        ['TIMESTAMP', 'LocalDateTime'],
      ]);

      expect(actual).toEqual(expected);
    });

    it('maps the Oracle TIMESTAMP hint onto LocalDateTime', () => {
      const column = createColumn({
        id: 'c1',
        tableId: 't1',
        name: 'created_at',
        dataType: 'TIMESTAMP',
      });
      const table = createTable({ id: 't1', name: 'log', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [column],
        settings: { database: Database.Oracle },
      });
      const buffer: string[] = [];

      formatTable(state, { buffer, table });

      expect(buffer).toContain('  private LocalDateTime createdAt;');
    });

    it('maps Oracle numbers, dates, zoned timestamps and intervals', () => {
      const { actual, expected } = fieldsOf(Database.Oracle, [
        ['NUMBER', 'Long'],
        ['NUMBER(10)', 'Long'],
        ['NUMBER(10,2)', 'BigDecimal'],
        ['NUMBER(*,2)', 'BigDecimal'],
        ['INTEGER', 'Long'],
        ['SMALLINT', 'Long'],
        ['REAL', 'Double'],
        ['BINARY_FLOAT', 'Float'],
        ['DATE', 'LocalDateTime'],
        ['TIMESTAMP(6) WITH TIME ZONE', 'OffsetDateTime'],
        ['TIMESTAMP(6) WITH LOCAL TIME ZONE', 'LocalDateTime'],
        ['INTERVAL DAY(2) TO SECOND(6)', 'Duration'],
        ['INTERVAL YEAR(2) TO MONTH', 'String'],
        ['RAW(16)', 'byte[]'],
        ['BLOB', 'byte[]'],
        ['CLOB', 'String'],
      ]);

      expect(actual).toEqual(expected);
    });

    it('maps the MySQL DATETIME and TIMESTAMP hints onto LocalDateTime', () => {
      const columns = [
        createColumn({
          id: 'c1',
          tableId: 't1',
          name: 'created_at',
          dataType: 'DATETIME',
        }),
        createColumn({
          id: 'c2',
          tableId: 't1',
          name: 'updated_at',
          dataType: 'TIMESTAMP',
        }),
        createColumn({
          id: 'c3',
          tableId: 't1',
          name: 'birth_day',
          dataType: 'DATE',
        }),
      ];
      const table = createTable({
        id: 't1',
        name: 'log',
        columnIds: columns.map(column => column.id),
      });
      const state = createState({
        tables: [table],
        columns,
        settings: { database: Database.MySQL },
      });
      const buffer: string[] = [];

      formatTable(state, { buffer, table });

      expect(buffer).toEqual([
        '@Data',
        'public class Log {',
        '  private LocalDateTime createdAt;',
        '  private LocalDateTime updatedAt;',
        '  private LocalDate birthDay;',
        '}',
      ]);
    });

    it('maps the PostgreSQL int8, timestamptz and interval types past their shorter prefixes', () => {
      const columns = [
        createColumn({
          id: 'c1',
          tableId: 't1',
          name: 'id',
          dataType: 'int8',
        }),
        createColumn({
          id: 'c2',
          tableId: 't1',
          name: 'created_at',
          dataType: 'timestamptz',
        }),
        createColumn({
          id: 'c3',
          tableId: 't1',
          name: 'duration',
          dataType: 'interval',
        }),
      ];
      const table = createTable({
        id: 't1',
        name: 'event',
        columnIds: columns.map(column => column.id),
      });
      const state = createState({
        tables: [table],
        columns,
        settings: { database: Database.PostgreSQL },
      });
      const buffer: string[] = [];

      formatTable(state, { buffer, table });

      expect(buffer).toEqual([
        '@Data',
        'public class Event {',
        '  private Long id;',
        '  private OffsetDateTime createdAt;',
        '  private Duration duration;',
        '}',
      ]);
    });

    it('maps PostgreSQL uuid, bytea, money, bit strings and time zones', () => {
      const { actual, expected } = fieldsOf(Database.PostgreSQL, [
        ['uuid', 'UUID'],
        ['bytea', 'byte[]'],
        ['smallint', 'Short'],
        ['int2', 'Short'],
        ['smallserial', 'Short'],
        ['serial', 'Integer'],
        ['bigserial', 'Long'],
        ['oid', 'Long'],
        ['money', 'BigDecimal'],
        ['numeric(10,2)', 'BigDecimal'],
        ['float(24)', 'Float'],
        ['float(53)', 'Double'],
        ['bit(8)', 'String'],
        ['varbit', 'String'],
        ['jsonb', 'String'],
        ['inet', 'String'],
        ['timetz', 'OffsetTime'],
        ['time with time zone', 'OffsetTime'],
        ['timestamp with time zone', 'OffsetDateTime'],
        ['interval day to second(3)', 'Duration'],
        ['interval year to month', 'String'],
      ]);

      expect(actual).toEqual(expected);
    });

    it('writes one array level for each PostgreSQL array dimension', () => {
      const { actual, expected } = fieldsOf(Database.PostgreSQL, [
        ['int[]', 'Integer[]'],
        ['integer ARRAY', 'Integer[]'],
        ['text[][]', 'String[][]'],
        ['uuid[]', 'UUID[]'],
        ['bytea[]', 'byte[][]'],
        ['timestamptz[][][]', 'OffsetDateTime[][][]'],
        ['"mood"[]', 'String[]'],
      ]);

      expect(actual).toEqual(expected);
    });

    it('maps SQL Server decimals, bits, binaries and offsets', () => {
      const { actual, expected } = fieldsOf(Database.MSSQL, [
        ['numeric(10,2)', 'BigDecimal'],
        ['money', 'BigDecimal'],
        ['smallmoney', 'BigDecimal'],
        ['bit', 'Boolean'],
        ['tinyint', 'Short'],
        ['smallint', 'Short'],
        ['real', 'Float'],
        ['float(24)', 'Float'],
        ['float', 'Double'],
        ['uniqueidentifier', 'UUID'],
        ['varbinary(max)', 'byte[]'],
        ['image', 'byte[]'],
        ['rowversion', 'byte[]'],
        ['timestamp', 'byte[]'],
        ['datetime2(7)', 'LocalDateTime'],
        ['datetimeoffset(7)', 'OffsetDateTime'],
        ['nvarchar(max)', 'String'],
      ]);

      expect(actual).toEqual(expected);
    });

    it('reads every SQLite integer as 64 bits and its BOOL, TIME and TIMESTAMP', () => {
      const { actual, expected } = fieldsOf(Database.SQLite, [
        ['INTEGER', 'Long'],
        ['TINYINT', 'Long'],
        ['BOOL', 'Boolean'],
        ['TIME', 'LocalTime'],
        ['TIMESTAMP', 'LocalDateTime'],
        ['BLOB', 'byte[]'],
        ['DECIMAL(10,2)', 'BigDecimal'],
      ]);

      expect(actual).toEqual(expected);
    });

    it('maps Snowflake and Databricks integers, timestamps and semi-structured types', () => {
      const snowflake = fieldsOf(Database.Snowflake, [
        ['TINYINT', 'Long'],
        ['NUMBER(38,2)', 'BigDecimal'],
        ['TIMESTAMP_TZ(3)', 'OffsetDateTime'],
        ['TIMESTAMP_LTZ', 'LocalDateTime'],
        ['VARIANT', 'String'],
        ['BINARY', 'byte[]'],
      ]);
      const databricks = fieldsOf(Database.Databricks, [
        ['BYTE', 'Byte'],
        ['SHORT', 'Short'],
        ['TIMESTAMP', 'LocalDateTime'],
        ['TIMESTAMP_NTZ', 'LocalDateTime'],
        ['INTERVAL DAY TO SECOND', 'Duration'],
        ['INTERVAL YEAR TO MONTH', 'String'],
        ['ARRAY<INT>', 'String'],
        ['VOID', 'String'],
      ]);

      expect(snowflake.actual).toEqual(snowflake.expected);
      expect(databricks.actual).toEqual(databricks.expected);
    });

    it('writes a reserved word with an underscore after it', () => {
      const columns = ['class', 'default', 'record', 'var', '_', 'type'].map(
        (name, index) =>
          createColumn({
            id: `c${index}`,
            tableId: 't1',
            name,
            dataType: 'INT',
          })
      );
      const table = createTable({
        id: 't1',
        name: 'record',
        columnIds: columns.map(column => column.id),
      });
      const state = createState({
        tables: [table],
        columns,
        settings: {
          tableNameCase: NameCase.none,
          columnNameCase: NameCase.none,
        },
      });
      const buffer: string[] = [];

      formatTable(state, { buffer, table });

      expect(buffer).toEqual([
        '@Data',
        'public class record_ {',
        '  private Integer class_;',
        '  private Integer default_;',
        '  private Integer record;',
        '  private Integer var;',
        '  private Integer __;',
        '  private Integer type;',
        '}',
      ]);
    });

    it('writes a field Class with an underscore after it, whose Lombok getter would be the final getClass', () => {
      const names = ['class', 'CLASS', 'class_', 'getClass'];
      const columns = names.map((name, index) =>
        createColumn({
          id: `c${index}`,
          tableId: 't1',
          name,
          dataType: 'INT',
        })
      );
      const table = createTable({
        id: 't1',
        name: 'class',
        columnIds: columns.map(column => column.id),
      });
      const pascalCase = createState({
        tables: [table],
        columns,
        settings: {
          tableNameCase: NameCase.pascalCase,
          columnNameCase: NameCase.pascalCase,
        },
      });
      const none = createState({
        tables: [table],
        columns: columns.map(column => ({
          ...column,
          name: column.name === 'CLASS' ? 'Class' : column.name,
        })),
        settings: {
          tableNameCase: NameCase.none,
          columnNameCase: NameCase.none,
        },
      });
      const pascalBuffer: string[] = [];
      const noneBuffer: string[] = [];

      formatTable(pascalCase, { buffer: pascalBuffer, table });
      formatTable(none, { buffer: noneBuffer, table });

      expect(pascalBuffer).toEqual([
        '@Data',
        'public class Class {',
        '  private Integer Class_;',
        '  private Integer Class_;',
        '  private Integer Class_;',
        '  private Integer GetClass;',
        '}',
      ]);
      expect(noneBuffer).toEqual([
        '@Data',
        'public class class_ {',
        '  private Integer class_;',
        '  private Integer Class_;',
        '  private Integer class_;',
        '  private Integer getClass;',
        '}',
      ]);
    });

    it('writes a comment of several lines as one line comment a line', () => {
      const column = createColumn({
        id: 'c1',
        tableId: 't1',
        name: 'id',
        dataType: 'INT',
        comment: 'first\nsecond\rthird fourth fifth',
      });
      const table = createTable({
        id: 't1',
        name: 'notes',
        comment: '\r\n  \ntitle\r\n\r\n  \nbody\n\n',
        columnIds: ['c1'],
      });
      const state = createState({ tables: [table], columns: [column] });
      const buffer: string[] = [];

      formatTable(state, { buffer, table });

      expect(buffer).toEqual([
        '// title',
        '//',
        '//',
        '// body',
        '@Data',
        'public class Notes {',
        '  // first',
        '  // second',
        '  // third',
        '  // fourth',
        '  // fifth',
        '  private Integer id;',
        '}',
      ]);
    });

    it('ignores comments that are only whitespace', () => {
      const column = createColumn({
        id: 'c1',
        tableId: 't1',
        name: 'id',
        dataType: 'INT',
        comment: '   ',
      });
      const table = createTable({
        id: 't1',
        name: 'blank',
        comment: '  \t \n ',
        columnIds: ['c1'],
      });
      const state = createState({ tables: [table], columns: [column] });
      const buffer: string[] = [];

      formatTable(state, { buffer, table });

      expect(buffer).toEqual([
        '@Data',
        'public class Blank {',
        '  private Integer id;',
        '}',
      ]);
    });

    it('doubles an odd run of backslashes before a u, which javac reads as an escape', () => {
      const column = createColumn({
        id: 'c1',
        tableId: 't1',
        name: 'path',
        dataType: 'VARCHAR(255)',
        comment: 'e.g. C:\\users, x \\u000a y, \\\\u0041, \\\\\\uZZ',
      });
      const table = createTable({
        id: 't1',
        name: 'files',
        comment: 'Stored under C:\\users\\x',
        columnIds: ['c1'],
      });
      const state = createState({ tables: [table], columns: [column] });
      const buffer: string[] = [];

      formatTable(state, { buffer, table });

      expect(buffer).toEqual([
        '// Stored under C:\\\\users\\x',
        '@Data',
        'public class Files {',
        '  // e.g. C:\\\\users, x \\\\u000a y, \\\\u0041, \\\\\\\\uZZ',
        '  private String path;',
        '}',
      ]);
    });

    it('honours the configured table and column name cases', () => {
      const column = createColumn({
        id: 'c1',
        tableId: 't1',
        name: 'userName',
        dataType: 'VARCHAR',
      });
      const table = createTable({
        id: 't1',
        name: 'user_table',
        columnIds: ['c1'],
      });
      const state = createState({
        tables: [table],
        columns: [column],
        settings: {
          tableNameCase: NameCase.none,
          columnNameCase: NameCase.snakeCase,
        },
      });
      const buffer: string[] = [];

      formatTable(state, { buffer, table });

      expect(buffer).toEqual([
        '@Data',
        'public class user_table {',
        '  private String user_name;',
        '}',
      ]);
    });

    it('appends to an existing buffer instead of replacing it', () => {
      const table = createTable({ id: 't1', name: 'empty' });
      const state = createState({ tables: [table] });
      const buffer = ['// header'];

      formatTable(state, { buffer, table });

      expect(buffer).toEqual([
        '// header',
        '@Data',
        'public class Empty {',
        '}',
      ]);
    });
  });

  describe('getJvmType', () => {
    it('gives the element type and the PostgreSQL array depth', () => {
      expect(getJvmType('varchar(20)[][]', Database.PostgreSQL)).toEqual({
        type: 'String',
        arrayDepth: 2,
      });
      expect(getJvmType('MEDIUMINT UNSIGNED', Database.MariaDB)).toEqual({
        type: 'Integer',
        arrayDepth: 0,
      });
      expect(getJvmType('INT UNSIGNED', Database.MariaDB)).toEqual({
        type: 'Long',
        arrayDepth: 0,
      });
      expect(getJvmType('UUID', Database.MariaDB)).toEqual({
        type: 'UUID',
        arrayDepth: 0,
      });
    });
  });

  describe('names', () => {
    it('keeps a name javac takes and renames the rest', () => {
      expect(toJavaFieldName('name')).toBe('name');
      expect(toJavaFieldName('yield')).toBe('yield');
      expect(toJavaFieldName('null')).toBe('null_');
      expect(toJavaFieldName('Class')).toBe('Class_');
      expect(toJavaClassName('Class')).toBe('Class');
      expect(toJavaClassName('yield')).toBe('yield_');
      expect(toJavaClassName('sealed')).toBe('sealed_');
      expect(toJavaClassName('enum')).toBe('enum_');
      expect(toJavaClassName('Record')).toBe('Record');
    });
  });

  describe('formatLineComment', () => {
    it('indents every line and writes nothing for an empty comment', () => {
      const buffer: string[] = [];

      formatLineComment(buffer, '    ', '');
      formatLineComment(buffer, '    ', 'a\r\n  b  ');

      expect(buffer).toEqual(['    // a', '    //   b  ']);
    });

    it('escapes each line it writes, but leaves a blank inner line bare', () => {
      const buffer: string[] = [];

      formatLineComment(buffer, '', 'a\n \nb', line => `<${line}>`);

      expect(buffer).toEqual(['// <a>', '//', '// <b>']);
    });
  });
});
