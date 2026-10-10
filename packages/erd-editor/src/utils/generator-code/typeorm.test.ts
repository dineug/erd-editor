import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  ColumnOption,
  ColumnUIKey,
  Database,
  NameCase,
  ReferentialAction,
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

function memberLines(dataType: string, database: number, options = 0) {
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

  return render(state, table).slice(2, -1);
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

    it('renders one table of a multi-table document on its own', () => {
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
      expect(createAnnotationFixture('bigint', Database.MSSQL)).toBe(
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
      expect(
        createTypeFixture('interval day(2) to second(6)', Database.Oracle)
      ).toBe('  @Column("interval day to second", { nullable: true })');
    });

    it('lifts an Oracle length stated in bytes or in characters', () => {
      const cases: Array<[string, string]> = [
        ['VARCHAR2(50 BYTE)', '"varchar2", { length: 50,'],
        ['VARCHAR2(50 CHAR)', '"varchar2", { length: 50,'],
        ['varchar2( 50  char )', '"varchar2", { length: 50,'],
        ['CHAR(10 CHAR)', '"char", { length: 10,'],
        ['CHARACTER VARYING(10 CHAR)', '"varchar2", { length: 10,'],
        ['VARCHAR2(0 CHAR)', '"varchar2", {'],
      ];

      cases.forEach(([dataType, head]) => {
        expect(createTypeFixture(dataType, Database.Oracle)).toBe(
          `  @Column(${head} nullable: true })`
        );
      });
    });

    it('states the type a string reflects as for a column with no data type', () => {
      ['', ' ', '(10)'].forEach(dataType => {
        expect(memberLines(dataType, Database.MySQL)).toEqual([
          '  @Column("varchar", { nullable: true })',
          '  value: string | null;',
        ]);
      });
      expect(
        memberLines('', Database.PostgreSQL, ColumnOption.notNull)
      ).toEqual(['  @Column("varchar")', '  value: string;']);
      expect(memberLines('', Database.MSSQL)).toEqual([
        '  @Column("nvarchar", { nullable: true })',
        '  value: string | null;',
      ]);
    });

    it('substitutes a name TypeORM knows for one outside its column types', () => {
      expect(createTypeFixture('oid', Database.PostgreSQL)).toBe(
        '  @Column("int", { nullable: true })'
      );
      expect(createTypeFixture('bpchar', Database.PostgreSQL)).toBe(
        '  @Column("varchar", { nullable: true })'
      );
      expect(createTypeFixture('LONG VARBINARY', Database.MySQL)).toBe(
        '  @Column("mediumblob", { nullable: true })'
      );
      expect(createTypeFixture('binary varying(16)', Database.MSSQL)).toBe(
        '  @Column("varbinary", { length: 16, nullable: true })'
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

  describe('MySQL and MariaDB widths and signs', () => {
    it('marks an unsigned integer and keeps its width', () => {
      const cases: Array<[string, string, string]> = [
        ['TINYINT UNSIGNED', 'tinyint', 'number'],
        ['SMALLINT(5) UNSIGNED ZEROFILL', 'smallint', 'number'],
        ['MEDIUMINT UNSIGNED', 'mediumint', 'number'],
        ['INT(10) UNSIGNED', 'int', 'number'],
        ['INT(11) ZEROFILL', 'int', 'number'],
        ['BIGINT UNSIGNED', 'bigint', 'string'],
      ];

      [Database.MySQL, Database.MariaDB].forEach(database => {
        cases.forEach(([dataType, type, annotation]) => {
          expect(createTypeFixture(dataType, database)).toBe(
            `  @Column("${type}", { unsigned: true, nullable: true })`
          );
          expect(createAnnotationFixture(dataType, database)).toBe(
            `  value: ${annotation};`
          );
        });
      });
    });

    it('names the type in the options where the typed overload refuses unsigned', () => {
      expect(memberLines('DECIMAL(10,2) UNSIGNED', Database.MySQL)).toEqual([
        '  @Column({',
        '    type: "decimal",',
        '    precision: 10,',
        '    scale: 2,',
        '    unsigned: true,',
        '    nullable: true,',
        '  })',
        '  value: string | null;',
      ]);
      expect(
        createAnnotationFixture('DECIMAL(10,2) UNSIGNED', Database.MySQL)
      ).toBe('  value: string;');
      expect(createTypeFixture('DOUBLE UNSIGNED', Database.MariaDB)).toBe(
        '  @Column({ type: "double", unsigned: true, nullable: true })'
      );
      expect(
        memberLines(
          'FLOAT(10,2) UNSIGNED',
          Database.MySQL,
          ColumnOption.notNull
        )
      ).toEqual([
        '  @Column({ type: "float", precision: 10, scale: 2, unsigned: true })',
        '  value: number;',
      ]);
      expect(createTypeFixture('FLOAT(53) UNSIGNED', Database.MySQL)).toBe(
        '  @Column({ type: "double", unsigned: true, nullable: true })'
      );
    });

    it('writes a FLOAT of one argument as the float or double it stores', () => {
      expect(createTypeFixture('FLOAT(24)', Database.MySQL)).toBe(
        '  @Column("float", { nullable: true })'
      );
      expect(createTypeFixture('FLOAT(25)', Database.MySQL)).toBe(
        '  @Column("double", { nullable: true })'
      );
      expect(createTypeFixture('FLOAT(53) SIGNED', Database.MariaDB)).toBe(
        '  @Column("double", { nullable: true })'
      );
      expect(createTypeFixture('FLOAT(10,2)', Database.MySQL)).toBe(
        '  @Column("float", { precision: 10, scale: 2, nullable: true })'
      );
    });

    it('writes a synonym as the type MySQL stores it as', () => {
      const cases: Array<[string, string, string]> = [
        ['INT1', 'tinyint', 'number'],
        ['INT2', 'smallint', 'number'],
        ['INT3', 'mediumint', 'number'],
        ['INT4', 'int', 'number'],
        ['INT8', 'bigint', 'string'],
        ['MIDDLEINT', 'mediumint', 'number'],
        ['FLOAT4', 'float', 'number'],
        ['FLOAT8', 'double', 'number'],
      ];

      cases.forEach(([dataType, type, annotation]) => {
        expect(createTypeFixture(dataType, Database.MySQL)).toBe(
          `  @Column("${type}", { nullable: true })`
        );
        expect(createAnnotationFixture(dataType, Database.MariaDB)).toBe(
          `  value: ${annotation};`
        );
      });
      expect(createTypeFixture('INT8 UNSIGNED', Database.MySQL)).toBe(
        '  @Column("bigint", { unsigned: true, nullable: true })'
      );
    });

    it('writes a character synonym as the type MySQL and MariaDB store it as', () => {
      const cases: Array<[string, string]> = [
        ['CHARACTER', '"char", {'],
        ['CHARACTER(10)', '"char", { length: 10,'],
        ['CHARACTER VARYING(10)', '"varchar", { length: 10,'],
        ['CHAR VARYING(10)', '"varchar", { length: 10,'],
        ['NATIONAL CHARACTER(10)', '"national char", { length: 10,'],
        ['LONG', '"mediumtext", {'],
        ['LONG VARCHAR', '"mediumtext", {'],
        ['LONG CHAR VARYING', '"mediumtext", {'],
        ['LONG CHARACTER VARYING', '"mediumtext", {'],
        ['LONG VARCHARACTER', '"mediumtext", {'],
        ['GEOMCOLLECTION', '"geometrycollection", {'],
        ['SQL_TSI_YEAR', '"year", {'],
      ];

      cases.forEach(([dataType, head]) => {
        expect(createTypeFixture(dataType, Database.MariaDB)).toBe(
          `  @Column(${head} nullable: true })`
        );
      });
      expect(createAnnotationFixture('LONG', Database.MySQL)).toBe(
        '  value: string;'
      );
      expect(createAnnotationFixture('LONG VARBINARY', Database.MySQL)).toBe(
        '  value: Buffer;'
      );
    });

    it('generates SERIAL, the unique unsigned bigint that is never null', () => {
      expect(memberLines('SERIAL', Database.MySQL)).toEqual([
        '  @Column("bigint", { unsigned: true, generated: "increment", unique: true })',
        '  value: string;',
      ]);
      expect(
        probe('SERIAL', Database.MariaDB, ColumnOption.primaryKey).decorator
      ).toBe('  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })');
    });

    it('carries the sign onto a generated key', () => {
      const keys: Array<[string, string]> = [
        [
          'INT UNSIGNED',
          '  @PrimaryGeneratedColumn({ type: "int", unsigned: true })',
        ],
        [
          'BIGINT UNSIGNED',
          '  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })',
        ],
      ];

      keys.forEach(([dataType, decorator]) => {
        const { decorator: rendered } = probe(
          dataType,
          Database.MySQL,
          ColumnOption.primaryKey | ColumnOption.autoIncrement
        );

        expect(rendered).toBe(decorator);
      });
      expect(
        probe(
          'BIGINT UNSIGNED',
          Database.MySQL,
          ColumnOption.primaryKey | ColumnOption.autoIncrement
        ).annotation
      ).toBe('  value: string;');
    });

    it('reads UNSIGNED on MySQL and MariaDB alone', () => {
      expect(createTypeFixture('INT UNSIGNED', Database.PostgreSQL)).toBe(
        '  @Column("int", { nullable: true })'
      );
    });

    it('reads a CHAR BYTE as the binary MySQL makes of it', () => {
      expect(createTypeFixture('CHAR(16) BYTE', Database.MySQL)).toBe(
        '  @Column("binary", { length: 16, nullable: true })'
      );
      expect(createAnnotationFixture('CHAR(16) BYTE', Database.MySQL)).toBe(
        '  value: Buffer;'
      );
    });

    it('reads ENUM members as MySQL reads a string literal', () => {
      expect(createTypeFixture("ENUM('a\\'b','x')", Database.MySQL)).toBe(
        '  @Column("enum", { enum: ["a\'b", "x"], nullable: true })'
      );
      expect(createTypeFixture('ENUM("a""b")', Database.MySQL)).toBe(
        '  @Column("enum", { enum: ["a\\"b"], nullable: true })'
      );
      expect(createTypeFixture("ENUM('a\\nb')", Database.MariaDB)).toBe(
        '  @Column("enum", { enum: ["a\\nb"], nullable: true })'
      );
    });

    it('writes a control character in a member as an escape that keeps it', () => {
      expect(memberLines("ENUM('a\\rb','c\\0')", Database.MySQL)).toEqual([
        '  @Column("enum", { enum: ["a\\rb", "c\\x00"], nullable: true })',
        '  value: "a\\rb" | "c\\x00" | null;',
      ]);
      expect(createTypeFixture("SET('a\\tb','c\\Z')", Database.MariaDB)).toBe(
        '  @Column("set", { enum: ["a\\tb", "c\\x1a"], nullable: true })'
      );
      expect(createTypeFixture("ENUM('a\r\nb')", Database.MySQL)).toBe(
        '  @Column("enum", { enum: ["a\\r\\nb"], nullable: true })'
      );
    });

    it('keeps the members of a list whose member holds a parenthesis', () => {
      expect(
        memberLines(
          "ENUM('Small (S)','Medium (M)')",
          Database.MySQL,
          ColumnOption.notNull
        )
      ).toEqual([
        '  @Column("enum", { enum: ["Small (S)", "Medium (M)"] })',
        '  value: "Small (S)" | "Medium (M)";',
      ]);
      expect(createTypeFixture("SET('x (1)','y')", Database.MariaDB)).toBe(
        '  @Column("set", { enum: ["x (1)", "y"], nullable: true })'
      );
      expect(
        createTypeFixture("enum('a','b') CHARACTER SET utf8mb4", Database.MySQL)
      ).toBe('  @Column("enum", { enum: ["a", "b"], nullable: true })');
    });

    it('reads the width of FLOAT(0) and of a FLOAT4 of one argument', () => {
      expect(createTypeFixture('FLOAT(0)', Database.MySQL)).toBe(
        '  @Column("float", { nullable: true })'
      );
      expect(createTypeFixture('FLOAT4(10)', Database.MariaDB)).toBe(
        '  @Column("float", { nullable: true })'
      );
      expect(createTypeFixture('FLOAT4(30)', Database.MySQL)).toBe(
        '  @Column("double", { nullable: true })'
      );
      expect(createTypeFixture('float(0)', Database.PostgreSQL)).toBe(
        '  @Column("float", { precision: 0, nullable: true })'
      );
    });

    it('reads the annotation of a type whose sign word follows it unspaced', () => {
      expect(
        memberLines('int(10)unsigned', Database.MySQL, ColumnOption.notNull)
      ).toEqual(['  @Column("int", { unsigned: true })', '  value: number;']);
      expect(
        probe(
          'int(10)unsigned',
          Database.MySQL,
          ColumnOption.primaryKey | ColumnOption.autoIncrement
        ).annotation
      ).toBe('  value: number;');
    });

    it('reads BIT as the Buffer mysql2 hands over, at any width', () => {
      [Database.MySQL, Database.MariaDB].forEach(database => {
        ['BIT', 'BIT(1)', 'BIT(8)'].forEach(dataType => {
          expect(createAnnotationFixture(dataType, database)).toBe(
            '  value: Buffer;'
          );
        });
      });
      expect(createTypeFixture('BIT(8)', Database.MySQL)).toBe(
        '  @Column("bit", { nullable: true })'
      );
    });
  });

  describe('PostgreSQL types', () => {
    it('writes an array as its element type with array set, one [] a dimension', () => {
      const cases: Array<[string, string, string]> = [
        ['int[]', '@Column("int", { array: true })', 'number[]'],
        ['text[][]', '@Column("text", { array: true })', 'string[][]'],
        ['integer ARRAY', '@Column("integer", { array: true })', 'number[]'],
        [
          'varchar(20)[]',
          '@Column("varchar", { length: 20, array: true })',
          'string[]',
        ],
        ['uuid[]', '@Column("uuid", { array: true })', 'string[]'],
        ['bytea[]', '@Column("bytea", { array: true })', 'Buffer[]'],
        ['timestamptz[]', '@Column("timestamptz", { array: true })', 'Date[]'],
        ['interval[]', '@Column("interval", { array: true })', 'object[]'],
        [
          "enum('a','b')[]",
          '@Column("enum", { enum: ["a", "b"], array: true })',
          '("a" | "b")[]',
        ],
      ];

      cases.forEach(([dataType, decorator, annotation]) => {
        const rendered = probe(
          dataType,
          Database.PostgreSQL,
          ColumnOption.notNull
        );

        expect(rendered.decorator).toBe(`  ${decorator}`);
        expect(rendered.annotation).toBe(`  value: ${annotation};`);
      });
      expect(probe('int[]', Database.PostgreSQL).annotation).toBe(
        '  value: number[] | null;'
      );
    });

    it('reads an array as node-postgres hands it over', () => {
      const cases: Array<[string, string, string]> = [
        [
          'numeric(10,2)[]',
          '@Column("numeric", { precision: 10, scale: 2, array: true })',
          'number[]',
        ],
        ['date[]', '@Column("date", { array: true })', 'Date[]'],
        [
          'bit(8)[]',
          '@Column({ type: "bit", length: 8, array: true })',
          'string',
        ],
        ['xid[]', '@Column("int", { array: true })', 'string'],
        ['"mood"[]', '@Column("varchar", { array: true })', 'string'],
      ];

      cases.forEach(([dataType, decorator, annotation]) => {
        expect(
          probe(dataType, Database.PostgreSQL, ColumnOption.notNull)
        ).toEqual({
          decorator: `  ${decorator}`,
          annotation: `  value: ${annotation};`,
        });
      });
    });

    it('writes dec as the decimal TypeORM takes for the numeric it stores', () => {
      const cases: Array<[string, string, string]> = [
        [
          'dec(10,2)',
          '@Column("decimal", { precision: 10, scale: 2 })',
          'string',
        ],
        ['DEC', '@Column("decimal")', 'string'],
        [
          'dec(10,2)[]',
          '@Column("decimal", { precision: 10, scale: 2, array: true })',
          'number[]',
        ],
      ];

      cases.forEach(([dataType, decorator, annotation]) => {
        expect(
          probe(dataType, Database.PostgreSQL, ColumnOption.notNull)
        ).toEqual({
          decorator: `  ${decorator}`,
          annotation: `  value: ${annotation};`,
        });
      });
    });

    it('states no precision on an array of dates, times or intervals', () => {
      const cases: Array<[string, string]> = [
        ['timestamp(3)[]', '@Column("timestamp", { array: true })'],
        ['timestamp(0)[]', '@Column("timestamp", { array: true })'],
        ['timestamptz(3)[]', '@Column("timestamptz", { array: true })'],
        [
          'timestamp(3) with time zone[]',
          '@Column("timestamp with time zone", { array: true })',
        ],
        ['time(3)[]', '@Column("time", { array: true })'],
        ['timetz(3)[][]', '@Column("timetz", { array: true })'],
        ['interval(3)[]', '@Column("interval", { array: true })'],
        ['interval second(3)[]', '@Column("interval", { array: true })'],
        ['interval day to second(3)[]', '@Column("interval", { array: true })'],
      ];

      cases.forEach(([dataType, decorator]) => {
        expect(
          probe(dataType, Database.PostgreSQL, ColumnOption.notNull).decorator
        ).toBe(`  ${decorator}`);
      });
      expect(
        probe('timestamp(3)', Database.PostgreSQL, ColumnOption.notNull)
          .decorator
      ).toBe('  @Column("timestamp", { precision: 3 })');
    });

    it('reads xid, cid and xid8 as the text node-postgres hands over', () => {
      ['xid', 'cid', 'xid8'].forEach(dataType => {
        expect(createAnnotationFixture(dataType, Database.PostgreSQL)).toBe(
          '  value: string;'
        );
      });
    });

    it('reads a vector as the numbers or the bytes its driver hands over', () => {
      expect(memberLines('vector(3)', Database.PostgreSQL)).toEqual([
        '  @Column("vector", { length: 3, nullable: true })',
        '  value: number[] | null;',
      ]);
      expect(createAnnotationFixture('halfvec(3)', Database.PostgreSQL)).toBe(
        '  value: number[];'
      );
      expect(createAnnotationFixture('VECTOR(3)', Database.MySQL)).toBe(
        '  value: number[];'
      );
      expect(createAnnotationFixture('VECTOR(3)', Database.MariaDB)).toBe(
        '  value: Buffer;'
      );
      expect(createAnnotationFixture('vector(3)', Database.MSSQL)).toBe(
        '  value: number[];'
      );
      expect(createAnnotationFixture('VECTOR(3)', Database.Oracle)).toBe(
        '  value: string;'
      );
      expect(createAnnotationFixture('halfvec(3)', Database.MySQL)).toBe(
        '  value: string;'
      );
    });

    it('reads an array suffix on PostgreSQL alone', () => {
      expect(createTypeFixture('int[]', Database.MySQL)).toBe(
        '  @Column("int", { nullable: true })'
      );
    });

    it('writes every interval as interval, the object node-postgres reads', () => {
      [
        'interval',
        'interval hour',
        'interval day to second',
        'interval year to month',
      ].forEach(dataType => {
        expect(createTypeFixture(dataType, Database.PostgreSQL)).toBe(
          '  @Column("interval", { nullable: true })'
        );
        expect(createAnnotationFixture(dataType, Database.PostgreSQL)).toBe(
          '  value: object;'
        );
      });
      expect(createTypeFixture('interval(3)', Database.PostgreSQL)).toBe(
        '  @Column({ type: "interval", precision: 3, nullable: true })'
      );
      expect(
        createTypeFixture('interval day to second(3)', Database.PostgreSQL)
      ).toBe('  @Column({ type: "interval", precision: 3, nullable: true })');
      expect(
        createTypeFixture('INTERVAL YEAR(2) TO MONTH', Database.PostgreSQL)
      ).toBe('  @Column("interval", { nullable: true })');
      expect(createTypeFixture('interval day to second', Database.Oracle)).toBe(
        '  @Column("interval day to second", { nullable: true })'
      );
    });

    it('caps a time, timestamp or interval precision at the 6 PostgreSQL keeps', () => {
      const cases: Array<[string, string]> = [
        ['timestamp(9)', '@Column("timestamp", { precision: 6 })'],
        ['time(10)', '@Column("time", { precision: 6 })'],
        [
          'timestamptz(10)',
          '@Column("timestamp with time zone", { precision: 6 })',
        ],
        ['timetz(7)', '@Column("time with time zone", { precision: 6 })'],
        [
          'timestamp(10) with time zone',
          '@Column("timestamp with time zone", { precision: 6 })',
        ],
        [
          'time(10) without time zone',
          '@Column("time without time zone", { precision: 6 })',
        ],
        ['interval(7)', '@Column({ type: "interval", precision: 6 })'],
        ['interval second(10)', '@Column({ type: "interval", precision: 6 })'],
        [
          'interval day to second(9)',
          '@Column({ type: "interval", precision: 6 })',
        ],
        ['timestamp(6)', '@Column("timestamp", { precision: 6 })'],
        ['timestamp(0)', '@Column("timestamp", { precision: 0 })'],
        ['numeric(10,7)', '@Column("numeric", { precision: 10, scale: 7 })'],
      ];

      cases.forEach(([dataType, decorator]) => {
        expect(
          probe(dataType, Database.PostgreSQL, ColumnOption.notNull).decorator
        ).toBe(`  ${decorator}`);
      });
      expect(
        probe('TIMESTAMP(9)', Database.Oracle, ColumnOption.notNull).decorator
      ).toBe('  @Column("timestamp", { precision: 9 })');
    });

    it('gives a bit string its length in the options and reads it as text', () => {
      expect(createTypeFixture('bit(8)', Database.PostgreSQL)).toBe(
        '  @Column({ type: "bit", length: 8, nullable: true })'
      );
      expect(createTypeFixture('varbit(8)', Database.PostgreSQL)).toBe(
        '  @Column({ type: "varbit", length: 8, nullable: true })'
      );
      expect(createTypeFixture('bit varying(8)', Database.PostgreSQL)).toBe(
        '  @Column({ type: "bit varying", length: 8, nullable: true })'
      );
      expect(createTypeFixture('bit', Database.PostgreSQL)).toBe(
        '  @Column("bit", { nullable: true })'
      );
      expect(createAnnotationFixture('bit(8)', Database.PostgreSQL)).toBe(
        '  value: string;'
      );
    });

    it('reads money as text and the parsed geometric types as objects', () => {
      expect(createTypeFixture('money', Database.PostgreSQL)).toBe(
        '  @Column("money", { nullable: true })'
      );
      expect(createAnnotationFixture('money', Database.PostgreSQL)).toBe(
        '  value: string;'
      );
      expect(createAnnotationFixture('point', Database.PostgreSQL)).toBe(
        '  value: object;'
      );
      expect(createAnnotationFixture('circle', Database.PostgreSQL)).toBe(
        '  value: object;'
      );
      expect(createAnnotationFixture('line', Database.PostgreSQL)).toBe(
        '  value: string;'
      );
    });

    it('spells a zoned type with a precision by the long name the overload takes', () => {
      expect(createTypeFixture('timestamptz(3)', Database.PostgreSQL)).toBe(
        '  @Column("timestamp with time zone", { precision: 3, nullable: true })'
      );
      expect(createTypeFixture('timetz(3)', Database.PostgreSQL)).toBe(
        '  @Column("time with time zone", { precision: 3, nullable: true })'
      );
      expect(createTypeFixture('timestamptz', Database.PostgreSQL)).toBe(
        '  @Column("timestamptz", { nullable: true })'
      );
    });

    it('writes float(p) as the real or double precision it stores', () => {
      expect(createTypeFixture('float(24)', Database.PostgreSQL)).toBe(
        '  @Column("real", { nullable: true })'
      );
      expect(createTypeFixture('float(25)', Database.PostgreSQL)).toBe(
        '  @Column("double precision", { nullable: true })'
      );
      expect(createTypeFixture('float', Database.PostgreSQL)).toBe(
        '  @Column("float", { nullable: true })'
      );
    });

    it('generates a serial column, which is never null', () => {
      expect(createTypeFixture('serial', Database.PostgreSQL)).toBe(
        '  @Column("int", { generated: "increment" })'
      );
      expect(createTypeFixture('smallserial', Database.PostgreSQL)).toBe(
        '  @Column("smallint", { generated: "increment" })'
      );
      expect(probe('bigserial', Database.PostgreSQL)).toEqual({
        decorator: '  @Column("bigint", { generated: "increment" })',
        annotation: '  value: string;',
      });
    });

    it('generates a serial key without the auto-increment flag', () => {
      expect(
        probe('serial', Database.PostgreSQL, ColumnOption.primaryKey)
      ).toEqual({
        decorator: '  @PrimaryGeneratedColumn({ type: "int" })',
        annotation: '  value: number;',
      });
      expect(
        probe('smallserial', Database.PostgreSQL, ColumnOption.primaryKey)
          .decorator
      ).toBe('  @PrimaryGeneratedColumn({ type: "smallint" })');
    });
  });

  describe('SQL Server types', () => {
    it('reads bit as a boolean and a decimal as the number tedious hands over', () => {
      expect(createTypeFixture('bit', Database.MSSQL)).toBe(
        '  @Column("bit", { nullable: true })'
      );
      expect(createAnnotationFixture('bit', Database.MSSQL)).toBe(
        '  value: boolean;'
      );
      ['decimal(10,2)', 'numeric(10,2)', 'money', 'smallmoney'].forEach(
        dataType => {
          expect(createAnnotationFixture(dataType, Database.MSSQL)).toBe(
            '  value: number;'
          );
        }
      );
    });

    it('states a max length as MAX', () => {
      expect(createTypeFixture('nvarchar(max)', Database.MSSQL)).toBe(
        '  @Column("nvarchar", { length: "MAX", nullable: true })'
      );
      expect(createTypeFixture('varchar(MAX)', Database.MSSQL)).toBe(
        '  @Column("varchar", { length: "MAX", nullable: true })'
      );
      expect(createTypeFixture('varbinary(max)', Database.MSSQL)).toBe(
        '  @Column("varbinary", { length: "MAX", nullable: true })'
      );
      expect(createTypeFixture('varchar(max)', Database.MySQL)).toBe(
        '  @Column("varchar", { nullable: true })'
      );
    });

    it('writes a standard spelling as the type SQL Server stores it as', () => {
      const cases: Array<[string, string]> = [
        ['char varying(10)', '"varchar", { length: 10,'],
        ['character varying(max)', '"varchar", { length: "MAX",'],
        ['character(10)', '"char", { length: 10,'],
        ['national char(10)', '"nchar", { length: 10,'],
        ['national character(10)', '"nchar", { length: 10,'],
        ['national char varying(10)', '"nvarchar", { length: 10,'],
        ['national character varying(max)', '"nvarchar", { length: "MAX",'],
        ['national text', '"ntext", {'],
      ];

      cases.forEach(([dataType, head]) => {
        expect(createTypeFixture(dataType, Database.MSSQL)).toBe(
          `  @Column(${head} nullable: true })`
        );
      });
    });

    it('writes float(p) as the real or float it stores', () => {
      expect(createTypeFixture('float(24)', Database.MSSQL)).toBe(
        '  @Column("real", { nullable: true })'
      );
      expect(createTypeFixture('float(53)', Database.MSSQL)).toBe(
        '  @Column("float", { nullable: true })'
      );
    });

    it('reads rowversion and timestamp as the Buffer tedious hands over', () => {
      expect(memberLines('rowversion', Database.MSSQL)).toEqual([
        '  @Column("rowversion", { nullable: true })',
        '  value: Buffer | null;',
      ]);
      expect(createAnnotationFixture('timestamp', Database.MSSQL)).toBe(
        '  value: Buffer;'
      );
      expect(createAnnotationFixture('timestamp', Database.MySQL)).toBe(
        '  value: Date;'
      );
    });

    it('reads a hierarchyid as the Buffer tedious hands over', () => {
      expect(memberLines('hierarchyid', Database.MSSQL)).toEqual([
        '  @Column("hierarchyid", { nullable: true })',
        '  value: Buffer | null;',
      ]);
    });
  });

  describe('Oracle and SQLite types', () => {
    it('reads an Oracle decimal as the number node-oracledb hands over', () => {
      expect(createTypeFixture('NUMBER(10,2)', Database.Oracle)).toBe(
        '  @Column("number", { precision: 10, scale: 2, nullable: true })'
      );
      ['NUMBER(10,2)', 'NUMBER(*,2)', 'DECIMAL(10,2)'].forEach(dataType => {
        expect(createAnnotationFixture(dataType, Database.Oracle)).toBe(
          '  value: number;'
        );
      });
      expect(createAnnotationFixture('DECIMAL(10,2)', Database.MySQL)).toBe(
        '  value: string;'
      );
    });

    it('states NUMBER(*,s) as the precision 38 it stands for at that scale', () => {
      const cases: Array<[string, number, string]> = [
        [
          'NUMBER(*,2)',
          Database.Oracle,
          '"number", { precision: 38, scale: 2,',
        ],
        [
          'number( * , 2 )',
          Database.Oracle,
          '"number", { precision: 38, scale: 2,',
        ],
        [
          'DECIMAL(*,2)',
          Database.Oracle,
          '"decimal", { precision: 38, scale: 2,',
        ],
        [
          'NUMBER(*,0)',
          Database.Oracle,
          '"number", { precision: 38, scale: 0,',
        ],
        [
          'NUMBER(10,-2)',
          Database.Oracle,
          '"number", { precision: 10, scale: -2,',
        ],
        ['NUMBER(*)', Database.Oracle, '"number", {'],
        [
          'NUMBER(*,2)',
          Database.Snowflake,
          '"number", { precision: 38, scale: 2,',
        ],
      ];

      cases.forEach(([dataType, database, head]) => {
        expect(createTypeFixture(dataType, database)).toBe(
          `  @Column(${head} nullable: true })`
        );
      });
    });

    it('reads an Oracle BFILE as the Lob object node-oracledb hands over', () => {
      expect(
        memberLines('BFILE', Database.Oracle, ColumnOption.notNull)
      ).toEqual(['  @Column("bfile")', '  value: object;']);
      expect(createAnnotationFixture('BLOB', Database.Oracle)).toBe(
        '  value: Buffer;'
      );
      expect(createAnnotationFixture('BFILE', Database.MySQL)).toBe(
        '  value: Buffer;'
      );
    });

    it('reads an Oracle DATE as the date string TypeORM hands over', () => {
      expect(createTypeFixture('DATE', Database.Oracle)).toBe(
        '  @Column("date", { nullable: true })'
      );
      expect(createAnnotationFixture('DATE', Database.Oracle)).toBe(
        '  value: string;'
      );
    });

    it('writes a standard spelling as the type Oracle stores it as', () => {
      const cases: Array<[string, string]> = [
        ['CHARACTER(10)', '"char", { length: 10,'],
        ['CHAR VARYING(10)', '"varchar2", { length: 10,'],
        ['CHARACTER VARYING(10)', '"varchar2", { length: 10,'],
        ['NATIONAL CHAR(10)', '"nchar", { length: 10,'],
        ['NATIONAL CHARACTER(10)', '"nchar", { length: 10,'],
        ['NATIONAL CHAR VARYING(10)', '"nvarchar2", { length: 10,'],
        ['NATIONAL CHARACTER VARYING(10)', '"nvarchar2", { length: 10,'],
        ['NCHAR VARYING(10)', '"nvarchar2", { length: 10,'],
        ['LONG VARCHAR', '"long", {'],
      ];

      cases.forEach(([dataType, head]) => {
        expect(createTypeFixture(dataType, Database.Oracle)).toBe(
          `  @Column(${head} nullable: true })`
        );
      });
      expect(createTypeFixture('BOOLEAN', Database.Oracle)).toBe(
        '  @Column("boolean", { nullable: true })'
      );
    });

    it('reads an Oracle interval as the object node-oracledb hands over', () => {
      expect(
        memberLines(
          'INTERVAL DAY(2) TO SECOND(6)',
          Database.Oracle,
          ColumnOption.notNull
        )
      ).toEqual(['  @Column("interval day to second")', '  value: object;']);
      expect(memberLines('INTERVAL YEAR TO MONTH', Database.Oracle)).toEqual([
        '  @Column("interval year to month", { nullable: true })',
        '  value: object | null;',
      ]);
    });

    it('reads a SQLite decimal as the number better-sqlite3 hands over', () => {
      expect(createTypeFixture('DECIMAL(10,2)', Database.SQLite)).toBe(
        '  @Column("decimal", { precision: 10, scale: 2, nullable: true })'
      );
      expect(createAnnotationFixture('NUMERIC', Database.SQLite)).toBe(
        '  value: number;'
      );
    });

    it('reads a SQLite 64-bit integer as the number better-sqlite3 hands over', () => {
      ['BIGINT', 'INT8', 'UNSIGNED BIG INT'].forEach(dataType => {
        expect(createAnnotationFixture(dataType, Database.SQLite)).toBe(
          '  value: number;'
        );
      });
      expect(
        probe(
          'BIGINT',
          Database.SQLite,
          ColumnOption.primaryKey | ColumnOption.autoIncrement
        )
      ).toEqual({
        decorator: '  @PrimaryGeneratedColumn({ type: "bigint" })',
        annotation: '  value: number;',
      });
    });

    it('writes the SQLite names TypeORM refuses as its own', () => {
      expect(createTypeFixture('TIMESTAMP', Database.SQLite)).toBe(
        '  @Column("datetime", { nullable: true })'
      );
      expect(createTypeFixture('TIMESTAMP(3)', Database.SQLite)).toBe(
        '  @Column("datetime", { precision: 3, nullable: true })'
      );
      expect(createAnnotationFixture('TIMESTAMP', Database.SQLite)).toBe(
        '  value: Date;'
      );
      expect(createTypeFixture('BOOL', Database.SQLite)).toBe(
        '  @Column("boolean", { nullable: true })'
      );
      expect(createAnnotationFixture('BOOL', Database.SQLite)).toBe(
        '  value: boolean;'
      );
      expect(createTypeFixture('DEC(10,2)', Database.SQLite)).toBe(
        '  @Column("decimal", { precision: 10, scale: 2, nullable: true })'
      );
      expect(createAnnotationFixture('DEC', Database.SQLite)).toBe(
        '  value: number;'
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

    it('leaves an auto-increment column outside the key nullable on SQLite alone', () => {
      expect(
        memberLines('INTEGER', Database.SQLite, ColumnOption.autoIncrement)
      ).toEqual([
        '  @Column("integer", { generated: "increment", nullable: true })',
        '  value: number | null;',
      ]);
      expect(
        memberLines(
          'INTEGER',
          Database.SQLite,
          ColumnOption.autoIncrement | ColumnOption.notNull
        )
      ).toEqual([
        '  @Column("integer", { generated: "increment" })',
        '  value: number;',
      ]);
      expect(
        memberLines('NUMBER(10)', Database.Oracle, ColumnOption.autoIncrement)
      ).toEqual([
        '  @Column("number", { precision: 10, generated: "increment" })',
        '  value: number;',
      ]);
    });

    it('never makes an auto-increment column nullable, the NN flag or not', () => {
      expect(
        memberLines('integer', Database.PostgreSQL, ColumnOption.autoIncrement)
      ).toEqual([
        '  @Column("integer", { generated: "increment" })',
        '  value: number;',
      ]);
      expect(
        memberLines(
          'INT',
          Database.MySQL,
          ColumnOption.autoIncrement | ColumnOption.unique
        )
      ).toEqual([
        '  @Column("int", { generated: "increment", unique: true })',
        '  value: number;',
      ]);
      expect(
        memberLines('bigint', Database.MSSQL, ColumnOption.autoIncrement)
      ).toEqual([
        '  @Column("bigint", { generated: "increment" })',
        '  value: string;',
      ]);
    });

    it('keeps the precision and scale of a generated key through PrimaryColumn', () => {
      const key = ColumnOption.primaryKey | ColumnOption.autoIncrement;

      expect(memberLines('decimal(10,0)', Database.MSSQL, key)).toEqual([
        '  @PrimaryColumn("decimal", { precision: 10, scale: 0, generated: "increment" })',
        '  value: number;',
      ]);
      expect(memberLines('numeric(12)', Database.MSSQL, key)).toEqual([
        '  @PrimaryColumn("numeric", { precision: 12, generated: "increment" })',
        '  value: number;',
      ]);
      expect(memberLines('numeric(10,0)', Database.PostgreSQL, key)).toEqual([
        '  @PrimaryColumn("numeric", { precision: 10, scale: 0, generated: "increment" })',
        '  value: string;',
      ]);
      expect(
        memberLines(
          'numeric(10,0)',
          Database.PostgreSQL,
          key | ColumnOption.unique
        )
      ).toEqual([
        '  @PrimaryColumn("numeric", { precision: 10, scale: 0, generated: "increment" })',
        '  value: string;',
      ]);
      expect(
        memberLines('DECIMAL(10,0) UNSIGNED', Database.MySQL, key)
      ).toEqual([
        '  @PrimaryColumn({',
        '    type: "decimal",',
        '    precision: 10,',
        '    scale: 0,',
        '    unsigned: true,',
        '    generated: "increment",',
        '  })',
        '  value: string;',
      ]);
      expect(memberLines('NUMBER(10)', Database.Oracle, key)).toEqual([
        '  @PrimaryColumn("number", { precision: 10, generated: "increment" })',
        '  value: number;',
      ]);
      expect(memberLines('decimal', Database.MSSQL, key)).toEqual([
        '  @PrimaryGeneratedColumn({ type: "decimal" })',
        '  value: number;',
      ]);
      expect(memberLines('INT(11) UNSIGNED', Database.MySQL, key)).toEqual([
        '  @PrimaryGeneratedColumn({ type: "int", unsigned: true })',
        '  value: number;',
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

    it('escapes a class name TypeScript refuses or reads as a type operator', () => {
      const names = ['number', 'string', 'object', 'readonly'];
      const state = createState({
        tables: names.map((name, index) =>
          createTable({ id: `t${index}`, name })
        ),
        settings: { tableNameCase: NameCase.none },
      });
      const code = createCode(state);

      names.forEach(name => {
        expect(code).toContain(`export class ${name}_ {}`);
      });
    });

    it('escapes a property named after a member every object has', () => {
      const table = createTable({
        id: 't1',
        name: 'probe',
        columnIds: ['c1', 'c2', 'c3'],
      });
      const state = createState({
        tables: [table],
        columns: ['toString', 'valueOf', 'readonly'].map((name, index) =>
          createColumn({
            id: `c${index + 1}`,
            tableId: 't1',
            name,
            dataType: 'int',
            options: ColumnOption.notNull,
          })
        ),
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toEqual([
        '@Entity("probe")',
        'export class Probe {',
        '  @Column("int", { name: "toString" })',
        '  toString_: number;',
        '',
        '  @Column("int", { name: "valueOf" })',
        '  valueOf_: number;',
        '',
        '  @Column("int")',
        '  readonly: number;',
        '}',
      ]);
    });

    it('renames __proto__, which an assignment reads as the prototype', () => {
      const table = createTable({
        id: 't1',
        name: '__proto__',
        columnIds: ['c1'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: '__proto__',
            dataType: 'int',
            options: ColumnOption.notNull,
          }),
        ],
        settings: {
          database: Database.SQLite,
          tableNameCase: NameCase.none,
          columnNameCase: NameCase.none,
        },
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        '@Entity("__proto__")',
        'export class __proto__2 {',
        '  @Column("int", { name: "__proto__" })',
        '  __proto___: number;',
        '}',
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
        '  @Column("varchar", { name: "2nd", nullable: true })',
        '  x2Nd: string | null;',
        '',
        '  @Column("varchar", { name: "-", nullable: true })',
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
        '  @Column("varchar", { name: "", nullable: true })'
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

    it('renames a class that would shadow a name the emitted module reads', () => {
      const names = ['Number', 'Object', 'Reflect', 'exports', 'require'];
      const state = createState({
        tables: names.map((name, index) =>
          createTable({ id: `t${index}`, name })
        ),
        settings: { tableNameCase: NameCase.none },
      });
      const code = createCode(state);

      names.forEach(name => {
        expect(code).toContain(`export class ${name}2 {}`);
      });
    });

    it('renames a class named after a member every object inherits', () => {
      const names = [
        'hasOwnProperty',
        'isPrototypeOf',
        'propertyIsEnumerable',
        'toLocaleString',
        'toString',
        'valueOf',
        '__defineGetter__',
        '__defineSetter__',
        '__lookupGetter__',
        '__lookupSetter__',
      ];
      const state = createState({
        tables: [
          ...names.map((name, index) => createTable({ id: `t${index}`, name })),
          createTable({ id: 'taken', name: 'hasOwnProperty2' }),
        ],
        settings: { tableNameCase: NameCase.none },
      });
      const code = createCode(state);

      names.forEach(name => {
        expect(code).toContain(`export class ${name}2 {}`);
      });
      expect(code).toContain('export class hasOwnProperty22 {}');
    });

    it('renames a class that would redeclare a helper tsc emits or a CommonJS name', () => {
      const names = [
        '__decorate',
        '__metadata',
        '__dirname',
        '__filename',
        '__esModule',
      ];
      const state = createState({
        tables: names.map((name, index) =>
          createTable({ id: `t${index}`, name })
        ),
        settings: { tableNameCase: NameCase.none },
      });
      const code = createCode(state);

      names.forEach(name => {
        expect(code).toContain(`export class ${name}2 {}`);
      });
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

    it('passes the referential actions to the owning side only', () => {
      const { state, team, user } = createTeamFixture();
      Object.assign(state.collections.relationshipEntities.r1, {
        onDelete: ReferentialAction.cascade,
        onUpdate: ReferentialAction.noAction,
      });

      const lines = render(state, user);
      const head = lines.indexOf(
        '  @ManyToOne(() => Team, (team) => team.userList, {'
      );

      expect(lines.slice(head, head + 4)).toEqual([
        '  @ManyToOne(() => Team, (team) => team.userList, {',
        '    onDelete: "CASCADE",',
        '    onUpdate: "NO ACTION",',
        '  })',
      ]);
      expect(render(state, team)).toContain(
        '  @OneToMany(() => User, (user) => user.team)'
      );
    });

    it('leaves SET DEFAULT out, which TypeORM would write as DEFAULT', () => {
      const { state, user } = createTeamFixture();
      Object.assign(state.collections.relationshipEntities.r1, {
        onDelete: ReferentialAction.setDefault,
        onUpdate: ReferentialAction.setNull,
      });

      expect(render(state, user)).toContain(
        '  @ManyToOne(() => Team, (team) => team.userList, { onUpdate: "SET NULL" })'
      );
    });

    it('keeps NO ACTION alone under Snowflake, as its DDL does', () => {
      const { state, user } = createTeamFixture();
      state.settings.database = Database.Snowflake;
      Object.assign(state.collections.relationshipEntities.r1, {
        onDelete: ReferentialAction.noAction,
        onUpdate: ReferentialAction.cascade,
      });

      expect(render(state, user)).toContain(
        '  @ManyToOne(() => Team, (team) => team.userList, { onDelete: "NO ACTION" })'
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
