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
import { createCode, formatTable } from '@/utils/generator-code/sequelize';

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

const EXPRESSION =
  /type: (.+?),(?: (?:field|primaryKey|autoIncrement|allowNull)|\n|$)/;

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
    expression: EXPRESSION.exec(lines.join('\n'))?.[1] ?? '',
    annotation: lines.find(line => line.startsWith('  declare value')) ?? '',
  };
}

function createTypeFixture(dataType: string, database: number) {
  return probe(dataType, database).expression;
}

function createAnnotationFixture(dataType: string, database: number) {
  return probe(dataType, database, ColumnOption.notNull).annotation;
}

function createDefaultFixture(value: string): string[] {
  const table = createTable({ id: 't1', name: 'probe', columnIds: ['c1'] });
  const state = createState({
    tables: [table],
    columns: [
      createColumn({
        id: 'c1',
        tableId: 't1',
        name: 'value',
        dataType: 'int',
        default: value,
      }),
    ],
    settings: { database: Database.MySQL },
  });

  return render(state, table);
}

describe('generator-code/sequelize', () => {
  describe('createCode', () => {
    it('returns an empty string when the document has no tables', () => {
      expect(createCode(createState({}))).toBe('');
    });

    it('renders the shared single-table document', () => {
      const { state } = createSharedFixture();

      expect(createCode(state).split('\n')).toEqual([
        '',
        'export class User extends Model<',
        '  InferAttributes<User>,',
        '  InferCreationAttributes<User>',
        '> {',
        '  declare createdAt: number;',
        '}',
        '',
        'User.init(',
        '  {',
        '    createdAt: {',
        '      type: DataTypes.INTEGER,',
        '      field: "created_at",',
        '      allowNull: false,',
        '    },',
        '  },',
        '  { sequelize, tableName: "user", timestamps: false }',
        ');',
        '',
      ]);
    });

    it('renders the PostgreSQL users table under the default name cases', () => {
      const { state } = createUsersFixture();

      expect(createCode(state).split('\n')).toEqual([
        '',
        'export class Users extends Model<',
        '  InferAttributes<Users>,',
        '  InferCreationAttributes<Users>',
        '> {',
        '  declare id: CreationOptional<string>;',
        '  declare email: string;',
        '  declare bio: string | null;',
        '  declare balance: CreationOptional<string>;',
        '  declare lastSeen: Date | null;',
        '}',
        '',
        'Users.init(',
        '  {',
        '    id: {',
        '      type: DataTypes.UUID,',
        '      primaryKey: true,',
        '      allowNull: false,',
        '      defaultValue: Sequelize.literal("gen_random_uuid()"),',
        '    },',
        '    email: {',
        '      type: DataTypes.STRING(255),',
        '      allowNull: false,',
        '      unique: true,',
        '      comment: "login email",',
        '    },',
        '    bio: { type: DataTypes.TEXT, allowNull: true },',
        '    balance: {',
        '      type: DataTypes.DECIMAL(10, 2),',
        '      allowNull: false,',
        '      defaultValue: 0,',
        '    },',
        '    lastSeen: { type: DataTypes.DATE, field: "last seen", allowNull: true },',
        '  },',
        '  { sequelize, tableName: "users", timestamps: false }',
        ');',
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
        'export class Ant extends Model<',
        '  InferAttributes<Ant>,',
        '  InferCreationAttributes<Ant>',
        '> {}',
        '',
        'Ant.init(',
        '  {},',
        '  { sequelize, tableName: "ant", timestamps: false }',
        ');',
        '',
        'export class Zebra extends Model<',
        '  InferAttributes<Zebra>,',
        '  InferCreationAttributes<Zebra>',
        '> {}',
        '',
        'Zebra.init(',
        '  {},',
        '  { sequelize, tableName: "zebra", timestamps: false }',
        ');',
        '',
      ]);
    });

    it('skips table ids that are not in the collection', () => {
      const { state } = createSharedFixture();
      state.doc.tableIds = ['missing', 't1'];

      expect(createCode(state).split('\n')).toEqual([
        '',
        'export class User extends Model<',
        '  InferAttributes<User>,',
        '  InferCreationAttributes<User>',
        '> {',
        '  declare createdAt: number;',
        '}',
        '',
        'User.init(',
        '  {',
        '    createdAt: {',
        '      type: DataTypes.INTEGER,',
        '      field: "created_at",',
        '      allowNull: false,',
        '    },',
        '  },',
        '  { sequelize, tableName: "user", timestamps: false }',
        ');',
        '',
      ]);
    });

    it('passes the referential actions to both association calls', () => {
      const { state } = createTeamFixture();
      state.settings.database = Database.PostgreSQL;
      Object.assign(state.collections.relationshipEntities.r1, {
        onDelete: ReferentialAction.cascade,
        onUpdate: ReferentialAction.setDefault,
      });
      const code = createCode(state);

      expect(code).toContain(
        [
          'Team.hasMany(User, {',
          '  foreignKey: "teamId",',
          '  sourceKey: "id",',
          '  as: "userList",',
          '  onDelete: "CASCADE",',
          '  onUpdate: "SET DEFAULT",',
          '});',
          'User.belongsTo(Team, {',
          '  foreignKey: "teamId",',
          '  targetKey: "id",',
          '  as: "team",',
          '  onDelete: "CASCADE",',
          '  onUpdate: "SET DEFAULT",',
          '});',
        ].join('\n')
      );
    });

    it('leaves out an action the database would refuse, as its DDL does', () => {
      const { state } = createTeamFixture();
      Object.assign(state.collections.relationshipEntities.r1, {
        onDelete: ReferentialAction.cascade,
        onUpdate: ReferentialAction.setDefault,
      });
      const code = createCode(state);

      expect(code).toContain('  onDelete: "CASCADE",\n});');
      expect(code).not.toContain('onUpdate');
    });

    it('keeps NO ACTION alone under Snowflake, as its DDL does', () => {
      const { state } = createTeamFixture();
      state.settings.database = Database.Snowflake;
      Object.assign(state.collections.relationshipEntities.r1, {
        onDelete: ReferentialAction.cascade,
        onUpdate: ReferentialAction.noAction,
      });
      const code = createCode(state);

      expect(code).toContain('  onUpdate: "NO ACTION",\n});');
      expect(code).not.toContain('onDelete');
    });

    it('runs every association call after every init call', () => {
      const { state } = createTeamFixture();
      const lines = createCode(state).split('\n');
      const inits = lines
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => line.endsWith('.init('))
        .map(({ index }) => index);
      const associations = lines
        .map((line, index) => ({ line, index }))
        .filter(
          ({ line }) =>
            line.includes('.hasMany(') || line.includes('.belongsTo(')
        )
        .map(({ index }) => index);

      expect(inits).toHaveLength(2);
      expect(associations).toHaveLength(2);
      expect(Math.min(...associations)).toBeGreaterThan(Math.max(...inits));
    });
  });

  describe('formatTable', () => {
    it('appends to an existing buffer instead of replacing it', () => {
      const { state, table } = createSharedFixture();
      const buffer = ['// keep me'];

      formatTable(state, { buffer, table });

      expect(buffer[0]).toBe('// keep me');
      expect(buffer).toHaveLength(18);
    });

    it('matches createCode byte for byte for a single-table document', () => {
      const { state, table } = createSharedFixture();

      expect(['', ...render(state, table), ''].join('\n')).toBe(
        createCode(state)
      );
    });

    it('renders one table of a multi-table document with the associations that touch it', () => {
      const { state, user } = createTeamFixture();

      expect(render(state, user)).toEqual([
        'export class User extends Model<',
        '  InferAttributes<User>,',
        '  InferCreationAttributes<User>',
        '> {',
        '  declare id: CreationOptional<number>;',
        '  declare teamId: number | null;',
        '',
        '  declare team?: NonAttribute<Team>;',
        '}',
        '',
        'User.init(',
        '  {',
        '    id: {',
        '      type: DataTypes.INTEGER,',
        '      primaryKey: true,',
        '      autoIncrement: true,',
        '      allowNull: false,',
        '    },',
        '    teamId: { type: DataTypes.INTEGER, field: "team_id", allowNull: true },',
        '  },',
        '  { sequelize, tableName: "user", timestamps: false }',
        ');',
        '',
        'Team.hasMany(User, { foreignKey: "teamId", sourceKey: "id", as: "userList" });',
        'User.belongsTo(Team, { foreignKey: "teamId", targetKey: "id", as: "team" });',
      ]);
    });

    it('ends a table with no association on the closing line of its init call', () => {
      const { state, table } = createSharedFixture();
      const lines = render(state, table);

      expect(lines[lines.length - 1]).toBe(');');
      expect(lines.join('\n')).not.toContain('hasMany');
    });

    it('renders the same class and init block as createCode does', () => {
      const { state, team } = createTeamFixture();

      expect(createCode(state)).toContain(
        render(state, team).slice(0, 20).join('\n')
      );
    });

    it('keeps the four-line class header even for the shortest class name', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'q' })],
        settings: { database: Database.MySQL },
      });

      expect(render(state, state.collections.tableEntities.t1)).toEqual([
        'export class Q extends Model<',
        '  InferAttributes<Q>,',
        '  InferCreationAttributes<Q>',
        '> {}',
        '',
        'Q.init(',
        '  {},',
        '  { sequelize, tableName: "q", timestamps: false }',
        ');',
      ]);
    });
  });

  describe('type mapping', () => {
    it('maps every primitive type to a DataTypes member and a TypeScript type', () => {
      const cases: Array<[string, string, string]> = [
        ['INT', 'DataTypes.INTEGER', 'number'],
        ['BIGINT', 'DataTypes.BIGINT', 'number | string'],
        ['FLOAT', 'DataTypes.FLOAT', 'number'],
        ['DOUBLE', 'DataTypes.DOUBLE', 'number'],
        ['DECIMAL', 'DataTypes.DECIMAL', 'string'],
        ['BOOLEAN', 'DataTypes.BOOLEAN', 'boolean'],
        ['VARCHAR', 'DataTypes.STRING', 'string'],
        ['TEXT', 'DataTypes.TEXT', 'string'],
        ['DATE', 'DataTypes.DATEONLY', 'string'],
        ['DATETIME', 'DataTypes.DATE', 'Date'],
        ['TIME', 'DataTypes.TIME', 'string'],
      ];

      cases.forEach(([dataType, expression, annotation]) => {
        expect(createTypeFixture(dataType, Database.MySQL)).toBe(expression);
        expect(createAnnotationFixture(dataType, Database.MySQL)).toBe(
          `  declare value: ${annotation};`
        );
      });
    });

    it('reads a 64-bit integer as the driver hands it over', () => {
      expect(createAnnotationFixture('BIGINT', Database.MySQL)).toBe(
        '  declare value: number | string;'
      );
      expect(createAnnotationFixture('BIGINT UNSIGNED', Database.MariaDB)).toBe(
        '  declare value: number | string;'
      );
      expect(createAnnotationFixture('SERIAL', Database.MySQL)).toBe(
        '  declare value: CreationOptional<number | string>;'
      );
      expect(createAnnotationFixture('bigserial', Database.PostgreSQL)).toBe(
        '  declare value: CreationOptional<string>;'
      );
      expect(createAnnotationFixture('bigint', Database.MSSQL)).toBe(
        '  declare value: string;'
      );
      expect(createAnnotationFixture('NUMBER', Database.Oracle)).toBe(
        '  declare value: string;'
      );
      expect(createAnnotationFixture('UNSIGNED BIG INT', Database.SQLite)).toBe(
        '  declare value: number;'
      );
      expect(createTypeFixture('UNSIGNED BIG INT', Database.SQLite)).toBe(
        'DataTypes.BIGINT'
      );
    });

    it('states a MySQL SERIAL as the unsigned BIGINT it stands for', () => {
      expect(createTypeFixture('SERIAL', Database.MySQL)).toBe(
        'DataTypes.BIGINT.UNSIGNED'
      );
      expect(createTypeFixture('serial', Database.MariaDB)).toBe(
        'DataTypes.BIGINT.UNSIGNED'
      );
      expect(createTypeFixture('serial', Database.PostgreSQL)).toBe(
        'DataTypes.INTEGER'
      );
    });

    it('reads the binary types as a Buffer whichever primitive they resolve to', () => {
      expect(createAnnotationFixture('BLOB', Database.MySQL)).toBe(
        '  declare value: Buffer;'
      );
      expect(createTypeFixture('BLOB', Database.MySQL)).toBe('DataTypes.BLOB');
      expect(createAnnotationFixture('LONG VARBINARY', Database.MySQL)).toBe(
        '  declare value: Buffer;'
      );
      expect(createAnnotationFixture('VARBINARY', Database.MySQL)).toBe(
        '  declare value: Buffer;'
      );
      expect(createAnnotationFixture('bytea', Database.PostgreSQL)).toBe(
        '  declare value: Buffer;'
      );
      expect(createAnnotationFixture('LONG RAW', Database.Oracle)).toBe(
        '  declare value: Buffer;'
      );
      expect(createAnnotationFixture('image', Database.MSSQL)).toBe(
        '  declare value: Buffer;'
      );
    });

    it('keeps the size of a sized text or blob, which is not a number', () => {
      expect(createTypeFixture('TINYTEXT', Database.MySQL)).toBe(
        'DataTypes.TEXT("tiny")'
      );
      expect(createTypeFixture('MEDIUMTEXT', Database.MySQL)).toBe(
        'DataTypes.TEXT("medium")'
      );
      expect(createTypeFixture('LONGTEXT', Database.MySQL)).toBe(
        'DataTypes.TEXT("long")'
      );
      expect(createTypeFixture('TINYBLOB', Database.MySQL)).toBe(
        'DataTypes.BLOB("tiny")'
      );
      expect(createTypeFixture('MEDIUMBLOB', Database.MySQL)).toBe(
        'DataTypes.BLOB("medium")'
      );
      expect(createTypeFixture('LONGBLOB', Database.MySQL)).toBe(
        'DataTypes.BLOB("long")'
      );
    });

    it('keeps the width of a small integer the primitive would widen', () => {
      expect(createTypeFixture('TINYINT', Database.MySQL)).toBe(
        'DataTypes.TINYINT'
      );
      expect(createTypeFixture('SMALLINT', Database.MySQL)).toBe(
        'DataTypes.SMALLINT'
      );
      expect(createTypeFixture('MEDIUMINT', Database.MySQL)).toBe(
        'DataTypes.MEDIUMINT'
      );
      expect(createTypeFixture('int2', Database.PostgreSQL)).toBe(
        'DataTypes.SMALLINT'
      );
      expect(createAnnotationFixture('TINYINT', Database.MySQL)).toBe(
        '  declare value: number;'
      );
    });

    it('reads a document type as unknown and keeps the vendor member', () => {
      expect(createTypeFixture('jsonb', Database.PostgreSQL)).toBe(
        'DataTypes.JSONB'
      );
      expect(createAnnotationFixture('jsonb', Database.PostgreSQL)).toBe(
        '  declare value: unknown;'
      );
      expect(createTypeFixture('JSON', Database.MySQL)).toBe('DataTypes.JSON');
      expect(createAnnotationFixture('JSON', Database.MySQL)).toBe(
        '  declare value: unknown;'
      );
    });

    it('keeps a network or search member the primitive would read as text', () => {
      expect(createTypeFixture('cidr', Database.PostgreSQL)).toBe(
        'DataTypes.CIDR'
      );
      expect(createTypeFixture('inet', Database.PostgreSQL)).toBe(
        'DataTypes.INET'
      );
      expect(createTypeFixture('macaddr', Database.PostgreSQL)).toBe(
        'DataTypes.MACADDR'
      );
      expect(createTypeFixture('tsvector', Database.PostgreSQL)).toBe(
        'DataTypes.TSVECTOR'
      );
      expect(createTypeFixture('uuid', Database.PostgreSQL)).toBe(
        'DataTypes.UUID'
      );
      expect(createTypeFixture('uniqueidentifier', Database.MSSQL)).toBe(
        '"uniqueidentifier"'
      );
    });

    it('reads a zoned stamp as DATE and states a zoned time as written', () => {
      expect(
        createTypeFixture('timestamp with time zone', Database.PostgreSQL)
      ).toBe('DataTypes.DATE');
      expect(
        createAnnotationFixture('timestamp with time zone', Database.PostgreSQL)
      ).toBe('  declare value: Date;');
      expect(
        createTypeFixture('timestamp(3) with time zone', Database.PostgreSQL)
      ).toBe('"timestamp(3) with time zone"');
      expect(createTypeFixture('timetz', Database.PostgreSQL)).toBe('"timetz"');
      expect(createAnnotationFixture('timetz', Database.PostgreSQL)).toBe(
        '  declare value: string;'
      );
      expect(
        createTypeFixture('time with time zone', Database.PostgreSQL)
      ).toBe('"time with time zone"');
    });

    it('lifts a length out of a string type and a precision out of a decimal', () => {
      expect(createTypeFixture('VARCHAR(255)', Database.MySQL)).toBe(
        'DataTypes.STRING(255)'
      );
      expect(createTypeFixture('DECIMAL(10)', Database.MySQL)).toBe(
        'DataTypes.DECIMAL(10)'
      );
      expect(createTypeFixture('DECIMAL(10, 2)', Database.MySQL)).toBe(
        'DataTypes.DECIMAL(10, 2)'
      );
      expect(createTypeFixture('CHAR(16)', Database.MySQL)).toBe(
        'DataTypes.CHAR(16)'
      );
      expect(createTypeFixture('binary(16)', Database.MySQL)).toBe(
        '"binary(16)"'
      );
    });

    it('keeps the members of an enum and states a set as written', () => {
      expect(
        createTypeFixture("ENUM('G','PG-13','NC-17')", Database.MySQL)
      ).toBe('DataTypes.ENUM("G", "PG-13", "NC-17")');
      expect(createAnnotationFixture("ENUM('G','PG-13')", Database.MySQL)).toBe(
        '  declare value: "G" | "PG-13";'
      );
      expect(
        createTypeFixture("SET('Trailers','Commentaries')", Database.MySQL)
      ).toBe("\"SET('Trailers','Commentaries')\"");
      expect(
        createAnnotationFixture(
          "SET('Trailers','Commentaries')",
          Database.MySQL
        )
      ).toBe('  declare value: string;');
    });

    it('reads a member that holds a comma or doubles its own quote', () => {
      expect(
        createTypeFixture("ENUM('a,b','it''s','sa\"y')", Database.MySQL)
      ).toBe('DataTypes.ENUM("a,b", "it\'s", "sa\\"y")');
    });

    it('falls back to the primitive type for a list it cannot read as members', () => {
      expect(createTypeFixture('ENUM', Database.MySQL)).toBe(
        'DataTypes.STRING'
      );
      expect(createTypeFixture('enum(a, b)', Database.MySQL)).toBe(
        'DataTypes.STRING'
      );
      expect(createAnnotationFixture('ENUM', Database.MySQL)).toBe(
        '  declare value: string;'
      );
    });

    it('drops an argument list it cannot read as positive integers', () => {
      expect(createTypeFixture('VARCHAR()', Database.MySQL)).toBe(
        'DataTypes.STRING'
      );
      expect(createTypeFixture('VARCHAR(0)', Database.MySQL)).toBe(
        'DataTypes.STRING'
      );
      expect(createTypeFixture('INT(11)', Database.MySQL)).toBe(
        'DataTypes.INTEGER'
      );
    });

    it('substitutes a variable-length string for a fixed-length one with no length', () => {
      expect(createTypeFixture('CHAR', Database.MySQL)).toBe(
        'DataTypes.STRING'
      );
      expect(createTypeFixture('CHAR(0)', Database.MySQL)).toBe(
        'DataTypes.STRING'
      );
      expect(createTypeFixture('CHAR(10, 2)', Database.MySQL)).toBe(
        'DataTypes.STRING'
      );
      expect(createTypeFixture('nchar', Database.MySQL)).toBe(
        'DataTypes.STRING'
      );
      expect(createTypeFixture('CHAR(10)', Database.MySQL)).toBe(
        'DataTypes.CHAR(10)'
      );
      expect(createAnnotationFixture('CHAR', Database.MySQL)).toBe(
        '  declare value: string;'
      );
    });

    it('strips arguments and collapses whitespace before naming the type', () => {
      expect(createTypeFixture('VARCHAR2(50 BYTE)', Database.Oracle)).toBe(
        'DataTypes.STRING'
      );
      expect(
        createTypeFixture('interval day(2) to second(6)', Database.Oracle)
      ).toBe('DataTypes.STRING');
      expect(createTypeFixture('NATIONAL CHARACTER (10)', Database.MySQL)).toBe(
        'DataTypes.CHAR(10)'
      );
    });

    it('states an interval outside PostgreSQL as a string, read as Oracle hands it over', () => {
      expect(createTypeFixture('INTERVAL DAY TO SECOND', Database.Oracle)).toBe(
        'DataTypes.STRING'
      );
      expect(
        createAnnotationFixture('INTERVAL YEAR TO MONTH', Database.Oracle)
      ).toBe('  declare value: object;');
      expect(
        createTypeFixture('INTERVAL HOUR TO MINUTE', Database.Databricks)
      ).toBe('DataTypes.STRING');
      expect(createAnnotationFixture('INTERVAL', Database.Databricks)).toBe(
        '  declare value: string;'
      );
    });

    it('reads an Oracle vector as the typed array of its format', () => {
      expect(createTypeFixture('VECTOR(3)', Database.Oracle)).toBe(
        'DataTypes.STRING'
      );
      expect(createTypeFixture('VECTOR(3, FLOAT64)', Database.Oracle)).toBe(
        'DataTypes.STRING'
      );
      expect(
        createAnnotationFixture('VECTOR(3, FLOAT32)', Database.Oracle)
      ).toBe('  declare value: Float32Array;');
      expect(
        createAnnotationFixture('vector(1024, float64)', Database.Oracle)
      ).toBe('  declare value: Float64Array;');
      expect(createAnnotationFixture('VECTOR(*, INT8)', Database.Oracle)).toBe(
        '  declare value: Int8Array;'
      );
      expect(
        createAnnotationFixture('VECTOR(8, BINARY)', Database.Oracle)
      ).toBe('  declare value: Uint8Array;');
      expect(
        createAnnotationFixture('VECTOR(3, FLOAT32, SPARSE)', Database.Oracle)
      ).toBe('  declare value: object;');
      expect(
        createAnnotationFixture('VECTOR(3, FLOAT32, DENSE)', Database.Oracle)
      ).toBe('  declare value: Float32Array;');
    });

    it('reads an Oracle vector of no fixed format as any typed array', () => {
      const anyFormat =
        '  declare value: Float32Array | Float64Array | Int8Array | Uint8Array;';

      expect(createAnnotationFixture('VECTOR', Database.Oracle)).toBe(
        anyFormat
      );
      expect(createAnnotationFixture('VECTOR(3)', Database.Oracle)).toBe(
        anyFormat
      );
      expect(createAnnotationFixture('VECTOR(*, *)', Database.Oracle)).toBe(
        anyFormat
      );
      expect(createAnnotationFixture('VECTOR(3, *, *)', Database.Oracle)).toBe(
        anyFormat
      );
    });

    it('reads an Oracle BFILE as the Lob oracledb hands over', () => {
      expect(createTypeFixture('BFILE', Database.Oracle)).toBe(
        'DataTypes.BLOB'
      );
      expect(createAnnotationFixture('BFILE', Database.Oracle)).toBe(
        '  declare value: object;'
      );
      expect(createAnnotationFixture('RAW(16)', Database.Oracle)).toBe(
        '  declare value: Buffer;'
      );
    });

    it('names a variable-length string for a column with no data type', () => {
      expect(createTypeFixture('', Database.MySQL)).toBe('DataTypes.STRING');
      expect(createAnnotationFixture('', Database.MySQL)).toBe(
        '  declare value: string;'
      );
    });

    it('substitutes a DataTypes member for a vendor name it has no member for', () => {
      expect(createTypeFixture('bigserial', Database.PostgreSQL)).toBe(
        'DataTypes.BIGINT'
      );
      expect(createTypeFixture('serial', Database.PostgreSQL)).toBe(
        'DataTypes.INTEGER'
      );
      expect(createTypeFixture('bpchar(10)', Database.PostgreSQL)).toBe(
        'DataTypes.CHAR(10)'
      );
      expect(createTypeFixture('LONG RAW', Database.Oracle)).toBe(
        'DataTypes.BLOB'
      );
      expect(createTypeFixture('BINARY_FLOAT', Database.Oracle)).toBe(
        'DataTypes.FLOAT'
      );
      expect(createTypeFixture('NUMBER(10,2)', Database.Oracle)).toBe(
        'DataTypes.DECIMAL(10, 2)'
      );
    });

    it('falls back to a string for a type the vendor does not list', () => {
      expect(createTypeFixture('nope', Database.MySQL)).toBe(
        'DataTypes.STRING'
      );
      expect(createAnnotationFixture('nope', Database.MySQL)).toBe(
        '  declare value: string;'
      );
    });

    it('reads the name of a MySQL integer with UNSIGNED and ZEROFILL dropped', () => {
      expect(createTypeFixture('mediumint unsigned', Database.MySQL)).toBe(
        'DataTypes.MEDIUMINT.UNSIGNED'
      );
      expect(createTypeFixture('SMALLINT UNSIGNED', Database.MySQL)).toBe(
        'DataTypes.SMALLINT.UNSIGNED'
      );
      expect(createTypeFixture('TINYINT(3) UNSIGNED', Database.MariaDB)).toBe(
        'DataTypes.TINYINT.UNSIGNED'
      );
      expect(createTypeFixture('SMALLINT SIGNED', Database.MySQL)).toBe(
        'DataTypes.SMALLINT'
      );
      expect(createTypeFixture('mediumint', Database.MySQL)).toBe(
        'DataTypes.MEDIUMINT'
      );
    });

    it('lifts a length only onto a type that carries one', () => {
      expect(createTypeFixture('TEXT', Database.MySQL)).toBe('DataTypes.TEXT');
      expect(createTypeFixture('BLOB', Database.MySQL)).toBe('DataTypes.BLOB');
      expect(createTypeFixture('TIME', Database.MySQL)).toBe('DataTypes.TIME');
      expect(createTypeFixture('DATE(2)', Database.MySQL)).toBe(
        'DataTypes.DATEONLY'
      );
      expect(createTypeFixture('FLOAT(11,10)', Database.MySQL)).toBe(
        'DataTypes.FLOAT(11, 10)'
      );
      expect(createTypeFixture('VARCHAR(500)', Database.MySQL)).toBe(
        'DataTypes.STRING(500)'
      );
    });

    it('reads every spelling of a fixed-length character type', () => {
      expect(createTypeFixture('character(10)', Database.MySQL)).toBe(
        'DataTypes.CHAR(10)'
      );
      expect(createTypeFixture('nchar(10)', Database.MySQL)).toBe(
        'DataTypes.CHAR(10)'
      );
      expect(createTypeFixture('national char(10)', Database.MySQL)).toBe(
        'DataTypes.CHAR(10)'
      );
      expect(createTypeFixture('native character(10)', Database.MySQL)).toBe(
        'DataTypes.CHAR(10)'
      );
      expect(
        createTypeFixture('national character(10)', Database.MariaDB)
      ).toBe('DataTypes.CHAR(10)');
      expect(createTypeFixture('bpchar(10)', Database.PostgreSQL)).toBe(
        'DataTypes.CHAR(10)'
      );
    });

    it('reads every spelling of a binary type as a blob of bytes', () => {
      expect(createTypeFixture('bfile', Database.Oracle)).toBe(
        'DataTypes.BLOB'
      );
      expect(createTypeFixture('raw(16)', Database.Oracle)).toBe(
        'DataTypes.BLOB'
      );
      expect(createTypeFixture('binary varying(10)', Database.MySQL)).toBe(
        'DataTypes.BLOB'
      );
      expect(createTypeFixture('CHAR(16) BYTE', Database.Databricks)).toBe(
        'DataTypes.BLOB'
      );
      expect(createTypeFixture('BINARY(16)', Database.Snowflake)).toBe(
        'DataTypes.BLOB'
      );
      expect(createAnnotationFixture('raw(16)', Database.Oracle)).toBe(
        '  declare value: Buffer;'
      );
    });

    it('states a sized binary type as written where BLOB would widen it', () => {
      expect(createTypeFixture('BINARY(16)', Database.MySQL)).toBe(
        '"BINARY(16)"'
      );
      expect(createTypeFixture('varbinary(10)', Database.MariaDB)).toBe(
        '"varbinary(10)"'
      );
      expect(createTypeFixture('CHAR(16) BYTE', Database.MySQL)).toBe(
        '"CHAR(16) BYTE"'
      );
      expect(createTypeFixture('LONG VARBINARY', Database.MySQL)).toBe(
        '"LONG VARBINARY"'
      );
      expect(createTypeFixture('binary(16)', Database.MSSQL)).toBe(
        '"binary(16)"'
      );
      expect(createTypeFixture('varbinary(16)', Database.MSSQL)).toBe(
        '"varbinary(16)"'
      );
      expect(createTypeFixture('image', Database.MSSQL)).toBe('"image"');
      expect(createTypeFixture('varbinary(max)', Database.MSSQL)).toBe(
        'DataTypes.BLOB'
      );
      expect(createAnnotationFixture('BINARY(16)', Database.MySQL)).toBe(
        '  declare value: Buffer;'
      );
      expect(createAnnotationFixture('varbinary(16)', Database.MSSQL)).toBe(
        '  declare value: Buffer;'
      );
    });

    it('keeps a binary key a key MySQL can index', () => {
      const { expression } = probe(
        'BINARY(16)',
        Database.MySQL,
        ColumnOption.primaryKey
      );

      expect(expression).toBe('"BINARY(16)"');
    });

    it('reads every spelling of a decimal as one that reads back a string', () => {
      expect(createTypeFixture('dec(10,2)', Database.MySQL)).toBe(
        'DataTypes.DECIMAL(10, 2)'
      );
      expect(createTypeFixture('fixed(10)', Database.MySQL)).toBe(
        'DataTypes.DECIMAL(10)'
      );
      expect(createTypeFixture('numeric(10,2)', Database.MSSQL)).toBe(
        'DataTypes.DECIMAL(10, 2)'
      );
      expect(createTypeFixture('NUMBER', Database.Oracle)).toBe(
        'DataTypes.DECIMAL'
      );
      expect(createAnnotationFixture('NUMBER', Database.Oracle)).toBe(
        '  declare value: string;'
      );
    });

    it('reads every spelling of a narrow integer at its own width', () => {
      expect(createTypeFixture('int1', Database.MySQL)).toBe(
        'DataTypes.TINYINT'
      );
      expect(createTypeFixture('byte', Database.MySQL)).toBe(
        'DataTypes.TINYINT'
      );
      expect(createTypeFixture('short', Database.MySQL)).toBe(
        'DataTypes.SMALLINT'
      );
      expect(createTypeFixture('smallserial', Database.PostgreSQL)).toBe(
        'DataTypes.SMALLINT'
      );
      expect(createTypeFixture('serial2', Database.PostgreSQL)).toBe(
        'DataTypes.SMALLINT'
      );
      expect(createTypeFixture('int3', Database.MySQL)).toBe(
        'DataTypes.MEDIUMINT'
      );
      expect(createTypeFixture('middleint', Database.MySQL)).toBe(
        'DataTypes.MEDIUMINT'
      );
    });

    it('reads a plain integer the same way on every vendor', () => {
      const databases = [
        Database.MariaDB,
        Database.MSSQL,
        Database.MySQL,
        Database.Oracle,
        Database.PostgreSQL,
        Database.SQLite,
        Database.Databricks,
      ];

      databases.forEach(database => {
        expect(createTypeFixture('INT', database)).toBe('DataTypes.INTEGER');
        expect(createAnnotationFixture('INT', database)).toBe(
          '  declare value: number;'
        );
      });
    });

    it('states a PostgreSQL bit string as written and reads a SQL Server bit as a boolean', () => {
      expect(createTypeFixture('bit', Database.PostgreSQL)).toBe('"bit"');
      expect(createTypeFixture('bit(8)', Database.PostgreSQL)).toBe('"bit(8)"');
      expect(createTypeFixture('varbit(8)', Database.PostgreSQL)).toBe(
        '"varbit(8)"'
      );
      expect(createAnnotationFixture('bit(8)', Database.PostgreSQL)).toBe(
        '  declare value: string;'
      );
      expect(createTypeFixture('bit', Database.MSSQL)).toBe(
        'DataTypes.BOOLEAN'
      );
      expect(createAnnotationFixture('bit', Database.MSSQL)).toBe(
        '  declare value: boolean;'
      );
    });

    it('states a MySQL BIT as written and reads it as its driver does', () => {
      expect(createTypeFixture('BIT(8)', Database.MySQL)).toBe('"BIT(8)"');
      expect(createTypeFixture('BIT', Database.MariaDB)).toBe('"BIT"');
      expect(createAnnotationFixture('BIT(1)', Database.MySQL)).toBe(
        '  declare value: Buffer;'
      );
      expect(createAnnotationFixture('BIT(1)', Database.MariaDB)).toBe(
        '  declare value: boolean;'
      );
      expect(createAnnotationFixture('BIT', Database.MariaDB)).toBe(
        '  declare value: boolean;'
      );
      expect(createAnnotationFixture('BIT(64)', Database.MariaDB)).toBe(
        '  declare value: Buffer;'
      );
    });

    it('reads a member as MySQL reads a string literal, escapes included', () => {
      expect(createTypeFixture("ENUM('a\\'b')", Database.MySQL)).toBe(
        'DataTypes.ENUM("a\'b")'
      );
      expect(createTypeFixture("ENUM('a\\nb')", Database.MariaDB)).toBe(
        'DataTypes.ENUM("a\\nb")'
      );
      expect(createAnnotationFixture("ENUM('a\\'b')", Database.MySQL)).toBe(
        '  declare value: "a\'b";'
      );
    });

    it('reads an enum member quoted with double quotes', () => {
      expect(createTypeFixture('ENUM("a","b")', Database.MySQL)).toBe(
        'DataTypes.ENUM("a", "b")'
      );
      expect(createAnnotationFixture('ENUM("a","b")', Database.MySQL)).toBe(
        '  declare value: "a" | "b";'
      );
    });

    it('keeps the fractional-second precision of a temporal type', () => {
      expect(createTypeFixture('TIMESTAMP(6)', Database.MySQL)).toBe(
        '"TIMESTAMP(6)"'
      );
      expect(createTypeFixture('DATETIME(3)', Database.MySQL)).toBe(
        'DataTypes.DATE(3)'
      );
      expect(createTypeFixture('DATETIME', Database.MariaDB)).toBe(
        'DataTypes.DATE'
      );
      expect(createTypeFixture('TIME(3)', Database.MySQL)).toBe('"TIME(3)"');
      expect(createAnnotationFixture('TIMESTAMP(6)', Database.MySQL)).toBe(
        '  declare value: Date;'
      );
      expect(createAnnotationFixture('TIME(3)', Database.MySQL)).toBe(
        '  declare value: string;'
      );
    });

    it('states a MySQL TIMESTAMP as written, which DATE would make a DATETIME', () => {
      expect(createTypeFixture('TIMESTAMP', Database.MySQL)).toBe(
        '"TIMESTAMP"'
      );
      expect(createTypeFixture('TIMESTAMP(3)', Database.MariaDB)).toBe(
        '"TIMESTAMP(3)"'
      );
      expect(createAnnotationFixture('TIMESTAMP', Database.MariaDB)).toBe(
        '  declare value: Date;'
      );
    });

    it('keeps the precision and scale of a MySQL floating point type', () => {
      expect(createTypeFixture('DOUBLE(11,10)', Database.MySQL)).toBe(
        'DataTypes.DOUBLE(11, 10)'
      );
      expect(createTypeFixture('DOUBLE PRECISION(10,2)', Database.MySQL)).toBe(
        'DataTypes.DOUBLE(10, 2)'
      );
      expect(createTypeFixture('REAL(10,2)', Database.MariaDB)).toBe(
        'DataTypes.DOUBLE(10, 2)'
      );
      expect(createTypeFixture('float(7,4) unsigned', Database.MySQL)).toBe(
        'DataTypes.FLOAT(7, 4).UNSIGNED'
      );
      expect(createTypeFixture('FLOAT(25)', Database.MySQL)).toBe(
        'DataTypes.DOUBLE'
      );
      expect(createTypeFixture('FLOAT(24)', Database.MySQL)).toBe(
        'DataTypes.FLOAT'
      );
    });

    it('drops the precision of a floating point type outside MySQL', () => {
      expect(createTypeFixture('REAL(11)', Database.PostgreSQL)).toBe(
        'DataTypes.REAL'
      );
      expect(createTypeFixture('float(53)', Database.MSSQL)).toBe(
        'DataTypes.DOUBLE'
      );
      expect(createTypeFixture('FLOAT(10,2)', Database.SQLite)).toBe(
        'DataTypes.DOUBLE'
      );
    });

    it('lifts a length only from a single argument', () => {
      expect(createTypeFixture('VARCHAR(10, 2)', Database.MySQL)).toBe(
        'DataTypes.STRING'
      );
      expect(createTypeFixture('VARCHAR(10)', Database.MySQL)).toBe(
        'DataTypes.STRING(10)'
      );
    });

    it('reads a data type of only whitespace as a variable-length string', () => {
      expect(createTypeFixture('   ', Database.MySQL)).toBe('DataTypes.STRING');
      expect(createAnnotationFixture('   ', Database.MySQL)).toBe(
        '  declare value: string;'
      );
    });

    it('reads an enum whose one member is the empty string', () => {
      expect(createTypeFixture("ENUM('')", Database.MySQL)).toBe(
        'DataTypes.ENUM("")'
      );
      expect(createAnnotationFixture("ENUM('')", Database.MySQL)).toBe(
        '  declare value: "";'
      );
    });

    it('appends UNSIGNED and ZEROFILL on MySQL and MariaDB alone, argument list or not', () => {
      expect(createTypeFixture('int unsigned', Database.MySQL)).toBe(
        'DataTypes.INTEGER.UNSIGNED'
      );
      expect(createTypeFixture('bigint(20) unsigned', Database.MySQL)).toBe(
        'DataTypes.BIGINT.UNSIGNED'
      );
      expect(createTypeFixture('int unsigned', Database.MariaDB)).toBe(
        'DataTypes.INTEGER.UNSIGNED'
      );
      expect(createTypeFixture('decimal(10,2) unsigned', Database.MySQL)).toBe(
        'DataTypes.DECIMAL(10, 2).UNSIGNED'
      );
      expect(createTypeFixture('FLOAT UNSIGNED', Database.MariaDB)).toBe(
        'DataTypes.FLOAT.UNSIGNED'
      );
      expect(createTypeFixture('INT(11) ZEROFILL', Database.MySQL)).toBe(
        'DataTypes.INTEGER.UNSIGNED.ZEROFILL'
      );
      expect(
        createTypeFixture('DECIMAL(10,2) UNSIGNED ZEROFILL', Database.MariaDB)
      ).toBe('DataTypes.DECIMAL(10, 2).UNSIGNED.ZEROFILL');
      expect(createTypeFixture('int unsigned', Database.PostgreSQL)).toBe(
        'DataTypes.INTEGER'
      );
      expect(createTypeFixture('unsigned big int', Database.SQLite)).toBe(
        'DataTypes.BIGINT'
      );
      expect(createTypeFixture('int unsigned', Database.MySQL)).not.toContain(
        'ZEROFILL'
      );
    });

    it('withholds UNSIGNED from a type that is not a NUMBER', () => {
      expect(createTypeFixture('UNSIGNED BIG INT', Database.MySQL)).toBe(
        'DataTypes.STRING'
      );
      expect(createTypeFixture('text unsigned', Database.MySQL)).toBe(
        'DataTypes.TEXT'
      );
      expect(createTypeFixture('date unsigned', Database.MariaDB)).toBe(
        'DataTypes.DATEONLY'
      );
      expect(createTypeFixture('boolean unsigned', Database.MySQL)).toBe(
        'DataTypes.BOOLEAN'
      );
    });
  });

  describe('PostgreSQL types', () => {
    it('states a real as REAL, which FLOAT would make a double precision', () => {
      expect(createTypeFixture('real', Database.PostgreSQL)).toBe(
        'DataTypes.REAL'
      );
      expect(createTypeFixture('float4', Database.PostgreSQL)).toBe(
        'DataTypes.REAL'
      );
      expect(createTypeFixture('float(24)', Database.PostgreSQL)).toBe(
        'DataTypes.REAL'
      );
      expect(createTypeFixture('float(25)', Database.PostgreSQL)).toBe(
        'DataTypes.DOUBLE'
      );
      expect(createAnnotationFixture('real', Database.PostgreSQL)).toBe(
        '  declare value: number;'
      );
    });

    it('states a stamp without a zone as written, which DATE would give one', () => {
      expect(createTypeFixture('timestamp', Database.PostgreSQL)).toBe(
        '"timestamp"'
      );
      expect(createTypeFixture('timestamp(3)', Database.PostgreSQL)).toBe(
        '"timestamp(3)"'
      );
      expect(
        createTypeFixture('timestamp without time zone', Database.PostgreSQL)
      ).toBe('"timestamp without time zone"');
      expect(createTypeFixture('timestamptz(3)', Database.PostgreSQL)).toBe(
        '"timestamptz(3)"'
      );
      expect(createTypeFixture('time(6)', Database.PostgreSQL)).toBe(
        '"time(6)"'
      );
      expect(createAnnotationFixture('timestamp(3)', Database.PostgreSQL)).toBe(
        '  declare value: Date;'
      );
    });

    it('states an interval as written and reads it as the object pg parses', () => {
      expect(createTypeFixture('interval', Database.PostgreSQL)).toBe(
        '"interval"'
      );
      expect(
        createTypeFixture('interval day to second(3)', Database.PostgreSQL)
      ).toBe('"interval day to second(3)"');
      expect(createAnnotationFixture('interval', Database.PostgreSQL)).toBe(
        '  declare value: object;'
      );
      expect(
        createAnnotationFixture('interval year to month', Database.PostgreSQL)
      ).toBe('  declare value: object;');
    });

    it('states money as written and reads it as the text pg hands over', () => {
      expect(createTypeFixture('money', Database.PostgreSQL)).toBe('"money"');
      expect(createAnnotationFixture('money', Database.PostgreSQL)).toBe(
        '  declare value: string;'
      );
    });

    it('states a range as RANGE of its subtype where Sequelize has one', () => {
      expect(createTypeFixture('int4range', Database.PostgreSQL)).toBe(
        'DataTypes.RANGE(DataTypes.INTEGER)'
      );
      expect(createTypeFixture('int8range', Database.PostgreSQL)).toBe(
        'DataTypes.RANGE(DataTypes.BIGINT)'
      );
      expect(createTypeFixture('numrange', Database.PostgreSQL)).toBe(
        'DataTypes.RANGE(DataTypes.DECIMAL)'
      );
      expect(createTypeFixture('daterange', Database.PostgreSQL)).toBe(
        'DataTypes.RANGE(DataTypes.DATEONLY)'
      );
      expect(createTypeFixture('tstzrange', Database.PostgreSQL)).toBe(
        'DataTypes.RANGE(DataTypes.DATE)'
      );
      expect(createTypeFixture('tsrange', Database.PostgreSQL)).toBe(
        '"tsrange"'
      );
      expect(createTypeFixture('int4multirange', Database.PostgreSQL)).toBe(
        '"int4multirange"'
      );
    });

    it('reads a range as a Range of the bound pg parses', () => {
      expect(createAnnotationFixture('int4range', Database.PostgreSQL)).toBe(
        '  declare value: Range<number>;'
      );
      expect(createAnnotationFixture('int8range', Database.PostgreSQL)).toBe(
        '  declare value: Range<string>;'
      );
      expect(createAnnotationFixture('numrange', Database.PostgreSQL)).toBe(
        '  declare value: Range<string>;'
      );
      expect(createAnnotationFixture('daterange', Database.PostgreSQL)).toBe(
        '  declare value: Range<string>;'
      );
      expect(createAnnotationFixture('tsrange', Database.PostgreSQL)).toBe(
        '  declare value: Range<Date>;'
      );
      expect(createAnnotationFixture('tstzrange', Database.PostgreSQL)).toBe(
        '  declare value: Range<Date>;'
      );
      expect(
        createAnnotationFixture('int4multirange', Database.PostgreSQL)
      ).toBe('  declare value: string;');
    });

    it('states a system identifier as written and reads it as pg does', () => {
      expect(createTypeFixture('oid', Database.PostgreSQL)).toBe('"oid"');
      expect(createAnnotationFixture('oid', Database.PostgreSQL)).toBe(
        '  declare value: number;'
      );
      expect(createTypeFixture('xid', Database.PostgreSQL)).toBe('"xid"');
      expect(createAnnotationFixture('xid', Database.PostgreSQL)).toBe(
        '  declare value: string;'
      );
      expect(createAnnotationFixture('xid8', Database.PostgreSQL)).toBe(
        '  declare value: string;'
      );
    });

    it('states any other listed type with no member as written', () => {
      expect(createTypeFixture('pg_lsn', Database.PostgreSQL)).toBe('"pg_lsn"');
      expect(createTypeFixture('xml', Database.PostgreSQL)).toBe('"xml"');
      expect(createTypeFixture('macaddr8', Database.PostgreSQL)).toBe(
        '"macaddr8"'
      );
      expect(createTypeFixture('point', Database.PostgreSQL)).toBe('"point"');
      expect(createAnnotationFixture('point', Database.PostgreSQL)).toBe(
        '  declare value: object;'
      );
      expect(createAnnotationFixture('circle', Database.PostgreSQL)).toBe(
        '  declare value: object;'
      );
      expect(createAnnotationFixture('polygon', Database.PostgreSQL)).toBe(
        '  declare value: string;'
      );
    });

    it('keeps the member of a listed type Sequelize creates as it is', () => {
      expect(createTypeFixture('macaddr', Database.PostgreSQL)).toBe(
        'DataTypes.MACADDR'
      );
      expect(createTypeFixture('time', Database.PostgreSQL)).toBe(
        'DataTypes.TIME'
      );
      expect(createTypeFixture('timestamptz', Database.PostgreSQL)).toBe(
        'DataTypes.DATE'
      );
      expect(createTypeFixture('mood', Database.PostgreSQL)).toBe(
        'DataTypes.STRING'
      );
    });
  });

  describe('PostgreSQL arrays', () => {
    it('wraps the member of a one-dimension array in ARRAY', () => {
      expect(createTypeFixture('int[]', Database.PostgreSQL)).toBe(
        'DataTypes.ARRAY(DataTypes.INTEGER)'
      );
      expect(createTypeFixture('integer ARRAY', Database.PostgreSQL)).toBe(
        'DataTypes.ARRAY(DataTypes.INTEGER)'
      );
      expect(createTypeFixture('text[]', Database.PostgreSQL)).toBe(
        'DataTypes.ARRAY(DataTypes.TEXT)'
      );
      expect(createTypeFixture('varchar(20)[]', Database.PostgreSQL)).toBe(
        'DataTypes.ARRAY(DataTypes.STRING(20))'
      );
      expect(createTypeFixture('uuid[]', Database.PostgreSQL)).toBe(
        'DataTypes.ARRAY(DataTypes.UUID)'
      );
      expect(createTypeFixture('int4range[]', Database.PostgreSQL)).toBe(
        'DataTypes.ARRAY(DataTypes.RANGE(DataTypes.INTEGER))'
      );
    });

    it('reads an array as an array of what pg hands over for an element', () => {
      expect(createAnnotationFixture('int[]', Database.PostgreSQL)).toBe(
        '  declare value: number[];'
      );
      expect(createAnnotationFixture('bigint[]', Database.PostgreSQL)).toBe(
        '  declare value: string[];'
      );
      expect(createAnnotationFixture('bytea[]', Database.PostgreSQL)).toBe(
        '  declare value: Buffer[];'
      );
      expect(createAnnotationFixture('jsonb[]', Database.PostgreSQL)).toBe(
        '  declare value: unknown[];'
      );
      expect(createAnnotationFixture('int4range[]', Database.PostgreSQL)).toBe(
        '  declare value: Range<number>[];'
      );
    });

    it('wraps the annotation of an element that is a union in parentheses', () => {
      expect(createTypeFixture("enum('a','b')[]", Database.PostgreSQL)).toBe(
        'DataTypes.ARRAY(DataTypes.ENUM("a", "b"))'
      );
      expect(
        createAnnotationFixture("enum('a','b')[]", Database.PostgreSQL)
      ).toBe('  declare value: ("a" | "b")[];');
    });

    it('states an array as written where its element is or it nests', () => {
      expect(createTypeFixture('money[]', Database.PostgreSQL)).toBe(
        '"money[]"'
      );
      expect(createTypeFixture('interval[]', Database.PostgreSQL)).toBe(
        '"interval[]"'
      );
      expect(createTypeFixture('int[][]', Database.PostgreSQL)).toBe(
        '"int[][]"'
      );
      expect(createTypeFixture('timestamptz[][][]', Database.PostgreSQL)).toBe(
        '"timestamptz[][][]"'
      );
      expect(createAnnotationFixture('interval[]', Database.PostgreSQL)).toBe(
        '  declare value: object[];'
      );
      expect(createAnnotationFixture('int[][]', Database.PostgreSQL)).toBe(
        '  declare value: number[][];'
      );
      expect(
        createAnnotationFixture('timestamptz[][][]', Database.PostgreSQL)
      ).toBe('  declare value: Date[][][];');
    });

    it('reads an array pg does not parse as the one string it hands over', () => {
      expect(createTypeFixture('bit(8)[]', Database.PostgreSQL)).toBe(
        '"bit(8)[]"'
      );
      expect(createAnnotationFixture('bit(8)[]', Database.PostgreSQL)).toBe(
        '  declare value: string;'
      );
      expect(createAnnotationFixture('xid[]', Database.PostgreSQL)).toBe(
        '  declare value: string;'
      );
      expect(createTypeFixture('tsvector[]', Database.PostgreSQL)).toBe(
        'DataTypes.ARRAY(DataTypes.TSVECTOR)'
      );
      expect(createAnnotationFixture('tsvector[]', Database.PostgreSQL)).toBe(
        '  declare value: string;'
      );
    });

    it('reads no array suffix outside PostgreSQL', () => {
      expect(createTypeFixture('int[]', Database.MySQL)).toBe(
        'DataTypes.INTEGER'
      );
      expect(createAnnotationFixture('int[]', Database.MySQL)).toBe(
        '  declare value: number;'
      );
    });
  });

  describe('MySQL and MariaDB types', () => {
    it('states a spatial type as GEOMETRY where Sequelize takes its subtype', () => {
      expect(createTypeFixture('GEOMETRY', Database.MySQL)).toBe(
        'DataTypes.GEOMETRY'
      );
      expect(createTypeFixture('POINT', Database.MySQL)).toBe(
        'DataTypes.GEOMETRY("POINT")'
      );
      expect(createTypeFixture('LINESTRING', Database.MariaDB)).toBe(
        'DataTypes.GEOMETRY("LINESTRING")'
      );
      expect(createTypeFixture('POLYGON', Database.MySQL)).toBe(
        'DataTypes.GEOMETRY("POLYGON")'
      );
      expect(createTypeFixture('MULTIPOINT', Database.MySQL)).toBe(
        '"MULTIPOINT"'
      );
      expect(createAnnotationFixture('POINT', Database.MySQL)).toBe(
        '  declare value: object;'
      );
      expect(createAnnotationFixture('MULTIPOLYGON', Database.MariaDB)).toBe(
        '  declare value: object;'
      );
    });

    it('states YEAR and SET as written', () => {
      expect(createTypeFixture('YEAR', Database.MySQL)).toBe('"YEAR"');
      expect(createAnnotationFixture('YEAR', Database.MySQL)).toBe(
        '  declare value: number;'
      );
      expect(createTypeFixture("SET('a','b')", Database.MariaDB)).toBe(
        `"SET('a','b')"`
      );
      expect(createAnnotationFixture("SET('a','b')", Database.MySQL)).toBe(
        '  declare value: string;'
      );
      expect(createAnnotationFixture("SET('a','b')", Database.MariaDB)).toBe(
        '  declare value: ("a" | "b")[];'
      );
      expect(createAnnotationFixture('SET', Database.MariaDB)).toBe(
        '  declare value: string[];'
      );
    });

    it('reads a MariaDB decimal as a number while it is safe and as text past that', () => {
      expect(createAnnotationFixture('DECIMAL(10,2)', Database.MariaDB)).toBe(
        '  declare value: number | string;'
      );
      expect(createAnnotationFixture('DECIMAL(10,2)', Database.MySQL)).toBe(
        '  declare value: string;'
      );
    });

    it('states the MariaDB address and UUID types as written', () => {
      expect(createTypeFixture('INET4', Database.MariaDB)).toBe('"INET4"');
      expect(createTypeFixture('INET6', Database.MariaDB)).toBe('"INET6"');
      expect(createTypeFixture('UUID', Database.MariaDB)).toBe('"UUID"');
      expect(createAnnotationFixture('INET6', Database.MariaDB)).toBe(
        '  declare value: string;'
      );
      expect(createAnnotationFixture('UUID', Database.MariaDB)).toBe(
        '  declare value: string;'
      );
    });

    it('states the long text and binary synonyms as written', () => {
      expect(createTypeFixture('LONG VARCHAR', Database.MySQL)).toBe(
        '"LONG VARCHAR"'
      );
      expect(createAnnotationFixture('LONG', Database.MariaDB)).toBe(
        '  declare value: string;'
      );
    });

    it('states a BLOB or TEXT of a length as written, which MySQL sizes by it', () => {
      expect(createTypeFixture('BLOB(100)', Database.MySQL)).toBe(
        '"BLOB(100)"'
      );
      expect(createAnnotationFixture('BLOB(100)', Database.MySQL)).toBe(
        '  declare value: Buffer;'
      );
      expect(createTypeFixture('text(50)', Database.MariaDB)).toBe(
        '"text(50)"'
      );
      expect(createAnnotationFixture('text(50)', Database.MariaDB)).toBe(
        '  declare value: string;'
      );
    });

    it('reads a MariaDB vector as its bytes', () => {
      expect(createTypeFixture('VECTOR(3)', Database.MariaDB)).toBe(
        '"VECTOR(3)"'
      );
      expect(createAnnotationFixture('VECTOR(3)', Database.MariaDB)).toBe(
        '  declare value: Buffer;'
      );
      expect(createAnnotationFixture('vector', Database.MariaDB)).toBe(
        '  declare value: Buffer;'
      );
    });

    it('keeps a carriage return in an enum or set member', () => {
      expect(createTypeFixture("ENUM('a\\rb')", Database.MySQL)).toBe(
        'DataTypes.ENUM("a\\rb")'
      );
      expect(createAnnotationFixture("ENUM('a\\rb')", Database.MySQL)).toBe(
        '  declare value: "a\\rb";'
      );
      expect(createTypeFixture("ENUM('a\r\nb')", Database.MariaDB)).toBe(
        'DataTypes.ENUM("a\\r\\nb")'
      );
      expect(createAnnotationFixture("SET('a\\rb')", Database.MariaDB)).toBe(
        '  declare value: ("a\\rb")[];'
      );
    });

    it('keeps each line break of a type written as is, as its members do', () => {
      expect(createTypeFixture("SET('a\r\nb','c')", Database.MySQL)).toBe(
        `"SET('a\\r\\nb','c')"`
      );
      expect(createTypeFixture("SET('a\r\nb','c')", Database.MariaDB)).toBe(
        `"SET('a\\r\\nb','c')"`
      );
      expect(
        createAnnotationFixture("SET('a\r\nb','c')", Database.MariaDB)
      ).toBe('  declare value: ("a\\r\\nb" | "c")[];');
      expect(createTypeFixture("SET('a\rb')", Database.MariaDB)).toBe(
        `"SET('a\\rb')"`
      );
      expect(createAnnotationFixture("SET('a\rb')", Database.MariaDB)).toBe(
        '  declare value: ("a\\rb")[];'
      );
    });
  });

  describe('SQL Server types', () => {
    it('states nvarchar(max) as TEXT and every other string type it has no member for as written', () => {
      expect(createTypeFixture('nvarchar(max)', Database.MSSQL)).toBe(
        'DataTypes.TEXT'
      );
      expect(createTypeFixture('nvarchar(100)', Database.MSSQL)).toBe(
        'DataTypes.STRING(100)'
      );
      expect(createTypeFixture('varchar(max)', Database.MSSQL)).toBe(
        '"varchar(max)"'
      );
      expect(createTypeFixture('varchar(100)', Database.MSSQL)).toBe(
        '"varchar(100)"'
      );
      expect(createTypeFixture('nchar(10)', Database.MSSQL)).toBe(
        '"nchar(10)"'
      );
      expect(createTypeFixture('char(10)', Database.MSSQL)).toBe(
        'DataTypes.CHAR(10)'
      );
      expect(createTypeFixture('ntext', Database.MSSQL)).toBe('"ntext"');
      expect(createTypeFixture('xml', Database.MSSQL)).toBe('"xml"');
    });

    it('states every stamp and time of day that takes the text of a Date as DATE', () => {
      [
        'datetime2',
        'datetime2(3)',
        'DATETIME2(7)',
        'datetimeoffset',
        'datetimeoffset(3)',
        'time',
        'time(3)',
      ].forEach(dataType => {
        expect(createTypeFixture(dataType, Database.MSSQL)).toBe(
          'DataTypes.DATE'
        );
        expect(createAnnotationFixture(dataType, Database.MSSQL)).toBe(
          '  declare value: Date;'
        );
      });
    });

    it('states datetime and smalldatetime as written, which refuse the text DATE writes', () => {
      expect(createTypeFixture('datetime', Database.MSSQL)).toBe('"datetime"');
      expect(createTypeFixture('smalldatetime', Database.MSSQL)).toBe(
        '"smalldatetime"'
      );
      expect(createAnnotationFixture('datetime', Database.MSSQL)).toBe(
        '  declare value: Date;'
      );
    });

    it('reads a decimal and money as the number tedious hands over', () => {
      expect(createTypeFixture('decimal(10,2)', Database.MSSQL)).toBe(
        'DataTypes.DECIMAL(10, 2)'
      );
      expect(createAnnotationFixture('decimal(10,2)', Database.MSSQL)).toBe(
        '  declare value: number;'
      );
      expect(createAnnotationFixture('numeric(18,4)', Database.MSSQL)).toBe(
        '  declare value: number;'
      );
      expect(createTypeFixture('money', Database.MSSQL)).toBe('"money"');
      expect(createAnnotationFixture('smallmoney', Database.MSSQL)).toBe(
        '  declare value: number;'
      );
    });

    it('states a single-precision float as REAL, which FLOAT would widen', () => {
      expect(createTypeFixture('real', Database.MSSQL)).toBe('DataTypes.REAL');
      expect(createTypeFixture('float(24)', Database.MSSQL)).toBe(
        'DataTypes.REAL'
      );
      expect(createTypeFixture('float', Database.MSSQL)).toBe(
        'DataTypes.DOUBLE'
      );
    });

    it('reads the CLR types as bytes, sql_variant as unknown and json as text', () => {
      expect(createTypeFixture('geography', Database.MSSQL)).toBe(
        '"geography"'
      );
      expect(createAnnotationFixture('geography', Database.MSSQL)).toBe(
        '  declare value: Buffer;'
      );
      expect(createAnnotationFixture('hierarchyid', Database.MSSQL)).toBe(
        '  declare value: Buffer;'
      );
      expect(createAnnotationFixture('sql_variant', Database.MSSQL)).toBe(
        '  declare value: unknown;'
      );
      expect(createTypeFixture('json', Database.MSSQL)).toBe('"json"');
      expect(createAnnotationFixture('json', Database.MSSQL)).toBe(
        '  declare value: string;'
      );
    });

    it('states uniqueidentifier and rowversion as written', () => {
      expect(createAnnotationFixture('uniqueidentifier', Database.MSSQL)).toBe(
        '  declare value: string;'
      );
      expect(createTypeFixture('rowversion', Database.MSSQL)).toBe(
        '"rowversion"'
      );
      expect(createTypeFixture('timestamp', Database.MSSQL)).toBe(
        '"timestamp"'
      );
    });

    it('leaves a rowversion to the database on an insert, as DEFAULT', () => {
      const table = createTable({
        id: 't1',
        name: 'probe',
        columnIds: ['c1', 'c2', 'c3'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'version',
            dataType: 'rowversion',
            default: '0',
            options: ColumnOption.notNull,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'stamp',
            dataType: 'timestamp',
          }),
          createColumn({
            id: 'c3',
            tableId: 't1',
            name: 'at',
            dataType: 'timestamp',
            options: ColumnOption.notNull,
          }),
        ],
        settings: { database: Database.MSSQL },
      });

      expect(render(state, table)).toEqual([
        'export class Probe extends Model<',
        '  InferAttributes<Probe>,',
        '  InferCreationAttributes<Probe>',
        '> {',
        '  declare version: CreationOptional<Buffer>;',
        '  declare stamp: Buffer | null;',
        '  declare at: CreationOptional<Buffer>;',
        '}',
        '',
        'Probe.init(',
        '  {',
        '    version: {',
        '      type: "rowversion",',
        '      allowNull: false,',
        '      defaultValue: () => Sequelize.literal("DEFAULT"),',
        '    },',
        '    stamp: {',
        '      type: "timestamp",',
        '      allowNull: true,',
        '      defaultValue: () => Sequelize.literal("DEFAULT"),',
        '    },',
        '    at: {',
        '      type: "timestamp",',
        '      allowNull: false,',
        '      defaultValue: () => Sequelize.literal("DEFAULT"),',
        '    },',
        '  },',
        '  { sequelize, tableName: "probe", timestamps: false }',
        ');',
      ]);
    });

    it('reads a timestamp outside SQL Server as a date and time', () => {
      expect(createAnnotationFixture('timestamp', Database.MySQL)).toBe(
        '  declare value: Date;'
      );
    });
  });

  describe('SQLite types', () => {
    it('states TIMESTAMP as written and reads it as text', () => {
      expect(createTypeFixture('TIMESTAMP', Database.SQLite)).toBe(
        '"TIMESTAMP"'
      );
      expect(createAnnotationFixture('TIMESTAMP', Database.SQLite)).toBe(
        '  declare value: string;'
      );
      expect(createTypeFixture('DATETIME', Database.SQLite)).toBe(
        'DataTypes.DATE'
      );
      expect(createAnnotationFixture('DATETIME', Database.SQLite)).toBe(
        '  declare value: Date;'
      );
    });

    it('reads a decimal as the number sqlite3 hands over', () => {
      expect(createAnnotationFixture('NUMERIC', Database.SQLite)).toBe(
        '  declare value: number;'
      );
      expect(createAnnotationFixture('DECIMAL(10,2)', Database.SQLite)).toBe(
        '  declare value: number;'
      );
    });
  });

  describe('empty tables', () => {
    it('renders a table with no columns as an empty class', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'empty' })],
      });

      expect(render(state, state.collections.tableEntities.t1)).toEqual([
        'export class Empty extends Model<',
        '  InferAttributes<Empty>,',
        '  InferCreationAttributes<Empty>',
        '> {}',
        '',
        'Empty.init(',
        '  {},',
        '  { sequelize, tableName: "empty", timestamps: false }',
        ');',
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
        'export class users extends Model<',
        '  InferAttributes<users>,',
        '  InferCreationAttributes<users>',
        '> {',
        '  declare Id: CreationOptional<string>;',
        '  declare Email: string;',
        '  declare Bio: string | null;',
        '  declare Balance: CreationOptional<string>;',
        '  declare LastSeen: Date | null;',
        '}',
        '',
        'users.init(',
        '  {',
        '    Id: {',
        '      type: DataTypes.UUID,',
        '      field: "id",',
        '      primaryKey: true,',
        '      allowNull: false,',
        '      defaultValue: Sequelize.literal("gen_random_uuid()"),',
        '    },',
        '    Email: {',
        '      type: DataTypes.STRING(255),',
        '      field: "email",',
        '      allowNull: false,',
        '      unique: true,',
        '      comment: "login email",',
        '    },',
        '    Bio: { type: DataTypes.TEXT, field: "bio", allowNull: true },',
        '    Balance: {',
        '      type: DataTypes.DECIMAL(10, 2),',
        '      field: "balance",',
        '      allowNull: false,',
        '      defaultValue: 0,',
        '    },',
        '    LastSeen: { type: DataTypes.DATE, field: "last seen", allowNull: true },',
        '  },',
        '  { sequelize, tableName: "users", timestamps: false }',
        ');',
      ]);
    });

    it('applies camelCase to a table name as the class name', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'user_log' })],
        settings: {
          database: Database.MySQL,
          tableNameCase: NameCase.camelCase,
        },
      });

      expect(render(state, state.collections.tableEntities.t1)).toEqual([
        'export class userLog extends Model<',
        '  InferAttributes<userLog>,',
        '  InferCreationAttributes<userLog>',
        '> {}',
        '',
        'userLog.init(',
        '  {},',
        '  { sequelize, tableName: "user_log", timestamps: false }',
        ');',
      ]);
    });

    it('applies the column name case to the association properties too', () => {
      const { state, team, user } = createTeamFixture();
      state.settings.columnNameCase = NameCase.pascalCase;

      expect(render(state, team)).toContain(
        '  declare UserList?: NonAttribute<User[]>;'
      );
      expect(render(state, user)).toContain(
        '  declare Team?: NonAttribute<Team>;'
      );
    });

    it('omits the database name when the identifier already spells it', () => {
      const { state, table } = createUsersFixture({
        columnNameCase: NameCase.none,
      });

      expect(render(state, table)).toContain(
        '    bio: { type: DataTypes.TEXT, allowNull: true },'
      );
      expect(render(state, table)).toContain('  declare bio: string | null;');
      expect(render(state, table)).toContain(
        '  declare last_seen: Date | null;'
      );
    });
  });

  describe('constraints', () => {
    it('generates an auto-increment primary key and states its numeric type', () => {
      const { state, team } = createTeamFixture();

      expect(render(state, team)).toContain('      autoIncrement: true,');
      expect(render(state, team)).toContain(
        '  declare id: CreationOptional<number>;'
      );
    });

    it('drops the default of an auto-increment column and the unique of a key', () => {
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

      expect(render(state, table)).toEqual([
        'export class Probe extends Model<',
        '  InferAttributes<Probe>,',
        '  InferCreationAttributes<Probe>',
        '> {',
        '  declare id: CreationOptional<number>;',
        '}',
        '',
        'Probe.init(',
        '  {',
        '    id: {',
        '      type: DataTypes.INTEGER,',
        '      primaryKey: true,',
        '      autoIncrement: true,',
        '      allowNull: false,',
        '    },',
        '  },',
        '  { sequelize, tableName: "probe", timestamps: false }',
        ');',
      ]);
    });

    it('states the data type of a generated key rather than a strategy', () => {
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
        'export class Account extends Model<',
        '  InferAttributes<Account>,',
        '  InferCreationAttributes<Account>',
        '> {',
        '  declare id: CreationOptional<string>;',
        '}',
        '',
        'Account.init(',
        '  {',
        '    id: {',
        '      type: DataTypes.BIGINT,',
        '      primaryKey: true,',
        '      autoIncrement: true,',
        '      allowNull: false,',
        '    },',
        '  },',
        '  { sequelize, tableName: "account", timestamps: false }',
        ');',
      ]);
    });

    it('keeps autoIncrement on a uuid key because the diagram states it', () => {
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
        'export class Probe extends Model<',
        '  InferAttributes<Probe>,',
        '  InferCreationAttributes<Probe>',
        '> {',
        '  declare id: CreationOptional<string>;',
        '}',
        '',
        'Probe.init(',
        '  {',
        '    id: {',
        '      type: DataTypes.UUID,',
        '      primaryKey: true,',
        '      autoIncrement: true,',
        '      allowNull: false,',
        '    },',
        '  },',
        '  { sequelize, tableName: "probe", timestamps: false }',
        ');',
      ]);
    });

    it('states autoIncrement on a non-numeric key exactly as the diagram does', () => {
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
        'export class Probe extends Model<',
        '  InferAttributes<Probe>,',
        '  InferCreationAttributes<Probe>',
        '> {',
        '  declare code: CreationOptional<string>;',
        '}',
        '',
        'Probe.init(',
        '  {',
        '    code: {',
        '      type: DataTypes.STRING(10),',
        '      primaryKey: true,',
        '      autoIncrement: true,',
        '      allowNull: false,',
        '    },',
        '  },',
        '  { sequelize, tableName: "probe", timestamps: false }',
        ');',
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
        'export class Log extends Model<',
        '  InferAttributes<Log>,',
        '  InferCreationAttributes<Log>',
        '> {',
        '  declare id: number;',
        '  declare seq: CreationOptional<number>;',
        '}',
        '',
        'Log.init(',
        '  {',
        '    id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },',
        '    seq: { type: DataTypes.INTEGER, autoIncrement: true, allowNull: false },',
        '  },',
        '  { sequelize, tableName: "log", timestamps: false }',
        ');',
      ]);
    });

    it('marks a serial auto-increment and NOT NULL, as the type numbers its rows', () => {
      const item = createTable({
        id: 't1',
        name: 'item',
        columnIds: ['c1', 'c2'],
      });
      const ledger = createTable({
        id: 't2',
        name: 'ledger',
        columnIds: ['c3', 'c4'],
      });
      const state = createState({
        tables: [item, ledger],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'serial',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'name',
            dataType: 'text',
            options: ColumnOption.notNull,
          }),
          createColumn({
            id: 'c3',
            tableId: 't2',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'c4',
            tableId: 't2',
            name: 'seq',
            dataType: 'bigserial',
            default: '7',
          }),
        ],
        settings: { database: Database.PostgreSQL },
      });

      expect(render(state, item)).toEqual([
        'export class Item extends Model<',
        '  InferAttributes<Item>,',
        '  InferCreationAttributes<Item>',
        '> {',
        '  declare id: CreationOptional<number>;',
        '  declare name: string;',
        '}',
        '',
        'Item.init(',
        '  {',
        '    id: {',
        '      type: DataTypes.INTEGER,',
        '      primaryKey: true,',
        '      autoIncrement: true,',
        '      allowNull: false,',
        '    },',
        '    name: { type: DataTypes.TEXT, allowNull: false },',
        '  },',
        '  { sequelize, tableName: "item", timestamps: false }',
        ');',
      ]);
      expect(render(state, ledger)).toContain(
        '  declare seq: CreationOptional<string>;'
      );
      expect(render(state, ledger)).toContain(
        '    seq: { type: DataTypes.BIGINT, autoIncrement: true, allowNull: false },'
      );
    });

    it('leaves a serial past the one auto-increment of a model to the database', () => {
      const table = createTable({
        id: 't1',
        name: 'item',
        columnIds: ['c1', 'c2', 'c3'],
      });
      const columns = [
        createColumn({
          id: 'c1',
          tableId: 't1',
          name: 'id',
          dataType: 'serial',
          options: ColumnOption.primaryKey,
        }),
        createColumn({
          id: 'c2',
          tableId: 't1',
          name: 'seq',
          dataType: 'bigserial',
        }),
        createColumn({
          id: 'c3',
          tableId: 't1',
          name: 'no',
          dataType: 'int',
          options: ColumnOption.autoIncrement | ColumnOption.notNull,
        }),
      ];
      const state = createState({
        tables: [table],
        columns,
        settings: { database: Database.PostgreSQL },
      });

      expect(render(state, table)).toEqual([
        'export class Item extends Model<',
        '  InferAttributes<Item>,',
        '  InferCreationAttributes<Item>',
        '> {',
        '  declare id: CreationOptional<number>;',
        '  declare seq: CreationOptional<string>;',
        '  declare no: CreationOptional<number>;',
        '}',
        '',
        'Item.init(',
        '  {',
        '    id: {',
        '      type: DataTypes.INTEGER,',
        '      primaryKey: true,',
        '      allowNull: false,',
        '      defaultValue: () => Sequelize.literal("DEFAULT"),',
        '    },',
        '    seq: {',
        '      type: DataTypes.BIGINT,',
        '      allowNull: false,',
        '      defaultValue: () => Sequelize.literal("DEFAULT"),',
        '    },',
        '    no: { type: DataTypes.INTEGER, autoIncrement: true, allowNull: false },',
        '  },',
        '  { sequelize, tableName: "item", timestamps: false }',
        ');',
      ]);
    });

    it('marks a MySQL SERIAL unique, the key its AUTO_INCREMENT needs, and nullable as the DDL writes it', () => {
      const keyed = createTable({ id: 't1', name: 'keyed', columnIds: ['c1'] });
      const counted = createTable({
        id: 't2',
        name: 'counted',
        columnIds: ['c2', 'c3'],
      });
      const state = createState({
        tables: [keyed, counted],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'SERIAL',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'c2',
            tableId: 't2',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'c3',
            tableId: 't2',
            name: 'seq',
            dataType: 'serial',
          }),
        ],
        settings: { database: Database.MariaDB },
      });

      expect(render(state, keyed)).toContain(
        '  declare id: CreationOptional<number | string>;'
      );
      expect(render(state, keyed).join('\n')).toContain(
        [
          '    id: {',
          '      type: DataTypes.BIGINT.UNSIGNED,',
          '      primaryKey: true,',
          '      autoIncrement: true,',
          '      allowNull: false,',
          '    },',
        ].join('\n')
      );
      expect(render(state, counted)).toContain(
        '  declare seq: number | string | null;'
      );
      expect(render(state, counted).join('\n')).toContain(
        [
          '    seq: {',
          '      type: DataTypes.BIGINT.UNSIGNED,',
          '      autoIncrement: true,',
          '      allowNull: true,',
          '      unique: true,',
          '    },',
        ].join('\n')
      );
    });

    it('emits one primaryKey per member of a composite primary key', () => {
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
        'export class Membership extends Model<',
        '  InferAttributes<Membership>,',
        '  InferCreationAttributes<Membership>',
        '> {',
        '  declare userId: number;',
        '  declare teamId: number;',
        '}',
        '',
        'Membership.init(',
        '  {',
        '    userId: {',
        '      type: DataTypes.INTEGER,',
        '      field: "user_id",',
        '      primaryKey: true,',
        '      allowNull: false,',
        '    },',
        '    teamId: {',
        '      type: DataTypes.INTEGER,',
        '      field: "team_id",',
        '      primaryKey: true,',
        '      allowNull: false,',
        '    },',
        '  },',
        '  { sequelize, tableName: "membership", timestamps: false }',
        ');',
      ]);
    });

    it('always states allowNull, which Sequelize would otherwise default to true', () => {
      const { state } = createUsersFixture();

      expect(createCode(state)).toContain('allowNull: false');
      expect(createCode(state)).toContain('allowNull: true');
      expect(
        createCode(state)
          .split('\n')
          .filter(line => line.includes('type: DataTypes'))
      ).toHaveLength(5);
      expect(
        createCode(state)
          .split('\n')
          .filter(line => line.includes('allowNull:'))
      ).toHaveLength(5);
    });

    it('suppresses unique on a primary key that already carries it', () => {
      const table = createTable({
        id: 't1',
        name: 'probe',
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
            options: ColumnOption.primaryKey | ColumnOption.unique,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'code',
            dataType: 'int',
            options: ColumnOption.unique | ColumnOption.notNull,
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toContain(
        '    id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },'
      );
      expect(render(state, table)).toContain(
        '    code: { type: DataTypes.INTEGER, allowNull: false, unique: true },'
      );
    });

    it('states timestamps: false so Sequelize does not invent createdAt and updatedAt', () => {
      const { state } = createSharedFixture();

      expect(createCode(state)).toContain('timestamps: false');
      expect(createCode(state)).toContain('  declare createdAt: number;');
      expect(createCode(state)).not.toContain('timestamps: true');
    });

    it('states the table comment in the init options', () => {
      const table = createTable({
        id: 't1',
        name: 'user',
        comment: 'one row per person',
      });
      const state = createState({ tables: [table] });

      expect(render(state, table)).toEqual([
        'export class User extends Model<',
        '  InferAttributes<User>,',
        '  InferCreationAttributes<User>',
        '> {}',
        '',
        'User.init(',
        '  {},',
        '  {',
        '    sequelize,',
        '    tableName: "user",',
        '    timestamps: false,',
        '    comment: "one row per person",',
        '  }',
        ');',
      ]);
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
        'export class User extends Model<',
        '  InferAttributes<User>,',
        '  InferCreationAttributes<User>',
        '> {',
        '  declare id: number;',
        '}',
        '',
        'User.init(',
        '  { id: { type: DataTypes.INTEGER, allowNull: false } },',
        '  { sequelize, tableName: "user", timestamps: false }',
        ');',
      ]);
    });

    it('keeps the whitespace inside a comment that also holds content', () => {
      const table = createTable({ id: 't1', name: 'user', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
            comment: ' pad ',
            options: ColumnOption.notNull,
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toContain(
        '  { id: { type: DataTypes.INTEGER, allowNull: false, comment: " pad " } },'
      );
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
        'export class SaY extends Model<',
        '  InferAttributes<SaY>,',
        '  InferCreationAttributes<SaY>',
        '> {',
        '  declare qUote: string | null;',
        '}',
        '',
        'SaY.init(',
        '  {',
        '    qUote: {',
        '      type: DataTypes.STRING(10),',
        '      field: "q\\"uote",',
        '      allowNull: true,',
        '      defaultValue: "a\\"b",',
        '      comment: "line\\none",',
        '    },',
        '  },',
        '  { sequelize, tableName: "sa\\"y", timestamps: false, comment: "a\\\\b" }',
        ');',
      ]);
    });

    it('keeps each line break of a string the database reads, but a comment', () => {
      const table = createTable({
        id: 't1',
        name: 'pa\r\nge',
        comment: 'one\rtwo',
        columnIds: ['c1', 'c2'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'cr\rx',
            dataType: 'varchar(10)',
            default: "'a\r\nb'",
            comment: 'x\r\ny',
            options: ColumnOption.notNull,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'lf\nx',
            dataType: 'varchar(10)',
            default: "concat('a\rb')",
            options: ColumnOption.notNull,
          }),
        ],
        indexes: [
          createIndex({
            id: 'i1',
            tableId: 't1',
            name: 'IDX\r\n1',
            indexColumnIds: ['ic1'],
          }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c1' }),
        ],
        settings: {
          database: Database.MySQL,
          columnNameCase: NameCase.none,
        },
      });

      expect(render(state, table)).toEqual([
        'export class PaGe extends Model<',
        '  InferAttributes<PaGe>,',
        '  InferCreationAttributes<PaGe>',
        '> {',
        '  declare cr_x: CreationOptional<string>;',
        '  declare lf_x: CreationOptional<string>;',
        '}',
        '',
        'PaGe.init(',
        '  {',
        '    cr_x: {',
        '      type: DataTypes.STRING(10),',
        '      field: "cr\\rx",',
        '      allowNull: false,',
        '      defaultValue: "a\\r\\nb",',
        '      comment: "x\\ny",',
        '    },',
        '    lf_x: {',
        '      type: DataTypes.STRING(10),',
        '      field: "lf\\nx",',
        '      allowNull: false,',
        '      defaultValue: Sequelize.literal("concat(\'a\\rb\')"),',
        '    },',
        '  },',
        '  {',
        '    sequelize,',
        '    tableName: "pa\\r\\nge",',
        '    timestamps: false,',
        '    comment: "one\\ntwo",',
        '    indexes: [{ name: "IDX\\r\\n1", fields: ["cr\\rx"] }],',
        '  }',
        ');',
      ]);
    });

    it('renders a raw default as a literal, a quoted string or Sequelize.literal', () => {
      expect(createDefaultFixture('0')).toContain(
        '  { value: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 } },'
      );
      expect(createDefaultFixture('-1.5')).toContain(
        '  { value: { type: DataTypes.INTEGER, allowNull: true, defaultValue: -1.5 } },'
      );
      expect(createDefaultFixture("'abc'")).toContain(
        '  { value: { type: DataTypes.INTEGER, allowNull: true, defaultValue: "abc" } },'
      );
      expect(createDefaultFixture("'it''s'")).toContain(
        '  { value: { type: DataTypes.INTEGER, allowNull: true, defaultValue: "it\'s" } },'
      );
      expect(createDefaultFixture('TRUE')).toContain(
        '  { value: { type: DataTypes.INTEGER, allowNull: true, defaultValue: true } },'
      );
      expect(createDefaultFixture('false')).toContain(
        '  { value: { type: DataTypes.INTEGER, allowNull: true, defaultValue: false } },'
      );
      expect(createDefaultFixture('CURRENT_TIMESTAMP')).toContain(
        '      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),'
      );
      expect(createDefaultFixture('NULL')).toContain(
        '      defaultValue: Sequelize.literal("NULL"),'
      );
      expect(createDefaultFixture("'a' || 'b'")).toContain(
        "      defaultValue: Sequelize.literal(\"'a' || 'b'\"),"
      );
    });

    it('reads a signed or fractional numeric default as a bare number', () => {
      expect(createDefaultFixture('+5')).toContain(
        '  { value: { type: DataTypes.INTEGER, allowNull: true, defaultValue: +5 } },'
      );
      expect(createDefaultFixture('0.50')).toContain(
        '  { value: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0.50 } },'
      );
      expect(createDefaultFixture(' 7 ')).toContain(
        '  { value: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 7 } },'
      );
    });

    it('holds a leading-zero default as a literal, which strict mode cannot spell', () => {
      expect(createDefaultFixture('007')).toContain(
        '      defaultValue: Sequelize.literal("007"),'
      );
      expect(createDefaultFixture('08')).toContain(
        '      defaultValue: Sequelize.literal("08"),'
      );
      expect(createDefaultFixture('00.5')).toContain(
        '      defaultValue: Sequelize.literal("00.5"),'
      );
      expect(createDefaultFixture('+007')).toContain(
        '      defaultValue: Sequelize.literal("+007"),'
      );
    });

    it('holds a default past double precision as a literal rather than rounding it', () => {
      expect(createDefaultFixture('99999999999999999999')).toContain(
        '      defaultValue: Sequelize.literal("99999999999999999999"),'
      );
      expect(createDefaultFixture('9007199254740993')).toContain(
        '      defaultValue: Sequelize.literal("9007199254740993"),'
      );
      expect(createDefaultFixture('9007199254740992')).toContain(
        '      defaultValue: 9007199254740992,'
      );
    });

    it('declares every property so a class field cannot define over the accessor', () => {
      const { state, team } = createTeamFixture();

      expect(render(state, team).slice(4, 7)).toEqual([
        '  declare id: CreationOptional<number>;',
        '',
        '  declare userList?: NonAttribute<User[]>;',
      ]);
    });

    it('states unique on a nullable column the diagram marks unique', () => {
      const table = createTable({ id: 't1', name: 'probe', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'code',
            dataType: 'int',
            options: ColumnOption.unique,
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toContain(
        '  { code: { type: DataTypes.INTEGER, allowNull: true, unique: true } },'
      );
      expect(render(state, table)).toContain('  declare code: number | null;');
    });

    it('brands a defaulted column CreationOptional but never a nullable one', () => {
      const table = createTable({
        id: 't1',
        name: 'probe',
        columnIds: ['c1', 'c2'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'kept',
            dataType: 'int',
            default: '0',
            options: ColumnOption.notNull,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'loose',
            dataType: 'int',
            default: '0',
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toContain(
        '  declare kept: CreationOptional<number>;'
      );
      expect(render(state, table)).toContain('  declare loose: number | null;');
      expect(render(state, table).join('\n')).not.toContain(
        'CreationOptional<number | null>'
      );
    });
  });

  describe('identifiers', () => {
    it('renames a property that would shadow a Model instance member', () => {
      const table = createTable({
        id: 't1',
        name: 'card',
        columnIds: ['c1', 'c2', 'c3'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'set',
            dataType: 'varchar(10)',
            options: ColumnOption.notNull,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'get',
            dataType: 'varchar(10)',
            options: ColumnOption.notNull,
          }),
          createColumn({
            id: 'c3',
            tableId: 't1',
            name: 'dataValues',
            dataType: 'varchar(10)',
            options: ColumnOption.notNull,
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toEqual([
        'export class Card extends Model<',
        '  InferAttributes<Card>,',
        '  InferCreationAttributes<Card>',
        '> {',
        '  declare set2: string;',
        '  declare get2: string;',
        '  declare dataValues2: string;',
        '}',
        '',
        'Card.init(',
        '  {',
        '    set2: { type: DataTypes.STRING(10), field: "set", allowNull: false },',
        '    get2: { type: DataTypes.STRING(10), field: "get", allowNull: false },',
        '    dataValues2: {',
        '      type: DataTypes.STRING(10),',
        '      field: "dataValues",',
        '      allowNull: false,',
        '    },',
        '  },',
        '  { sequelize, tableName: "card", timestamps: false }',
        ');',
      ]);
    });

    it('renames a property Sequelize declares, sets or looks up on every object', () => {
      const names = [
        '_model',
        'addHook',
        'runHooks',
        'uniqno',
        '_options',
        'validators',
        'rawAttributes',
        '__proto__',
        'toString',
        'hasOwnProperty',
      ];
      const table = createTable({
        id: 't1',
        name: 'card',
        columnIds: names.map((_, index) => `c${index}`),
      });
      const state = createState({
        tables: [table],
        columns: names.map((name, index) =>
          createColumn({
            id: `c${index}`,
            tableId: 't1',
            name,
            dataType: 'int',
            options: ColumnOption.notNull,
          })
        ),
        settings: { database: Database.MySQL, columnNameCase: NameCase.none },
      });
      const code = render(state, table).join('\n');

      names.forEach(name => {
        expect(code).toContain(`  declare ${name}2: number;`);
        expect(code).toMatch(
          new RegExp(
            `\\n    ${name}2: \\{\\s+type: DataTypes\\.INTEGER,\\s+field: "${name}",`
          )
        );
      });
    });

    it('renames an association alias named after what every object inherits', () => {
      const parent = createTable({
        id: 't_parent',
        name: '__proto__',
        columnIds: ['pc_id'],
      });
      const child = createTable({
        id: 't_child',
        name: 'child',
        columnIds: ['cc_id', 'cc_parent'],
      });
      const state = createState({
        tables: [parent, child],
        columns: [
          createColumn({
            id: 'pc_id',
            tableId: 't_parent',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'cc_id',
            tableId: 't_child',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'cc_parent',
            tableId: 't_child',
            name: 'parent_id',
            dataType: 'int',
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't_parent', columnIds: ['pc_id'] },
            end: { tableId: 't_child', columnIds: ['cc_parent'] },
          }),
        ],
        settings: { database: Database.MySQL, columnNameCase: NameCase.none },
      });
      const code = createCode(state);

      expect(code).toContain('  declare __proto__2?: NonAttribute<');
      expect(code).toContain('  as: "__proto__2",');
      expect(code).not.toContain('as: "__proto__"');
    });

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

      expect(render(state, table)).toContain(
        'export class class_ extends Model<'
      );
      expect(render(state, table)).toContain(
        '  declare default_: number | null;'
      );
      expect(render(state, table)).toContain(
        '  declare constructor_: number | null;'
      );
      expect(render(state, table)).toContain('class_.init(');
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
        'export class arguments_ extends Model<',
        '  InferAttributes<arguments_>,',
        '  InferCreationAttributes<arguments_>',
        '> {}',
        '',
        'arguments_.init(',
        '  {},',
        '  { sequelize, tableName: "arguments", timestamps: false }',
        ');',
        '',
        'export class await_ extends Model<',
        '  InferAttributes<await_>,',
        '  InferCreationAttributes<await_>',
        '> {}',
        '',
        'await_.init(',
        '  {},',
        '  { sequelize, tableName: "await", timestamps: false }',
        ');',
        '',
        'export class eval_ extends Model<',
        '  InferAttributes<eval_>,',
        '  InferCreationAttributes<eval_>',
        '> {}',
        '',
        'eval_.init(',
        '  {},',
        '  { sequelize, tableName: "eval", timestamps: false }',
        ');',
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
        'export class x1st extends Model<',
        '  InferAttributes<x1st>,',
        '  InferCreationAttributes<x1st>',
        '> {',
        '  declare x2Nd: string | null;',
        '  declare x: string | null;',
        '}',
        '',
        'x1st.init(',
        '  {',
        '    x2Nd: { type: DataTypes.STRING, field: "2nd", allowNull: true },',
        '    x: { type: DataTypes.STRING, field: "-", allowNull: true },',
        '  },',
        '  { sequelize, tableName: "1st", timestamps: false }',
        ');',
      ]);
    });

    it('renders an unnamed column with a repaired identifier and an empty name', () => {
      const table = createTable({ id: 't1', name: 'probe', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [createColumn({ id: 'c1', tableId: 't1', name: '' })],
      });

      expect(render(state, table)).toContain(
        '  { x: { type: DataTypes.STRING, field: "", allowNull: true } },'
      );
      expect(render(state, table)).toContain('  declare x: string | null;');
    });

    it('numbers a property two columns would spell the same after casing', () => {
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
            name: 'Email',
            dataType: 'varchar(50)',
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'email',
            dataType: 'varchar(50)',
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toEqual([
        'export class User extends Model<',
        '  InferAttributes<User>,',
        '  InferCreationAttributes<User>',
        '> {',
        '  declare email: string | null;',
        '  declare email2: string | null;',
        '}',
        '',
        'User.init(',
        '  {',
        '    email: { type: DataTypes.STRING(50), field: "Email", allowNull: true },',
        '    email2: { type: DataTypes.STRING(50), field: "email", allowNull: true },',
        '  },',
        '  { sequelize, tableName: "user", timestamps: false }',
        ');',
      ]);
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
        'export class UserLog extends Model<',
        '  InferAttributes<UserLog>,',
        '  InferCreationAttributes<UserLog>',
        '> {}',
        '',
        'UserLog.init(',
        '  {},',
        '  { sequelize, tableName: "user log", timestamps: false }',
        ');',
        '',
        'export class UserLog2 extends Model<',
        '  InferAttributes<UserLog2>,',
        '  InferCreationAttributes<UserLog2>',
        '> {}',
        '',
        'UserLog2.init(',
        '  {},',
        '  { sequelize, tableName: "user_log", timestamps: false }',
        ');',
        '',
      ]);
    });

    it('renames a class that would shadow DataTypes, Model or the sequelize instance', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'model', columnIds: ['c1'] }),
          createTable({ id: 't2', name: 'date' }),
          createTable({ id: 't3', name: 'data types' }),
          createTable({ id: 't4', name: 'buffer' }),
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
      const whole = createCode(state);

      expect(whole).toContain('export class Model2 extends Model<');
      expect(whole).toContain('export class Date2 extends Model<');
      expect(whole).toContain('export class DataTypes2 extends Model<');
      expect(whole).toContain('export class Buffer2 extends Model<');
      expect(whole).toContain(
        '  { at: { type: DataTypes.INTEGER, allowNull: true } },'
      );
    });

    it('renames a class that would shadow the Range type a range column names', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'range', columnIds: ['c1'] })],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'span',
            dataType: 'int4range',
          }),
        ],
        settings: { database: Database.PostgreSQL },
      });
      const whole = createCode(state);

      expect(whole).toContain('export class Range2 extends Model<');
      expect(whole).toContain('  declare span: Range<number> | null;');
    });

    it('renames a class that would shadow the sequelize instance itself', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'sequelize' })],
        settings: {
          database: Database.MySQL,
          tableNameCase: NameCase.none,
        },
      });

      expect(createCode(state)).toContain(
        'export class sequelize2 extends Model<'
      );
      expect(createCode(state)).toContain('sequelize2.init(');
    });

    it('puts an underscore after a class name TypeScript refuses or reads as a type operator', () => {
      const classNameOf = (name: string, tableNameCase: number) =>
        /^export class (\S+) /m.exec(
          createCode(
            createState({
              tables: [createTable({ id: 't1', name })],
              settings: { database: Database.PostgreSQL, tableNameCase },
            })
          )
        )?.[1];

      expect(classNameOf('object', NameCase.pascalCase)).toBe('Object_');
      expect(classNameOf('Number', NameCase.camelCase)).toBe('number_');
      expect(classNameOf('unknown', NameCase.none)).toBe('unknown_');
      expect(classNameOf('keyof', NameCase.none)).toBe('keyof_');
      expect(classNameOf('readonly', NameCase.snakeCase)).toBe('readonly_');
      expect(classNameOf('type', NameCase.none)).toBe('type');
    });

    it('puts an underscore after a class name a CommonJS module already binds', () => {
      const classNameOf = (name: string, tableNameCase: number) =>
        /^export class (\S+) /m.exec(
          createCode(
            createState({
              tables: [createTable({ id: 't1', name })],
              settings: { database: Database.MySQL, tableNameCase },
            })
          )
        )?.[1];

      expect(classNameOf('require', NameCase.none)).toBe('require_');
      expect(classNameOf('exports', NameCase.camelCase)).toBe('exports_');
      expect(classNameOf('module', NameCase.snakeCase)).toBe('module_');
      expect(classNameOf('__filename', NameCase.none)).toBe('__filename_');
      expect(classNameOf('__dirname', NameCase.none)).toBe('__dirname_');
      expect(classNameOf('require', NameCase.pascalCase)).toBe('Require');
    });

    it('puts an underscore after a class named __proto__, a key of the model registry', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: '__proto__' }),
          createTable({ id: 't2', name: 'prototype' }),
        ],
        settings: { database: Database.SQLite, tableNameCase: NameCase.none },
      });
      const whole = createCode(state);

      expect(whole).toContain('export class __proto___ extends Model<');
      expect(whole).toContain('export class prototype extends Model<');
    });

    it('keeps a property named after what a CommonJS module binds', () => {
      const table = createTable({ id: 't1', name: 'probe', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'require',
            dataType: 'int',
          }),
        ],
        settings: { database: Database.MySQL, columnNameCase: NameCase.none },
      });

      expect(render(state, table)).toContain(
        '  declare require: number | null;'
      );
    });

    it('renames a class that would shadow the typed array a vector names', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'float32_array' }),
          createTable({ id: 't2', name: 'embedding', columnIds: ['c1'] }),
          createTable({ id: 't3', name: 'uint8 array' }),
          createTable({ id: 't4', name: 'int8_array' }),
          createTable({ id: 't5', name: 'float64_array' }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't2',
            name: 'v',
            dataType: 'VECTOR(3, FLOAT32)',
            options: ColumnOption.notNull,
          }),
        ],
        settings: { database: Database.Oracle },
      });
      const whole = createCode(state);

      expect(whole).toContain('export class Float32Array2 extends Model<');
      expect(whole).toContain('export class Uint8Array2 extends Model<');
      expect(whole).toContain('export class Int8Array2 extends Model<');
      expect(whole).toContain('export class Float64Array2 extends Model<');
      expect(whole).toContain('  declare v: Float32Array;');
    });

    it('keeps a property named after a predefined type', () => {
      const table = createTable({ id: 't1', name: 'probe', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'number',
            dataType: 'int',
          }),
        ],
        settings: {
          database: Database.PostgreSQL,
          columnNameCase: NameCase.none,
        },
      });

      expect(render(state, table)).toContain(
        '  declare number: number | null;'
      );
    });

    it('numbers an alias whose accessors would hide a Model method or an attribute', () => {
      const tables = [
        createTable({ id: 't1', name: 'data_value', columnIds: ['a1'] }),
        createTable({ id: 't2', name: 'attributes', columnIds: ['b1'] }),
        createTable({ id: 't3', name: 'team', columnIds: ['d1'] }),
        createTable({
          id: 't4',
          name: 'item',
          columnIds: ['i1', 'i2', 'i3', 'i4', 'i5'],
        }),
      ];
      const state = createState({
        tables,
        columns: [
          ...[
            ['a1', 't1'],
            ['b1', 't2'],
            ['d1', 't3'],
            ['i1', 't4'],
          ].map(([id, tableId]) =>
            createColumn({
              id,
              tableId,
              name: 'id',
              dataType: 'INTEGER',
              options: ColumnOption.primaryKey,
            })
          ),
          ...[
            ['i2', 'data_value_id'],
            ['i3', 'attributes_id'],
            ['i4', 'team_id'],
            ['i5', 'get_team'],
          ].map(([id, name]) =>
            createColumn({ id, tableId: 't4', name, dataType: 'INTEGER' })
          ),
        ],
        relationships: [
          ['r1', 't1', 'a1', 'i2'],
          ['r2', 't2', 'b1', 'i3'],
          ['r3', 't3', 'd1', 'i4'],
        ].map(([id, tableId, start, end]) =>
          createRelationship({
            id,
            relationshipType: RelationshipType.ZeroOne,
            start: { tableId, columnIds: [start] },
            end: { tableId: 't4', columnIds: [end] },
          })
        ),
        settings: { database: Database.SQLite },
      });
      const code = createCode(state);

      expect(code).toContain('  declare dataValue2?: NonAttribute<DataValue>;');
      expect(code).toContain(
        '  declare attributes2?: NonAttribute<Attributes>;'
      );
      expect(code).toContain('  declare team2?: NonAttribute<Team>;');
      expect(code).toContain('as: "dataValue2"');
      expect(code).toContain('as: "attributes2"');
      expect(code).toContain('as: "team2"');
      expect(code).toContain('  declare item?: NonAttribute<Item>;');
      expect(code).not.toMatch(/as: "(dataValue|attributes|team)"/);
    });

    it('deduplicates a property name a relationship would collide with', () => {
      const { state, user } = createTeamFixture();
      state.collections.tableColumnEntities.uc_team.name = 'team';

      expect(render(state, user)).toContain('  declare team: number | null;');
      expect(render(state, user)).toContain(
        '  declare team2?: NonAttribute<Team>;'
      );
      expect(render(state, user)).toContain(
        'User.belongsTo(Team, { foreignKey: "team", targetKey: "id", as: "team2" });'
      );
    });
  });

  describe('relationships', () => {
    it('drops a relationship whose end is outside the document', () => {
      const { state, team, user } = createTeamFixture();
      state.doc.tableIds = [user.id];

      expect(createCode(state)).toBe(
        [
          '',
          'export class User extends Model<',
          '  InferAttributes<User>,',
          '  InferCreationAttributes<User>',
          '> {',
          '  declare id: CreationOptional<number>;',
          '  declare teamId: number | null;',
          '}',
          '',
          'User.init(',
          '  {',
          '    id: {',
          '      type: DataTypes.INTEGER,',
          '      primaryKey: true,',
          '      autoIncrement: true,',
          '      allowNull: false,',
          '    },',
          '    teamId: { type: DataTypes.INTEGER, field: "team_id", allowNull: true },',
          '  },',
          '  { sequelize, tableName: "user", timestamps: false }',
          ');',
          '',
        ].join('\n')
      );
      expect(render(state, team)).not.toContain('Team.hasMany(User, {');
    });

    it('owns the foreign key on the many-to-one end and faces it on the other', () => {
      const { state, team, user } = createTeamFixture();

      expect(render(state, team)).toEqual([
        'export class Team extends Model<',
        '  InferAttributes<Team>,',
        '  InferCreationAttributes<Team>',
        '> {',
        '  declare id: CreationOptional<number>;',
        '',
        '  declare userList?: NonAttribute<User[]>;',
        '}',
        '',
        'Team.init(',
        '  {',
        '    id: {',
        '      type: DataTypes.INTEGER,',
        '      primaryKey: true,',
        '      autoIncrement: true,',
        '      allowNull: false,',
        '    },',
        '  },',
        '  { sequelize, tableName: "team", timestamps: false }',
        ');',
        '',
        'Team.hasMany(User, { foreignKey: "teamId", sourceKey: "id", as: "userList" });',
        'User.belongsTo(Team, { foreignKey: "teamId", targetKey: "id", as: "team" });',
      ]);
      expect(render(state, user)).toContain(
        'User.belongsTo(Team, { foreignKey: "teamId", targetKey: "id", as: "team" });'
      );
    });

    it('renders the whole document with every class before every association', () => {
      const { state } = createTeamFixture();

      expect(createCode(state).split('\n')).toEqual([
        '',
        'export class Team extends Model<',
        '  InferAttributes<Team>,',
        '  InferCreationAttributes<Team>',
        '> {',
        '  declare id: CreationOptional<number>;',
        '',
        '  declare userList?: NonAttribute<User[]>;',
        '}',
        '',
        'Team.init(',
        '  {',
        '    id: {',
        '      type: DataTypes.INTEGER,',
        '      primaryKey: true,',
        '      autoIncrement: true,',
        '      allowNull: false,',
        '    },',
        '  },',
        '  { sequelize, tableName: "team", timestamps: false }',
        ');',
        '',
        'export class User extends Model<',
        '  InferAttributes<User>,',
        '  InferCreationAttributes<User>',
        '> {',
        '  declare id: CreationOptional<number>;',
        '  declare teamId: number | null;',
        '',
        '  declare team?: NonAttribute<Team>;',
        '}',
        '',
        'User.init(',
        '  {',
        '    id: {',
        '      type: DataTypes.INTEGER,',
        '      primaryKey: true,',
        '      autoIncrement: true,',
        '      allowNull: false,',
        '    },',
        '    teamId: { type: DataTypes.INTEGER, field: "team_id", allowNull: true },',
        '  },',
        '  { sequelize, tableName: "user", timestamps: false }',
        ');',
        '',
        'Team.hasMany(User, { foreignKey: "teamId", sourceKey: "id", as: "userList" });',
        'User.belongsTo(Team, { foreignKey: "teamId", targetKey: "id", as: "team" });',
        '',
      ]);
    });

    it('drops the null from the parent once the foreign key is required', () => {
      const { state, user } = createTeamFixture(
        RelationshipType.OneN,
        ColumnOption.notNull
      );

      expect(render(state, user)).toContain('  declare teamId: number;');
      expect(render(state, user)).toContain(
        '    teamId: { type: DataTypes.INTEGER, field: "team_id", allowNull: false },'
      );
      expect(render(state, user)).toContain(
        '  declare team?: NonAttribute<Team>;'
      );
    });

    it('brands every association property NonAttribute and marks it optional', () => {
      const { state, team, user } = createTeamFixture();

      expect(render(state, user)).toContain(
        '  declare team?: NonAttribute<Team>;'
      );
      expect(render(state, team)).toContain(
        '  declare userList?: NonAttribute<User[]>;'
      );
      expect(render(state, team).join('\n')).not.toContain('| null;');
    });

    it('renders a one relationship as a scalar on both ends', () => {
      const { state, team, user } = createTeamFixture(RelationshipType.ZeroOne);

      expect(render(state, team)).toContain(
        '  declare user?: NonAttribute<User>;'
      );
      expect(render(state, team)).toContain(
        'Team.hasOne(User, { foreignKey: "teamId", sourceKey: "id", as: "user" });'
      );
      expect(render(state, user)).toContain(
        '  declare team?: NonAttribute<Team>;'
      );
      expect(render(state, user)).toContain(
        'User.belongsTo(Team, { foreignKey: "teamId", targetKey: "id", as: "team" });'
      );
    });

    it('declares the columns of a composite foreign key but no association at all', () => {
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
        'export class Child extends Model<',
        '  InferAttributes<Child>,',
        '  InferCreationAttributes<Child>',
        '> {',
        '  declare tenantId: number;',
        '  declare parentCode: string;',
        '}',
        '',
        'Child.init(',
        '  {',
        '    tenantId: { type: DataTypes.INTEGER, field: "tenant_id", allowNull: false },',
        '    parentCode: {',
        '      type: DataTypes.STRING(10),',
        '      field: "parent_code",',
        '      allowNull: false,',
        '    },',
        '  },',
        '  { sequelize, tableName: "child", timestamps: false }',
        ');',
      ]);
      expect(createCode(state)).not.toContain('hasMany');
      expect(createCode(state)).not.toContain('belongsTo');
      expect(createCode(state)).not.toContain('NonAttribute');
    });

    it('leaves the parent of a composite foreign key without an inverse', () => {
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
            dataType: 'int',
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
            name: 'code',
            dataType: 'int',
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

      expect(render(state, parent).join('\n')).not.toContain('NonAttribute');
      expect(render(state, parent).join('\n')).not.toContain('hasMany');
      expect(render(state, parent)).toContain('  declare tenantId: number;');
      expect(render(state, parent)).toContain('  declare code: number;');
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

      expect(render(state, user)).toContain(
        '  declare team?: NonAttribute<Team>;'
      );
      expect(render(state, user)).toContain(
        '  declare team2?: NonAttribute<Team>;'
      );
      expect(render(state, team)).toContain(
        '  declare userList?: NonAttribute<User[]>;'
      );
      expect(render(state, team)).toContain(
        '  declare userList2?: NonAttribute<User[]>;'
      );
      expect(render(state, user)).toContain('  as: "userList2",');
      expect(render(state, user)).toContain('  as: "team2",');
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
        '  { a: { type: DataTypes.STRING(10), allowNull: true } },'
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

      expect(lines).toContain('  declare team?: NonAttribute<Team>;');
      expect(lines).toContain('  declare org?: NonAttribute<Org>;');
      expect(lines).toContain(
        'User.belongsTo(Org, { foreignKey: "teamId", targetKey: "id", as: "org" });'
      );
      expect(
        lines.filter(line => line.startsWith('User.belongsTo('))
      ).toHaveLength(2);
    });

    it('renders a required one relationship as hasOne on the parent', () => {
      const { state, team, user } = createTeamFixture(
        RelationshipType.OneOnly,
        ColumnOption.notNull
      );

      expect(render(state, team)).toContain(
        'Team.hasOne(User, { foreignKey: "teamId", sourceKey: "id", as: "user" });'
      );
      expect(render(state, team)).toContain(
        '  declare user?: NonAttribute<User>;'
      );
      expect(render(state, user)).toContain('  declare teamId: number;');
    });

    it('renders a required N relationship as hasMany on the parent', () => {
      const { state, team } = createTeamFixture(
        RelationshipType.OneN,
        ColumnOption.notNull
      );

      expect(render(state, team)).toContain(
        'Team.hasMany(User, { foreignKey: "teamId", sourceKey: "id", as: "userList" });'
      );
    });

    it('names the referenced column even when it is not the primary key', () => {
      const team = createTable({
        id: 't_team',
        name: 'team',
        columnIds: ['tc_id', 'tc_code'],
      });
      const user = createTable({
        id: 't_user',
        name: 'user',
        columnIds: ['uc_team'],
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
          }),
          createColumn({
            id: 'tc_code',
            tableId: 't_team',
            name: 'code',
            dataType: 'varchar(10)',
            options: ColumnOption.notNull | ColumnOption.unique,
          }),
          createColumn({
            id: 'uc_team',
            tableId: 't_user',
            name: 'team_id',
            dataType: 'varchar(10)',
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't_team', columnIds: ['tc_code'] },
            end: { tableId: 't_user', columnIds: ['uc_team'] },
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, user)).toContain(
        'Team.hasMany(User, { foreignKey: "teamId", sourceKey: "code", as: "userList" });'
      );
      expect(render(state, user)).toContain(
        'User.belongsTo(Team, { foreignKey: "teamId", targetKey: "code", as: "team" });'
      );
    });

    it('follows the document order of the relationships', () => {
      const { state } = createTeamFixture();
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

      expect(createCode(state).split('\n').slice(-5)).toEqual([
        'Team.hasMany(User, { foreignKey: "teamId", sourceKey: "id", as: "userList" });',
        'User.belongsTo(Team, { foreignKey: "teamId", targetKey: "id", as: "team" });',
        'Org.hasMany(User, { foreignKey: "teamId", sourceKey: "id", as: "userList" });',
        'User.belongsTo(Org, { foreignKey: "teamId", targetKey: "id", as: "org" });',
        '',
      ]);
    });

    it('emits nothing for a relationship type that is neither one nor N', () => {
      const { state, team, user } = createTeamFixture(1);

      expect(render(state, user).join('\n')).not.toContain('belongsTo');
      expect(render(state, user)).toContain(
        '    teamId: { type: DataTypes.INTEGER, field: "team_id", allowNull: true },'
      );
      expect(render(state, team).join('\n')).not.toContain('hasMany');
      expect(render(state, team).join('\n')).not.toContain('NonAttribute');
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

        expect(render(state, user).join('\n')).not.toContain('belongsTo');
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

      expect(createCode(state).split('\n')).toEqual([
        '',
        'export class Category extends Model<',
        '  InferAttributes<Category>,',
        '  InferCreationAttributes<Category>',
        '> {',
        '  declare id: CreationOptional<number>;',
        '  declare parentId: number | null;',
        '',
        '  declare parentCategory?: NonAttribute<Category>;',
        '  declare categoryList?: NonAttribute<Category[]>;',
        '}',
        '',
        'Category.init(',
        '  {',
        '    id: {',
        '      type: DataTypes.INTEGER,',
        '      primaryKey: true,',
        '      autoIncrement: true,',
        '      allowNull: false,',
        '    },',
        '    parentId: { type: DataTypes.INTEGER, field: "parent_id", allowNull: true },',
        '  },',
        '  { sequelize, tableName: "category", timestamps: false }',
        ');',
        '',
        'Category.hasMany(Category, {',
        '  foreignKey: "parentId",',
        '  sourceKey: "id",',
        '  as: "categoryList",',
        '});',
        'Category.belongsTo(Category, {',
        '  foreignKey: "parentId",',
        '  targetKey: "id",',
        '  as: "parentCategory",',
        '});',
        '',
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
        '  declare parentNode?: NonAttribute<Node>;'
      );
      expect(render(state, table)).toContain(
        '  declare node?: NonAttribute<Node>;'
      );
      expect(render(state, table)).toContain(
        'Node.hasOne(Node, { foreignKey: "nextId", sourceKey: "id", as: "node" });'
      );
      expect(render(state, table)).toContain('  as: "parentNode",');
    });
  });

  describe('indexes', () => {
    it('lists the database columns of a named index in the init options', () => {
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
          createIndex({
            id: 'i2',
            tableId: 't1',
            name: '',
            indexColumnIds: ['ic3'],
          }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c1' }),
          createIndexColumn({ id: 'ic2', indexId: 'i1', columnId: 'c2' }),
          createIndexColumn({ id: 'ic3', indexId: 'i2', columnId: 'c1' }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toEqual([
        'export class User extends Model<',
        '  InferAttributes<User>,',
        '  InferCreationAttributes<User>',
        '> {',
        '  declare firstName: string | null;',
        '  declare lastName: string | null;',
        '}',
        '',
        'User.init(',
        '  {',
        '    firstName: {',
        '      type: DataTypes.STRING(50),',
        '      field: "first_name",',
        '      allowNull: true,',
        '    },',
        '    lastName: {',
        '      type: DataTypes.STRING(50),',
        '      field: "last_name",',
        '      allowNull: true,',
        '    },',
        '  },',
        '  {',
        '    sequelize,',
        '    tableName: "user",',
        '    timestamps: false,',
        '    indexes: [',
        '      { name: "IDX_name", fields: ["first_name", "last_name"], unique: true },',
        '      { name: "IDX_user", fields: ["first_name"] },',
        '    ],',
        '  }',
        ');',
      ]);
    });

    it('names index fields by the database column and association keys by the property', () => {
      const { state, user } = createTeamFixture();
      state.collections.indexEntities.i1 = createIndex({
        id: 'i1',
        tableId: 't_user',
        name: '',
        indexColumnIds: ['ic1'],
      });
      state.collections.indexColumnEntities.ic1 = createIndexColumn({
        id: 'ic1',
        indexId: 'i1',
        columnId: 'uc_team',
      });
      state.doc.indexIds = ['i1'];

      const lines = render(state, user);

      expect(lines).toContain(
        '    indexes: [{ name: "IDX_user", fields: ["team_id"] }],'
      );
      expect(lines).toContain(
        'Team.hasMany(User, { foreignKey: "teamId", sourceKey: "id", as: "userList" });'
      );
      expect(lines.join('\n')).not.toContain('foreignKey: "team_id"');
      expect(lines.join('\n')).not.toContain('fields: ["teamId"]');
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

      expect(render(state, table).slice(-6)).toEqual([
        '    indexes: [',
        '      { name: "IDX_user", fields: ["email"] },',
        '      { name: "IDX_user1", fields: ["email"] },',
        '    ],',
        '  }',
        ');',
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

      expect(render(state, table).slice(-6)).toEqual([
        '    indexes: [',
        '      { name: "IDX_user1", fields: ["email"] },',
        '      { name: "IDX_user", fields: ["email"] },',
        '    ],',
        '  }',
        ');',
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

      expect(whole).toContain(
        '    indexes: [{ name: "IDX_user", fields: ["email"] }],'
      );
      expect(whole).toContain(
        '    indexes: [{ name: "IDX_user1", fields: ["email"] }],'
      );
      expect(render(state, first)).toContain(
        '    indexes: [{ name: "IDX_user", fields: ["email"] }],'
      );
      expect(render(state, second)).toContain(
        '    indexes: [{ name: "IDX_user1", fields: ["email"] }],'
      );
    });

    it('lists a column once when two columns of one name are both indexed', () => {
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

      expect(render(state, table)).toContain(
        '    indexes: [{ name: "IDX_thing", fields: ["a"], unique: true }],'
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

      expect(render(state, table)).toContain(
        '    indexes: [{ name: "IDX_mixed", fields: ["email"] }],'
      );
      expect(render(state, table).join('\n')).not.toContain('IDX_gone');
    });

    it('leaves out an index that belongs to another table', () => {
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
            name: 'code',
            dataType: 'varchar(50)',
          }),
        ],
        indexes: [
          createIndex({
            id: 'i1',
            tableId: 't2',
            name: 'IDX_other',
            indexColumnIds: ['ic1'],
          }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c2' }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table).join('\n')).not.toContain('indexes');
      expect(render(state, other)).toContain(
        '    indexes: [{ name: "IDX_other", fields: ["code"] }],'
      );
    });

    it('escapes an index name and the column names it lists', () => {
      const table = createTable({ id: 't1', name: 'user', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'a\\b',
            dataType: 'int',
          }),
        ],
        indexes: [
          createIndex({
            id: 'i1',
            tableId: 't1',
            name: 'IDX_"q"',
            indexColumnIds: ['ic1'],
          }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c1' }),
        ],
        settings: {
          database: Database.MySQL,
          columnNameCase: NameCase.none,
        },
      });

      expect(render(state, table)).toContain(
        '  { a_b: { type: DataTypes.INTEGER, field: "a\\\\b", allowNull: true } },'
      );
      expect(render(state, table)).toContain(
        '    indexes: [{ name: "IDX_\\"q\\"", fields: ["a\\\\b"] }],'
      );
    });

    it('leaves the indexes key out when the table has no index to state', () => {
      const { state, table } = createSharedFixture();

      expect(render(state, table).join('\n')).not.toContain('indexes');
    });
  });

  describe('line wrapping', () => {
    it('breaks the fields list of an index that carries no options', () => {
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

      expect(render(state, table).slice(-11)).toEqual([
        '    indexes: [',
        '      {',
        '        name: "IDX_a_very_long_index_name_on_the_long_table",',
        '        fields: [',
        '          "a_column_name_that_is_also_quite_long_indeed",',
        '          "another_column_name_that_is_also_quite_long",',
        '        ],',
        '      },',
        '    ],',
        '  }',
        ');',
      ]);
    });

    it('breaks the options of an association call that would not fit', () => {
      const { state, team, user } = createTeamFixture();
      state.collections.tableEntities.t_team.name =
        'a_team_whose_name_is_long_enough_to_push_things_over_the_limit';

      expect(render(state, user).slice(-10)).toEqual([
        'ATeamWhoseNameIsLongEnoughToPushThingsOverTheLimit.hasMany(User, {',
        '  foreignKey: "teamId",',
        '  sourceKey: "id",',
        '  as: "userList",',
        '});',
        'User.belongsTo(ATeamWhoseNameIsLongEnoughToPushThingsOverTheLimit, {',
        '  foreignKey: "teamId",',
        '  targetKey: "id",',
        '  as: "aTeamWhoseNameIsLongEnoughToPushThingsOverTheLimit",',
        '});',
      ]);
      expect(render(state, team)).toContain(
        '  declare userList?: NonAttribute<User[]>;'
      );
    });

    it('leaves a long entry whose value cannot be split any further', () => {
      const name =
        'a_table_whose_name_is_long_enough_to_push_the_entity_call_over_the_limit';
      const table = createTable({ id: 't1', name });
      const state = createState({ tables: [table] });
      const lines = render(state, table);

      expect(lines.slice(-6)).toEqual([
        '  {',
        '    sequelize,',
        `    tableName: "${name}",`,
        '    timestamps: false,',
        '  }',
        ');',
      ]);
      expect(`    tableName: "${name}",`.length).toBeGreaterThan(80);
    });

    it('always breaks the init call onto lines of its own', () => {
      const { state, table } = createSharedFixture();

      expect(render(state, table)).toContain('User.init(');
      expect(render(state, table)).toContain('  {');
      expect(render(state, table)).toContain(');');
      expect(render(state, table).join('\n')).not.toContain('User.init({');
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
        'export class User extends Model<',
        '  InferAttributes<User>,',
        '  InferCreationAttributes<User>',
        '> {',
        '  declare email: string;',
        '}',
        '',
        'User.init(',
        '  { email: { type: DataTypes.STRING(50), allowNull: false } },',
        '  { sequelize, tableName: "user", timestamps: false }',
        ');',
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
        '    teamId: { type: DataTypes.INTEGER, field: "team_id", allowNull: false },'
      );
      expect(render(state, user)).toContain('  declare teamId: number;');
      expect(render(state, user)).toContain(
        'User.belongsTo(Team, { foreignKey: "teamId", targetKey: "id", as: "team" });'
      );
    });
  });

  describe('duplicate table names', () => {
    it('renders two tables of one name as two classes sharing a tableName', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'user' }),
          createTable({ id: 't2', name: 'user' }),
        ],
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'export class User extends Model<',
        '  InferAttributes<User>,',
        '  InferCreationAttributes<User>',
        '> {}',
        '',
        'User.init(',
        '  {},',
        '  { sequelize, tableName: "user", timestamps: false }',
        ');',
        '',
        'export class User2 extends Model<',
        '  InferAttributes<User2>,',
        '  InferCreationAttributes<User2>',
        '> {}',
        '',
        'User2.init(',
        '  {},',
        '  { sequelize, tableName: "user", timestamps: false }',
        ');',
        '',
      ]);
    });
  });

  describe('shared numbering', () => {
    it('numbers a class name the same way from both entry points', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'user' }),
          createTable({ id: 't2', name: 'user' }),
        ],
      });

      expect(render(state, state.collections.tableEntities.t1)[0]).toBe(
        'export class User extends Model<'
      );
      expect(render(state, state.collections.tableEntities.t2)[0]).toBe(
        'export class User2 extends Model<'
      );
    });
  });

  describe('enum columns', () => {
    it('renders an enum column beside an auto-increment key', () => {
      const table = createTable({
        id: 't1',
        name: 'movie',
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
            name: 'rating',
            dataType: "enum('G','PG-13')",
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'export class Movie extends Model<',
        '  InferAttributes<Movie>,',
        '  InferCreationAttributes<Movie>',
        '> {',
        '  declare id: CreationOptional<number>;',
        '  declare rating: "G" | "PG-13" | null;',
        '}',
        '',
        'Movie.init(',
        '  {',
        '    id: {',
        '      type: DataTypes.INTEGER,',
        '      primaryKey: true,',
        '      autoIncrement: true,',
        '      allowNull: false,',
        '    },',
        '    rating: { type: DataTypes.ENUM("G", "PG-13"), allowNull: true },',
        '  },',
        '  { sequelize, tableName: "movie", timestamps: false }',
        ');',
        '',
      ]);
    });

    it('brands a defaulted enum CreationOptional without parenthesising it', () => {
      const table = createTable({ id: 't1', name: 'movie', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'rating',
            dataType: "enum('G','PG-13')",
            default: "'G'",
            options: ColumnOption.notNull,
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toContain(
        '  declare rating: CreationOptional<"G" | "PG-13">;'
      );
      expect(render(state, table)).toContain('      defaultValue: "G",');
    });
  });
});
