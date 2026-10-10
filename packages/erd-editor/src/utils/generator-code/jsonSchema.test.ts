import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnOption, Database, NameCase } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import {
  createCode,
  createTableCode,
  DIALECT,
  formatJson,
  JsonObject,
  JsonValue,
  NAIVE_DATE_TIME_PATTERN,
  textWidth,
  TIME_PATTERN,
  toDefinitionKeys,
  toValueSchema,
  withNull,
} from '@/utils/generator-code/jsonSchema';
import { getJsonShape } from '@/utils/generator-code/jsonShape';

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

const PK = ColumnOption.primaryKey | ColumnOption.notNull;
const NN = ColumnOption.notNull;
const SCHEMA_LINE =
  '  "$schema": "https://json-schema.org/draft/2020-12/schema",';
const TIME = JSON.stringify(TIME_PATTERN);
const NAIVE = JSON.stringify(NAIVE_DATE_TIME_PATTERN);

const {
  Databricks,
  MariaDB,
  MSSQL,
  MySQL,
  Oracle,
  PostgreSQL,
  SQLite,
  Snowflake,
} = Database;

function createState(database: number = PostgreSQL): RootState {
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

function toPlain(value: JsonValue): unknown {
  return value instanceof Map
    ? Object.fromEntries([...value].map(([key, item]) => [key, toPlain(item)]))
    : value;
}

/** The value schema of a type in one line, null added where nullable. */
function schemaOf(dataType: string, database: number, nullable = false) {
  const schema = toValueSchema(getJsonShape(dataType, database));

  return JSON.stringify(toPlain(nullable ? withNull(schema) : schema));
}

function createBlog(): RootState {
  const state = createState(PostgreSQL);

  addTable(state, {
    id: 'member',
    name: 'member',
    comment: 'Registered users',
    columns: [
      { name: 'id', dataType: 'uuid', options: PK },
      {
        name: 'email',
        dataType: 'varchar(255)',
        options: NN,
        comment: 'Login e-mail, unique',
      },
      { name: 'display_name', dataType: 'varchar(50)' },
      { name: 'birth_date', dataType: 'date' },
      { name: 'is_active', dataType: 'boolean', options: NN },
      { name: 'created_at', dataType: 'timestamptz', options: NN },
    ],
  });
  addTable(state, {
    id: 'post',
    name: 'post',
    columns: [
      { name: 'id', dataType: 'bigserial', options: PK },
      { name: 'member_id', dataType: 'uuid', options: NN },
      { name: 'title', dataType: 'varchar(200)', options: NN },
      { name: 'body', dataType: 'text' },
      { name: 'tags', dataType: 'text[]', options: NN },
      { name: 'metadata', dataType: 'jsonb' },
      { name: 'price', dataType: 'numeric(10,2)' },
      { name: 'view_count', dataType: 'integer', options: NN },
      {
        name: 'published_at',
        dataType: 'timestamp',
        comment: 'Local time of the newsroom\nnull while a draft',
      },
    ],
  });
  addTable(state, {
    id: 'attachment',
    name: 'post_attachment',
    columns: [
      { name: 'id', dataType: 'serial', options: ColumnOption.primaryKey },
      { name: 'post_id', dataType: 'bigint', options: NN },
      { name: 'file_name', dataType: 'varchar(255)', options: NN },
      { name: 'content', dataType: 'bytea', options: NN },
      { name: 'size_bytes', dataType: 'bigint', options: NN },
    ],
  });

  return state;
}

const ATTACHMENT_BODY = [
  '"type": "object",',
  '"properties": {',
  '  "id": {',
  '    "type": "integer",',
  '    "minimum": -2147483648,',
  '    "maximum": 2147483647',
  '  },',
  '  "postId": {',
  '    "type": "integer"',
  '  },',
  '  "fileName": {',
  '    "type": "string",',
  '    "maxLength": 255',
  '  },',
  '  "content": {',
  '    "type": "string",',
  '    "contentEncoding": "base64"',
  '  },',
  '  "sizeBytes": {',
  '    "type": "integer"',
  '  }',
  '},',
  '"required": ["id", "postId", "fileName", "content", "sizeBytes"],',
  '"additionalProperties": false',
];

function indented(lines: string[], indent: string): string[] {
  return lines.map(line => indent + line);
}

describe('createCode', () => {
  it('writes one document, each table a row schema under $defs, by name', () => {
    expect(createCode(createBlog())).toBe(
      [
        '',
        '{',
        SCHEMA_LINE,
        '  "$defs": {',
        '    "Member": {',
        '      "title": "Member",',
        '      "description": "Registered users",',
        '      "type": "object",',
        '      "properties": {',
        '        "id": {',
        '          "type": "string",',
        '          "format": "uuid"',
        '        },',
        '        "email": {',
        '          "description": "Login e-mail, unique",',
        '          "type": "string",',
        '          "maxLength": 255',
        '        },',
        '        "displayName": {',
        '          "type": ["string", "null"],',
        '          "maxLength": 50',
        '        },',
        '        "birthDate": {',
        '          "type": ["string", "null"],',
        '          "format": "date"',
        '        },',
        '        "isActive": {',
        '          "type": "boolean"',
        '        },',
        '        "createdAt": {',
        '          "type": "string",',
        '          "format": "date-time"',
        '        }',
        '      },',
        '      "required": [',
        '        "id",',
        '        "email",',
        '        "displayName",',
        '        "birthDate",',
        '        "isActive",',
        '        "createdAt"',
        '      ],',
        '      "additionalProperties": false',
        '    },',
        '    "Post": {',
        '      "title": "Post",',
        '      "type": "object",',
        '      "properties": {',
        '        "id": {',
        '          "type": "integer"',
        '        },',
        '        "memberId": {',
        '          "type": "string",',
        '          "format": "uuid"',
        '        },',
        '        "title": {',
        '          "type": "string",',
        '          "maxLength": 200',
        '        },',
        '        "body": {',
        '          "type": ["string", "null"]',
        '        },',
        '        "tags": {',
        '          "type": "array",',
        '          "items": {',
        '            "type": "string"',
        '          }',
        '        },',
        '        "metadata": {},',
        '        "price": {',
        '          "type": ["string", "null"]',
        '        },',
        '        "viewCount": {',
        '          "type": "integer",',
        '          "minimum": -2147483648,',
        '          "maximum": 2147483647',
        '        },',
        '        "publishedAt": {',
        '          "description": "Local time of the newsroom\\nnull while a draft",',
        '          "type": ["string", "null"],',
        `          "pattern": ${NAIVE}`,
        '        }',
        '      },',
        '      "required": [',
        '        "id",',
        '        "memberId",',
        '        "title",',
        '        "body",',
        '        "tags",',
        '        "metadata",',
        '        "price",',
        '        "viewCount",',
        '        "publishedAt"',
        '      ],',
        '      "additionalProperties": false',
        '    },',
        '    "PostAttachment": {',
        '      "title": "PostAttachment",',
        ...indented(ATTACHMENT_BODY, '      '),
        '    }',
        '  }',
        '}',
        '',
      ].join('\n')
    );
  });

  it('writes a MySQL ENUM with null in its enum where nullable, a SET as text', () => {
    const state = createState(MySQL);

    addTable(state, {
      id: 'account',
      name: 'account',
      columns: [
        { name: 'id', dataType: 'INT UNSIGNED', options: PK },
        { name: 'role', dataType: "ENUM('admin','member')", options: NN },
        { name: 'is_verified', dataType: 'TINYINT(1)', options: NN },
        { name: 'flags', dataType: "SET('a','b')" },
        { name: 'score', dataType: 'SMALLINT UNSIGNED' },
        { name: 'joined_on', dataType: 'DATE', options: NN },
        { name: 'tier', dataType: "ENUM('free','pro')" },
      ],
    });

    expect(createCode(state)).toBe(
      [
        '',
        '{',
        SCHEMA_LINE,
        '  "$defs": {',
        '    "Account": {',
        '      "title": "Account",',
        '      "type": "object",',
        '      "properties": {',
        '        "id": {',
        '          "type": "integer",',
        '          "minimum": 0,',
        '          "maximum": 4294967295',
        '        },',
        '        "role": {',
        '          "type": "string",',
        '          "enum": ["admin", "member"]',
        '        },',
        '        "isVerified": {',
        '          "type": "integer",',
        '          "minimum": -128,',
        '          "maximum": 127',
        '        },',
        '        "flags": {',
        '          "type": ["string", "null"]',
        '        },',
        '        "score": {',
        '          "type": ["integer", "null"],',
        '          "minimum": 0,',
        '          "maximum": 65535',
        '        },',
        '        "joinedOn": {',
        '          "type": "string",',
        '          "format": "date"',
        '        },',
        '        "tier": {',
        '          "type": ["string", "null"],',
        '          "enum": ["free", "pro", null]',
        '        }',
        '      },',
        '      "required": [',
        '        "id",',
        '        "role",',
        '        "isVerified",',
        '        "flags",',
        '        "score",',
        '        "joinedOn",',
        '        "tier"',
        '      ],',
        '      "additionalProperties": false',
        '    }',
        '  }',
        '}',
        '',
      ].join('\n')
    );
  });

  it('writes nothing for a document with no table', () => {
    expect(createCode(createState())).toBe('');
  });

  it('writes a table with no column as one that takes only an empty object', () => {
    const state = createState();

    addTable(state, { id: 'empty', name: 'empty' });

    expect(createCode(state)).toBe(
      [
        '',
        '{',
        SCHEMA_LINE,
        '  "$defs": {',
        '    "Empty": {',
        '      "title": "Empty",',
        '      "type": "object",',
        '      "properties": {},',
        '      "required": [],',
        '      "additionalProperties": false',
        '    }',
        '  }',
        '}',
        '',
      ].join('\n')
    );
  });

  it('numbers a repeated table key past every key a table takes as is', () => {
    const state = createState();

    addTable(state, { id: 't1', name: 'user' });
    addTable(state, { id: 't2', name: 'User' });
    addTable(state, { id: 't3', name: 'user2' });

    const document = JSON.parse(createCode(state));

    expect(Object.keys(document.$defs)).toEqual(['User', 'User3', 'User2']);
    expect(document.$defs.User3.title).toBe('User3');
    expect(document.$defs.User2.title).toBe('User2');
  });

  it('keeps the first of a repeated property key, which required lists once', () => {
    const state = createState();

    addTable(state, {
      id: 'repeat',
      name: 'repeat',
      columns: [
        { name: 'user_id', dataType: 'int', options: NN },
        { name: 'userId', dataType: 'text', options: NN },
        { name: 'UserId', dataType: 'uuid' },
      ],
    });

    const { $defs } = JSON.parse(createCode(state));

    expect($defs.Repeat.properties).toEqual({
      userId: { type: 'integer', minimum: -2147483648, maximum: 2147483647 },
    });
    expect($defs.Repeat.required).toEqual(['userId']);
  });

  it('keeps every key where its column stands, __proto__ and numbers too', () => {
    const state = createState();

    state.settings.columnNameCase = NameCase.none;
    addTable(state, {
      id: 'keys',
      name: 'keys',
      columns: [
        { name: 'b', dataType: 'int', options: NN },
        { name: '__proto__', dataType: 'jsonb' },
        { name: '10', dataType: 'jsonb' },
        { name: '2', dataType: 'jsonb' },
        { name: '', dataType: 'jsonb' },
      ],
    });

    const code = createCode(state);

    expect(code).toContain(
      [
        '      "properties": {',
        '        "b": {',
        '          "type": "integer",',
        '          "minimum": -2147483648,',
        '          "maximum": 2147483647',
        '        },',
        '        "__proto__": {},',
        '        "10": {},',
        '        "2": {},',
        '        "": {}',
        '      },',
        '      "required": ["b", "__proto__", "10", "2", ""],',
      ].join('\n')
    );
  });

  it('writes a comment as a description, a blank one not at all', () => {
    const state = createState();

    addTable(state, {
      id: 'notes',
      name: 'notes',
      comment: ' \n\t',
      columns: [
        { name: 'a', dataType: 'text', options: NN, comment: '   ' },
        {
          name: 'b',
          dataType: 'text',
          options: NN,
          comment: 'say "hi"\r\nline end ',
        },
      ],
    });

    const code = createCode(state);
    const { $defs } = JSON.parse(code);

    expect($defs.Notes).not.toHaveProperty('description');
    expect($defs.Notes.properties.a).toEqual({ type: 'string' });
    expect($defs.Notes.properties.b.description).toBe('say "hi"\r\nline end ');
    expect(code).toContain('"description": "say \\"hi\\"\\r\\nline end ",');
  });

  it('opens with a blank line and parses as JSON whatever the names', () => {
    const state = createState();

    state.settings.tableNameCase = NameCase.none;
    addTable(state, {
      id: 'odd',
      name: 'a/b~c "q"\\ 회원',
      columns: [{ name: 'x', dataType: 'int', options: NN }],
    });

    const code = createCode(state);

    expect(code.startsWith('\n{\n')).toBe(true);
    expect(code.endsWith('\n}\n')).toBe(true);
    expect(Object.keys(JSON.parse(code).$defs)).toEqual(['a/b~c "q"\\ 회원']);
  });
});

describe('createTableCode', () => {
  it('writes one table as a standalone schema with $schema first', () => {
    const state = createBlog();

    expect(
      createTableCode(state, state.collections.tableEntities.attachment)
    ).toBe(
      [
        '',
        '{',
        SCHEMA_LINE,
        '  "title": "PostAttachment",',
        ...indented(ATTACHMENT_BODY, '  '),
        '}',
        '',
      ].join('\n')
    );
  });

  it('writes a repeated table under its own name, which the whole text numbers', () => {
    const state = createState();

    addTable(state, { id: 't1', name: 'user' });
    const second = addTable(state, { id: 't2', name: 'User' });

    expect(JSON.parse(createTableCode(state, second)).title).toBe('User');
    expect(Object.keys(JSON.parse(createCode(state)).$defs)).toEqual([
      'User',
      'User2',
    ]);
  });
});

describe('toDefinitionKeys', () => {
  it('keeps the first of each name and numbers the rest past every name', () => {
    expect(toDefinitionKeys(['a', 'a', 'a2', 'a', 'b'])).toEqual([
      'a',
      'a3',
      'a2',
      'a4',
      'b',
    ]);
  });

  it('numbers past a key another name was numbered to', () => {
    const names = Array.from({ length: 12 }, () => 'a');

    expect(toDefinitionKeys(['a1', 'a1', ...names, 'b'])).toEqual([
      'a1',
      'a12',
      'a',
      'a2',
      'a3',
      'a4',
      'a5',
      'a6',
      'a7',
      'a8',
      'a9',
      'a10',
      'a11',
      'a13',
      'b',
    ]);
  });
});

describe('toValueSchema', () => {
  it.each([
    [PostgreSQL, 'boolean', '{"type":"boolean"}'],
    [MySQL, 'TINYINT(1)', '{"type":"integer","minimum":-128,"maximum":127}'],
    [MySQL, 'TINYINT UNSIGNED', '{"type":"integer","minimum":0,"maximum":255}'],
    [
      PostgreSQL,
      'smallint',
      '{"type":"integer","minimum":-32768,"maximum":32767}',
    ],
    [MySQL, 'YEAR', '{"type":"integer","minimum":0,"maximum":65535}'],
    [
      MySQL,
      'MEDIUMINT',
      '{"type":"integer","minimum":-8388608,"maximum":8388607}',
    ],
    [
      MariaDB,
      'MEDIUMINT UNSIGNED',
      '{"type":"integer","minimum":0,"maximum":16777215}',
    ],
    [
      PostgreSQL,
      'integer',
      '{"type":"integer","minimum":-2147483648,"maximum":2147483647}',
    ],
    [
      MySQL,
      'INT UNSIGNED',
      '{"type":"integer","minimum":0,"maximum":4294967295}',
    ],
    [PostgreSQL, 'oid', '{"type":"integer","minimum":0,"maximum":4294967295}'],
    [PostgreSQL, 'bigint', '{"type":"integer"}'],
    [MySQL, 'BIGINT UNSIGNED', '{"type":"integer","minimum":0}'],
    [MySQL, 'SERIAL', '{"type":"integer","minimum":0}'],
    [SQLite, 'TINYINT', '{"type":"integer"}'],
    [Oracle, 'INTEGER', '{"type":"integer"}'],
    [Oracle, 'NUMBER', '{"type":"integer"}'],
    [Oracle, 'NUMBER(*)', '{"type":"integer"}'],
    [Snowflake, 'SMALLINT', '{"type":"integer"}'],
    [PostgreSQL, 'double precision', '{"type":"number"}'],
    [MSSQL, 'float(24)', '{"type":"number"}'],
    [PostgreSQL, 'numeric(10,2)', '{"type":"string"}'],
    [PostgreSQL, 'money', '{"type":"string"}'],
    [Oracle, 'NUMBER(10,2)', '{"type":"string"}'],
    [SQLite, 'DECIMAL(10,2)', '{"type":"number"}'],
    [PostgreSQL, 'varchar(255)', '{"type":"string","maxLength":255}'],
    [Oracle, 'VARCHAR2(100 BYTE)', '{"type":"string","maxLength":100}'],
    [Snowflake, 'STRING(100)', '{"type":"string","maxLength":100}'],
    [MSSQL, 'nvarchar(max)', '{"type":"string"}'],
    [PostgreSQL, 'text', '{"type":"string"}'],
    [PostgreSQL, 'xid', '{"type":"string"}'],
    [PostgreSQL, 'timetz', '{"type":"string"}'],
    [PostgreSQL, 'interval', '{"type":"string"}'],
    [PostgreSQL, 'uuid', '{"type":"string","format":"uuid"}'],
    [MariaDB, 'UUID', '{"type":"string","format":"uuid"}'],
    [MSSQL, 'uniqueidentifier', '{"type":"string","format":"uuid"}'],
    [PostgreSQL, 'date', '{"type":"string","format":"date"}'],
    [PostgreSQL, 'time', `{"type":"string","pattern":${TIME}}`],
    [PostgreSQL, 'timestamp', `{"type":"string","pattern":${NAIVE}}`],
    [MSSQL, 'datetime2(7)', `{"type":"string","pattern":${NAIVE}}`],
    [Oracle, 'DATE', `{"type":"string","pattern":${NAIVE}}`],
    [SQLite, 'TIMESTAMP', `{"type":"string","pattern":${NAIVE}}`],
    [PostgreSQL, 'timestamptz', '{"type":"string","format":"date-time"}'],
    [MySQL, 'TIMESTAMP', '{"type":"string","format":"date-time"}'],
    [Databricks, 'TIMESTAMP', '{"type":"string","format":"date-time"}'],
    [PostgreSQL, 'bytea', '{"type":"string","contentEncoding":"base64"}'],
    [MSSQL, 'rowversion', '{"type":"string","contentEncoding":"base64"}'],
    [PostgreSQL, 'jsonb', '{}'],
    [Snowflake, 'VARIANT', '{}'],
    [Databricks, 'STRUCT<a:INT>', '{}'],
    [MySQL, "ENUM('a','b','a')", '{"type":"string","enum":["a","b"]}'],
    [MySQL, "SET('a','b')", '{"type":"string"}'],
    [MariaDB, 'INET4', '{"type":"string","format":"ipv4"}'],
    [MariaDB, 'INET6', '{"type":"string","format":"ipv6"}'],
    [PostgreSQL, 'inet', '{"type":"string"}'],
    [Databricks, 'VOID', '{"type":"null"}'],
    [
      PostgreSQL,
      'int[][]',
      '{"type":"array","items":{"type":"array","items":{"type":"integer","minimum":-2147483648,"maximum":2147483647}}}',
    ],
    [PostgreSQL, '"mood"[]', '{"type":"array","items":{"type":"string"}}'],
    [PostgreSQL, 'jsonb[]', '{"type":"array","items":{}}'],
  ])('writes %s %s as %s', (database, dataType, expected) => {
    expect(schemaOf(dataType, database)).toBe(expected);
  });

  it.each([
    [
      '2^53 - 1',
      '9007199254740991',
      '{"type":"string","maxLength":9007199254740991}',
    ],
    ['2^53', '9007199254740992', '{"type":"string"}'],
    ['20 digits', '9'.repeat(20), '{"type":"string"}'],
    ['309 digits', '9'.repeat(309), '{"type":"string"}'],
  ])(
    'writes a length of %s only up to 2^53 - 1, past which a double rounds it',
    (_, length, expected) => {
      expect(schemaOf(`varchar(${length})`, PostgreSQL)).toBe(expected);
      expect(schemaOf(`varchar(${length})`, PostgreSQL, true)).toBe(
        expected.replace('"string"', '["string","null"]')
      );
    }
  );
});

describe('withNull', () => {
  it.each([
    [PostgreSQL, 'boolean', '{"type":["boolean","null"]}'],
    [PostgreSQL, 'varchar(50)', '{"type":["string","null"],"maxLength":50}'],
    [PostgreSQL, 'bigint', '{"type":["integer","null"]}'],
    [PostgreSQL, 'time', `{"type":["string","null"],"pattern":${TIME}}`],
    [
      MySQL,
      "ENUM('free','pro')",
      '{"type":["string","null"],"enum":["free","pro",null]}',
    ],
    [
      PostgreSQL,
      'text[]',
      '{"type":["array","null"],"items":{"type":"string"}}',
    ],
    [PostgreSQL, 'jsonb', '{}'],
    [Databricks, 'VOID', '{"type":"null"}'],
  ])('adds null to %s %s as %s', (database, dataType, expected) => {
    expect(schemaOf(dataType, database, true)).toBe(expected);
  });

  it('leaves the schema it is given as it was', () => {
    const schema = toValueSchema(getJsonShape("ENUM('a')", MySQL));

    withNull(schema);
    expect(JSON.stringify(toPlain(schema))).toBe(
      '{"type":"string","enum":["a"]}'
    );
  });
});

describe('patterns', () => {
  const time = new RegExp(TIME_PATTERN, 'u');
  const naive = new RegExp(NAIVE_DATE_TIME_PATTERN, 'u');

  it('writes ASCII digits as [0-9], never \\d', () => {
    expect(TIME_PATTERN).toBe(
      '^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:\\.[0-9]+)?)?$'
    );
    expect(NAIVE_DATE_TIME_PATTERN).toBe(
      '^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:\\.[0-9]+)?Z?)?$'
    );
  });

  it.each(['00:00', '12:34:56', '23:59:59.123456'])(
    'takes the time %s',
    value => {
      expect(time.test(value)).toBe(true);
    }
  );

  it.each(['24:00', '12:34:56Z', '12:34:56+09:00', '1٢:34:56', '1:2'])(
    'refuses the time %s',
    value => {
      expect(time.test(value)).toBe(false);
    }
  );

  it.each([
    '2026-10-09T12:34',
    '2026-10-09T12:34:56',
    '2026-10-09T03:34:56.789Z',
  ])('takes the naive date and time %s', value => {
    expect(naive.test(value)).toBe(true);
  });

  it.each([
    '2026-10-09T12:34Z',
    '2026-10-09 12:34:56',
    '2026-13-01T00:00',
    '2026-10-32T00:00',
    '2026-10-09T12:34:56+09:00',
    '٢026-10-09T12:34',
  ])('refuses the naive date and time %s', value => {
    expect(naive.test(value)).toBe(false);
  });
});

describe('formatJson', () => {
  function line(key: string, items: JsonValue, followed: boolean): string {
    const object: JsonObject = new Map([[key, items]]);

    if (followed) {
      object.set('z', 0);
    }
    return formatJson(object).split('\n')[1];
  }

  it('writes an empty object and an empty array closed', () => {
    expect(
      formatJson(
        new Map<string, JsonValue>([
          ['a', new Map()],
          ['b', []],
        ])
      )
    ).toBe('{\n  "a": {},\n  "b": []\n}');
    expect(formatJson(new Map())).toBe('{}');
  });

  it('writes an array on one line while it fits in 80 columns', () => {
    const fits = 'x'.repeat(69);

    expect(line('k', [fits], false)).toBe(`  "k": ["${fits}"]`);
    expect(line('k', [fits], false)).toHaveLength(80);
    expect(line('k', [`${fits}x`], false)).toBe('  "k": [');
  });

  it('counts the comma after an array only where another key follows', () => {
    const fits = 'x'.repeat(68);

    expect(line('k', [fits], true)).toBe(`  "k": ["${fits}"],`);
    expect(line('k', [`${fits}x`], true)).toBe('  "k": [');
  });

  it('writes a broken array one item a line, closed at its key', () => {
    expect(formatJson(new Map([['k', ['x'.repeat(40), 'y'.repeat(40)]]]))).toBe(
      [
        '{',
        '  "k": [',
        `    "${'x'.repeat(40)}",`,
        `    "${'y'.repeat(40)}"`,
        '  ]',
        '}',
      ].join('\n')
    );
  });

  it('counts a Hangul syllable two columns, as Prettier does', () => {
    const fits = '가'.repeat(34);

    expect(line('k', [fits], false)).toBe(`  "k": ["${fits}"]`);
    expect(line('k', [`${fits}가`], false)).toBe('  "k": [');
  });

  it('counts a text-default emoji that takes a skin tone two columns', () => {
    const fits = 'x'.repeat(67);

    expect(line('k', [`✌${fits}`], false)).toBe(`  "k": ["✌${fits}"]`);
    expect(line('k', [`✌${fits}x`], false)).toBe('  "k": [');
  });

  it('measures a key as it measures an item', () => {
    const key = '회'.repeat(10);
    const item = 'x'.repeat(50);

    expect(line(key, [item], false)).toBe(`  "${key}": ["${item}"]`);
    expect(line(key, [`${item}x`], false)).toBe(`  "${key}": [`);
  });

  it('writes nested objects two spaces deeper each', () => {
    expect(
      formatJson(
        new Map<string, JsonValue>([
          ['a', new Map<string, JsonValue>([['b', new Map([['c', true]])]])],
          ['d', null],
        ])
      )
    ).toBe(
      [
        '{',
        '  "a": {',
        '    "b": {',
        '      "c": true',
        '    }',
        '  },',
        '  "d": null',
        '}',
      ].join('\n')
    );
  });
});

describe('textWidth', () => {
  it.each([
    ['', 0],
    ['"abc"', 5],
    ['a\u007fb', 3],
    ['회원', 4],
    ['한\u007f', 2],
    ['é', 1],
    ['é', 1],
    ['\u0085', 0],
    ['❤️', 1],
    ['Ａ', 2],
    ['　', 2],
    ['\u{1f600}', 2],
    ['\u{20000}', 2],
    ['\u{3fffd}', 2],
    ['\u{3fffe}', 1],
    ['ᄀᅟᅠ', 5],
    ['⺚', 1],
    ['☝', 2],
    ['⛹', 2],
    ['✌', 2],
    ['✍', 2],
    ['\u{1f3cb}', 2],
    ['\u{1f3cc}', 2],
    ['\u{1f574}', 2],
    ['\u{1f575}', 2],
    ['\u{1f590}', 2],
    ['✌️', 2],
    ['☚', 1],
    ['✎', 1],
  ])('counts %j as %i columns', (text, width) => {
    expect(textWidth(text)).toBe(width);
  });
});

describe('DIALECT', () => {
  it('names draft 2020-12', () => {
    expect(DIALECT).toBe('https://json-schema.org/draft/2020-12/schema');
  });
});
