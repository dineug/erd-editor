import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { underTurkishLocale } from '@/__test-utils__/locale';
import { ColumnOption, Database, NameCase } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import {
  baseTypeName,
  createCode,
  createTableCode,
  formatDocComment,
  formatTable,
  toClassName,
} from '@/utils/generator-code/php';

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

const HEADER = ['<?php', '', 'declare(strict_types=1);'];

function createState(database: number = Database.MySQL): RootState {
  const state = {
    ...schemaV3Parser({}),
    editor: {} as any,
    lww: {},
  } as RootState;

  state.settings.database = database;
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

function propertyOf(
  database: number,
  dataType: string,
  options: number = ColumnOption.notNull
): string {
  const state = createState(database);
  const table = addTable(state, {
    id: 't',
    name: 'types',
    columns: [{ name: 'value', dataType, options }],
  });

  return tableLines(state, table)[2];
}

describe('php generator', () => {
  describe('createCode', () => {
    it('writes nothing for a document without tables', () => {
      expect(createCode(createState())).toBe('');
    });

    it('opens on the tag and strict types, then each class by table name, a blank line apart', () => {
      const state = createState();
      addTable(state, {
        id: 'b',
        name: 'post',
        columns: [
          { name: 'id', dataType: 'INT', options: ColumnOption.notNull },
        ],
      });
      addTable(state, {
        id: 'a',
        name: 'member',
        columns: [
          { name: 'id', dataType: 'INT', options: ColumnOption.notNull },
        ],
      });

      expect(createCode(state).split('\n')).toEqual([
        ...HEADER,
        '',
        'class Member',
        '{',
        '    public int $id;',
        '}',
        '',
        'class Post',
        '{',
        '    public int $id;',
        '}',
        '',
      ]);
    });

    it('starts with no byte before the tag, which PHP needs for declare(strict_types=1)', () => {
      const state = createState();
      addTable(state, { id: 't', name: 'user' });

      expect(createCode(state).startsWith('<?php\n')).toBe(true);
    });
  });

  describe('createTableCode', () => {
    it('writes the header and the one class, a file of its own', () => {
      const state = createState();
      const table = addTable(state, {
        id: 't',
        name: 'user',
        columns: [{ name: 'email', dataType: 'VARCHAR(255)' }],
      });
      state.doc.tableIds = [];

      expect(createTableCode(state, table).split('\n')).toEqual([
        ...HEADER,
        '',
        'class User',
        '{',
        '    public ?string $email = null;',
        '}',
        '',
      ]);
    });
  });

  describe('formatTable', () => {
    it('applies the table and column name cases', () => {
      const state = createState();
      state.settings.tableNameCase = NameCase.snakeCase;
      state.settings.columnNameCase = NameCase.pascalCase;
      const table = addTable(state, {
        id: 't',
        name: 'OrderItem',
        columns: [{ name: 'unit_price', dataType: 'INT' }],
      });

      expect(tableLines(state, table)).toEqual([
        'class order_item',
        '{',
        '    public ?int $UnitPrice = null;',
        '}',
      ]);
    });

    it('writes a table without columns as an empty body on one line, as PER Coding Style asks', () => {
      const state = createState();
      const table = addTable(state, { id: 't', name: 'empty' });

      expect(tableLines(state, table)).toEqual(['class Empty_ {}']);
    });

    it('writes a NOT NULL column without a default and a nullable one as null', () => {
      const state = createState();
      const table = addTable(state, {
        id: 't',
        name: 'user',
        columns: [
          { name: 'id', dataType: 'INT', options: ColumnOption.primaryKey },
          {
            name: 'name',
            dataType: 'VARCHAR(20)',
            options: ColumnOption.notNull,
          },
          { name: 'nickname', dataType: 'VARCHAR(20)' },
        ],
      });

      expect(tableLines(state, table)).toEqual([
        'class User',
        '{',
        '    public int $id;',
        '    public string $name;',
        '    public ?string $nickname = null;',
        '}',
      ]);
    });

    it('writes the table comment above the class and a column comment above its property', () => {
      const state = createState();
      const table = addTable(state, {
        id: 't',
        name: 'user',
        comment: 'members',
        columns: [{ name: 'id', dataType: 'INT', comment: 'the key' }],
      });

      expect(tableLines(state, table)).toEqual([
        '/** members */',
        'class User',
        '{',
        '    /** the key */',
        '    public ?int $id = null;',
        '}',
      ]);
    });
  });

  describe('types', () => {
    it.each([
      ['INT', 'int'],
      ['BIGINT', 'int'],
      ['FLOAT', 'float'],
      ['DOUBLE', 'float'],
      ['DECIMAL(10,2)', 'string'],
      ['BOOLEAN', 'bool'],
      ['VARCHAR(255)', 'string'],
      ['TEXT', 'string'],
      ['DATE', '\\DateTimeImmutable'],
      ['DATETIME', '\\DateTimeImmutable'],
      ['TIME', 'string'],
      ['', 'string'],
    ])('maps the MySQL type %s to %s', (dataType, type) => {
      expect(propertyOf(Database.MySQL, dataType)).toBe(
        `    public ${type} $value;`
      );
    });

    it('keeps a PostgreSQL interval a string, which the shared tables file under time', () => {
      expect(propertyOf(Database.PostgreSQL, 'interval')).toBe(
        '    public string $value;'
      );
    });

    it.each([
      [Database.PostgreSQL, 'money'],
      [Database.MSSQL, 'money'],
      [Database.MSSQL, 'smallmoney'],
    ])(
      'keeps the digits of a money type in a string (database %i, %s)',
      (database, dataType) => {
        expect(propertyOf(database, dataType)).toBe(
          '    public string $value;'
        );
      }
    );

    it('reads SQL Server bit as a flag and numeric as a decimal', () => {
      expect(propertyOf(Database.MSSQL, 'bit')).toBe('    public bool $value;');
      expect(propertyOf(Database.MSSQL, 'numeric(10, 2)')).toBe(
        '    public string $value;'
      );
      expect(propertyOf(Database.MSSQL, 'int')).toBe('    public int $value;');
    });

    it.each([
      [Database.Oracle, 'NUMBER(10,2)'],
      [Database.Oracle, 'NUMBER(*,2)'],
      [Database.Oracle, 'NUMBER(2, 2)'],
      [Database.Snowflake, 'NUMBER(12,2)'],
    ])(
      'reads a NUMBER with a scale above zero as a decimal string (database %i, %s)',
      (database, dataType) => {
        expect(propertyOf(database, dataType)).toBe(
          '    public string $value;'
        );
      }
    );

    it.each(['NUMBER(10)', 'NUMBER(10,0)', 'NUMBER'])(
      'reads the Oracle %s, of no scale or scale 0, as an int',
      dataType => {
        expect(propertyOf(Database.Oracle, dataType)).toBe(
          '    public int $value;'
        );
      }
    );

    it.each(['integer[]', 'text[]', 'int[][]', 'integer[3]', 'integer ARRAY'])(
      'keeps a PostgreSQL array %s a string, the text pdo_pgsql reads',
      dataType => {
        expect(propertyOf(Database.PostgreSQL, dataType)).toBe(
          '    public string $value;'
        );
      }
    );

    it.each(['bit(8)', 'bit varying(8)', 'varbit', 'pg_lsn'])(
      'keeps the PostgreSQL %s a string, as pdo_pgsql reads it',
      dataType => {
        expect(propertyOf(Database.PostgreSQL, dataType)).toBe(
          '    public string $value;'
        );
      }
    );

    it('keeps the shared tables elsewhere for the names SQL Server reads its own way', () => {
      expect(propertyOf(Database.MySQL, 'bit')).toBe('    public int $value;');
    });
  });

  describe('baseTypeName', () => {
    it('lowers the name and drops its argument lists and extra spaces', () => {
      expect(baseTypeName('  NUMERIC( 10, 2 ) ')).toBe('numeric');
      expect(baseTypeName('interval day(2) to   second(6)')).toBe(
        'interval day to second'
      );
    });

    it('lowers an I to i under a Turkish default locale too', () => {
      underTurkishLocale(() => {
        expect(baseTypeName('TINYINT UNSIGNED')).toBe('tinyint unsigned');
        expect(baseTypeName('BIT(8)')).toBe('bit');
      });
    });
  });

  describe('toClassName', () => {
    it.each([
      ['List', 'List_'],
      ['MATCH', 'MATCH_'],
      ['object', 'object_'],
      ['Readonly', 'Readonly_'],
      ['Self', 'Self_'],
      ['__Property__', '__Property___'],
      ['_', '__'],
    ])(
      'adds an underscore to %s, which PHP refuses for a class',
      (name, expected) => {
        expect(toClassName(name)).toBe(expected);
      }
    );

    it.each(['Enum', 'Resource', 'Numeric', 'Listing', 'Order'])(
      'keeps %s, which PHP takes for a class',
      name => {
        expect(toClassName(name)).toBe(name);
      }
    );
  });

  describe('formatDocComment', () => {
    function commentOf(comment: string, indent = ''): string[] {
      const buffer: string[] = [];

      formatDocComment(buffer, indent, comment);
      return buffer;
    }

    it('writes nothing for a blank comment', () => {
      expect(commentOf('')).toEqual([]);
      expect(commentOf('  \n \r\n ')).toEqual([]);
    });

    it('writes one line as a one-line block, trimmed', () => {
      expect(commentOf('  members  ', '    ')).toEqual(['    /** members */']);
    });

    it('writes several lines as a block, the blank lines around it dropped and those inside kept', () => {
      expect(commentOf('\nfirst  \r\n\rthird\n\n', '    ')).toEqual([
        '    /**',
        '     * first',
        '     *',
        '     * third',
        '     */',
      ]);
    });

    it('breaks a star and a slash that would close the block early', () => {
      expect(commentOf('a */ b')).toEqual(['/** a *\\/ b */']);
    });

    it('keeps a ?> as written, which a block comment does not end on', () => {
      expect(commentOf('a ?> b')).toEqual(['/** a ?> b */']);
    });
  });
});
