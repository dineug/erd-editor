import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnOption, Database, NameCase } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createCode, formatTable } from '@/utils/generator-code/go';

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

function createState(): RootState {
  return {
    ...schemaV3Parser({}),
    editor: {} as any,
    lww: {},
  } as RootState;
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

/** The field type each data type gets on a database, NOT NULL and nullable. */
function goTypes(
  database: number,
  dataTypes: string[]
): Record<string, [notNull: string, nullable: string]> {
  const state = createState();
  state.settings.database = database;
  const table = addTable(state, {
    id: 't-types',
    name: 'types',
    columns: dataTypes.flatMap(dataType => [
      { name: 'a', dataType, options: ColumnOption.notNull },
      { name: 'b', dataType },
    ]),
  });
  const buffer: string[] = [];

  formatTable(state, { buffer, table });

  const types = buffer.slice(1, -1).map(line => line.trim().split(/\s+/)[1]);
  return Object.fromEntries(
    dataTypes.map((dataType, index) => [
      dataType,
      [types[index * 2], types[index * 2 + 1]],
    ])
  );
}

describe('generator-code/go', () => {
  it('returns an empty string when there is no table', () => {
    expect(createCode(createState())).toBe('');
  });

  it('emits structs sorted by name with comments and pointer nullables', () => {
    const state = createState();

    addTable(state, {
      id: 't-users',
      name: 'users',
      comment: 'user table',
      columns: [
        {
          name: 'id',
          dataType: 'INT',
          comment: 'user id',
          options: ColumnOption.primaryKey | ColumnOption.notNull,
        },
        { name: 'nick_name', dataType: 'VARCHAR(50)' },
      ],
    });
    addTable(state, {
      id: 't-posts',
      name: 'posts',
      columns: [
        { name: 'id', dataType: 'BIGINT', options: ColumnOption.notNull },
      ],
    });

    expect(createCode(state)).toBe(
      [
        '',
        'type Posts struct {',
        '\tId int64 `json:"id"`',
        '}',
        '',
        '// user table',
        'type Users struct {',
        '\t// user id',
        '\tId       int32   `json:"id"`',
        '\tNickName *string `json:"nick_name"`',
        '}',
        '',
      ].join('\n')
    );
  });

  it('maps every primitive type to a Go type', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-types',
      name: 'types',
      columns: [
        { name: 'intCol', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'longCol', dataType: 'BIGINT', options: ColumnOption.notNull },
        { name: 'floatCol', dataType: 'FLOAT', options: ColumnOption.notNull },
        {
          name: 'doubleCol',
          dataType: 'DOUBLE',
          options: ColumnOption.notNull,
        },
        {
          name: 'decimalCol',
          dataType: 'DECIMAL(10, 2)',
          options: ColumnOption.notNull,
        },
        {
          name: 'booleanCol',
          dataType: 'BOOLEAN',
          options: ColumnOption.notNull,
        },
        {
          name: 'stringCol',
          dataType: 'VARCHAR(10)',
          options: ColumnOption.notNull,
        },
        { name: 'lobCol', dataType: 'TEXT', options: ColumnOption.notNull },
        { name: 'dateCol', dataType: 'DATE', options: ColumnOption.notNull },
        { name: 'timeCol', dataType: 'TIME', options: ColumnOption.notNull },
        {
          name: 'unknownCol',
          dataType: 'NOT_A_TYPE',
          options: ColumnOption.notNull,
        },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'type Types struct {',
      '\tIntCol     int32           `json:"intCol"`',
      '\tLongCol    int64           `json:"longCol"`',
      '\tFloatCol   float32         `json:"floatCol"`',
      '\tDoubleCol  float64         `json:"doubleCol"`',
      '\tDecimalCol decimal.Decimal `json:"decimalCol"`',
      '\tBooleanCol bool            `json:"booleanCol"`',
      '\tStringCol  string          `json:"stringCol"`',
      '\tLobCol     string          `json:"lobCol"`',
      '\tDateCol    time.Time       `json:"dateCol"`',
      '\tTimeCol    string          `json:"timeCol"`',
      '\tUnknownCol string          `json:"unknownCol"`',
      '}',
    ]);
  });

  it('maps the dateTime primitive type to time.Time', () => {
    const state = createState();
    state.settings.database = Database.Oracle;
    const table = addTable(state, {
      id: 't-ts',
      name: 'ts',
      columns: [
        {
          name: 'created_at',
          dataType: 'TIMESTAMP',
          options: ColumnOption.notNull,
        },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'type Ts struct {',
      '\tCreatedAt time.Time `json:"created_at"`',
      '}',
    ]);
  });

  it('points at the type for columns without the not null option, a key aside', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-nullable',
      name: 'nullable',
      columns: [
        { name: 'intCol', dataType: 'INT', options: ColumnOption.primaryKey },
        { name: 'boolCol', dataType: 'BOOLEAN', comment: 'a flag' },
        { name: 'amount', dataType: 'DECIMAL(10, 2)' },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'type Nullable struct {',
      '\tIntCol int32 `json:"intCol"`',
      '\t// a flag',
      '\tBoolCol *bool            `json:"boolCol"`',
      '\tAmount  *decimal.Decimal `json:"amount"`',
      '}',
    ]);
  });

  it('restarts the column alignment at a comment, the way gofmt does', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-runs',
      name: 'runs',
      columns: [
        { name: 'id', dataType: 'INT', options: ColumnOption.notNull },
        {
          name: 'name',
          dataType: 'VARCHAR(10)',
          options: ColumnOption.notNull,
        },
        {
          name: 'settled_amount',
          dataType: 'DECIMAL(19, 4)',
          comment: 'in the account currency',
          options: ColumnOption.notNull,
        },
        { name: 'memo', dataType: 'TEXT', options: ColumnOption.notNull },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'type Runs struct {',
      '\tId   int32  `json:"id"`',
      '\tName string `json:"name"`',
      '\t// in the account currency',
      '\tSettledAmount decimal.Decimal `json:"settled_amount"`',
      '\tMemo          string          `json:"memo"`',
      '}',
    ]);
  });

  it('exports the struct and its fields whatever the name case setting is', () => {
    const state = createState();
    state.settings.tableNameCase = NameCase.snakeCase;
    state.settings.columnNameCase = NameCase.camelCase;
    const table = addTable(state, {
      id: 't-user-profile',
      name: 'UserProfile',
      columns: [
        { name: 'user_id', dataType: 'INT', options: ColumnOption.notNull },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'type User_profile struct {',
      '\tUserId int32 `json:"user_id"`',
      '}',
    ]);
  });

  it('keeps the tag on the column name the database spells, not the cased one', () => {
    const state = createState();
    state.settings.columnNameCase = NameCase.pascalCase;
    const table = addTable(state, {
      id: 't-tags',
      name: 'tags',
      columns: [
        {
          name: 'created_at',
          dataType: 'TIMESTAMP',
          options: ColumnOption.notNull,
        },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'type Tags struct {',
      '\tCreatedAt time.Time `json:"created_at"`',
      '}',
    ]);
  });

  it('escapes a quote or a backslash so the tag reads back as the column name', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-quoted',
      name: 'quoted',
      columns: [
        { name: 'say"hi', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'back\\slash', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'plain', dataType: 'INT', options: ColumnOption.notNull },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'type Quoted struct {',
      '\tSayHi     int32 `json:"say\\"hi"`',
      '\tBackSlash int32 `json:"back\\\\slash"`',
      '\tPlain     int32 `json:"plain"`',
      '}',
    ]);
  });

  it('falls back to an interpreted tag literal for a name holding a backtick', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-backtick',
      name: 'backtick',
      columns: [
        { name: 'we`ird', dataType: 'INT', options: ColumnOption.notNull },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'type Backtick struct {',
      '\tWeIrd int32 "json:\\"we`ird\\""',
      '}',
    ]);
  });

  it('escapes a control character or a byte order mark in the tag, which Go reads back', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-controls',
      name: 'controls',
      columns: [
        { name: 'line\nfeed', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'car\rret', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'nul\u0000x', dataType: 'INT', options: ColumnOption.notNull },
        { name: '\uFEFFbom', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'form\ffeed', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'tab\tkept', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'nel\u0085', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'tick`\nx', dataType: 'INT', options: ColumnOption.notNull },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'type Controls struct {',
      '\tLineFeed int32 `json:"line\\nfeed"`',
      '\tCarRet   int32 `json:"car\\rret"`',
      '\tNulX     int32 `json:"nul\\u0000x"`',
      '\tBom      int32 `json:"\\ufeffbom"`',
      '\tFormFeed int32 `json:"form\\u000cfeed"`',
      '\tTabKept  int32 `json:"tab\tkept"`',
      '\tNel      int32 `json:"nel\\u0085"`',
      '\tTickX    int32 "json:\\"tick`\\\\nx\\""',
      '}',
    ]);
  });

  it('tags a column named - as -, which encoding/json reads as the name -', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-dash',
      name: 'dash',
      columns: [
        { name: '-', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'a-b', dataType: 'INT', options: ColumnOption.notNull },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'type Dash struct {',
      '\tX  int32 `json:"-,"`',
      '\tAB int32 `json:"a-b"`',
      '}',
    ]);
  });

  it('emits an empty struct body for a table without columns', () => {
    const state = createState();
    const table = addTable(state, { id: 't-empty', name: 'empty' });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual(['type Empty struct {', '}']);
  });

  it('leaves no trailing whitespace on a field line', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-widths',
      name: 'widths',
      columns: [
        { name: 'a', dataType: 'INT', options: ColumnOption.notNull },
        {
          name: 'bbbbbbbb',
          dataType: 'DECIMAL(10, 2)',
          options: ColumnOption.notNull,
        },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    buffer.forEach(line => expect(line).toBe(line.trimEnd()));
  });

  it('reads a time of day as a string where the driver hands over text', () => {
    expect(goTypes(Database.MySQL, ['TIME', 'TIME(3)'])).toEqual({
      TIME: ['string', '*string'],
      'TIME(3)': ['string', '*string'],
    });
    expect(goTypes(Database.MariaDB, ['TIME'])).toEqual({
      TIME: ['string', '*string'],
    });
    expect(
      goTypes(Database.PostgreSQL, [
        'time',
        'time without time zone',
        'timetz',
        'time with time zone',
      ])
    ).toEqual({
      time: ['string', '*string'],
      'time without time zone': ['string', '*string'],
      timetz: ['string', '*string'],
      'time with time zone': ['string', '*string'],
    });
    expect(goTypes(Database.SQLite, ['TIME'])).toEqual({
      TIME: ['string', '*string'],
    });
    expect(goTypes(Database.MSSQL, ['time'])).toEqual({
      time: ['time.Time', '*time.Time'],
    });
    expect(goTypes(Database.Snowflake, ['TIME'])).toEqual({
      TIME: ['time.Time', '*time.Time'],
    });
  });

  it('gives an unsigned MySQL or MariaDB integer an unsigned type of its width', () => {
    expect(
      goTypes(Database.MySQL, [
        'TINYINT UNSIGNED',
        'SMALLINT UNSIGNED',
        'MEDIUMINT UNSIGNED',
        'INT UNSIGNED',
        'INT(11) ZEROFILL',
        'BIGINT UNSIGNED',
        'SERIAL',
      ])
    ).toEqual({
      'TINYINT UNSIGNED': ['uint8', '*uint8'],
      'SMALLINT UNSIGNED': ['uint16', '*uint16'],
      'MEDIUMINT UNSIGNED': ['uint32', '*uint32'],
      'INT UNSIGNED': ['uint32', '*uint32'],
      'INT(11) ZEROFILL': ['uint32', '*uint32'],
      'BIGINT UNSIGNED': ['uint64', '*uint64'],
      SERIAL: ['uint64', '*uint64'],
    });
    expect(goTypes(Database.MariaDB, ['INT UNSIGNED'])).toEqual({
      'INT UNSIGNED': ['uint32', '*uint32'],
    });
  });

  it('reads every MySQL and MariaDB BIT as bytes, nil for NULL', () => {
    expect(goTypes(Database.MySQL, ['BIT', 'BIT(1)', 'BIT(8)'])).toEqual({
      BIT: ['[]byte', '[]byte'],
      'BIT(1)': ['[]byte', '[]byte'],
      'BIT(8)': ['[]byte', '[]byte'],
    });
    expect(goTypes(Database.MariaDB, ['BIT(1)'])).toEqual({
      'BIT(1)': ['[]byte', '[]byte'],
    });
  });

  it('reads the SQL Server flag, numbers, money and uniqueidentifier as go-mssqldb does', () => {
    expect(
      goTypes(Database.MSSQL, [
        'bit',
        'tinyint',
        'numeric(18,2)',
        'money',
        'smallmoney',
        'uniqueidentifier',
        'rowversion',
        'float(24)',
        'json',
      ])
    ).toEqual({
      bit: ['bool', '*bool'],
      tinyint: ['uint8', '*uint8'],
      'numeric(18,2)': ['decimal.Decimal', '*decimal.Decimal'],
      money: ['decimal.Decimal', '*decimal.Decimal'],
      smallmoney: ['decimal.Decimal', '*decimal.Decimal'],
      uniqueidentifier: ['mssql.UniqueIdentifier', '*mssql.UniqueIdentifier'],
      rowversion: ['[]byte', '[]byte'],
      'float(24)': ['float32', '*float32'],
      json: ['string', '*string'],
    });
  });

  it('reads PostgreSQL bit strings and money as text and its uuid as a string', () => {
    expect(
      goTypes(Database.PostgreSQL, [
        'bit(8)',
        'varbit',
        'money',
        'uuid',
        'numeric(10,2)',
      ])
    ).toEqual({
      'bit(8)': ['string', '*string'],
      varbit: ['string', '*string'],
      money: ['string', '*string'],
      uuid: ['string', '*string'],
      'numeric(10,2)': ['decimal.Decimal', '*decimal.Decimal'],
    });
  });

  it('reads an interval as a string on every database', () => {
    expect(
      goTypes(Database.PostgreSQL, ['interval', 'interval day to second(3)'])
    ).toEqual({
      interval: ['string', '*string'],
      'interval day to second(3)': ['string', '*string'],
    });
    expect(goTypes(Database.Oracle, ['INTERVAL YEAR(2) TO MONTH'])).toEqual({
      'INTERVAL YEAR(2) TO MONTH': ['string', '*string'],
    });
    expect(goTypes(Database.Databricks, ['INTERVAL DAY TO SECOND'])).toEqual({
      'INTERVAL DAY TO SECOND': ['string', '*string'],
    });
  });

  it('writes a PostgreSQL array as one slice per dimension, nil for NULL', () => {
    expect(
      goTypes(Database.PostgreSQL, [
        'int[]',
        'int[][]',
        'integer ARRAY',
        'text[]',
        'bytea[]',
        'money[]',
        'timestamptz[][][]',
        '"mood"[]',
      ])
    ).toEqual({
      'int[]': ['[]int32', '[]int32'],
      'int[][]': ['[][]int32', '[][]int32'],
      'integer ARRAY': ['[]int32', '[]int32'],
      'text[]': ['[]string', '[]string'],
      'bytea[]': ['[][]byte', '[][]byte'],
      'money[]': ['[]string', '[]string'],
      'timestamptz[][][]': ['[][][]time.Time', '[][][]time.Time'],
      '"mood"[]': ['[]string', '[]string'],
    });
  });

  it('reads binary types as bytes but an Oracle BFILE as a string', () => {
    expect(goTypes(Database.PostgreSQL, ['bytea'])).toEqual({
      bytea: ['[]byte', '[]byte'],
    });
    expect(
      goTypes(Database.MySQL, ['VARBINARY(16)', 'BLOB', 'LONGBLOB'])
    ).toEqual({
      'VARBINARY(16)': ['[]byte', '[]byte'],
      BLOB: ['[]byte', '[]byte'],
      LONGBLOB: ['[]byte', '[]byte'],
    });
    expect(goTypes(Database.Oracle, ['RAW(16)', 'BLOB', 'BFILE'])).toEqual({
      'RAW(16)': ['[]byte', '[]byte'],
      BLOB: ['[]byte', '[]byte'],
      BFILE: ['string', '*string'],
    });
    expect(goTypes(Database.SQLite, ['BLOB'])).toEqual({
      BLOB: ['[]byte', '[]byte'],
    });
  });

  it('reads an Oracle or Snowflake NUMBER with a scale as a decimal', () => {
    expect(
      goTypes(Database.Oracle, ['NUMBER(10,2)', 'NUMBER(*,2)', 'NUMBER'])
    ).toEqual({
      'NUMBER(10,2)': ['decimal.Decimal', '*decimal.Decimal'],
      'NUMBER(*,2)': ['decimal.Decimal', '*decimal.Decimal'],
      NUMBER: ['int64', '*int64'],
    });
    expect(goTypes(Database.Snowflake, ['NUMBER(38,2)'])).toEqual({
      'NUMBER(38,2)': ['decimal.Decimal', '*decimal.Decimal'],
    });
  });

  it('takes each integer and float width from the type', () => {
    expect(
      goTypes(Database.MySQL, ['TINYINT', 'SMALLINT', 'YEAR', 'FLOAT(53)'])
    ).toEqual({
      TINYINT: ['int8', '*int8'],
      SMALLINT: ['int16', '*int16'],
      YEAR: ['uint16', '*uint16'],
      'FLOAT(53)': ['float64', '*float64'],
    });
    expect(
      goTypes(Database.PostgreSQL, ['smallserial', 'int2', 'float(24)'])
    ).toEqual({
      smallserial: ['int16', '*int16'],
      int2: ['int16', '*int16'],
      'float(24)': ['float32', '*float32'],
    });
    expect(goTypes(Database.Databricks, ['BYTE', 'SHORT', 'LONG'])).toEqual({
      BYTE: ['int8', '*int8'],
      SHORT: ['int16', '*int16'],
      LONG: ['int64', '*int64'],
    });
    expect(goTypes(Database.Oracle, ['SMALLINT', 'REAL'])).toEqual({
      SMALLINT: ['int64', '*int64'],
      REAL: ['float64', '*float64'],
    });
  });

  it('reads every SQLite, Oracle and Snowflake integer as 64 bits', () => {
    expect(goTypes(Database.SQLite, ['INTEGER', 'TINYINT', 'INT'])).toEqual({
      INTEGER: ['int64', '*int64'],
      TINYINT: ['int64', '*int64'],
      INT: ['int64', '*int64'],
    });
    expect(goTypes(Database.Oracle, ['INTEGER'])).toEqual({
      INTEGER: ['int64', '*int64'],
    });
    expect(goTypes(Database.Snowflake, ['TINYINT'])).toEqual({
      TINYINT: ['int64', '*int64'],
    });
  });

  it('reads JSON as a json.RawMessage where the driver hands over bytes', () => {
    expect(goTypes(Database.PostgreSQL, ['json', 'jsonb'])).toEqual({
      json: ['json.RawMessage', '*json.RawMessage'],
      jsonb: ['json.RawMessage', '*json.RawMessage'],
    });
    expect(goTypes(Database.MySQL, ['JSON'])).toEqual({
      JSON: ['json.RawMessage', '*json.RawMessage'],
    });
    expect(goTypes(Database.MariaDB, ['JSON'])).toEqual({
      JSON: ['json.RawMessage', '*json.RawMessage'],
    });
    expect(goTypes(Database.Oracle, ['JSON'])).toEqual({
      JSON: ['json.RawMessage', '*json.RawMessage'],
    });
    expect(goTypes(Database.SQLite, ['JSON'])).toEqual({
      JSON: ['string', '*string'],
    });
    expect(goTypes(Database.Snowflake, ['VARIANT'])).toEqual({
      VARIANT: ['string', '*string'],
    });
    expect(goTypes(Database.Databricks, ['STRUCT<a:INT>'])).toEqual({
      'STRUCT<a:INT>': ['string', '*string'],
    });
  });

  it('puts an X before a name Go would not export, keeping the tag', () => {
    const state = createState();
    state.settings.columnNameCase = NameCase.none;
    const table = addTable(state, {
      id: 't-member',
      name: '회원',
      columns: [
        {
          name: '회원번호',
          dataType: 'INT',
          options: ColumnOption.primaryKey | ColumnOption.notNull,
        },
        {
          name: '이름',
          dataType: 'VARCHAR(20)',
          options: ColumnOption.notNull,
        },
        { name: '_id', dataType: 'INT', options: ColumnOption.notNull },
        { name: '1st', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'email', dataType: 'VARCHAR(50)' },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'type X회원 struct {',
      '\tX회원번호 int32   `json:"회원번호"`',
      '\tX이름   string  `json:"이름"`',
      '\tX_id  int32   `json:"_id"`',
      '\tX1st  int32   `json:"1st"`',
      '\tEmail *string `json:"email"`',
      '}',
    ]);
  });

  it('drops a mark the default name cases leave, which Go takes in no name', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-ilce',
      name: 'İlçe',
      columns: [
        { name: 'İlçe', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'KİLO', dataType: 'INT', options: ColumnOption.notNull },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'type İlçe struct {',
      '\tİlçe int32 `json:"İlçe"`',
      '\tKilo int32 `json:"KİLO"`',
      '}',
    ]);
  });

  it('drops a mark the casing makes though the name had marks the name cases dropped', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-kilo',
      name: 'KİLO_ชื่อ',
      columns: [
        { name: 'KİLO_ชื่อ', dataType: 'INT', options: ColumnOption.notNull },
      ],
    });
    const defaults: string[] = [];
    const snakeCase: string[] = [];

    formatTable(state, { buffer: defaults, table });
    state.settings.tableNameCase = NameCase.snakeCase;
    state.settings.columnNameCase = NameCase.snakeCase;
    formatTable(state, { buffer: snakeCase, table });

    expect(defaults).toEqual([
      'type Kiloชอ struct {',
      '\tKiloชอ int32 `json:"KİLO_ชื่อ"`',
      '}',
    ]);
    expect(snakeCase).toEqual([
      'type Kilo_ช_อ struct {',
      '\tKilo_ช_อ int32 `json:"KİLO_ชื่อ"`',
      '}',
    ]);
  });

  it('recomposes a cased name and writes a mark of the name itself as is', () => {
    const state = createState();
    state.settings.tableNameCase = NameCase.snakeCase;
    state.settings.columnNameCase = NameCase.none;
    const table = addTable(state, {
      id: 't-marks',
      name: 'il_İd',
      columns: [
        { name: 'ǰx', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'ΐx', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'e\u0301mile', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'नाम', dataType: 'INT', options: ColumnOption.notNull },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'type Il_id struct {',
      '\tJx    int32 `json:"ǰx"`',
      '\tΪx    int32 `json:"ΐx"`',
      '\tÉmile int32 `json:"e\u0301mile"`',
      '\tXनाम  int32 `json:"नाम"`',
      '}',
    ]);
  });

  it('composes a decomposed name before the name cases split it at the mark', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-emile',
      name: 'e\u0301mile',
      columns: [
        { name: 'e\u0301mile', dataType: 'INT', options: ColumnOption.notNull },
        { name: 'émile', dataType: 'INT', options: ColumnOption.notNull },
        {
          name: 'e\u0301mile_no',
          dataType: 'INT',
          options: ColumnOption.notNull,
        },
      ],
    });
    const camelCase: string[] = [];
    const snakeCase: string[] = [];

    formatTable(state, { buffer: camelCase, table });
    state.settings.tableNameCase = NameCase.snakeCase;
    state.settings.columnNameCase = NameCase.snakeCase;
    formatTable(state, { buffer: snakeCase, table });

    expect(camelCase).toEqual([
      'type Émile struct {',
      '\tÉmile   int32 `json:"e\u0301mile"`',
      '\tÉmile   int32 `json:"émile"`',
      '\tÉmileNo int32 `json:"e\u0301mile_no"`',
      '}',
    ]);
    expect(snakeCase).toEqual([
      'type Émile struct {',
      '\tÉmile    int32 `json:"e\u0301mile"`',
      '\tÉmile    int32 `json:"émile"`',
      '\tÉmile_no int32 `json:"e\u0301mile_no"`',
      '}',
    ]);
  });

  it('aligns the field names by runes, as gofmt counts them', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-runes',
      name: 'runes',
      columns: [
        { name: 'id', dataType: 'INT', options: ColumnOption.notNull },
        { name: '𠮷', dataType: 'INT', options: ColumnOption.notNull },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      'type Runes struct {',
      '\tId int32 `json:"id"`',
      '\tX𠮷 int32 `json:"𠮷"`',
      '}',
    ]);
  });

  it('writes a comment of several lines as one line comment per line', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-notes',
      name: 'notes',
      comment: ' first line  \r\n\r\nthird line\u2028fourth ',
      columns: [
        {
          name: 'id',
          dataType: 'INT',
          comment: 'key\nof the row\r  indented',
          options: ColumnOption.notNull,
        },
        { name: 'body', dataType: 'TEXT', options: ColumnOption.notNull },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      '// first line',
      '//',
      '// third line',
      '// fourth',
      'type Notes struct {',
      '\t// key',
      '\t// of the row',
      '\t//   indented',
      '\tId   int32  `json:"id"`',
      '\tBody string `json:"body"`',
      '}',
    ]);
  });

  it('folds a run of empty comment lines, as gofmt folds one in a doc comment', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-runs',
      name: 'runs',
      comment: 'line1\n\n\nline3\n\u2029\nline5',
      columns: [
        {
          name: 'id',
          dataType: 'INT',
          comment: 'a\n\n\n\nb',
          options: ColumnOption.notNull,
        },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      '// line1',
      '//',
      '// line3',
      '//',
      '// line5',
      'type Runs struct {',
      '\t// a',
      '\t//',
      '\t// b',
      '\tId int32 `json:"id"`',
      '}',
    ]);
  });

  it('writes a comment line that reads as a +build constraint as a block comment', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-constraints',
      name: 'constraints',
      comment: 'first line\n+build ignore\n+builder\n+build */ x',
      columns: [
        {
          name: 'id',
          dataType: 'INT',
          comment: 'note\n  +build\tlinux',
          options: ColumnOption.notNull,
        },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      '// first line',
      '/* +build ignore */',
      '// +builder',
      '// +build */ x',
      'type Constraints struct {',
      '\t// note',
      '\t/*   +build\tlinux */',
      '\tId int32 `json:"id"`',
      '}',
    ]);
  });

  it('drops a NUL and a byte order mark from a comment, which Go refuses', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-refused',
      name: 'refused',
      comment: '\u0000\nnul\u0000 and bom\uFEFF here\u0000',
      columns: [
        {
          name: 'id',
          dataType: 'INT',
          comment: 'a\uFEFFb',
          options: ColumnOption.notNull,
        },
        {
          name: 'body',
          dataType: 'TEXT',
          comment: '\u0000\n',
          options: ColumnOption.notNull,
        },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      '// nul and bom here',
      'type Refused struct {',
      '\t// ab',
      '\tId   int32  `json:"id"`',
      '\tBody string `json:"body"`',
      '}',
    ]);
  });

  it('trims a next line character as gofmt trims any Unicode space', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-nel',
      name: 'nel',
      comment: '\u0085Loading\u0085 \u0085',
      columns: [
        {
          name: 'id',
          dataType: 'INT',
          comment: 'a\u0085\n\u0085\n\u0085\nb',
          options: ColumnOption.notNull,
        },
        {
          name: 'body',
          dataType: 'TEXT',
          comment: '\u0085',
          options: ColumnOption.notNull,
        },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      '// Loading',
      'type Nel struct {',
      '\t// a',
      '\t//',
      '\t// b',
      '\tId   int32  `json:"id"`',
      '\tBody string `json:"body"`',
      '}',
    ]);
  });

  it('reads any Unicode space after +build as Go does, a form feed a space', () => {
    const state = createState();
    const table = addTable(state, {
      id: 't-spaces',
      name: 'spaces',
      comment: 'note\n+build\u3000linux\n+build\u00a0x\n+build\u0085',
      columns: [
        {
          name: 'id',
          dataType: 'INT',
          comment: '+build\vx\n\f+build\fy\n+build\u2003z\nform\ffeed',
          options: ColumnOption.notNull,
        },
      ],
    });
    const buffer: string[] = [];

    formatTable(state, { buffer, table });

    expect(buffer).toEqual([
      '// note',
      '/* +build\u3000linux */',
      '/* +build\u00a0x */',
      '/* +build */',
      'type Spaces struct {',
      '\t/* +build\vx */',
      '\t/*  +build y */',
      '\t/* +build\u2003z */',
      '\t// form\ffeed',
      '\tId int32 `json:"id"`',
      '}',
    ]);
  });
});
