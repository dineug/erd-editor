import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  BracketType,
  ColumnOption,
  Database,
  NameCase,
  ReferentialAction,
  RelationshipType,
} from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { createIndex } from '@/utils/collection/index.entity';
import { createIndexColumn } from '@/utils/collection/indexColumn.entity';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createCode, createTableCode } from '@/utils/generator-code/doctrine';

type ColumnInput = {
  name: string;
  dataType?: string;
  comment?: string;
  default?: string;
  options?: number;
};

type TableInput = {
  id: string;
  name: string;
  comment?: string;
  columns?: ColumnInput[];
};

type RelationshipInput = {
  id: string;
  start: [tableId: string, columnIndexes: number[]];
  end: [tableId: string, columnIndexes: number[]];
  relationshipType?: number;
  onDelete?: number;
  onUpdate?: number;
};

const PK = ColumnOption.primaryKey | ColumnOption.notNull;
const NN = ColumnOption.notNull;
const AI = ColumnOption.autoIncrement;

const HEADER = ['<?php', '', 'declare(strict_types=1);', ''];
const USE_COLLECTIONS = [
  'use Doctrine\\Common\\Collections\\ArrayCollection;',
  'use Doctrine\\Common\\Collections\\Collection;',
];
const USE_TYPES = 'use Doctrine\\DBAL\\Types\\Types;';
const USE_ORM = 'use Doctrine\\ORM\\Mapping as ORM;';

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
      id: `${id}.${index}`,
      tableId: id,
      name: column.name,
      dataType: column.dataType ?? '',
      comment: column.comment ?? '',
      default: column.default ?? '',
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

function addRelationship(
  state: RootState,
  {
    id,
    start,
    end,
    relationshipType = RelationshipType.ZeroN,
    onDelete = ReferentialAction.none,
    onUpdate = ReferentialAction.none,
  }: RelationshipInput
) {
  state.collections.relationshipEntities[id] = createRelationship({
    id,
    relationshipType,
    onDelete,
    onUpdate,
    start: {
      tableId: start[0],
      columnIds: start[1].map(index => `${start[0]}.${index}`),
    },
    end: {
      tableId: end[0],
      columnIds: end[1].map(index => `${end[0]}.${index}`),
    },
  });
  state.doc.relationshipIds.push(id);
}

function addIndex(
  state: RootState,
  id: string,
  tableId: string,
  name: string,
  unique: boolean,
  columnIds: string[]
) {
  const indexColumns = columnIds.map((columnId, index) =>
    createIndexColumn({ id: `${id}.${index}`, indexId: id, columnId })
  );
  state.collections.indexEntities[id] = createIndex({
    id,
    tableId,
    name,
    unique,
    indexColumnIds: indexColumns.map(indexColumn => indexColumn.id),
  });
  indexColumns.forEach(indexColumn => {
    state.collections.indexColumnEntities[indexColumn.id] = indexColumn;
  });
  state.doc.indexIds.push(id);
}

/** The lines of the class a table writes, from its first attribute to its brace. */
function classOf(state: RootState, table: Table): string[] {
  const lines = createTableCode(state, table).split('\n');

  return lines.slice(lines.indexOf('#[ORM\\Entity]'), -1);
}

/** The member a property line closes, from its first attribute down. */
function memberOf(lines: string[], property: string): string[] {
  const end = lines.findIndex(
    line => line.endsWith(` $${property};`) || line.includes(` $${property} = `)
  );
  let start = end;

  while (start > 0 && lines[start - 1] !== '' && lines[start - 1] !== '{') {
    start -= 1;
  }
  return lines.slice(start, end + 1);
}

function columnOf(
  database: number,
  dataType: string,
  options: number = NN
): string[] {
  const state = createState(database);
  const table = addTable(state, {
    id: 't',
    name: 'types',
    columns: [
      { name: 'id', dataType: 'INT', options: PK },
      { name: 'value', dataType, options },
    ],
  });

  return memberOf(classOf(state, table), 'value');
}

/** The Table attribute a lone table of this name writes. */
function tableLineOf(
  database: number,
  name: string,
  bracketType: number = BracketType.none
): string | undefined {
  const state = createState(database);
  state.settings.bracketType = bracketType;
  addTable(state, { id: 't', name });

  return createCode(state)
    .split('\n')
    .find(line => line.startsWith('#[ORM\\Table'));
}

function createShop(database: number = Database.MySQL): RootState {
  const state = createState(database);

  addTable(state, {
    id: 'u',
    name: 'user',
    columns: [
      { name: 'id', dataType: 'BIGINT', options: PK | AI },
      { name: 'email', dataType: 'VARCHAR(191)', options: NN },
    ],
  });
  addTable(state, {
    id: 'o',
    name: 'orders',
    columns: [
      { name: 'id', dataType: 'INT', options: PK | AI },
      { name: 'user_id', dataType: 'BIGINT', options: NN },
      { name: 'buyer_id', dataType: 'BIGINT' },
    ],
  });
  addRelationship(state, {
    id: 'r1',
    start: ['u', [0]],
    end: ['o', [1]],
    onDelete: ReferentialAction.cascade,
    onUpdate: ReferentialAction.cascade,
  });
  addRelationship(state, { id: 'r2', start: ['u', [0]], end: ['o', [2]] });

  return state;
}

describe('doctrine generator', () => {
  describe('createCode', () => {
    it('writes nothing for a document without tables', () => {
      expect(createCode(createState())).toBe('');
    });

    it('opens on the tag, then the use statements the entities need, then each entity by table name', () => {
      const state = createShop();

      expect(createCode(state).split('\n')).toEqual([
        ...HEADER,
        ...USE_COLLECTIONS,
        USE_TYPES,
        USE_ORM,
        '',
        '#[ORM\\Entity]',
        "#[ORM\\Table(name: 'orders')]",
        'class Orders',
        '{',
        '    #[ORM\\Id]',
        '    #[ORM\\GeneratedValue]',
        "    #[ORM\\Column(name: 'id', type: Types::INTEGER)]",
        '    public ?int $id = null;',
        '',
        "    #[ORM\\ManyToOne(targetEntity: User::class, inversedBy: 'ordersList')]",
        "    #[ORM\\JoinColumn(name: 'user_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]",
        '    public User $user;',
        '',
        "    #[ORM\\ManyToOne(targetEntity: User::class, inversedBy: 'ordersList2')]",
        "    #[ORM\\JoinColumn(name: 'buyer_id', referencedColumnName: 'id')]",
        '    public ?User $user2 = null;',
        '}',
        '',
        '#[ORM\\Entity]',
        "#[ORM\\Table(name: '`user`')]",
        'class User',
        '{',
        '    #[ORM\\Id]',
        '    #[ORM\\GeneratedValue]',
        "    #[ORM\\Column(name: 'id', type: Types::BIGINT)]",
        '    public ?int $id = null;',
        '',
        "    #[ORM\\Column(name: 'email', type: Types::STRING, length: 191)]",
        '    public string $email;',
        '',
        '    /** @var Collection<int, Orders> */',
        "    #[ORM\\OneToMany(targetEntity: Orders::class, mappedBy: 'user')]",
        '    public Collection $ordersList;',
        '',
        '    /** @var Collection<int, Orders> */',
        "    #[ORM\\OneToMany(targetEntity: Orders::class, mappedBy: 'user2')]",
        '    public Collection $ordersList2;',
        '',
        '    public function __construct()',
        '    {',
        '        $this->ordersList = new ArrayCollection();',
        '        $this->ordersList2 = new ArrayCollection();',
        '    }',
        '}',
        '',
      ]);
    });

    it('imports only the ORM attributes for entities with no column and no collection', () => {
      const state = createState();
      addTable(state, { id: 't', name: 'empty' });

      expect(createCode(state).split('\n')).toEqual([
        ...HEADER,
        USE_ORM,
        '',
        '#[ORM\\Entity]',
        "#[ORM\\Table(name: '`empty`')]",
        'class Empty_ {}',
        '',
      ]);
    });
  });

  describe('createTableCode', () => {
    it('imports what the one entity needs, a table outside the document included', () => {
      const state = createShop();
      const orders = state.collections.tableEntities.o;
      state.doc.tableIds = ['u'];

      expect(createTableCode(state, orders).split('\n').slice(0, 8)).toEqual([
        ...HEADER,
        USE_TYPES,
        USE_ORM,
        '',
        '#[ORM\\Entity]',
      ]);
    });

    it('names the properties as the whole document does, so both sides of an association agree', () => {
      const state = createShop();
      const user = state.collections.tableEntities.u;

      expect(memberOf(classOf(state, user), 'ordersList2')).toEqual([
        '    /** @var Collection<int, Orders> */',
        "    #[ORM\\OneToMany(targetEntity: Orders::class, mappedBy: 'user2')]",
        '    public Collection $ordersList2;',
      ]);
    });
  });

  describe('columns', () => {
    it('writes the name and type of every column, its length, its uniqueness and a nullable one as null', () => {
      const state = createState();
      state.settings.columnNameCase = NameCase.camelCase;
      const table = addTable(state, {
        id: 't',
        name: 'user',
        comment: 'members',
        columns: [
          { name: 'id', dataType: 'INT', options: PK | ColumnOption.unique },
          {
            name: 'nick_name',
            dataType: 'VARCHAR(20)',
            options: ColumnOption.unique,
          },
        ],
      });

      expect(classOf(state, table)).toEqual([
        '#[ORM\\Entity]',
        "#[ORM\\Table(name: '`user`', options: ['comment' => 'members'])]",
        'class User',
        '{',
        '    #[ORM\\Id]',
        "    #[ORM\\Column(name: 'id', type: Types::INTEGER)]",
        '    public int $id;',
        '',
        "    #[ORM\\Column(name: 'nick_name', type: Types::STRING, length: 20, unique: true, nullable: true)]",
        '    public ?string $nickName = null;',
        '}',
      ]);
    });

    it('generates the value of a single column key alone, never of a part of a composite one', () => {
      const state = createState();
      const table = addTable(state, {
        id: 't',
        name: 'pair',
        columns: [
          { name: 'a', dataType: 'INT', options: PK | AI },
          { name: 'b', dataType: 'INT', options: PK },
        ],
      });

      expect(memberOf(classOf(state, table), 'a')).toEqual([
        '    #[ORM\\Id]',
        "    #[ORM\\Column(name: 'a', type: Types::INTEGER)]",
        '    public int $a;',
      ]);
    });

    it('wraps an attribute past the line limit one argument a line, each with its comma', () => {
      const state = createState();
      const table = addTable(state, {
        id: 't',
        name: 'user',
        columns: [
          {
            name: 'email',
            dataType: 'VARCHAR(191)',
            options: NN,
            comment: 'where the receipts and the password resets are sent',
          },
        ],
      });

      expect(memberOf(classOf(state, table), 'email')).toEqual([
        '    #[ORM\\Column(',
        "        name: 'email',",
        '        type: Types::STRING,',
        '        length: 191,',
        "        options: ['comment' => 'where the receipts and the password resets are sent'],",
        '    )]',
        '    public string $email;',
      ]);
    });

    it('keeps an attribute of one argument on one line however long', () => {
      const state = createState();
      const name = 'x'.repeat(130);
      addTable(state, { id: 't', name });

      expect(createCode(state)).toContain(`#[ORM\\Table(name: '${name}')]`);
    });

    it('quotes a name in single quotes, escaping its quotes and backslashes', () => {
      expect(columnOf(Database.MySQL, 'INT', NN).join('\n')).toContain(
        "name: 'value'"
      );

      const state = createState();
      addTable(state, { id: 't', name: "it's\\" });

      expect(createCode(state)).toContain(
        "#[ORM\\Table(name: '`it\\'s\\\\`')]"
      );
    });

    it('writes a text holding a line break in double quotes, with the break, quote, dollar and backslash escaped', () => {
      const state = createState();
      addTable(state, {
        id: 't',
        name: 'memo',
        comment: 'a "b"\r\n$c\\d',
      });

      expect(createCode(state)).toContain(
        `#[ORM\\Table(name: 'memo', options: ['comment' => "a \\"b\\"\\r\\n\\$c\\\\d"])]`
      );
    });
  });

  describe('types', () => {
    it.each([
      ['INT', 'INTEGER', 'int', ''],
      ['BIGINT', 'BIGINT', 'int', ''],
      ['SMALLINT', 'SMALLINT', 'int', ''],
      ['TINYINT', 'SMALLINT', 'int', ''],
      ['FLOAT', 'SMALLFLOAT', 'float', ''],
      ['FLOAT(53)', 'FLOAT', 'float', ''],
      ['FLOAT(30,2)', 'SMALLFLOAT', 'float', ''],
      ['FLOAT(25)', 'FLOAT', 'float', ''],
      ['REAL', 'FLOAT', 'float', ''],
      ['DOUBLE', 'FLOAT', 'float', ''],
      ['DECIMAL(10,2)', 'DECIMAL', 'string', ', precision: 10, scale: 2'],
      ['DECIMAL(5)', 'DECIMAL', 'string', ', precision: 5'],
      ['DECIMAL', 'DECIMAL', 'string', ', precision: 10, scale: 0'],
      ['BOOLEAN', 'BOOLEAN', 'bool', ''],
      ['VARCHAR(255)', 'STRING', 'string', ', length: 255'],
      ['VARCHAR', 'STRING', 'string', ''],
      ['TINYTEXT', 'TEXT', 'string', ', length: 255'],
      ['TEXT', 'TEXT', 'string', ', length: 65535'],
      ['TEXT(63)', 'TEXT', 'string', ', length: 255'],
      ['TEXT(1000)', 'TEXT', 'string', ', length: 65535'],
      ['TEXT(16384)', 'TEXT', 'string', ', length: 16777215'],
      ['TEXT(4194304)', 'TEXT', 'string', ''],
      ['LONG', 'TEXT', 'string', ', length: 16777215'],
      ['LONG VARCHAR', 'TEXT', 'string', ', length: 16777215'],
      ['MEDIUMTEXT', 'TEXT', 'string', ', length: 16777215'],
      ['LONGTEXT', 'TEXT', 'string', ''],
      ['JSON', 'JSON', 'array', ''],
      ['BLOB', 'BLOB', 'mixed', ', length: 65535'],
      ['BLOB(100)', 'BLOB', 'mixed', ', length: 100'],
      ['LONGBLOB', 'BLOB', 'mixed', ''],
      ['LONG VARBINARY', 'BLOB', 'mixed', ', length: 16777215'],
      ['VARBINARY(16)', 'BINARY', 'string', ', length: 16'],
      [
        'CHAR(10) BYTE',
        'BINARY',
        'string',
        ", length: 10, options: ['fixed' => true]",
      ],
      [
        'NATIONAL VARCHAR(100)',
        'STRING',
        'string',
        ", length: 100, options: ['charset' => 'utf8mb3']",
      ],
      [
        'NCHAR VARCHAR(1000)',
        'STRING',
        'string',
        ", length: 1000, options: ['charset' => 'utf8mb3']",
      ],
      [
        'NCHAR',
        'STRING',
        'string',
        ", length: 1, options: ['fixed' => true, 'charset' => 'utf8mb3']",
      ],
      ['TEXT(0)', 'TEXT', 'string', ', length: 255'],
      ['BLOB(0)', 'BLOB', 'mixed', ', length: 255'],
      ['LONG CHAR VARYING', 'TEXT', 'string', ', length: 16777215'],
      ['VARCHARACTER(50)', 'STRING', 'string', ', length: 50'],
      ['DATE', 'DATE_IMMUTABLE', '\\DateTimeImmutable', ''],
      ['DATETIME', 'DATETIME_IMMUTABLE', '\\DateTimeImmutable', ''],
      ['TIMESTAMP', 'DATETIME_IMMUTABLE', '\\DateTimeImmutable', ''],
      ['TIME', 'TIME_IMMUTABLE', '\\DateTimeImmutable', ''],
      ['', 'STRING', 'string', ''],
    ])(
      'maps the MySQL type %s to Types::%s and %s',
      (dataType, type, php, args) => {
        expect(columnOf(Database.MySQL, dataType)).toEqual([
          `    #[ORM\\Column(name: 'value', type: Types::${type}${args})]`,
          `    public ${php} $value;`,
        ]);
      }
    );

    it.each([
      ['uuid', 'GUID'],
      ['timestamptz', 'DATETIMETZ_IMMUTABLE'],
      ['timetz', 'TIME_IMMUTABLE'],
      ['time with time zone', 'TIME_IMMUTABLE'],
      ['bytea', 'BLOB'],
      ['jsonb', 'JSON'],
      ['int2', 'SMALLINT'],
    ])('maps the PostgreSQL type %s to Types::%s', (dataType, type) => {
      expect(columnOf(Database.PostgreSQL, dataType)[0]).toContain(
        `type: Types::${type}`
      );
    });

    it('keeps a PostgreSQL interval a string, a duration being no time of day', () => {
      expect(columnOf(Database.PostgreSQL, 'interval')).toEqual([
        "    #[ORM\\Column(name: 'value', type: Types::STRING)]",
        '    public string $value;',
      ]);
    });

    it.each([
      [Database.PostgreSQL, 'money', 19, 2],
      [Database.MSSQL, 'money', 19, 4],
      [Database.MSSQL, 'smallmoney', 10, 4],
    ])(
      'gives a money type its vendor digits (database %i, %s)',
      (database, dataType, precision, scale) => {
        expect(columnOf(database, dataType)[0]).toBe(
          `    #[ORM\\Column(name: 'value', type: Types::DECIMAL, precision: ${precision}, scale: ${scale})]`
        );
      }
    );

    it.each([
      ['bit', 'BOOLEAN', 'bool'],
      ['numeric(10, 2)', 'DECIMAL', 'string'],
      ['uniqueidentifier', 'GUID', 'string'],
      ['datetimeoffset', 'DATETIMETZ_IMMUTABLE', '\\DateTimeImmutable'],
      ['datetime', 'DATETIME_IMMUTABLE', '\\DateTimeImmutable'],
      ['smalldatetime', 'DATETIME_IMMUTABLE', '\\DateTimeImmutable'],
    ])('reads the SQL Server type %s as Types::%s', (dataType, type, php) => {
      const [attribute, property] = columnOf(Database.MSSQL, dataType);

      expect(attribute).toContain(`type: Types::${type}`);
      expect(property).toBe(`    public ${php} $value;`);
    });

    it('writes a nullable blob as mixed, which takes null without a question mark', () => {
      expect(columnOf(Database.MySQL, 'LONGBLOB', 0)).toEqual([
        "    #[ORM\\Column(name: 'value', type: Types::BLOB, nullable: true)]",
        '    public mixed $value = null;',
      ]);
    });
  });

  describe('associations', () => {
    it('writes a one-to-one on both sides, each naming the other', () => {
      const state = createState();
      const user = addTable(state, {
        id: 'u',
        name: 'user',
        columns: [{ name: 'id', dataType: 'INT', options: PK | AI }],
      });
      const profile = addTable(state, {
        id: 'p',
        name: 'profile',
        columns: [
          { name: 'id', dataType: 'INT', options: PK | AI },
          { name: 'user_id', dataType: 'INT' },
        ],
      });
      addRelationship(state, {
        id: 'r',
        start: ['u', [0]],
        end: ['p', [1]],
        relationshipType: RelationshipType.ZeroOne,
      });

      expect(memberOf(classOf(state, profile), 'user')).toEqual([
        "    #[ORM\\OneToOne(targetEntity: User::class, inversedBy: 'profile')]",
        "    #[ORM\\JoinColumn(name: 'user_id', referencedColumnName: 'id')]",
        '    public ?User $user = null;',
      ]);
      expect(memberOf(classOf(state, user), 'profile')).toEqual([
        "    #[ORM\\OneToOne(targetEntity: Profile::class, mappedBy: 'user')]",
        '    public ?Profile $profile = null;',
      ]);
    });

    it('names a self reference after its parent and numbers a second one', () => {
      const state = createState();
      const employee = addTable(state, {
        id: 'e',
        name: 'employee',
        columns: [
          { name: 'id', dataType: 'INT', options: PK | AI },
          { name: 'manager_id', dataType: 'INT' },
          { name: 'mentor_id', dataType: 'INT' },
        ],
      });
      addRelationship(state, { id: 'r1', start: ['e', [0]], end: ['e', [1]] });
      addRelationship(state, { id: 'r2', start: ['e', [0]], end: ['e', [2]] });

      const lines = classOf(state, employee);

      expect(memberOf(lines, 'parentEmployee2')).toEqual([
        "    #[ORM\\ManyToOne(targetEntity: Employee::class, inversedBy: 'employeeList2')]",
        "    #[ORM\\JoinColumn(name: 'mentor_id', referencedColumnName: 'id')]",
        '    public ?Employee $parentEmployee2 = null;',
      ]);
      expect(memberOf(lines, 'employeeList2')).toContain(
        "    #[ORM\\OneToMany(targetEntity: Employee::class, mappedBy: 'parentEmployee2')]"
      );
    });

    it('writes a join column for each pair of a composite key', () => {
      const state = createState();
      addTable(state, {
        id: 'a',
        name: 'account',
        columns: [
          { name: 'region', dataType: 'INT', options: PK },
          { name: 'no', dataType: 'INT', options: PK },
        ],
      });
      const entry = addTable(state, {
        id: 'e',
        name: 'entry',
        columns: [
          { name: 'id', dataType: 'INT', options: PK | AI },
          { name: 'account_region', dataType: 'INT', options: NN },
          { name: 'account_no', dataType: 'INT', options: NN },
        ],
      });
      addRelationship(state, {
        id: 'r',
        start: ['a', [0, 1]],
        end: ['e', [1, 2]],
      });

      expect(memberOf(classOf(state, entry), 'account')).toEqual([
        "    #[ORM\\ManyToOne(targetEntity: Account::class, inversedBy: 'entryList')]",
        "    #[ORM\\JoinColumn(name: 'account_region', referencedColumnName: 'region', nullable: false)]",
        "    #[ORM\\JoinColumn(name: '`account_no`', referencedColumnName: '`no`', nullable: false)]",
        '    public Account $account;',
      ]);
    });

    it.each([
      [Database.MySQL, ReferentialAction.restrict, "onDelete: 'RESTRICT'"],
      [Database.MSSQL, ReferentialAction.restrict, null],
      [Database.Oracle, ReferentialAction.setNull, "onDelete: 'SET NULL'"],
      [Database.Oracle, ReferentialAction.noAction, null],
      [
        Database.PostgreSQL,
        ReferentialAction.setDefault,
        "onDelete: 'SET DEFAULT'",
      ],
    ])(
      'writes ON DELETE where the database takes it (database %i, action %i)',
      (database, onDelete, expected) => {
        const state = createState(database);
        addTable(state, {
          id: 'p',
          name: 'parent',
          columns: [{ name: 'id', dataType: 'INT', options: PK }],
        });
        const child = addTable(state, {
          id: 'c',
          name: 'child',
          columns: [
            { name: 'id', dataType: 'INT', options: PK },
            { name: 'parent_id', dataType: 'INT' },
          ],
        });
        addRelationship(state, {
          id: 'r',
          start: ['p', [0]],
          end: ['c', [1]],
          onDelete,
          onUpdate: ReferentialAction.cascade,
        });

        const joinColumn = memberOf(classOf(state, child), 'parent')[1];

        expect(joinColumn).not.toContain('onUpdate');
        if (expected) {
          expect(joinColumn).toContain(expected);
        } else {
          expect(joinColumn).not.toContain('onDelete');
        }
      }
    );

    it('keeps the foreign key a column where the relationship cannot be mapped', () => {
      const state = createState();
      addTable(state, {
        id: 'p',
        name: 'parent',
        columns: [{ name: 'id', dataType: 'INT', options: PK }],
      });
      const child = addTable(state, {
        id: 'c',
        name: 'child',
        columns: [
          { name: 'id', dataType: 'INT', options: PK },
          { name: 'parent_id', dataType: 'INT' },
          { name: 'other_id', dataType: 'INT' },
        ],
      });
      addRelationship(state, {
        id: 'unknown-type',
        start: ['p', [0]],
        end: ['c', [1]],
        relationshipType: 1,
      });
      addRelationship(state, {
        id: 'missing',
        start: ['p', [0]],
        end: ['c', [9]],
      });
      addRelationship(state, {
        id: 'uneven',
        start: ['p', [0]],
        end: ['c', [1, 2]],
      });
      addTable(state, {
        id: 'q',
        name: 'removed_from',
        columns: [{ name: 'id', dataType: 'INT', options: PK }],
      });
      state.collections.tableEntities.q.columnIds = [];
      addRelationship(state, {
        id: 'outside',
        start: ['q', [0]],
        end: ['c', [2]],
      });

      const lines = classOf(state, child);

      expect(lines.filter(line => line.includes('ORM\\ManyToOne'))).toEqual([]);
      expect(memberOf(lines, 'parentId')).toEqual([
        "    #[ORM\\Column(name: 'parent_id', type: Types::INTEGER, nullable: true)]",
        '    public ?int $parentId = null;',
      ]);
    });
  });

  describe('keys through an association', () => {
    function createOrders(): RootState {
      const state = createState();

      addTable(state, {
        id: 'o',
        name: 'orders',
        columns: [{ name: 'id', dataType: 'INT', options: PK | AI }],
      });
      addTable(state, {
        id: 'i',
        name: 'order_item',
        columns: [
          { name: 'order_id', dataType: 'INT', options: PK },
          { name: 'item_no', dataType: 'INT', options: PK },
        ],
      });
      addTable(state, {
        id: 'x',
        name: 'order_item_option',
        columns: [
          { name: 'order_id', dataType: 'INT', options: PK },
          { name: 'item_no', dataType: 'INT', options: PK },
          { name: 'option_no', dataType: 'INT', options: PK },
        ],
      });
      addRelationship(state, { id: 'r1', start: ['o', [0]], end: ['i', [0]] });
      addRelationship(state, {
        id: 'r2',
        start: ['i', [0, 1]],
        end: ['x', [0, 1]],
      });

      return state;
    }

    it('makes the association the key toward a parent keyed by one column of its own', () => {
      const state = createOrders();
      const lines = classOf(state, state.collections.tableEntities.i);

      expect(lines.join('\n')).not.toContain('$orderId');
      expect(memberOf(lines, 'orders')).toEqual([
        '    #[ORM\\Id]',
        "    #[ORM\\ManyToOne(targetEntity: Orders::class, inversedBy: 'orderItemList')]",
        "    #[ORM\\JoinColumn(name: 'order_id', referencedColumnName: 'id', nullable: false)]",
        '    public Orders $orders;',
      ]);
    });

    it('keeps the key columns identifier fields toward a parent with a composite key', () => {
      const state = createOrders();
      const lines = classOf(state, state.collections.tableEntities.x);

      expect(memberOf(lines, 'orderId')).toEqual([
        '    #[ORM\\Id]',
        "    #[ORM\\Column(name: 'order_id', type: Types::INTEGER)]",
        '    public int $orderId;',
      ]);
      expect(memberOf(lines, 'orderItem')).toEqual([
        "    #[ORM\\ManyToOne(targetEntity: OrderItem::class, inversedBy: 'orderItemOptionList')]",
        "    #[ORM\\JoinColumn(name: 'order_id', referencedColumnName: 'order_id', nullable: false)]",
        "    #[ORM\\JoinColumn(name: 'item_no', referencedColumnName: 'item_no', nullable: false)]",
        '    public OrderItem $orderItem;',
      ]);
    });

    it('keeps the key column a field toward a parent whose one key column comes through an association', () => {
      const state = createState();
      addTable(state, {
        id: 'u',
        name: 'user',
        columns: [{ name: 'id', dataType: 'INT', options: PK | AI }],
      });
      addTable(state, {
        id: 'p',
        name: 'profile',
        columns: [{ name: 'user_id', dataType: 'INT', options: PK }],
      });
      const extension = addTable(state, {
        id: 'e',
        name: 'profile_ext',
        columns: [{ name: 'user_id', dataType: 'INT', options: PK }],
      });
      addRelationship(state, {
        id: 'r1',
        start: ['u', [0]],
        end: ['p', [0]],
        relationshipType: RelationshipType.OneOnly,
      });
      addRelationship(state, {
        id: 'r2',
        start: ['p', [0]],
        end: ['e', [0]],
        relationshipType: RelationshipType.OneOnly,
      });

      const lines = classOf(state, extension);

      expect(memberOf(lines, 'userId')[0]).toBe('    #[ORM\\Id]');
      expect(memberOf(lines, 'profile')[0]).toBe(
        "    #[ORM\\OneToOne(targetEntity: Profile::class, inversedBy: 'profileExt')]"
      );
    });
  });

  describe('SQL names', () => {
    function createLines(bracketType: number): string {
      const state = createState(Database.PostgreSQL);
      state.settings.bracketType = bracketType;
      addTable(state, {
        id: 'p',
        name: 'Order',
        columns: [{ name: 'id', dataType: 'INT', options: PK }],
      });
      addTable(state, {
        id: 'c',
        name: 'line_item',
        columns: [
          { name: 'id', dataType: 'INT', options: PK },
          { name: 'order_id', dataType: 'INT', options: NN },
          { name: 'unit price', dataType: 'INT', options: NN },
        ],
      });
      addRelationship(state, { id: 'r', start: ['p', [0]], end: ['c', [1]] });

      return createCode(state);
    }

    it('marks a reserved word in any case and a name of other characters with backticks, which a query needs', () => {
      const code = createLines(BracketType.none);

      expect(code).toContain("#[ORM\\Table(name: '`order`')]");
      expect(code).toContain("#[ORM\\Table(name: 'line_item')]");
      expect(code).toContain(
        "#[ORM\\Column(name: '`unit price`', type: Types::INTEGER)]"
      );
      expect(code).toContain(
        "#[ORM\\JoinColumn(name: 'order_id', referencedColumnName: 'id', nullable: false)]"
      );
    });

    it.each([
      BracketType.doubleQuote,
      BracketType.singleQuote,
      BracketType.backtick,
    ])(
      'marks every name where the document quotes its names (bracket type %i)',
      bracketType => {
        const code = createLines(bracketType);

        expect(code).toContain("#[ORM\\Table(name: '`line_item`')]");
        expect(code).toContain(
          "#[ORM\\Column(name: '`id`', type: Types::INTEGER)]"
        );
        expect(code).toContain(
          "#[ORM\\JoinColumn(name: '`order_id`', referencedColumnName: '`id`', nullable: false)]"
        );
      }
    );
  });

  describe('table names with a dot', () => {
    it.each([
      ['sales.users', "#[ORM\\Table(name: 'users', schema: 'sales')]"],
      ['[sales].[users]', "#[ORM\\Table(name: '`users`', schema: 'sales')]"],
      ['shop.sales.users', "#[ORM\\Table(name: 'users', schema: 'sales')]"],
      ['Sales.Users', "#[ORM\\Table(name: 'users', schema: 'sales')]"],
      ['sales.order', "#[ORM\\Table(name: '`order`', schema: 'sales')]"],
      ['my shop.users', "#[ORM\\Table(name: '`users`', schema: 'my shop')]"],
    ])(
      'writes %s as its schema and its table, backticks on the table alone',
      (name, expected) => {
        expect(tableLineOf(Database.PostgreSQL, name)).toBe(expected);
      }
    );

    it('splits a dotted name where the document quotes names too, which Doctrine always does', () => {
      expect(
        tableLineOf(Database.PostgreSQL, 'sales.users', BracketType.doubleQuote)
      ).toBe("#[ORM\\Table(name: '`users`', schema: 'sales')]");
    });
  });

  describe('lengths', () => {
    it.each([
      [Database.MySQL, 'CHAR(2)', 'STRING, length: 2'],
      [Database.MySQL, 'BINARY(16)', 'BINARY, length: 16'],
      [Database.MSSQL, 'nchar(10)', 'STRING, length: 10'],
    ])(
      'marks a fixed length type fixed (database %i, %s)',
      (database, dataType, type) => {
        expect(columnOf(database, dataType)[0]).toBe(
          `    #[ORM\\Column(name: 'value', type: Types::${type}, options: ['fixed' => true])]`
        );
      }
    );

    it('writes the fixed flag and the comment in one options array', () => {
      const state = createState();
      const table = addTable(state, {
        id: 't',
        name: 'country',
        columns: [
          { name: 'code', dataType: 'CHAR(2)', options: PK, comment: 'ISO' },
        ],
      });

      expect(memberOf(classOf(state, table), 'code')).toContain(
        "    #[ORM\\Column(name: 'code', type: Types::STRING, length: 2, options: ['fixed' => true, 'comment' => 'ISO'])]"
      );
    });

    it.each([
      [Database.Snowflake, 'BINARY', 'BLOB', 'mixed'],
      [Database.MSSQL, 'varbinary(max)', 'BLOB', 'mixed'],
      [Database.MSSQL, 'varchar(max)', 'TEXT', 'string'],
    ])(
      'gives a type without a length DBAL 4 can write an unbounded one (database %i, %s)',
      (database, dataType, type, php) => {
        expect(columnOf(database, dataType)).toEqual([
          `    #[ORM\\Column(name: 'value', type: Types::${type})]`,
          `    public ${php} $value;`,
        ]);
      }
    );

    it('keeps a length-less PostgreSQL varchar a STRING, which ORM writes as VARCHAR(255)', () => {
      expect(columnOf(Database.PostgreSQL, 'varchar')).toEqual([
        "    #[ORM\\Column(name: 'value', type: Types::STRING)]",
        '    public string $value;',
      ]);
    });

    it.each([
      [Database.MySQL, 'BINARY', ", options: ['fixed' => true]"],
      [Database.MariaDB, 'CHAR BYTE', ", options: ['fixed' => true]"],
      [Database.MSSQL, 'binary', ", options: ['fixed' => true]"],
      [Database.MSSQL, 'varbinary', ''],
    ])(
      'gives a bare binary the one byte the database makes it (database %i, %s)',
      (database, dataType, options) => {
        expect(columnOf(database, dataType)).toEqual([
          `    #[ORM\\Column(name: 'value', type: Types::BINARY, length: 1${options})]`,
          '    public string $value;',
        ]);
      }
    );

    it.each([
      ['rowversion', NN],
      ['timestamp', NN],
      ['rowversion', 0],
    ])(
      'maps the SQL Server %s as eight bytes the database writes, never NULL (options %i)',
      (dataType, options) => {
        expect(columnOf(Database.MSSQL, dataType, options)).toEqual([
          '    #[ORM\\Column(',
          "        name: 'value',",
          '        type: Types::BINARY,',
          '        length: 8,',
          '        insertable: false,',
          '        updatable: false,',
          "        columnDefinition: 'ROWVERSION NOT NULL',",
          "        generated: 'ALWAYS',",
          '    )]',
          '    public ?string $value = null;',
        ]);
      }
    );
  });

  describe('generated keys', () => {
    it('generates no value for a key Doctrine cannot number, a uuid', () => {
      const state = createState(Database.PostgreSQL);
      const table = addTable(state, {
        id: 't',
        name: 'token',
        columns: [{ name: 'id', dataType: 'uuid', options: PK | AI }],
      });

      expect(memberOf(classOf(state, table), 'id')).toEqual([
        '    #[ORM\\Id]',
        "    #[ORM\\Column(name: 'id', type: Types::GUID)]",
        '    public string $id;',
      ]);
    });

    it('keys a link table by both associations and generates nothing', () => {
      const state = createState();
      addTable(state, {
        id: 'a',
        name: 'actor',
        columns: [{ name: 'id', dataType: 'INT', options: PK | AI }],
      });
      addTable(state, {
        id: 'f',
        name: 'film',
        columns: [{ name: 'id', dataType: 'INT', options: PK | AI }],
      });
      const link = addTable(state, {
        id: 'l',
        name: 'film_actor',
        columns: [
          { name: 'actor_id', dataType: 'INT', options: PK | AI },
          { name: 'film_id', dataType: 'INT', options: PK },
        ],
      });
      addRelationship(state, { id: 'r1', start: ['a', [0]], end: ['l', [0]] });
      addRelationship(state, { id: 'r2', start: ['f', [0]], end: ['l', [1]] });

      const lines = classOf(state, link);

      expect(lines).not.toContain('    #[ORM\\GeneratedValue]');
      expect(lines.filter(line => line.startsWith('    public '))).toEqual([
        '    public Actor $actor;',
        '    public Film $film;',
      ]);
      expect(memberOf(lines, 'film')).toEqual([
        '    #[ORM\\Id]',
        "    #[ORM\\ManyToOne(targetEntity: Film::class, inversedBy: 'filmActorList')]",
        "    #[ORM\\JoinColumn(name: 'film_id', referencedColumnName: 'id', nullable: false)]",
        '    public Film $film;',
      ]);
    });

    it('maps no association toward a column of its parent other than the key, which Doctrine cannot join on', () => {
      const state = createState();
      addTable(state, {
        id: 'b',
        name: 'brand',
        columns: [
          { name: 'id', dataType: 'INT', options: PK | AI },
          {
            name: 'code',
            dataType: 'VARCHAR(10)',
            options: NN | ColumnOption.unique,
          },
        ],
      });
      const product = addTable(state, {
        id: 'p',
        name: 'product',
        columns: [{ name: 'brand_code', dataType: 'VARCHAR(10)', options: PK }],
      });
      addRelationship(state, { id: 'r', start: ['b', [1]], end: ['p', [0]] });

      const lines = classOf(state, product);

      expect(memberOf(lines, 'brandCode')[0]).toBe('    #[ORM\\Id]');
      expect(lines.join('\n')).not.toContain('ManyToOne');
      expect(createCode(state)).not.toContain('OneToMany');
    });
  });

  describe('names', () => {
    it('suffixes a name PHP refuses and numbers one the header imports or another table takes in any case', () => {
      const state = createState();
      state.settings.tableNameCase = NameCase.none;
      ['list', 'Collection', 'types', 'ORM', 'user', 'USER'].forEach(
        (name, index) =>
          addTable(state, {
            id: `t${index}`,
            name,
            columns: [{ name: 'id', dataType: 'INT', options: PK }],
          })
      );

      const classes = createCode(state)
        .split('\n')
        .filter(line => line.startsWith('class '));

      expect(classes).toEqual([
        'class Collection2',
        'class list_',
        'class ORM2',
        'class types2',
        'class user',
        'class USER2',
      ]);
    });

    it('turns a name into a PHP identifier, keeping letters beyond ASCII', () => {
      const state = createState();
      state.settings.tableNameCase = NameCase.none;
      state.settings.columnNameCase = NameCase.none;
      const table = addTable(state, {
        id: 't',
        name: '1st table',
        columns: [
          { name: '회원 번호', dataType: 'INT', options: PK },
          { name: '', dataType: 'INT', options: NN },
          { name: 'a-b', dataType: 'INT', options: NN },
        ],
      });

      const lines = classOf(state, table);

      expect(lines[2]).toBe('class _1st_table');
      expect(lines.filter(line => line.startsWith('    public '))).toEqual([
        '    public int $회원_번호;',
        '    public int $_;',
        '    public int $a_b;',
      ]);
    });

    it('maps the first of two columns of one name and numbers an association named like a column', () => {
      const state = createState();
      addTable(state, {
        id: 'u',
        name: 'user',
        columns: [{ name: 'id', dataType: 'INT', options: PK }],
      });
      const post = addTable(state, {
        id: 'p',
        name: 'post',
        columns: [
          { name: 'id', dataType: 'INT', options: PK },
          { name: 'user', dataType: 'VARCHAR(20)', options: NN },
          { name: 'user', dataType: 'TEXT' },
          { name: 'author_id', dataType: 'INT', options: NN },
        ],
      });
      addRelationship(state, { id: 'r', start: ['u', [0]], end: ['p', [3]] });

      const lines = classOf(state, post);

      expect(lines.filter(line => line.startsWith('    public '))).toEqual([
        '    public int $id;',
        '    public string $user;',
        '    public User $user2;',
      ]);
    });
  });

  describe('more types', () => {
    it.each([
      [Database.Oracle, 'NUMBER(10,2)', 'precision: 10, scale: 2'],
      [Database.Oracle, 'NUMBER(*,2)', 'precision: 38, scale: 2'],
      [Database.Snowflake, 'NUMBER(12,2)', 'precision: 12, scale: 2'],
    ])(
      'reads a NUMBER with a scale as a DECIMAL (database %i, %s)',
      (database, dataType, args) => {
        expect(columnOf(database, dataType)).toEqual([
          `    #[ORM\\Column(name: '${database === Database.Oracle ? 'VALUE' : 'value'}', type: Types::DECIMAL, ${args})]`,
          '    public string $value;',
        ]);
      }
    );

    it.each([
      [Database.PostgreSQL, 'text', 'TEXT'],
      [Database.SQLite, 'TEXT', 'TEXT'],
      [Database.Snowflake, 'STRING', 'TEXT'],
      [Database.Databricks, 'STRING', 'TEXT'],
      [Database.Snowflake, 'TEXT(100)', 'STRING, length: 100'],
      [Database.PostgreSQL, 'interval(3)', 'STRING'],
      [Database.Oracle, 'INTERVAL DAY(2) TO SECOND(6)', 'STRING'],
      [Database.Oracle, 'VARCHAR2(4000 CHAR)', 'STRING, length: 4000'],
      [Database.PostgreSQL, 'jsonb', "JSON, options: ['jsonb' => true]"],
      [Database.PostgreSQL, 'json', 'JSON'],
      [Database.PostgreSQL, 'real', 'SMALLFLOAT'],
      [Database.MSSQL, 'real', 'SMALLFLOAT'],
      [Database.Oracle, 'BINARY_FLOAT', 'FLOAT'],
      [Database.Oracle, 'REAL', 'SMALLFLOAT'],
      [Database.MSSQL, 'varchar(max)', 'TEXT'],
      [Database.MSSQL, 'VARCHAR(4000)', 'STRING, length: 4000'],
      [
        Database.MariaDB,
        'NCHAR VARYING(20)',
        "STRING, length: 20, options: ['charset' => 'utf8mb3']",
      ],
      [
        Database.MariaDB,
        'NATIONAL VARCHARACTER(30)',
        "STRING, length: 30, options: ['charset' => 'utf8mb3']",
      ],
      [
        Database.MariaDB,
        'NCHAR VARCHARACTER(9)',
        "STRING, length: 9, options: ['charset' => 'utf8mb3']",
      ],
      [Database.MariaDB, 'LONG VARCHARACTER', 'TEXT, length: 16777215'],
      [Database.MariaDB, 'TEXT(0)', 'TEXT, length: 65535'],
      [Database.MariaDB, 'BLOB(0)', 'BLOB, length: 65535'],
      [Database.MSSQL, 'decimal', 'DECIMAL, precision: 18, scale: 0'],
      [Database.SQLite, 'REAL', 'SMALLFLOAT'],
      [Database.PostgreSQL, 'float4', 'SMALLFLOAT'],
      [Database.MariaDB, 'LONG CHARACTER VARYING', 'TEXT, length: 16777215'],
      [Database.Oracle, 'NCHAR VARYING(10)', 'STRING, length: 10'],
      [Database.SQLite, 'NATIVE CHARACTER(70)', 'STRING, length: 70'],
      [Database.PostgreSQL, 'float(24)', 'SMALLFLOAT'],
      [Database.PostgreSQL, 'float(25)', 'FLOAT'],
      [Database.MSSQL, 'float(10)', 'SMALLFLOAT'],
      [Database.MSSQL, 'float', 'FLOAT'],
      [Database.Oracle, 'FLOAT(63)', 'SMALLFLOAT'],
      [Database.Oracle, 'FLOAT(126)', 'FLOAT'],
    ])(
      'maps the type of database %i named %s to Types::%s',
      (database, dataType, type) => {
        expect(columnOf(database, dataType)[0]).toMatch(
          new RegExp(`type: Types::${type.replace(/[[\]()]/g, '\\$&')}\\)\\]$`)
        );
      }
    );

    it.each([
      ['CHAR(1 BYTE)', 'length: 1'],
      ['CHAR(3 CHAR)', 'length: 3'],
      ['CHAR', 'length: 1'],
    ])('reads the Oracle %s as fixed with %s', (dataType, length) => {
      expect(columnOf(Database.Oracle, dataType)[0]).toBe(
        `    #[ORM\\Column(name: 'VALUE', type: Types::STRING, ${length}, options: ['fixed' => true])]`
      );
    });

    it('marks a bpchar with a length fixed and writes a bare one as a plain STRING, which ORM makes VARCHAR(255)', () => {
      expect(columnOf(Database.PostgreSQL, 'bpchar(4)')[0]).toBe(
        "    #[ORM\\Column(name: 'value', type: Types::STRING, length: 4, options: ['fixed' => true])]"
      );
      expect(columnOf(Database.PostgreSQL, 'bpchar')[0]).toBe(
        "    #[ORM\\Column(name: 'value', type: Types::STRING)]"
      );
    });

    it.each([
      ['integer[]', 'integer[] NOT NULL'],
      ['bit(8)', 'bit(8) NOT NULL'],
      ['varbit', 'varbit NOT NULL'],
      ['pg_lsn', 'pg_lsn NOT NULL'],
    ])(
      'keeps the PostgreSQL %s a TEXT whose column keeps its type',
      (dataType, definition) => {
        expect(columnOf(Database.PostgreSQL, dataType)).toEqual([
          `    #[ORM\\Column(name: 'value', type: Types::TEXT, columnDefinition: '${definition}')]`,
          '    public string $value;',
        ]);
      }
    );

    it('keeps a SQL Server Unicode column of no length Unicode', () => {
      expect(columnOf(Database.MSSQL, 'nvarchar(max)')).toEqual([
        "    #[ORM\\Column(name: 'value', type: Types::STRING, length: -1, columnDefinition: 'NVARCHAR(MAX) NOT NULL')]",
        '    public string $value;',
      ]);
      expect(columnOf(Database.MSSQL, 'ntext', 0)[0]).toBe(
        "    #[ORM\\Column(name: 'value', type: Types::STRING, length: -1, nullable: true, columnDefinition: 'NVARCHAR(MAX)')]"
      );
      expect(columnOf(Database.MSSQL, 'national text', 0)[0]).toBe(
        "    #[ORM\\Column(name: 'value', type: Types::STRING, length: -1, nullable: true, columnDefinition: 'NVARCHAR(MAX)')]"
      );
    });

    it('defines a SQL Server VARCHAR past the 4000 characters DBAL writes as NVARCHAR', () => {
      expect(columnOf(Database.MSSQL, 'VARCHAR(8000)')[0]).toBe(
        "    #[ORM\\Column(name: 'value', type: Types::STRING, length: 8000, columnDefinition: 'VARCHAR(8000) NOT NULL')]"
      );
    });

    it.each([
      [Database.MySQL, 'int unsigned', 'INTEGER', 'int'],
      [Database.MariaDB, 'bigint unsigned', 'BIGINT', 'int|string'],
      [Database.MySQL, 'smallint unsigned', 'SMALLINT', 'int'],
      [Database.MySQL, 'serial', 'BIGINT', 'int|string'],
      [
        Database.MySQL,
        'decimal(10,2) unsigned',
        'DECIMAL, precision: 10, scale: 2',
        'string',
      ],
      [Database.MySQL, 'float unsigned', 'SMALLFLOAT', 'float'],
      [Database.MariaDB, 'double unsigned', 'FLOAT', 'float'],
      [Database.MySQL, 'smallint unsigned zerofill', 'SMALLINT', 'int'],
      [Database.MySQL, 'float unsigned zerofill', 'SMALLFLOAT', 'float'],
      [Database.MySQL, 'int zerofill', 'INTEGER', 'int'],
    ])(
      'marks the type of database %i named %s unsigned',
      (database, dataType, type, php) => {
        expect(columnOf(database, dataType)).toEqual([
          `    #[ORM\\Column(name: 'value', type: Types::${type}, options: ['unsigned' => true])]`,
          `    public ${php} $value;`,
        ]);
      }
    );

    it('writes a nullable unsigned BIGINT as a union with null', () => {
      expect(columnOf(Database.MySQL, 'bigint unsigned', 0)[1]).toBe(
        '    public int|string|null $value = null;'
      );
    });

    it.each([
      [Database.PostgreSQL, 'serial'],
      [Database.PostgreSQL, 'int unsigned'],
      [Database.MSSQL, 'int unsigned'],
      [Database.SQLite, 'INTEGER UNSIGNED'],
    ])(
      'marks nothing unsigned outside MySQL and MariaDB (database %i, %s)',
      (database, dataType) => {
        expect(columnOf(database, dataType)[0]).toBe(
          "    #[ORM\\Column(name: 'value', type: Types::INTEGER)]"
        );
      }
    );

    it('maps a MySQL ENUM with its members and a SET as a simple array', () => {
      expect(columnOf(Database.MySQL, "ENUM('G','it''s', 'a,b')")[0]).toBe(
        "    #[ORM\\Column(name: 'value', type: Types::ENUM, options: ['values' => ['G', 'it\\'s', 'a,b']])]"
      );
      expect(columnOf(Database.MySQL, "ENUM('x\\\\y','tab\\there')")[0]).toBe(
        "    #[ORM\\Column(name: 'value', type: Types::ENUM, options: ['values' => ['x\\\\y', \"tab\\there\"]])]"
      );
      expect(columnOf(Database.MySQL, 'ENUM(G)')[0]).toBe(
        "    #[ORM\\Column(name: 'value', type: Types::STRING)]"
      );
      expect(columnOf(Database.MySQL, "SET('x','y')")).toEqual([
        "    #[ORM\\Column(name: 'value', type: Types::SIMPLE_ARRAY)]",
        '    public array $value;',
      ]);
    });

    it('writes a date and time key as a string whose column keeps its type, which Doctrine can hash', () => {
      const state = createState();
      addTable(state, {
        id: 'd',
        name: 'daily_stat',
        columns: [{ name: 'stat_date', dataType: 'DATE', options: PK }],
      });
      const note = addTable(state, {
        id: 'n',
        name: 'stat_note',
        columns: [
          { name: 'id', dataType: 'INT', options: PK | AI },
          { name: 'stat_date', dataType: 'DATE' },
        ],
      });
      addRelationship(state, { id: 'r', start: ['d', [0]], end: ['n', [1]] });

      expect(
        memberOf(classOf(state, state.collections.tableEntities.d), 'statDate')
      ).toEqual([
        '    #[ORM\\Id]',
        "    #[ORM\\Column(name: 'stat_date', type: Types::STRING, length: 255, columnDefinition: 'DATE NOT NULL')]",
        '    public string $statDate;',
      ]);
      expect(memberOf(classOf(state, note), 'dailyStat')).toContain(
        "    #[ORM\\JoinColumn(name: 'stat_date', referencedColumnName: 'stat_date', columnDefinition: 'DATE')]"
      );
    });
  });

  describe('keys and definitions', () => {
    it.each([
      ['NUMBER(10)', 'INTEGER'],
      ['NUMBER(10,0)', 'INTEGER'],
      ['NUMBER(6)', 'INTEGER'],
      ['NUMBER(5)', 'SMALLINT'],
      ['NUMBER(20)', 'BIGINT'],
      ['SMALLINT', 'INTEGER'],
      ['DECIMAL(5)', 'SMALLINT'],
      ['NUMERIC(10)', 'INTEGER'],
      ['DEC(12,0)', 'BIGINT'],
      ['DECIMAL', 'INTEGER'],
    ])(
      'reads the Oracle %s as DBAL reads it back, Types::%s',
      (dataType, type) => {
        expect(columnOf(Database.Oracle, dataType)).toEqual([
          `    #[ORM\\Column(name: 'VALUE', type: Types::${type})]`,
          '    public int $value;',
        ]);
      }
    );

    it.each([
      ['NUMBER(1)', 'INTEGER'],
      ['NUMBER(11)', 'BIGINT'],
      ['NUMBER(19)', 'BIGINT'],
      ['NUMBER', 'BIGINT'],
    ])(
      'maps the Oracle %s to Types::%s, which DBAL reads back as another type',
      (dataType, type) => {
        expect(columnOf(Database.Oracle, dataType)[0]).toBe(
          `    #[ORM\\Column(name: 'VALUE', type: Types::${type})]`
        );
      }
    );

    it.each([
      [Database.PostgreSQL, 'bytea'],
      [Database.SQLite, 'BLOB'],
    ])(
      'keys a binary column of database %i, %s, as a BINARY string Doctrine can hash',
      (database, dataType) => {
        const state = createState(database);
        const blob = addTable(state, {
          id: 'b',
          name: 'file_blob',
          columns: [{ name: 'hash', dataType, options: PK }],
        });
        const ref = addTable(state, {
          id: 'r',
          name: 'file_ref',
          columns: [
            { name: 'id', dataType: 'INT', options: PK },
            { name: 'hash', dataType, options: NN },
          ],
        });
        addRelationship(state, { id: 'r', start: ['b', [0]], end: ['r', [1]] });

        expect(memberOf(classOf(state, blob), 'hash')).toEqual([
          '    #[ORM\\Id]',
          "    #[ORM\\Column(name: 'hash', type: Types::BINARY)]",
          '    public string $hash;',
        ]);
        expect(memberOf(classOf(state, ref), 'fileBlob')).toContain(
          "    #[ORM\\JoinColumn(name: 'hash', referencedColumnName: 'hash', nullable: false)]"
        );
      }
    );

    it('gives a string key of no length the 255 ORM gives it, which SchemaTool copies to a join column toward it', () => {
      const state = createState(Database.PostgreSQL);
      const code = addTable(state, {
        id: 'c',
        name: 'code',
        columns: [{ name: 'id', dataType: 'varchar', options: PK }],
      });
      const item = addTable(state, {
        id: 'i',
        name: 'item',
        columns: [
          { name: 'id', dataType: 'INT', options: PK },
          { name: 'code_id', dataType: 'varchar', options: NN },
        ],
      });
      addRelationship(state, { id: 'r', start: ['c', [0]], end: ['i', [1]] });

      expect(memberOf(classOf(state, code), 'id')).toEqual([
        '    #[ORM\\Id]',
        "    #[ORM\\Column(name: 'id', type: Types::STRING, length: 255)]",
        '    public string $id;',
      ]);
      expect(memberOf(classOf(state, item), 'code')).toContain(
        "    #[ORM\\JoinColumn(name: 'code_id', referencedColumnName: 'id', nullable: false)]"
      );
    });

    it.each([
      [Database.Oracle, 'TIMESTAMP', "'TIMESTAMP'"],
      [Database.Oracle, 'DATE', "'DATE NOT NULL'"],
      [Database.MSSQL, 'DATETIME2', "'DATETIME2 NOT NULL'"],
    ])(
      'leaves NOT NULL out of an Oracle key definition DBAL reads back as another type (database %i, %s)',
      (database, dataType, definition) => {
        const state = createState(database);
        const table = addTable(state, {
          id: 'e',
          name: 'event_log',
          columns: [
            { name: 'happened_at', dataType, options: PK },
            { name: 'seq', dataType: 'INT', options: PK },
          ],
        });

        expect(classOf(state, table).join('\n')).toContain(
          `columnDefinition: ${definition})]`
        );
      }
    );

    it.each([
      [Database.MySQL, " COMMENT \\'day\\'\\'s\\'", " COMMENT \\'noted\\'"],
      [Database.MariaDB, " COMMENT \\'day\\'\\'s\\'", " COMMENT \\'noted\\'"],
      [Database.PostgreSQL, '', ''],
    ])(
      'writes a comment into a definition on MySQL and MariaDB, which write no other (database %i)',
      (database, keyComment, joinComment) => {
        const state = createState(database);
        const daily = addTable(state, {
          id: 'd',
          name: 'daily_stats',
          columns: [
            {
              name: 'stat_day',
              dataType: 'DATE',
              comment: "day's",
              options: PK,
            },
          ],
        });
        const note = addTable(state, {
          id: 'n',
          name: 'notes',
          columns: [
            { name: 'id', dataType: 'INT', options: PK | AI },
            { name: 'noted_day', dataType: 'DATE', comment: 'noted' },
          ],
        });
        addRelationship(state, { id: 'r', start: ['d', [0]], end: ['n', [1]] });

        const key = memberOf(classOf(state, daily), 'statDay').join('\n');
        const join = memberOf(classOf(state, note), 'dailyStats').join('\n');

        expect(key).toContain(`columnDefinition: 'DATE NOT NULL${keyComment}'`);
        expect(key).toContain("options: ['comment' => 'day\\'s']");
        expect(join).toContain(`columnDefinition: 'DATE${joinComment}'`);
        expect(join).toContain("options: ['comment' => 'noted']");
      }
    );
  });

  describe('definitions with a default or a comment', () => {
    it('doubles a backslash in the MySQL comment of a definition, as MySQL reads one', () => {
      const state = createState();
      const table = addTable(state, {
        id: 'd',
        name: 'daily',
        columns: [
          {
            name: 'day',
            dataType: 'DATE',
            comment: 'C:\\temp',
            options: PK,
          },
        ],
      });

      expect(memberOf(classOf(state, table), 'day').join('\n')).toContain(
        "columnDefinition: 'DATE NOT NULL COMMENT \\'C:\\\\\\\\temp\\''"
      );
    });

    it('leaves NOT NULL out of an Oracle DATE key with a default, which DBAL reads back otherwise', () => {
      const state = createState(Database.Oracle);
      const table = addTable(state, {
        id: 'c',
        name: 'cal',
        columns: [
          {
            name: 'cal_day',
            dataType: 'DATE',
            default: 'SYSDATE',
            options: PK,
          },
        ],
      });

      expect(classOf(state, table).join('\n')).toContain(
        "columnDefinition: 'DATE')]"
      );
    });
  });

  describe('defaults', () => {
    function defaultLine(
      database: number,
      dataType: string,
      value: string
    ): string {
      const state = createState(database);
      const table = addTable(state, {
        id: 't',
        name: 'item',
        columns: [{ name: 'value', dataType, default: value, options: NN }],
      });

      return memberOf(classOf(state, table), 'value').join('\n');
    }

    it.each([
      ['INT', '0', "'default' => 0"],
      ['INT', '007', "'default' => 7"],
      ['BIGINT', '9223372036854775807', "'default' => 9223372036854775807"],
      ['BIGINT', '-9223372036854775808', "'default' => '-9223372036854775808'"],
      ['INT', "'5'", "'default' => 5"],
      ['FLOAT', '-1.5', "'default' => '-1.5'"],
      ['FLOAT', '0.0', "'default' => '0'"],
      ['DOUBLE', '2.50', "'default' => '2.5'"],
      ['DECIMAL(10,2)', '0.00', "'default' => '0.00'"],
      ['DECIMAL(10,2)', '0', "'default' => '0.00'"],
      ['DECIMAL(10,2)', '1.555', "'default' => '1.56'"],
      ['DECIMAL(10,2)', "'3'", "'default' => '3.00'"],
      ['DECIMAL(10,2)', '-0.001', "'default' => '0.00'"],
      ['DECIMAL(10,3)', '-2.5', "'default' => '-2.500'"],
      ['DECIMAL(8)', '5.0', "'default' => '5'"],
      ['DECIMAL', '1.5', "'default' => '2'"],
      ['VARCHAR(10)', "'it''s'", "'default' => 'it\\'s'"],
      ['VARCHAR(10)', "'it\\'s'", "'default' => 'it\\'s'"],
      ['VARCHAR(10)', '007', "'default' => '7'"],
      ['VARCHAR(20)', "'C:\\\\temp'", "'default' => 'C:\\\\temp'"],
      ['VARCHAR(20)', "'a\\%b'", "'default' => 'a\\\\%b'"],
      ['VARCHAR(20)', "'a\\tb'", '\'default\' => "a\\tb"'],
      ['VARCHAR(20)', "'a\\0b'", '\'default\' => "a\\x00b"'],
      ['VARCHAR(20)', "N'abc'", "'default' => 'abc'"],
      ['VARCHAR(20)', "_utf8mb4'y'", "'default' => 'y'"],
      ["SET('a','b')", "'a'", "'default' => 'a'"],
      ['BOOLEAN', 'TRUE', "'default' => true"],
      ['BOOLEAN', "'false'", "'default' => false"],
      ['BOOLEAN', "'1'", "'default' => 1"],
      ['TINYINT(1)', 'TRUE', "'default' => 1"],
      ['SMALLINT', 'false', "'default' => 0"],
      ['DATETIME', 'CURRENT_TIMESTAMP', "'default' => 'CURRENT_TIMESTAMP'"],
      ['DATETIME', 'NOW()', "'default' => 'CURRENT_TIMESTAMP'"],
      ['DATETIME', 'localtime', "'default' => 'CURRENT_TIMESTAMP'"],
      ['FLOAT', '-0.0', "'default' => '0'"],
      ['BOOLEAN', '-0', "'default' => 0"],
      ['INT', '+5', "'default' => 5"],
      ['INT', '1e2', "'default' => 100"],
      ['DOUBLE', '.5', "'default' => '0.5'"],
      ['DOUBLE', '1.5e-3', "'default' => '0.0015'"],
      ['DECIMAL(10,2)', '1.', "'default' => '1.00'"],
      ['DECIMAL(10,2)', "'+1.5'", "'default' => '1.50'"],
      ['INT', '5.5', "'default' => 6"],
      ['INT', '-0.4', "'default' => 0"],
      ['FLOAT(7,4)', '2', "'default' => '2.0000'"],
      ['DOUBLE(10,2)', '1.5', "'default' => '1.50'"],
      ['VARCHAR(20)', "'a\\_b'", "'default' => 'a\\\\_b'"],
      ['VARCHAR(20)', "'a\\Zb'", '\'default\' => "a\\x1ab"'],
      ['VARCHAR(20)', "'a\\bb'", '\'default\' => "a\\x08b"'],
      ['VARCHAR(20)', "'a\u007fb'", '\'default\' => "a\\x7fb"'],
      ['VARCHAR(30)', "_utf8mb4 'sp'", "'default' => 'sp'"],
      ['TIMESTAMP', 'localtimestamp', "'default' => 'CURRENT_TIMESTAMP'"],
    ])('writes a MySQL %s default of %s', (dataType, value, entry) => {
      expect(defaultLine(Database.MySQL, dataType, value)).toContain(
        `options: [${entry}]`
      );
    });

    it.each([
      [Database.MSSQL, 'DATETIME2', 'GETDATE()', "'CURRENT_TIMESTAMP'"],
      [Database.PostgreSQL, 'timestamp', 'now()', "'CURRENT_TIMESTAMP'"],
      [
        Database.PostgreSQL,
        'timestamp',
        'transaction_timestamp()',
        "'CURRENT_TIMESTAMP'",
      ],
      [Database.PostgreSQL, 'numeric(10,2)', '0', "'0'"],
      [Database.PostgreSQL, 'varchar(20)', "'C:\\\\temp'", "'C:\\\\\\\\temp'"],
      [Database.MSSQL, 'nvarchar(20)', "N'abc'", "'abc'"],
      [Database.MariaDB, 'JSON', "'[]'", "'[]'"],
      [Database.SQLite, 'INTEGER', 'TRUE', '1'],
      [Database.PostgreSQL, 'boolean', "'t'", 'true'],
      [Database.PostgreSQL, 'boolean', "'off'", 'false'],
      [
        Database.PostgreSQL,
        'timestamp',
        'localtimestamp',
        "'CURRENT_TIMESTAMP'",
      ],
      [Database.PostgreSQL, 'integer', '1e2', '100'],
      [Database.SQLite, 'DATETIME', 'CURRENT_TIMESTAMP', "'CURRENT_TIMESTAMP'"],
      [
        Database.Oracle,
        'TIMESTAMP',
        'CURRENT_TIMESTAMP',
        "'CURRENT_TIMESTAMP'",
      ],
      [Database.Oracle, 'NUMBER(10)', '010', "'010'"],
      [Database.Oracle, 'NUMBER(10)', '5', '5'],
      [Database.Oracle, 'FLOAT', '0.0', "'0.0'"],
      [Database.SQLite, 'REAL', '0.0', "'0.0'"],
      [Database.MSSQL, 'decimal', '5', "'5'"],
    ])(
      'writes a default of database %i on %s of %s as %s',
      (database, dataType, value, entry) => {
        expect(defaultLine(database, dataType, value)).toContain(
          `options: ['default' => ${entry}]`
        );
      }
    );

    it('writes an unsigned default past the int PHP reads as a string', () => {
      expect(
        defaultLine(Database.MySQL, 'BIGINT UNSIGNED', '18446744073709551615')
      ).toContain(
        "options: ['unsigned' => true, 'default' => '18446744073709551615']"
      );
    });

    it.each([
      [Database.MySQL, 'INT', '(1+1)'],
      [Database.MySQL, 'VARCHAR(10)', 'uuid()'],
      [Database.MySQL, 'VARCHAR(10)', 'CURRENT_TIMESTAMP'],
      [Database.MySQL, 'VARCHAR(10)', 'true'],
      [Database.MySQL, 'VARCHAR(10)', 'NOW()'],
      [Database.MySQL, 'JSON', "'[]'"],
      [Database.MySQL, 'BOOLEAN', "'abc'"],
      [Database.MySQL, 'BOOLEAN', '2'],
      [Database.MSSQL, 'DATETIME2', 'SYSDATETIME()'],
      [Database.MSSQL, 'nvarchar(20)', "N'가'"],
      [Database.Oracle, 'TIMESTAMP', 'SYSTIMESTAMP'],
      [Database.PostgreSQL, 'integer', 'TRUE'],
      [Database.PostgreSQL, 'varchar(20)', "E'a\\tb'"],
      [Database.PostgreSQL, 'varchar(20)', "_utf8mb4'y'"],
      [Database.PostgreSQL, 'boolean', "'maybe'"],
    ])(
      'leaves out a default of database %i on %s DBAL cannot write, %s',
      (database, dataType, value) => {
        expect(defaultLine(database, dataType, value)).not.toContain('default');
      }
    );

    it('writes no default on a generated key', () => {
      const state = createState();
      const table = addTable(state, {
        id: 't',
        name: 'item',
        columns: [
          { name: 'id', dataType: 'INT', default: '1', options: PK | AI },
        ],
      });

      expect(classOf(state, table).join('\n')).not.toContain('default');
    });
  });

  describe('indexes', () => {
    it('leaves a blank index unnamed where its name repeats another but for case, which DBAL refuses', () => {
      const state = createState(Database.PostgreSQL);
      state.settings.bracketType = BracketType.doubleQuote;
      const table = addTable(state, {
        id: 'u',
        name: 'users',
        columns: [
          { name: 'id', dataType: 'INT', options: PK },
          { name: 'name', dataType: 'TEXT', options: NN },
          { name: 'code', dataType: 'TEXT', options: NN },
        ],
      });
      addIndex(state, 'i1', 'u', 'idx_users', false, ['u.2']);
      addIndex(state, 'i2', 'u', '', false, ['u.1']);

      expect(classOf(state, table).slice(2, 4)).toEqual([
        "#[ORM\\Index(name: 'idx_users', columns: ['`code`'])]",
        "#[ORM\\Index(columns: ['`name`'])]",
      ]);
    });

    it('writes an unnamed unique index beside an unnamed plain one on the same columns', () => {
      const state = createState();
      const table = addTable(state, {
        id: 'm',
        name: 'memo',
        columns: [
          { name: 'id', dataType: 'INT', options: PK },
          { name: 'email', dataType: 'VARCHAR(50)', options: NN },
        ],
      });
      addIndex(state, 'i1', 'm', 'bad-name', false, ['m.1']);
      addIndex(state, 'i2', 'm', 'bad-name2', true, ['m.1']);

      expect(classOf(state, table).slice(2, 4)).toEqual([
        "#[ORM\\Index(columns: ['email'])]",
        "#[ORM\\UniqueConstraint(columns: ['email'])]",
      ]);
    });

    it('writes a unique index as a constraint and any other as an index, after the table', () => {
      const state = createState();
      const table = addTable(state, {
        id: 'm',
        name: 'member',
        columns: [
          { name: 'id', dataType: 'INT', options: PK },
          { name: 'tenant', dataType: 'INT', options: NN },
          { name: 'login', dataType: 'VARCHAR(50)', options: NN },
          { name: 'order', dataType: 'INT', options: NN },
          {
            name: 'email',
            dataType: 'VARCHAR(50)',
            options: NN | ColumnOption.unique,
          },
        ],
      });
      addIndex(state, 'i1', 'm', 'uq_member_login', true, ['m.1', 'm.2']);
      addIndex(state, 'i2', 'm', '', false, ['m.3', 'gone']);
      addIndex(state, 'i3', 'm', 'uq_email', true, ['m.4']);
      addIndex(state, 'i4', 'm', 'empty', false, ['gone']);
      addIndex(state, 'i5', 'other', 'elsewhere', false, ['m.1']);

      expect(classOf(state, table).slice(1, 5)).toEqual([
        "#[ORM\\Table(name: '`member`')]",
        "#[ORM\\UniqueConstraint(name: 'uq_member_login', columns: ['tenant', 'login'])]",
        "#[ORM\\Index(name: 'IDX_member', columns: ['`order`'])]",
        "#[ORM\\UniqueConstraint(name: 'uq_email', columns: ['email'])]",
      ]);
      expect(classOf(state, table)[5]).toBe('class Member');
    });

    it('names a blank index as the editor DDL does, numbered across the document, in the one-table view too', () => {
      const state = createState();
      const post = addTable(state, {
        id: 'p',
        name: 'sales.post',
        columns: [
          { name: 'id', dataType: 'INT', options: PK },
          { name: 'title', dataType: 'VARCHAR(50)', options: NN },
        ],
      });
      const tag = addTable(state, {
        id: 't',
        name: 'Post',
        columns: [{ name: 'id', dataType: 'INT', options: PK }],
      });
      addIndex(state, 'i1', 'p', '', false, ['p.1']);
      addIndex(state, 'i2', 't', '', false, ['t.0']);
      addIndex(state, 'i3', 'p', '', true, ['p.0', 'p.1']);

      expect(classOf(state, post).slice(2, 4)).toEqual([
        "#[ORM\\Index(name: 'IDX_post', columns: ['title'])]",
        "#[ORM\\UniqueConstraint(name: 'IDX_post2', columns: ['id', 'title'])]",
      ]);
      expect(classOf(state, tag)[2]).toBe(
        "#[ORM\\Index(name: 'IDX_Post1', columns: ['id'])]"
      );
    });

    it('leaves out a name DBAL refuses, and writes one unnamed index of a column set once', () => {
      const state = createState(Database.PostgreSQL);
      const table = addTable(state, {
        id: 'u',
        name: '사용자',
        columns: [
          { name: 'id', dataType: 'INT', options: PK },
          { name: 'email', dataType: 'VARCHAR(50)', options: NN },
        ],
      });
      addIndex(state, 'i1', 'u', 'users-email-idx', false, ['u.1']);
      addIndex(state, 'i2', 'u', '', false, ['u.1']);
      addIndex(state, 'i3', 'u', '`idx_a`', false, ['u.0']);
      addIndex(state, 'i4', 'u', '"idx_b"', true, ['u.1']);
      addIndex(state, 'i5', 'u', 'sales.idx_c', true, ['u.0']);
      addIndex(state, 'i6', 'u', 'primary', false, ['u.0']);
      addIndex(state, 'i7', 'u', '123', false, ['u.1', 'u.0']);
      addIndex(state, 'i8', 'u', 'IDX_A', false, ['u.1', 'u.0']);

      expect(
        classOf(state, table).filter(line => line.startsWith('#[ORM\\Index'))
      ).toEqual([
        "#[ORM\\Index(columns: ['email'])]",
        "#[ORM\\Index(name: 'idx_a', columns: ['id'])]",
        "#[ORM\\Index(columns: ['id'])]",
        "#[ORM\\Index(columns: ['email', 'id'])]",
      ]);
      expect(
        classOf(state, table).filter(line =>
          line.startsWith('#[ORM\\UniqueConstraint')
        )
      ).toEqual([
        "#[ORM\\UniqueConstraint(name: 'idx_b', columns: ['email'])]",
        "#[ORM\\UniqueConstraint(columns: ['id'])]",
      ]);
    });
  });

  describe('review rules for associations', () => {
    it("maps an association that is the child's one key column one-to-one on both sides, whatever its N side", () => {
      const state = createState();
      const users = addTable(state, {
        id: 'u',
        name: 'users',
        columns: [{ name: 'id', dataType: 'INT', options: PK | AI }],
      });
      const profile = addTable(state, {
        id: 'p',
        name: 'profile',
        columns: [
          { name: 'user_id', dataType: 'INT', options: PK },
          { name: 'bio', dataType: 'TEXT' },
        ],
      });
      addRelationship(state, { id: 'r', start: ['u', [0]], end: ['p', [0]] });

      expect(memberOf(classOf(state, profile), 'users')).toEqual([
        '    #[ORM\\Id]',
        "    #[ORM\\OneToOne(targetEntity: Users::class, inversedBy: 'profile')]",
        "    #[ORM\\JoinColumn(name: 'user_id', referencedColumnName: 'id', nullable: false)]",
        '    public Users $users;',
      ]);
      expect(classOf(state, profile)[3]).toBe('{');
      expect(classOf(state, profile)[4]).toBe('    #[ORM\\Id]');
      expect(memberOf(classOf(state, users), 'profile')).toEqual([
        "    #[ORM\\OneToOne(targetEntity: Profile::class, mappedBy: 'users')]",
        '    public ?Profile $profile = null;',
      ]);
      expect(createTableCode(state, users)).not.toContain('Collection');
    });

    it('writes a key association at its first join column, so the key keeps the document order', () => {
      const state = createState();
      addTable(state, {
        id: 'r',
        name: 'roles',
        columns: [{ name: 'id', dataType: 'INT', options: PK | AI }],
      });
      addTable(state, {
        id: 'u',
        name: 'users',
        columns: [{ name: 'id', dataType: 'INT', options: PK | AI }],
      });
      const link = addTable(state, {
        id: 'l',
        name: 'user_roles',
        columns: [
          { name: 'user_id', dataType: 'INT', options: PK },
          { name: 'note', dataType: 'TEXT' },
          { name: 'role_id', dataType: 'INT', options: PK },
        ],
      });
      addRelationship(state, { id: 'r1', start: ['r', [0]], end: ['l', [2]] });
      addRelationship(state, { id: 'r2', start: ['u', [0]], end: ['l', [0]] });

      expect(
        classOf(state, link).filter(line => line.startsWith('    public '))
      ).toEqual([
        '    public Users $users;',
        '    public ?string $note = null;',
        '    public Roles $roles;',
      ]);
    });

    it('writes NOT NULL per join column, and an optional association nullable', () => {
      const state = createState(Database.PostgreSQL);
      addTable(state, {
        id: 'g',
        name: 't_group',
        columns: [
          { name: 'tenant_id', dataType: 'integer', options: PK },
          { name: 'id', dataType: 'integer', options: PK },
        ],
      });
      const doc = addTable(state, {
        id: 'd',
        name: 't_doc',
        columns: [
          { name: 'id', dataType: 'integer', options: PK },
          { name: 'tenant_id', dataType: 'integer', options: NN },
          { name: 'group_id', dataType: 'integer' },
        ],
      });
      addRelationship(state, {
        id: 'r',
        start: ['g', [0, 1]],
        end: ['d', [1, 2]],
      });

      expect(memberOf(classOf(state, doc), 'tGroup')).toEqual([
        "    #[ORM\\ManyToOne(targetEntity: TGroup::class, inversedBy: 'tDocList')]",
        "    #[ORM\\JoinColumn(name: 'tenant_id', referencedColumnName: 'tenant_id', nullable: false)]",
        "    #[ORM\\JoinColumn(name: 'group_id', referencedColumnName: 'id')]",
        '    public ?TGroup $tGroup = null;',
      ]);
    });

    it('keeps the UNIQUE and the comment of a column an association carries, its unique index once', () => {
      const state = createState();
      addTable(state, {
        id: 'u',
        name: 'users',
        columns: [{ name: 'id', dataType: 'INT', options: PK | AI }],
      });
      const card = addTable(state, {
        id: 'c',
        name: 'card',
        columns: [
          { name: 'id', dataType: 'INT', options: PK | AI },
          {
            name: 'user_id',
            dataType: 'INT',
            options: NN | ColumnOption.unique,
            comment: 'holder',
          },
        ],
      });
      addRelationship(state, { id: 'r1', start: ['u', [0]], end: ['c', [1]] });
      addRelationship(state, { id: 'r2', start: ['u', [0]], end: ['c', [1]] });

      const code = classOf(state, card).join('\n');

      expect(code.match(/unique: true/g)).toHaveLength(1);
      expect(code.match(/options: \['comment' => 'holder'\]/g)).toHaveLength(2);
      expect(memberOf(classOf(state, card), 'users')).toEqual([
        "    #[ORM\\ManyToOne(targetEntity: Users::class, inversedBy: 'cardList')]",
        '    #[ORM\\JoinColumn(',
        "        name: 'user_id',",
        "        referencedColumnName: 'id',",
        '        unique: true,',
        '        nullable: false,',
        "        options: ['comment' => 'holder'],",
        '    )]',
        '    public Users $users;',
      ]);
    });

    it('lets a single-column one-to-one keep the unique index Doctrine gives it', () => {
      const state = createState();
      addTable(state, {
        id: 'u',
        name: 'users',
        columns: [{ name: 'id', dataType: 'INT', options: PK | AI }],
      });
      const card = addTable(state, {
        id: 'c',
        name: 'card',
        columns: [
          { name: 'id', dataType: 'INT', options: PK | AI },
          {
            name: 'user_id',
            dataType: 'INT',
            options: NN | ColumnOption.unique,
          },
        ],
      });
      addRelationship(state, {
        id: 'r',
        start: ['u', [0]],
        end: ['c', [1]],
        relationshipType: RelationshipType.OneOnly,
      });

      expect(classOf(state, card).join('\n')).not.toContain('unique: true');
    });

    it.each(['serial', 'BIGSERIAL', 'smallserial'])(
      'numbers a %s key without its auto increment flag',
      dataType => {
        const state = createState(Database.PostgreSQL);
        const table = addTable(state, {
          id: 't',
          name: 'item',
          columns: [{ name: 'id', dataType, options: PK }],
        });

        expect(memberOf(classOf(state, table), 'id')[1]).toBe(
          '    #[ORM\\GeneratedValue]'
        );
      }
    );

    it('numbers no serial column inside a composite key', () => {
      const state = createState(Database.PostgreSQL);
      const table = addTable(state, {
        id: 't',
        name: 'item',
        columns: [
          { name: 'id', dataType: 'serial', options: PK },
          { name: 'part', dataType: 'int', options: PK },
        ],
      });

      expect(classOf(state, table)).not.toContain('    #[ORM\\GeneratedValue]');
    });
  });

  describe('options of a carried column', () => {
    it('writes the comment of a key column an association carries', () => {
      const state = createState();
      addTable(state, {
        id: 'u',
        name: 'users',
        columns: [{ name: 'id', dataType: 'INT', options: PK | AI }],
      });
      const profile = addTable(state, {
        id: 'p',
        name: 'profile',
        columns: [
          { name: 'user_id', dataType: 'INT', options: PK, comment: 'owner' },
        ],
      });
      addRelationship(state, { id: 'r', start: ['u', [0]], end: ['p', [0]] });

      expect(memberOf(classOf(state, profile), 'users').join('\n')).toContain(
        "options: ['comment' => 'owner']"
      );
    });

    it('writes a carried column its own default and comment, or none over those of its parent', () => {
      const state = createState();
      addTable(state, {
        id: 'c',
        name: 'country',
        columns: [
          {
            name: 'code',
            dataType: 'CHAR(2)',
            default: "'KR'",
            comment: 'ISO code',
            options: PK,
          },
        ],
      });
      const city = addTable(state, {
        id: 'y',
        name: 'city',
        columns: [
          { name: 'id', dataType: 'INT', options: PK | AI },
          { name: 'country_code', dataType: 'CHAR(2)' },
          {
            name: 'home_code',
            dataType: 'CHAR(2)',
            default: "'JP'",
            comment: 'home',
            options: NN,
          },
        ],
      });
      addRelationship(state, { id: 'r1', start: ['c', [0]], end: ['y', [1]] });
      addRelationship(state, { id: 'r2', start: ['c', [0]], end: ['y', [2]] });

      const lines = classOf(state, city);

      expect(memberOf(lines, 'country').join('\n')).toContain(
        "options: ['default' => null, 'comment' => '']"
      );
      expect(memberOf(lines, 'country2').join('\n')).toContain(
        "options: ['default' => 'JP', 'comment' => 'home']"
      );
    });

    it('maps no relationship whose table the document no longer lists', () => {
      const state = createShop();
      state.doc.tableIds = state.doc.tableIds.filter(id => id !== 'u');

      const code = createCode(state);

      expect(code).not.toContain('User::class');
      expect(code).toContain(
        "    #[ORM\\Column(name: 'user_id', type: Types::BIGINT)]"
      );
    });

    it('keeps a composite foreign key that is the child whole key a many-to-one beside its key fields', () => {
      const state = createState();
      addTable(state, {
        id: 'a',
        name: 'region_account',
        columns: [
          { name: 'region', dataType: 'INT', options: PK },
          { name: 'seq', dataType: 'INT', options: PK },
        ],
      });
      const detail = addTable(state, {
        id: 'd',
        name: 'account_detail',
        columns: [
          { name: 'region', dataType: 'INT', options: PK },
          { name: 'seq', dataType: 'INT', options: PK },
          { name: 'note', dataType: 'TEXT' },
        ],
      });
      addRelationship(state, {
        id: 'r',
        start: ['a', [0, 1]],
        end: ['d', [0, 1]],
      });

      const lines = classOf(state, detail);

      expect(memberOf(lines, 'region')[0]).toBe('    #[ORM\\Id]');
      expect(memberOf(lines, 'regionAccount')[0]).toBe(
        "    #[ORM\\ManyToOne(targetEntity: RegionAccount::class, inversedBy: 'accountDetailList')]"
      );
    });
  });

  describe('review rules for names', () => {
    it('folds a name as Oracle stores it, a reserved one in backticks, and quotes both names of a join column together', () => {
      const state = createState(Database.Oracle);
      addTable(state, {
        id: 'a',
        name: 'account',
        columns: [{ name: 'id', dataType: 'NUMBER(10)', options: PK }],
      });
      const entry = addTable(state, {
        id: 'e',
        name: 'log',
        columns: [
          { name: 'id', dataType: 'NUMBER(10)', options: PK },
          { name: 'end', dataType: 'NUMBER(10)', options: NN },
        ],
      });
      addRelationship(state, { id: 'r', start: ['a', [0]], end: ['e', [1]] });

      const lines = classOf(state, entry);

      expect(lines[1]).toBe("#[ORM\\Table(name: '`LOG`')]");
      expect(memberOf(lines, 'id')[1]).toBe(
        "    #[ORM\\Column(name: 'ID', type: Types::INTEGER)]"
      );
      expect(memberOf(lines, 'account')[1]).toBe(
        "    #[ORM\\JoinColumn(name: '`END`', referencedColumnName: '`ID`', nullable: false)]"
      );
    });

    it('folds a PostgreSQL name to lower case and keeps one the user typed in delimiters', () => {
      const state = createState(Database.PostgreSQL);
      const table = addTable(state, {
        id: 't',
        name: '"Users"',
        columns: [
          { name: 'Date', dataType: 'date', options: NN },
          { name: '"Name"', dataType: 'text', options: NN },
          { name: 'userId', dataType: 'int', options: NN },
        ],
      });

      expect(
        classOf(state, table).filter(line => line.includes('name:'))
      ).toEqual([
        "#[ORM\\Table(name: '`Users`')]",
        "    #[ORM\\Column(name: '`date`', type: Types::DATE_IMMUTABLE)]",
        "    #[ORM\\Column(name: '`Name`', type: Types::TEXT)]",
        "    #[ORM\\Column(name: 'userid', type: Types::INTEGER)]",
      ]);
    });

    it('keeps a delimited column name whole where the document quotes names, as its DDL does', () => {
      const state = createState(Database.MySQL);
      state.settings.bracketType = BracketType.backtick;
      const table = addTable(state, {
        id: 't',
        name: '[sales].[order]',
        columns: [{ name: '"Name"', dataType: 'TEXT', options: NN }],
      });

      expect(
        classOf(state, table).filter(line => line.includes('name:'))
      ).toEqual([
        "#[ORM\\Table(name: '`order`', schema: 'sales')]",
        `    #[ORM\\Column(name: '\`"Name"\`', type: Types::TEXT, length: 65535)]`,
      ]);
    });

    it('folds a letter beyond ASCII on Oracle too, where its capital is one character', () => {
      const state = createState(Database.Oracle);
      const table = addTable(state, {
        id: 't',
        name: 'résumé',
        columns: [
          { name: 'café', dataType: 'INT', options: PK },
          { name: 'straße', dataType: 'INT', options: NN },
          { name: 'ıd', dataType: 'INT', options: NN },
          { name: 'ᾳx', dataType: 'INT', options: NN },
          { name: 'ῳ', dataType: 'INT', options: NN },
          { name: 'ᾀ', dataType: 'INT', options: NN },
        ],
      });

      expect(
        classOf(state, table).filter(line => line.includes('name:'))
      ).toEqual([
        "#[ORM\\Table(name: '`RÉSUMÉ`')]",
        "    #[ORM\\Column(name: '`CAFÉ`', type: Types::INTEGER)]",
        "    #[ORM\\Column(name: '`STRAßE`', type: Types::INTEGER)]",
        "    #[ORM\\Column(name: 'ID', type: Types::INTEGER)]",
        "    #[ORM\\Column(name: '`ᾼX`', type: Types::INTEGER)]",
        "    #[ORM\\Column(name: '`ῼ`', type: Types::INTEGER)]",
        "    #[ORM\\Column(name: '`ᾈ`', type: Types::INTEGER)]",
      ]);
    });

    it('quotes a key field as its join column, where the key it references needs quotes', () => {
      const state = createState(Database.PostgreSQL);
      addTable(state, {
        id: 'i',
        name: 'invoice',
        columns: [
          { name: 'number', dataType: 'INT', options: PK },
          { name: 'series', dataType: 'VARCHAR(5)', options: PK },
        ],
      });
      const line = addTable(state, {
        id: 'l',
        name: 'invoice_line',
        columns: [
          { name: 'invoice_number', dataType: 'INT', options: PK },
          { name: 'invoice_series', dataType: 'VARCHAR(5)', options: PK },
          { name: 'seq', dataType: 'INT', options: PK },
        ],
      });
      addRelationship(state, {
        id: 'r',
        start: ['i', [0, 1]],
        end: ['l', [0, 1]],
      });
      addIndex(state, 'x', 'l', 'ix_inv', false, ['l.0']);

      const lines = classOf(state, line);

      expect(lines).toContain(
        "#[ORM\\Index(name: 'ix_inv', columns: ['`invoice_number`'])]"
      );
      expect(memberOf(lines, 'invoiceNumber')[1]).toBe(
        "    #[ORM\\Column(name: '`invoice_number`', type: Types::INTEGER)]"
      );
      expect(memberOf(lines, 'invoice')).toContain(
        "    #[ORM\\JoinColumn(name: '`invoice_number`', referencedColumnName: '`number`', nullable: false)]"
      );
    });

    it('quotes a column carried by two associations alike in both, where one key it references needs quotes', () => {
      const state = createState(Database.SQLite);
      addTable(state, {
        id: 't',
        name: 'tenants',
        columns: [{ name: 'key', dataType: 'INTEGER', options: PK }],
      });
      addTable(state, {
        id: 'o',
        name: 'orders',
        columns: [
          { name: 'tenant_id', dataType: 'INTEGER', options: PK },
          { name: 'id', dataType: 'INTEGER', options: PK },
        ],
      });
      const lines = addTable(state, {
        id: 'l',
        name: 'lines',
        columns: [
          { name: 'id', dataType: 'INTEGER', options: PK },
          { name: 'tenant_id', dataType: 'INTEGER', options: NN },
          { name: 'order_id', dataType: 'INTEGER', options: NN },
        ],
      });
      addRelationship(state, { id: 'r1', start: ['t', [0]], end: ['l', [1]] });
      addRelationship(state, {
        id: 'r2',
        start: ['o', [0, 1]],
        end: ['l', [1, 2]],
      });

      const code = classOf(state, lines).join('\n');

      expect(code).toContain(
        "#[ORM\\JoinColumn(name: '`tenant_id`', referencedColumnName: '`key`', nullable: false)]"
      );
      expect(code).toContain(
        "#[ORM\\JoinColumn(name: '`tenant_id`', referencedColumnName: '`tenant_id`', nullable: false)]"
      );
      expect(code).not.toContain("name: 'tenant_id'");
    });

    it.each([
      [
        Database.MySQL,
        '`sales`.`item`',
        "#[ORM\\Table(name: '`item`', schema: 'sales')]",
      ],
      [
        Database.MySQL,
        '`sales`.items2',
        "#[ORM\\Table(name: '`items2`', schema: 'sales')]",
      ],
      [
        Database.MariaDB,
        '`sales`.`item`',
        "#[ORM\\Table(name: '`item`', schema: 'sales')]",
      ],
      [
        Database.SQLite,
        '`sales`.`item`',
        "#[ORM\\Table(name: '`item`', schema: 'sales')]",
      ],
      [
        Database.Databricks,
        '`sales`.`item`',
        "#[ORM\\Table(name: '`item`', schema: 'sales')]",
      ],
      [
        Database.PostgreSQL,
        '`sales`.`item`',
        "#[ORM\\Table(name: '``item``', schema: '`sales`')]",
      ],
    ])(
      'reads a part in backticks as delimited where database %i does, %s',
      (database, name, expected) => {
        expect(tableLineOf(database, name)).toBe(expected);
      }
    );

    it.each([
      ['"Users"', BracketType.backtick, '#[ORM\\Table(name: \'`"Users"`\')]'],
      ['[order]', BracketType.doubleQuote, "#[ORM\\Table(name: '`[order]`')]"],
    ])(
      'keeps a one-part delimited table name %s whole where the document quotes names, as its DDL does',
      (name, bracketType, expected) => {
        expect(tableLineOf(Database.PostgreSQL, name, bracketType)).toBe(
          expected
        );
      }
    );

    it('gives a table with no name or a lone underscore a class PHP 8.4 takes', () => {
      const state = createState();
      addTable(state, { id: 'a', name: '' });
      addTable(state, { id: 'b', name: '-' });

      expect(
        createCode(state)
          .split('\n')
          .filter(line => line.startsWith('class '))
      ).toEqual(['class __ {}', 'class __2 {}']);
    });
  });
});
