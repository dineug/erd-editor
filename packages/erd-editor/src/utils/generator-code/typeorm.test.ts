import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  ColumnOption,
  ColumnUIKey,
  Database,
  NameCase,
  RelationshipType,
} from '@/constants/schema';
import { RootState } from '@/engine/state';
import {
  Column,
  Index,
  IndexColumn,
  Relationship,
  Table,
} from '@/internal-types';
import { createIndex } from '@/utils/collection/index.entity';
import { createIndexColumn } from '@/utils/collection/indexColumn.entity';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createCode, formatTable } from '@/utils/generator-code/typeorm';

type StateInput = {
  tables?: Table[];
  columns?: Column[];
  relationships?: Relationship[];
  indexes?: Index[];
  indexColumns?: IndexColumn[];
  settings?: Partial<RootState['settings']>;
};

function createState({
  tables = [],
  columns = [],
  relationships = [],
  indexes = [],
  indexColumns = [],
  settings,
}: StateInput): RootState {
  const state = schemaV3Parser({}) as unknown as RootState;
  state.doc.tableIds = tables.map(table => table.id);
  state.doc.relationshipIds = relationships.map(
    relationship => relationship.id
  );
  state.doc.indexIds = indexes.map(index => index.id);
  tables.forEach(table => {
    state.collections.tableEntities[table.id] = table;
  });
  columns.forEach(column => {
    state.collections.tableColumnEntities[column.id] = column;
  });
  relationships.forEach(relationship => {
    state.collections.relationshipEntities[relationship.id] = relationship;
  });
  indexes.forEach(index => {
    state.collections.indexEntities[index.id] = index;
  });
  indexColumns.forEach(indexColumn => {
    state.collections.indexColumnEntities[indexColumn.id] = indexColumn;
  });
  Object.assign(state.settings, settings);
  return state;
}

function render(state: RootState, table: Table): string[] {
  const buffer: string[] = [];
  formatTable(state, { buffer, table });
  return buffer;
}

function createSharedFixture() {
  const table = createTable({ id: 't1', name: 'user', columnIds: ['c1'] });
  const state = createState({
    tables: [table],
    columns: [
      createColumn({
        id: 'c1',
        tableId: 't1',
        name: 'created_at',
        dataType: 'INT',
        options: ColumnOption.notNull,
      }),
    ],
    settings: { database: Database.MySQL },
  });

  return { state, table };
}

function createUsersFixture(settings?: Partial<RootState['settings']>) {
  const table = createTable({
    id: 't_users',
    name: 'users',
    columnIds: ['c_id', 'c_email', 'c_bio', 'c_balance', 'c_seen'],
  });
  const state = createState({
    tables: [table],
    columns: [
      createColumn({
        id: 'c_id',
        tableId: 't_users',
        name: 'id',
        dataType: 'uuid',
        default: 'gen_random_uuid()',
        options: ColumnOption.primaryKey,
        ui: { keys: ColumnUIKey.primaryKey },
      }),
      createColumn({
        id: 'c_email',
        tableId: 't_users',
        name: 'email',
        dataType: 'varchar(255)',
        comment: 'login email',
        options: ColumnOption.notNull | ColumnOption.unique,
      }),
      createColumn({
        id: 'c_bio',
        tableId: 't_users',
        name: 'bio',
        dataType: 'text',
      }),
      createColumn({
        id: 'c_balance',
        tableId: 't_users',
        name: 'balance',
        dataType: 'numeric(10,2)',
        default: '0',
        options: ColumnOption.notNull,
      }),
      createColumn({
        id: 'c_seen',
        tableId: 't_users',
        name: 'last seen',
        dataType: 'timestamptz',
      }),
    ],
    settings: { database: Database.PostgreSQL, ...settings },
  });

  return { state, table };
}

function createTeamFixture(
  relationshipType: number = RelationshipType.ZeroN,
  options = 0
) {
  const team = createTable({
    id: 't_team',
    name: 'team',
    columnIds: ['tc_id'],
  });
  const user = createTable({
    id: 't_user',
    name: 'user',
    columnIds: ['uc_id', 'uc_team'],
  });
  const state = createState({
    tables: [team, user],
    columns: [
      createColumn({
        id: 'tc_id',
        tableId: 't_team',
        name: 'id',
        dataType: 'int',
        options: ColumnOption.primaryKey | ColumnOption.autoIncrement,
        ui: { keys: ColumnUIKey.primaryKey },
      }),
      createColumn({
        id: 'uc_id',
        tableId: 't_user',
        name: 'id',
        dataType: 'int',
        options: ColumnOption.primaryKey | ColumnOption.autoIncrement,
        ui: { keys: ColumnUIKey.primaryKey },
      }),
      createColumn({
        id: 'uc_team',
        tableId: 't_user',
        name: 'team_id',
        dataType: 'int',
        options,
        ui: { keys: ColumnUIKey.foreignKey },
      }),
    ],
    relationships: [
      createRelationship({
        id: 'r1',
        relationshipType,
        start: { tableId: 't_team', columnIds: ['tc_id'] },
        end: { tableId: 't_user', columnIds: ['uc_team'] },
      }),
    ],
    settings: { database: Database.MySQL },
  });

  return { state, team, user };
}

function probe(dataType: string, database: number, options = 0) {
  const table = createTable({ id: 't1', name: 'probe', columnIds: ['c1'] });
  const state = createState({
    tables: [table],
    columns: [
      createColumn({
        id: 'c1',
        tableId: 't1',
        name: 'value',
        dataType,
        options,
      }),
    ],
    settings: { database },
  });
  const lines = render(state, table);

  return {
    decorator: lines.find(line => line.startsWith('  @')) ?? '',
    annotation: lines.find(line => line.startsWith('  value')) ?? '',
  };
}

function createTypeFixture(dataType: string, database: number) {
  return probe(dataType, database).decorator;
}

function createAnnotationFixture(dataType: string, database: number) {
  return probe(dataType, database, ColumnOption.notNull).annotation;
}

describe('generator-code/typeorm', () => {
  describe('createCode', () => {
    it('returns an empty string when the document has no tables', () => {
      expect(createCode(createState({}))).toBe('');
    });

    it('renders the shared single-table document', () => {
      const { state } = createSharedFixture();

      expect(createCode(state).split('\n')).toEqual([
        '',
        '@Entity("user")',
        'export class User {',
        '  @Column("int", { name: "created_at" })',
        '  createdAt: number;',
        '}',
        '',
      ]);
    });

    it('renders the PostgreSQL users table under the default name cases', () => {
      const { state } = createUsersFixture();

      expect(createCode(state).split('\n')).toEqual([
        '',
        '@Entity("users")',
        'export class Users {',
        '  @PrimaryColumn("uuid", { default: () => "gen_random_uuid()" })',
        '  id: string;',
        '',
        '  @Column("varchar", { length: 255, unique: true, comment: "login email" })',
        '  email: string;',
        '',
        '  @Column("text", { nullable: true })',
        '  bio: string | null;',
        '',
        '  @Column("numeric", { precision: 10, scale: 2, default: () => "0" })',
        '  balance: string;',
        '',
        '  @Column("timestamptz", { name: "last seen", nullable: true })',
        '  lastSeen: Date | null;',
        '}',
        '',
      ]);
    });

    it('orders the classes by table name, not by document order', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'zebra' }),
          createTable({ id: 't2', name: 'ant' }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        '@Entity("ant")',
        'export class Ant {}',
        '',
        '@Entity("zebra")',
        'export class Zebra {}',
        '',
      ]);
    });

    it('skips table ids that are not in the collection', () => {
      const { state } = createSharedFixture();
      state.doc.tableIds = ['missing', 't1'];

      expect(createCode(state).split('\n')).toEqual([
        '',
        '@Entity("user")',
        'export class User {',
        '  @Column("int", { name: "created_at" })',
        '  createdAt: number;',
        '}',
        '',
      ]);
    });
  });

  describe('formatTable', () => {
    it('appends to an existing buffer instead of replacing it', () => {
      const { state, table } = createSharedFixture();
      const buffer = ['// keep me'];

      formatTable(state, { buffer, table });

      expect(buffer[0]).toBe('// keep me');
      expect(buffer).toHaveLength(6);
    });

    it('matches createCode byte for byte for a single-table document', () => {
      const { state, table } = createSharedFixture();

      expect(['', ...render(state, table), ''].join('\n')).toBe(
        createCode(state)
      );
    });

    it('renders one table of a multi-table document with its own import header', () => {
      const { state, user } = createTeamFixture();

      expect(render(state, user)).toEqual([
        '@Entity("user")',
        'export class User {',
        '  @PrimaryGeneratedColumn({ type: "int" })',
        '  id: number;',
        '',
        '  @Column("int", { name: "team_id", nullable: true })',
        '  teamId: number | null;',
        '',
        '  @ManyToOne(() => Team, (team) => team.userList)',
        '  @JoinColumn([{ name: "team_id", referencedColumnName: "id" }])',
        '  team: Relation<Team> | null;',
        '}',
      ]);
    });
  });

  describe('type mapping', () => {
    it('maps every primitive type to a column type and an annotation', () => {
      const cases: Array<[string, string, string]> = [
        ['INT', 'int', 'number'],
        ['BIGINT', 'bigint', 'string'],
        ['FLOAT', 'float', 'number'],
        ['DOUBLE', 'double', 'number'],
        ['DECIMAL', 'decimal', 'string'],
        ['BOOLEAN', 'boolean', 'boolean'],
        ['VARCHAR', 'varchar', 'string'],
        ['TEXT', 'text', 'string'],
        ['DATE', 'date', 'string'],
        ['DATETIME', 'datetime', 'Date'],
        ['TIME', 'time', 'string'],
      ];

      cases.forEach(([dataType, type, annotation]) => {
        expect(createTypeFixture(dataType, Database.MySQL)).toBe(
          `  @Column("${type}", { nullable: true })`
        );
        expect(createAnnotationFixture(dataType, Database.MySQL)).toBe(
          `  value: ${annotation};`
        );
      });
    });

    it('reads a 64-bit integer as a string and the other long members as numbers', () => {
      expect(createAnnotationFixture('BIGINT', Database.MySQL)).toBe(
        '  value: string;'
      );
      expect(createAnnotationFixture('SERIAL', Database.MySQL)).toBe(
        '  value: string;'
      );
      expect(createAnnotationFixture('bigserial', Database.PostgreSQL)).toBe(
        '  value: string;'
      );
      expect(createAnnotationFixture('UNSIGNED BIG INT', Database.SQLite)).toBe(
        '  value: string;'
      );
      expect(createAnnotationFixture('NUMBER', Database.Oracle)).toBe(
        '  value: number;'
      );
      expect(createAnnotationFixture('oid', Database.PostgreSQL)).toBe(
        '  value: number;'
      );
    });

    it('reads the binary types as a Buffer whichever primitive they resolve to', () => {
      expect(createAnnotationFixture('BLOB', Database.MySQL)).toBe(
        '  value: Buffer;'
      );
      expect(createAnnotationFixture('LONG VARBINARY', Database.MySQL)).toBe(
        '  value: Buffer;'
      );
      expect(createAnnotationFixture('VARBINARY', Database.MySQL)).toBe(
        '  value: Buffer;'
      );
      expect(createAnnotationFixture('bytea', Database.PostgreSQL)).toBe(
        '  value: Buffer;'
      );
      expect(createAnnotationFixture('LONG RAW', Database.Oracle)).toBe(
        '  value: Buffer;'
      );
      expect(createAnnotationFixture('image', Database.MSSQL)).toBe(
        '  value: Buffer;'
      );
    });

    it('reads a document type as an object and keeps the vendor spelling', () => {
      expect(createTypeFixture('jsonb', Database.PostgreSQL)).toBe(
        '  @Column("jsonb", { nullable: true })'
      );
      expect(createAnnotationFixture('jsonb', Database.PostgreSQL)).toBe(
        '  value: object;'
      );
      expect(createTypeFixture('JSON', Database.MySQL)).toBe(
        '  @Column("json", { nullable: true })'
      );
      expect(createAnnotationFixture('JSON', Database.MySQL)).toBe(
        '  value: object;'
      );
    });

    it('keeps a timezone-aware type name rather than collapsing it', () => {
      expect(
        createTypeFixture('timestamp(3) with time zone', Database.PostgreSQL)
      ).toBe(
        '  @Column("timestamp with time zone", { precision: 3, nullable: true })'
      );
      expect(
        createAnnotationFixture('timestamp with time zone', Database.PostgreSQL)
      ).toBe('  value: Date;');
      expect(createTypeFixture('timetz', Database.PostgreSQL)).toBe(
        '  @Column("timetz", { nullable: true })'
      );
      expect(createAnnotationFixture('timetz', Database.PostgreSQL)).toBe(
        '  value: string;'
      );
    });

    it('lifts a length out of a string type and a precision out of a decimal', () => {
      expect(createTypeFixture('VARCHAR(255)', Database.MySQL)).toBe(
        '  @Column("varchar", { length: 255, nullable: true })'
      );
      expect(createTypeFixture('DECIMAL(10)', Database.MySQL)).toBe(
        '  @Column("decimal", { precision: 10, nullable: true })'
      );
      expect(createTypeFixture('DECIMAL(10, 2)', Database.MySQL)).toBe(
        '  @Column("decimal", { precision: 10, scale: 2, nullable: true })'
      );
      expect(createTypeFixture('binary(16)', Database.MySQL)).toBe(
        '  @Column("binary", { length: 16, nullable: true })'
      );
    });

    it('keeps the members of an enum and of a set, which are the type', () => {
      expect(
        createTypeFixture("ENUM('G','PG-13','NC-17')", Database.MySQL)
      ).toBe(
        '  @Column("enum", { enum: ["G", "PG-13", "NC-17"], nullable: true })'
      );
      expect(createAnnotationFixture("ENUM('G','PG-13')", Database.MySQL)).toBe(
        '  value: "G" | "PG-13";'
      );
      expect(
        createTypeFixture("SET('Trailers','Commentaries')", Database.MySQL)
      ).toBe(
        '  @Column("set", { enum: ["Trailers", "Commentaries"], nullable: true })'
      );
      expect(
        createAnnotationFixture(
          "SET('Trailers','Commentaries')",
          Database.MySQL
        )
      ).toBe('  value: ("Trailers" | "Commentaries")[];');
    });

    it('reads a member that holds a comma or doubles its own quote', () => {
      expect(
        createTypeFixture("ENUM('a,b','it''s','sa\"y')", Database.MySQL)
      ).toBe(
        '  @Column("enum", { enum: ["a,b", "it\'s", "sa\\"y"], nullable: true })'
      );
    });

    it('falls back to the primitive type for a list it cannot read as members', () => {
      expect(createTypeFixture('ENUM', Database.MySQL)).toBe(
        '  @Column("enum", { nullable: true })'
      );
      expect(createTypeFixture('enum(a, b)', Database.MySQL)).toBe(
        '  @Column("enum", { nullable: true })'
      );
      expect(createAnnotationFixture('ENUM', Database.MySQL)).toBe(
        '  value: string;'
      );
    });

    it('drops an argument list it cannot read as positive integers', () => {
      expect(createTypeFixture('CHAR(0)', Database.MySQL)).toBe(
        '  @Column("char", { nullable: true })'
      );
      expect(createTypeFixture('VARCHAR()', Database.MySQL)).toBe(
        '  @Column("varchar", { nullable: true })'
      );
      expect(createTypeFixture('INT(11)', Database.MySQL)).toBe(
        '  @Column("int", { nullable: true })'
      );
    });

    it('strips arguments and collapses whitespace before naming the type', () => {
      expect(createTypeFixture('VARCHAR2(50 BYTE)', Database.Oracle)).toBe(
        '  @Column("varchar2", { nullable: true })'
      );
      expect(
        createTypeFixture('interval day(2) to second(6)', Database.Oracle)
      ).toBe('  @Column("interval day to second", { nullable: true })');
    });

    it('leaves the type unstated for a column with no data type', () => {
      expect(createTypeFixture('', Database.MySQL)).toBe(
        '  @Column({ nullable: true })'
      );
      expect(createAnnotationFixture('', Database.MySQL)).toBe(
        '  value: string;'
      );
    });

    it('substitutes a name TypeORM knows for one outside its column types', () => {
      expect(createTypeFixture('bigserial', Database.PostgreSQL)).toBe(
        '  @Column("bigint", { nullable: true })'
      );
      expect(createTypeFixture('serial', Database.PostgreSQL)).toBe(
        '  @Column("int", { nullable: true })'
      );
      expect(createTypeFixture('oid', Database.PostgreSQL)).toBe(
        '  @Column("int", { nullable: true })'
      );
      expect(createTypeFixture('bpchar', Database.PostgreSQL)).toBe(
        '  @Column("varchar", { nullable: true })'
      );
      expect(createTypeFixture('LONG VARBINARY', Database.MySQL)).toBe(
        '  @Column("varbinary", { nullable: true })'
      );
      expect(createTypeFixture('BINARY_FLOAT', Database.Oracle)).toBe(
        '  @Column("float", { nullable: true })'
      );
    });

    it('falls back to a string for a type the vendor does not list', () => {
      expect(createTypeFixture('nope', Database.MySQL)).toBe(
        '  @Column("varchar", { nullable: true })'
      );
      expect(createAnnotationFixture('nope', Database.MySQL)).toBe(
        '  value: string;'
      );
    });

    it('lifts a length only onto a type that carries one', () => {
      expect(createTypeFixture('TEXT(500)', Database.MySQL)).toBe(
        '  @Column("text", { nullable: true })'
      );
      expect(createTypeFixture('BLOB(500)', Database.MySQL)).toBe(
        '  @Column("blob", { nullable: true })'
      );
      expect(createTypeFixture('VARCHAR(500)', Database.MySQL)).toBe(
        '  @Column("varchar", { length: 500, nullable: true })'
      );
    });
  });

  describe('empty tables', () => {
    it('renders a table with no columns as an empty class', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'empty' })],
      });

      expect(render(state, state.collections.tableEntities.t1)).toEqual([
        '@Entity("empty")',
        'export class Empty {}',
      ]);
    });
  });

  describe('name cases', () => {
    it('applies the table and column name cases to the identifiers only', () => {
      const { state, table } = createUsersFixture({
        tableNameCase: NameCase.snakeCase,
        columnNameCase: NameCase.pascalCase,
      });

      expect(render(state, table)).toEqual([
        '@Entity("users")',
        'export class users {',
        '  @PrimaryColumn("uuid", { name: "id", default: () => "gen_random_uuid()" })',
        '  Id: string;',
        '',
        '  @Column("varchar", {',
        '    name: "email",',
        '    length: 255,',
        '    unique: true,',
        '    comment: "login email",',
        '  })',
        '  Email: string;',
        '',
        '  @Column("text", { name: "bio", nullable: true })',
        '  Bio: string | null;',
        '',
        '  @Column("numeric", {',
        '    name: "balance",',
        '    precision: 10,',
        '    scale: 2,',
        '    default: () => "0",',
        '  })',
        '  Balance: string;',
        '',
        '  @Column("timestamptz", { name: "last seen", nullable: true })',
        '  LastSeen: Date | null;',
        '}',
      ]);
    });

    it('omits the database name when the identifier already spells it', () => {
      const { state, table } = createUsersFixture({
        columnNameCase: NameCase.none,
      });

      expect(render(state, table)).toContain(
        '  @Column("text", { nullable: true })'
      );
      expect(render(state, table)).toContain('  bio: string | null;');
    });
  });

  describe('constraints', () => {
    it('generates an auto-increment primary key and states its numeric type', () => {
      const { state, team } = createTeamFixture();

      expect(render(state, team)).toContain(
        '  @PrimaryGeneratedColumn({ type: "int" })'
      );
    });

    it('drops the default of a generated key, which has no option to carry it', () => {
      const table = createTable({ id: 't1', name: 'probe', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
            default: '0',
            options:
              ColumnOption.primaryKey |
              ColumnOption.autoIncrement |
              ColumnOption.unique,
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toContain(
        '  @PrimaryGeneratedColumn({ type: "int" })'
      );
      expect(render(state, table).join('\n')).not.toContain('default');
      expect(render(state, table).join('\n')).not.toContain('unique');
    });

    it('annotates a generated key by its strategy, not by the data type', () => {
      const table = createTable({
        id: 't1',
        name: 'account',
        columnIds: ['c1'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'bigserial',
            options: ColumnOption.primaryKey | ColumnOption.autoIncrement,
          }),
        ],
        settings: { database: Database.PostgreSQL },
      });

      expect(render(state, table)).toEqual([
        '@Entity("account")',
        'export class Account {',
        '  @PrimaryGeneratedColumn({ type: "bigint" })',
        '  id: string;',
        '}',
      ]);
    });

    it('names the uuid strategy instead of a numeric type', () => {
      const table = createTable({ id: 't1', name: 'probe', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'uuid',
            options: ColumnOption.primaryKey | ColumnOption.autoIncrement,
          }),
        ],
        settings: { database: Database.PostgreSQL },
      });

      expect(render(state, table)).toEqual([
        '@Entity("probe")',
        'export class Probe {',
        '  @PrimaryGeneratedColumn("uuid")',
        '  id: string;',
        '}',
      ]);
    });

    it('leaves the type unstated when the generated strategy would reject it', () => {
      const table = createTable({ id: 't1', name: 'probe', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'code',
            dataType: 'varchar(10)',
            options: ColumnOption.primaryKey | ColumnOption.autoIncrement,
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toEqual([
        '@Entity("probe")',
        'export class Probe {',
        '  @PrimaryGeneratedColumn()',
        '  code: number;',
        '}',
      ]);
    });

    it('marks an auto-increment column that is not the primary key', () => {
      const table = createTable({
        id: 't1',
        name: 'log',
        columnIds: ['c1', 'c2'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'seq',
            dataType: 'int',
            default: '0',
            options: ColumnOption.autoIncrement | ColumnOption.notNull,
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toEqual([
        '@Entity("log")',
        'export class Log {',
        '  @PrimaryColumn("int")',
        '  id: number;',
        '',
        '  @Column("int", { generated: "increment" })',
        '  seq: number;',
        '}',
      ]);
    });

    it('emits one PrimaryColumn per member of a composite primary key', () => {
      const table = createTable({
        id: 't1',
        name: 'membership',
        columnIds: ['c1', 'c2'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'user_id',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'team_id',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toEqual([
        '@Entity("membership")',
        'export class Membership {',
        '  @PrimaryColumn("int", { name: "user_id" })',
        '  userId: number;',
        '',
        '  @PrimaryColumn("int", { name: "team_id" })',
        '  teamId: number;',
        '}',
      ]);
    });

    it('never emits nullable: false; the annotation carries what NOT NULL says', () => {
      const { state } = createUsersFixture();

      expect(createCode(state)).not.toContain('nullable: false');
      expect(createCode(state)).toContain('nullable: true');
    });

    it('states the table comment on the entity', () => {
      const table = createTable({
        id: 't1',
        name: 'user',
        comment: 'one row per person',
      });
      const state = createState({ tables: [table] });

      expect(render(state, table)).toContain(
        '@Entity("user", { comment: "one row per person" })'
      );
    });

    it('ignores a comment or a default that is only whitespace', () => {
      const table = createTable({
        id: 't1',
        name: 'user',
        comment: '  ',
        columnIds: ['c1'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
            comment: ' ',
            default: '\t',
            options: ColumnOption.notNull,
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toEqual([
        '@Entity("user")',
        'export class User {',
        '  @Column("int")',
        '  id: number;',
        '}',
      ]);
    });

    it('escapes a quote, a backslash and a newline in every string it emits', () => {
      const table = createTable({
        id: 't1',
        name: 'sa"y',
        comment: 'a\\b',
        columnIds: ['c1'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'q"uote',
            dataType: 'varchar(10)',
            comment: 'line\r\none',
            default: "'a\"b'",
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toEqual([
        '@Entity("sa\\"y", { comment: "a\\\\b" })',
        'export class SaY {',
        '  @Column("varchar", {',
        '    name: "q\\"uote",',
        '    length: 10,',
        '    nullable: true,',
        '    default: () => "\'a\\"b\'",',
        '    comment: "line\\none",',
        '  })',
        '  qUote: string | null;',
        '}',
      ]);
    });
  });

  describe('identifiers', () => {
    it('escapes a reserved word a class or a member cannot spell', () => {
      const table = createTable({
        id: 't1',
        name: 'class',
        columnIds: ['c1', 'c2'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'default',
            dataType: 'int',
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'constructor',
            dataType: 'int',
          }),
        ],
        settings: {
          database: Database.MySQL,
          tableNameCase: NameCase.none,
        },
      });

      expect(render(state, table)).toContain('export class class_ {');
      expect(render(state, table)).toContain('  default_: number | null;');
      expect(render(state, table)).toContain('  constructor_: number | null;');
    });

    it('escapes the words a class name cannot spell outside the reserved list', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'await' }),
          createTable({ id: 't2', name: 'eval' }),
          createTable({ id: 't3', name: 'arguments' }),
        ],
        settings: { tableNameCase: NameCase.none },
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        '@Entity("arguments")',
        'export class arguments_ {}',
        '',
        '@Entity("await")',
        'export class await_ {}',
        '',
        '@Entity("eval")',
        'export class eval_ {}',
        '',
      ]);
    });

    it('moves an identifier that would start with a digit or be empty', () => {
      const table = createTable({
        id: 't1',
        name: '1st',
        columnIds: ['c1', 'c2'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({ id: 'c1', tableId: 't1', name: '2nd', dataType: '' }),
          createColumn({ id: 'c2', tableId: 't1', name: '-', dataType: '' }),
        ],
        settings: { database: Database.MySQL, tableNameCase: NameCase.none },
      });

      expect(render(state, table)).toEqual([
        '@Entity("1st")',
        'export class x1st {',
        '  @Column({ name: "2nd", nullable: true })',
        '  x2Nd: string | null;',
        '',
        '  @Column({ name: "-", nullable: true })',
        '  x: string | null;',
        '}',
      ]);
    });

    it('renders an unnamed column with a repaired identifier and an empty name', () => {
      const table = createTable({ id: 't1', name: 'probe', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [createColumn({ id: 'c1', tableId: 't1', name: '' })],
      });

      expect(render(state, table)).toContain(
        '  @Column({ name: "", nullable: true })'
      );
      expect(render(state, table)).toContain('  x: string | null;');
    });

    it('deduplicates a class name two tables would both claim', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'user_log' }),
          createTable({ id: 't2', name: 'user log' }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        '@Entity("user log")',
        'export class UserLog {}',
        '',
        '@Entity("user_log")',
        'export class UserLog2 {}',
        '',
      ]);
    });

    it('renames a class that would shadow an imported decorator', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'column', columnIds: ['c1'] }),
          createTable({ id: 't2', name: 'date' }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'at',
            dataType: 'int',
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(createCode(state)).toContain('export class Column2 {');
      expect(createCode(state)).toContain('export class Date2 {}');
      expect(createCode(state)).toContain(
        '  @Column("int", { nullable: true })'
      );
    });

    it('deduplicates a property name a relationship would collide with', () => {
      const { state, user } = createTeamFixture();
      state.collections.tableColumnEntities.uc_team.name = 'team';

      expect(render(state, user)).toContain('  team: number | null;');
      expect(render(state, user)).toContain('  team2: Relation<Team> | null;');
    });
  });

  describe('relationships', () => {
    it('owns the foreign key on the many-to-one end and faces it on the other', () => {
      const { state, team, user } = createTeamFixture();

      expect(render(state, team)).toEqual([
        '@Entity("team")',
        'export class Team {',
        '  @PrimaryGeneratedColumn({ type: "int" })',
        '  id: number;',
        '',
        '  @OneToMany(() => User, (user) => user.team)',
        '  userList: User[];',
        '}',
      ]);
      expect(render(state, user)).toContain(
        '  @ManyToOne(() => Team, (team) => team.userList)'
      );
      expect(render(state, user)).toContain(
        '  @JoinColumn([{ name: "team_id", referencedColumnName: "id" }])'
      );
    });

    it('drops the null from the parent once the foreign key is required', () => {
      const { state, user } = createTeamFixture(
        RelationshipType.OneN,
        ColumnOption.notNull
      );

      expect(render(state, user)).toContain('  team: Relation<Team>;');
      expect(render(state, user)).toContain('  teamId: number;');
    });

    it('wraps a single-entity relation in Relation but not a collection', () => {
      const { state, team, user } = createTeamFixture();

      expect(render(state, user)).toContain('  team: Relation<Team> | null;');
      expect(render(state, team)).toContain('  userList: User[];');
      expect(render(state, team).join('\n')).not.toContain('Relation');
    });

    it('renders a one relationship as a scalar on both ends', () => {
      const { state, team, user } = createTeamFixture(RelationshipType.ZeroOne);

      expect(render(state, team)).toContain(
        '  @OneToOne(() => User, (user) => user.team)'
      );
      expect(render(state, team)).toContain('  user: Relation<User> | null;');
      expect(render(state, user)).toContain(
        '  @OneToOne(() => Team, (team) => team.user)'
      );
      expect(render(state, user)).toContain('  team: Relation<Team> | null;');
    });

    it('names every column of a composite foreign key in order', () => {
      const parent = createTable({
        id: 'tp',
        name: 'parent',
        columnIds: ['pa', 'pb'],
      });
      const child = createTable({
        id: 'tc',
        name: 'child',
        columnIds: ['ca', 'cb'],
      });
      const state = createState({
        tables: [parent, child],
        columns: [
          createColumn({
            id: 'pa',
            tableId: 'tp',
            name: 'tenant_id',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'pb',
            tableId: 'tp',
            name: 'code',
            dataType: 'varchar(10)',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'ca',
            tableId: 'tc',
            name: 'tenant_id',
            dataType: 'int',
            options: ColumnOption.notNull,
          }),
          createColumn({
            id: 'cb',
            tableId: 'tc',
            name: 'parent_code',
            dataType: 'varchar(10)',
            options: ColumnOption.notNull,
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 'tp', columnIds: ['pa', 'pb'] },
            end: { tableId: 'tc', columnIds: ['ca', 'cb'] },
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, child)).toEqual([
        '@Entity("child")',
        'export class Child {',
        '  @Column("int", { name: "tenant_id" })',
        '  tenantId: number;',
        '',
        '  @Column("varchar", { name: "parent_code", length: 10 })',
        '  parentCode: string;',
        '',
        '  @ManyToOne(() => Parent, (parent) => parent.childList)',
        '  @JoinColumn([',
        '    { name: "tenant_id", referencedColumnName: "tenantId" },',
        '    { name: "parent_code", referencedColumnName: "code" },',
        '  ])',
        '  parent: Relation<Parent>;',
        '}',
      ]);
    });

    it('gives each of two relationships joining one pair its own property', () => {
      const { state, team, user } = createTeamFixture();
      state.collections.tableEntities.t_user.columnIds.push('uc_owner');
      state.collections.tableColumnEntities.uc_owner = createColumn({
        id: 'uc_owner',
        tableId: 't_user',
        name: 'owner_team_id',
        dataType: 'int',
      });
      state.collections.relationshipEntities.r2 = createRelationship({
        id: 'r2',
        relationshipType: RelationshipType.ZeroN,
        start: { tableId: 't_team', columnIds: ['tc_id'] },
        end: { tableId: 't_user', columnIds: ['uc_owner'] },
      });
      state.doc.relationshipIds.push('r2');

      expect(render(state, user)).toContain('  team: Relation<Team> | null;');
      expect(render(state, user)).toContain('  team2: Relation<Team> | null;');
      expect(render(state, team)).toContain('  userList: User[];');
      expect(render(state, team)).toContain('  userList2: User[];');
      expect(render(state, user)).toContain(
        '  @ManyToOne(() => Team, (team) => team.userList2)'
      );
    });

    it('substitutes a known name for a data type that is not one at all', () => {
      const table = createTable({ id: 't1', name: 'q', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'a',
            dataType: 'va"rchar(10)',
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toContain(
        '  @Column("varchar", { length: 10, nullable: true })'
      );
    });

    it('gives each relationship its own property when both end on one column', () => {
      const { state, user } = createTeamFixture();
      state.collections.tableEntities.t_org = createTable({
        id: 't_org',
        name: 'org',
        columnIds: ['oc_id'],
      });
      state.collections.tableColumnEntities.oc_id = createColumn({
        id: 'oc_id',
        tableId: 't_org',
        name: 'id',
        dataType: 'int',
        options: ColumnOption.primaryKey,
      });
      state.doc.tableIds.push('t_org');
      state.collections.relationshipEntities.r2 = createRelationship({
        id: 'r2',
        relationshipType: RelationshipType.ZeroN,
        start: { tableId: 't_org', columnIds: ['oc_id'] },
        end: { tableId: 't_user', columnIds: ['uc_team'] },
      });
      state.doc.relationshipIds.push('r2');

      const lines = render(state, user);

      expect(lines).toContain(
        '  @JoinColumn([{ name: "team_id", referencedColumnName: "id" }])'
      );
      expect(lines).toContain('  team: Relation<Team> | null;');
      expect(lines).toContain('  org: Relation<Org> | null;');
      expect(
        lines.filter(line => line.startsWith('  @JoinColumn'))
      ).toHaveLength(2);
    });

    it('emits nothing for a relationship type that is neither one nor N', () => {
      const { state, team, user } = createTeamFixture(1);

      expect(render(state, user).join('\n')).not.toContain('@ManyToOne');
      expect(render(state, user)).toContain(
        '  @Column("int", { name: "team_id", nullable: true })'
      );
      expect(render(state, team).join('\n')).not.toContain('@OneToMany');
    });

    it('skips a relationship whose ends do not resolve', () => {
      const cases: Array<(state: RootState) => void> = [
        state => {
          state.collections.relationshipEntities.r1.start.tableId = 'missing';
        },
        state => {
          state.collections.relationshipEntities.r1.end.tableId = 'missing';
        },
        state => {
          state.collections.relationshipEntities.r1.end.columnIds = [];
        },
        state => {
          state.collections.relationshipEntities.r1.start.columnIds = [
            'missing',
          ];
        },
        state => {
          state.collections.relationshipEntities.r1.end.columnIds = ['missing'];
        },
        state => {
          state.collections.relationshipEntities.r1.start.columnIds = [
            'tc_id',
            'tc_id',
          ];
        },
        state => {
          state.collections.relationshipEntities.r1.start.columnIds = ['uc_id'];
        },
        state => {
          state.collections.relationshipEntities.r1.end.columnIds = ['tc_id'];
        },
      ];

      cases.forEach(mutate => {
        const { state, user } = createTeamFixture();
        mutate(state);

        expect(render(state, user).join('\n')).not.toContain('@ManyToOne');
      });
    });
  });

  describe('self-referential relationships', () => {
    it('names the owning end after the parent so it cannot collide', () => {
      const table = createTable({
        id: 't1',
        name: 'category',
        columnIds: ['c1', 'c2'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey | ColumnOption.autoIncrement,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'parent_id',
            dataType: 'int',
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't1', columnIds: ['c1'] },
            end: { tableId: 't1', columnIds: ['c2'] },
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toEqual([
        '@Entity("category")',
        'export class Category {',
        '  @PrimaryGeneratedColumn({ type: "int" })',
        '  id: number;',
        '',
        '  @Column("int", { name: "parent_id", nullable: true })',
        '  parentId: number | null;',
        '',
        '  @ManyToOne(() => Category, (category) => category.categoryList)',
        '  @JoinColumn([{ name: "parent_id", referencedColumnName: "id" }])',
        '  parentCategory: Relation<Category> | null;',
        '',
        '  @OneToMany(() => Category, (category) => category.parentCategory)',
        '  categoryList: Category[];',
        '}',
      ]);
    });

    it('renders a one-to-one self reference as a scalar on both ends', () => {
      const table = createTable({
        id: 't1',
        name: 'node',
        columnIds: ['c1', 'c2'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'next_id',
            dataType: 'int',
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroOne,
            start: { tableId: 't1', columnIds: ['c1'] },
            end: { tableId: 't1', columnIds: ['c2'] },
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toContain(
        '  parentNode: Relation<Node> | null;'
      );
      expect(render(state, table)).toContain('  node: Relation<Node> | null;');
    });
  });

  describe('indexes', () => {
    it('lists the properties of a named index above the entity', () => {
      const table = createTable({
        id: 't1',
        name: 'user',
        columnIds: ['c1', 'c2'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'first_name',
            dataType: 'varchar(50)',
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'last_name',
            dataType: 'varchar(50)',
          }),
        ],
        indexes: [
          createIndex({
            id: 'i1',
            tableId: 't1',
            name: 'IDX_name',
            unique: true,
            indexColumnIds: ['ic1', 'ic2'],
          }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c1' }),
          createIndexColumn({ id: 'ic2', indexId: 'i1', columnId: 'c2' }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)[0]).toBe(
        '@Index("IDX_name", ["firstName", "lastName"], { unique: true })'
      );
    });

    it('auto-names an index the document left blank', () => {
      const table = createTable({ id: 't1', name: 'user', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'email',
            dataType: 'varchar(50)',
          }),
        ],
        indexes: [
          createIndex({
            id: 'i1',
            tableId: 't1',
            name: '  ',
            indexColumnIds: ['ic1'],
          }),
          createIndex({
            id: 'i2',
            tableId: 't1',
            name: '',
            indexColumnIds: ['ic2'],
          }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c1' }),
          createIndexColumn({ id: 'ic2', indexId: 'i2', columnId: 'c1' }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table).slice(0, 2)).toEqual([
        '@Index("IDX_user", ["email"])',
        '@Index("IDX_user1", ["email"])',
      ]);
    });

    it('numbers an auto-named index around the names the document already gives', () => {
      const table = createTable({ id: 't1', name: 'user', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'email',
            dataType: 'varchar(50)',
          }),
        ],
        indexes: [
          createIndex({
            id: 'i1',
            tableId: 't1',
            name: '',
            indexColumnIds: ['ic1'],
          }),
          createIndex({
            id: 'i2',
            tableId: 't1',
            name: 'IDX_user',
            indexColumnIds: ['ic2'],
          }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c1' }),
          createIndexColumn({ id: 'ic2', indexId: 'i2', columnId: 'c1' }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table).slice(0, 2)).toEqual([
        '@Index("IDX_user1", ["email"])',
        '@Index("IDX_user", ["email"])',
      ]);
    });

    it('numbers an auto-named index the same way in both entry points', () => {
      const first = createTable({ id: 't1', name: 'user', columnIds: ['c1'] });
      const second = createTable({ id: 't2', name: 'user', columnIds: ['c2'] });
      const state = createState({
        tables: [first, second],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'email',
            dataType: 'varchar(50)',
          }),
          createColumn({
            id: 'c2',
            tableId: 't2',
            name: 'email',
            dataType: 'varchar(50)',
          }),
        ],
        indexes: [
          createIndex({
            id: 'i1',
            tableId: 't1',
            name: '',
            indexColumnIds: ['ic1'],
          }),
          createIndex({
            id: 'i2',
            tableId: 't2',
            name: '',
            indexColumnIds: ['ic2'],
          }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c1' }),
          createIndexColumn({ id: 'ic2', indexId: 'i2', columnId: 'c2' }),
        ],
        settings: { database: Database.MySQL },
      });
      const whole = createCode(state);

      expect(whole).toContain('@Index("IDX_user", ["email"])');
      expect(whole).toContain('@Index("IDX_user1", ["email"])');
      expect(render(state, first)[0]).toBe('@Index("IDX_user", ["email"])');
      expect(render(state, second)[0]).toBe('@Index("IDX_user1", ["email"])');
    });

    it('lists a property once when two columns of one name are both indexed', () => {
      const table = createTable({
        id: 't1',
        name: 'thing',
        columnIds: ['c1', 'c2'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'a',
            dataType: 'int',
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'a',
            dataType: 'int',
          }),
        ],
        indexes: [
          createIndex({
            id: 'i1',
            tableId: 't1',
            name: 'IDX_thing',
            unique: true,
            indexColumnIds: ['ic1', 'ic2'],
          }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c1' }),
          createIndexColumn({ id: 'ic2', indexId: 'i1', columnId: 'c2' }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)[0]).toBe(
        '@Index("IDX_thing", ["a"], { unique: true })'
      );
    });

    it('drops an index column this class does not map', () => {
      const table = createTable({ id: 't1', name: 'user', columnIds: ['c1'] });
      const other = createTable({ id: 't2', name: 'other', columnIds: ['c2'] });
      const state = createState({
        tables: [table, other],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'email',
            dataType: 'varchar(50)',
          }),
          createColumn({
            id: 'c2',
            tableId: 't2',
            name: 'other',
            dataType: 'int',
          }),
        ],
        indexes: [
          createIndex({
            id: 'i1',
            tableId: 't1',
            name: 'IDX_mixed',
            indexColumnIds: ['ic1', 'ic2', 'ic3'],
          }),
          createIndex({
            id: 'i2',
            tableId: 't1',
            name: 'IDX_gone',
            indexColumnIds: ['ic3'],
          }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c1' }),
          createIndexColumn({ id: 'ic2', indexId: 'i1', columnId: 'c2' }),
          createIndexColumn({ id: 'ic3', indexId: 'i1', columnId: 'missing' }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)[0]).toBe('@Index("IDX_mixed", ["email"])');
      expect(render(state, table).join('\n')).not.toContain('IDX_gone');
    });
  });

  describe('line wrapping', () => {
    it('breaks the column list of an index that carries no options', () => {
      const table = createTable({
        id: 't1',
        name: 'user',
        columnIds: ['c1', 'c2'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'a_column_name_that_is_also_quite_long_indeed',
            dataType: 'int',
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'another_column_name_that_is_also_quite_long',
            dataType: 'int',
          }),
        ],
        indexes: [
          createIndex({
            id: 'i1',
            tableId: 't1',
            name: 'IDX_a_very_long_index_name_on_the_long_table',
            indexColumnIds: ['ic1', 'ic2'],
          }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c1' }),
          createIndexColumn({ id: 'ic2', indexId: 'i1', columnId: 'c2' }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table).slice(0, 4)).toEqual([
        '@Index("IDX_a_very_long_index_name_on_the_long_table", [',
        '  "aColumnNameThatIsAlsoQuiteLongIndeed",',
        '  "anotherColumnNameThatIsAlsoQuiteLong",',
        '])',
      ]);
    });

    it('expands the whole argument list when hugging the options would not fit', () => {
      const table = createTable({
        id: 't1',
        name: 'customer_order_line_item_detail',
        columnIds: ['c1', 'c2'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'shipping_address_line_one',
            dataType: 'int',
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'shipping_address_line_two',
            dataType: 'int',
          }),
        ],
        indexes: [
          createIndex({
            id: 'i1',
            tableId: 't1',
            name: 'IDX_customer_order_line_item_detail_shipping',
            unique: true,
            indexColumnIds: ['ic1', 'ic2'],
          }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c1' }),
          createIndexColumn({ id: 'ic2', indexId: 'i1', columnId: 'c2' }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table).slice(0, 6)).toEqual([
        '@Index(',
        '  "IDX_customer_order_line_item_detail_shipping",',
        '  ["shippingAddressLineOne", "shippingAddressLineTwo"],',
        '  { unique: true },',
        ')',
        '@Entity("customer_order_line_item_detail")',
      ]);
    });

    it('leaves a long call whose one argument cannot be split any further', () => {
      const name =
        'a_table_whose_name_is_long_enough_to_push_the_entity_call_over_the_limit';
      const table = createTable({ id: 't1', name });
      const state = createState({ tables: [table] });

      expect(render(state, table)[0]).toBe(`@Entity("${name}")`);
      expect(render(state, table)[0].length).toBeGreaterThan(80);
    });

    it('breaks the argument list of a relation that has no options to hug', () => {
      const { state, team, user } = createTeamFixture();
      state.collections.tableEntities.t_team.name =
        'a_team_whose_name_is_long_enough_to_push_things_over_the_limit';

      const lines = render(state, user);
      const head = lines.indexOf('  @ManyToOne(');

      expect(lines.slice(head, head + 4)).toEqual([
        '  @ManyToOne(',
        '    () => ATeamWhoseNameIsLongEnoughToPushThingsOverTheLimit,',
        '    (aTeamWhoseNameIsLongEnoughToPushThingsOverTheLimit) => aTeamWhoseNameIsLongEnoughToPushThingsOverTheLimit.userList,',
        '  )',
      ]);
      expect(render(state, team)).toContain('  userList: User[];');
    });
  });

  describe('duplicate column names', () => {
    it('declares one property when two columns share a database name', () => {
      const table = createTable({
        id: 't1',
        name: 'user',
        columnIds: ['c1', 'c2'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'email',
            dataType: 'varchar(50)',
            options: ColumnOption.notNull,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'email',
            dataType: 'text',
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toEqual([
        '@Entity("user")',
        'export class User {',
        '  @Column("varchar", { length: 50 })',
        '  email: string;',
        '}',
      ]);
    });

    it('resolves a foreign key onto the column that carries the name', () => {
      const { state, user } = createTeamFixture();
      state.collections.tableEntities.t_user.columnIds = [
        'uc_id',
        'uc_dup',
        'uc_team',
      ];
      state.collections.tableColumnEntities.uc_dup = createColumn({
        id: 'uc_dup',
        tableId: 't_user',
        name: 'team_id',
        dataType: 'int',
        options: ColumnOption.notNull,
      });
      state.collections.relationshipEntities.r1.end.columnIds = ['uc_team'];

      expect(render(state, user)).toContain(
        '  @Column("int", { name: "team_id" })'
      );
      expect(render(state, user)).toContain('  teamId: number;');
      expect(render(state, user)).toContain('  team: Relation<Team>;');
    });
  });

  describe('duplicate table names', () => {
    it('renders two tables of one name as two classes sharing an @Entity name', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'user' }),
          createTable({ id: 't2', name: 'user' }),
        ],
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        '@Entity("user")',
        'export class User {}',
        '',
        '@Entity("user")',
        'export class User2 {}',
        '',
      ]);
    });
  });
});
