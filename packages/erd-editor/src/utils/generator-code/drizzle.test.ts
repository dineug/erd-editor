import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  ColumnOption,
  ColumnUIKey,
  Database,
  NameCase,
  OrderType,
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
import { createCode, formatTable } from '@/utils/generator-code/drizzle';

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

const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

function render(state: RootState, table: Table): string[] {
  const buffer: string[] = [];
  formatTable(state, { buffer, table });
  return buffer;
}

describe('generator-code/drizzle', () => {
  describe('createCode', () => {
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

    function createCommentFixture(comment: string) {
      return createState({
        tables: [
          createTable({ id: 't1', name: 'user', comment, columnIds: ['c1'] }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
          }),
        ],
        settings: { database: Database.MySQL },
      });
    }

    it('returns an empty string when the document has no tables', () => {
      expect(createCode(createState({}))).toBe('');
    });

    it('renders the shared single-table document', () => {
      const { state } = createSharedFixture();

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { int, mysqlTable } from "drizzle-orm/mysql-core";',
        '',
        'export const User = mysqlTable("user", {',
        '  createdAt: int("created_at").notNull(),',
        '});',
        '',
      ]);
    });

    it('orders the table consts by table name, not by document order', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'zebra' }),
          createTable({ id: 't2', name: 'ant' }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { mysqlTable } from "drizzle-orm/mysql-core";',
        '',
        'export const Ant = mysqlTable("ant", {});',
        '',
        'export const Zebra = mysqlTable("zebra", {});',
        '',
      ]);
    });

    it('skips table ids that are not in the collection', () => {
      const { state } = createSharedFixture();
      state.doc.tableIds = ['missing', 't1'];

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { int, mysqlTable } from "drizzle-orm/mysql-core";',
        '',
        'export const User = mysqlTable("user", {',
        '  createdAt: int("created_at").notNull(),',
        '});',
        '',
      ]);
    });

    it('opens on a blank line, then the import header, then a blank line', () => {
      const { state } = createSharedFixture();
      const lines = createCode(state).split('\n');

      expect(lines.slice(0, 3)).toEqual([
        '',
        'import { int, mysqlTable } from "drizzle-orm/mysql-core";',
        '',
      ]);
      expect(lines[lines.length - 1]).toBe('');
    });

    it('renders a table that has no columns with an empty object literal', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'log' })],
        settings: { database: Database.MySQL },
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { mysqlTable } from "drizzle-orm/mysql-core";',
        '',
        'export const Log = mysqlTable("log", {});',
        '',
      ]);
    });

    it('states a table comment on the line above the const', () => {
      const state = createCommentFixture('people who log in');

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { int, mysqlTable } from "drizzle-orm/mysql-core";',
        '',
        '// people who log in',
        'export const User = mysqlTable("user", {',
        '  id: int(),',
        '});',
        '',
      ]);
    });

    it('gives every line of a table comment its own slashes', () => {
      const state = createCommentFixture('first line\nsecond line');

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { int, mysqlTable } from "drizzle-orm/mysql-core";',
        '',
        '// first line',
        '// second line',
        'export const User = mysqlTable("user", {',
        '  id: int(),',
        '});',
        '',
      ]);
    });

    it('gives every line of a column comment its own slashes', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'user', columnIds: ['c1'] })],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
            comment: 'what it is\nwhere it comes from',
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { int, mysqlTable } from "drizzle-orm/mysql-core";',
        '',
        'export const User = mysqlTable("user", {',
        '  // what it is',
        '  // where it comes from',
        '  id: int(),',
        '});',
        '',
      ]);
    });

    it('ignores a table comment that is only whitespace', () => {
      const state = createCommentFixture('   ');

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { int, mysqlTable } from "drizzle-orm/mysql-core";',
        '',
        'export const User = mysqlTable("user", {',
        '  id: int(),',
        '});',
        '',
      ]);
    });

    it('splits a comment on the separators a line comment ends at', () => {
      const state = createCommentFixture('first\u2028second\u2029third');

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { int, mysqlTable } from "drizzle-orm/mysql-core";',
        '',
        '// first',
        '// second',
        '// third',
        'export const User = mysqlTable("user", {',
        '  id: int(),',
        '});',
        '',
      ]);
    });

    it('puts a backslash before a comment line TypeScript would read as a directive', () => {
      const state = createCommentFixture(
        [
          '@ts-expect-error',
          '  @ts-ignore it',
          ' @ts-ignored',
          '@ts-nocheck',
          'see @ts-ignore',
          '@TS-IGNORE',
          '/@ts-ignore',
        ].join('\n')
      );

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { int, mysqlTable } from "drizzle-orm/mysql-core";',
        '',
        '// \\@ts-expect-error',
        '//   \\@ts-ignore it',
        '//  \\@ts-ignored',
        '// \\@ts-nocheck',
        '// see @ts-ignore',
        '// @TS-IGNORE',
        '// /@ts-ignore',
        'export const User = mysqlTable("user", {',
        '  id: int(),',
        '});',
        '',
      ]);
    });

    it('escapes a directive on any line of a column comment', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'user', columnIds: ['c1'] })],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
            comment: `first${LINE_SEPARATOR}@ts-expect-error no error here`,
          }),
        ],
        settings: { database: Database.PostgreSQL },
      });

      expect(createCode(state).split('\n').slice(4, 6)).toEqual([
        '  // first',
        '  // \\@ts-expect-error no error here',
      ]);
    });
  });

  describe('formatTable', () => {
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

    function createTeamFixture() {
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
            ui: { keys: ColumnUIKey.foreignKey },
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't_team', columnIds: ['tc_id'] },
            end: { tableId: 't_user', columnIds: ['uc_team'] },
          }),
        ],
        settings: { database: Database.MySQL },
      });

      return { state, team, user };
    }

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

    it('passes the referential actions to an inline reference', () => {
      const { state, user } = createTeamFixture();
      Object.assign(state.collections.relationshipEntities.r1, {
        onDelete: ReferentialAction.cascade,
      });

      expect(render(state, user)).toContain(
        '  teamId: int("team_id").references(() => Team.id, { onDelete: "cascade" }),'
      );

      Object.assign(state.collections.relationshipEntities.r1, {
        onUpdate: ReferentialAction.setNull,
      });
      const lines = render(state, user);
      const head = lines.indexOf('  teamId: int("team_id")');

      expect(lines[head + 1]).toBe(
        '    .references(() => Team.id, { onDelete: "cascade", onUpdate: "set null" }),'
      );
    });

    it('leaves out an action the database would refuse, as its DDL does', () => {
      const { state, user } = createTeamFixture();
      Object.assign(state.collections.relationshipEntities.r1, {
        onDelete: ReferentialAction.setDefault,
        onUpdate: ReferentialAction.setNull,
      });

      expect(render(state, user)).toContain(
        '  teamId: int("team_id").references(() => Team.id, { onUpdate: "set null" }),'
      );
    });

    it.each([
      Database.Oracle,
      Database.MSSQL,
      Database.Databricks,
      Database.Snowflake,
    ])(
      'keeps what PostgreSQL takes in the pg-core code database %i borrows',
      database => {
        const { state, user } = createTeamFixture();
        state.settings.database = database;
        Object.assign(state.collections.relationshipEntities.r1, {
          onDelete: ReferentialAction.restrict,
          onUpdate: ReferentialAction.setDefault,
        });
        const lines = render(state, user);
        const head = lines.findIndex(line => line.startsWith('  teamId: '));

        expect(lines[head + 1]).toBe(
          '    .references(() => Team.id, { onDelete: "restrict", onUpdate: "set default" }),'
        );
      }
    );

    it('carries its own import header for one table of a larger document', () => {
      const { state, user } = createTeamFixture();

      expect(render(state, user)).toEqual([
        'import { relations } from "drizzle-orm";',
        'import { int, mysqlTable } from "drizzle-orm/mysql-core";',
        '',
        'export const User = mysqlTable("user", {',
        '  id: int().autoincrement().primaryKey(),',
        '  teamId: int("team_id").references(() => Team.id),',
        '});',
        '',
        'export const UserRelations = relations(User, ({ one }) => ({',
        '  team: one(Team, { fields: [User.teamId], references: [Team.id] }),',
        '}));',
      ]);
    });

    it('names a sibling const it does not itself declare', () => {
      const { state, team } = createTeamFixture();

      expect(render(state, team)).toEqual([
        'import { relations } from "drizzle-orm";',
        'import { int, mysqlTable } from "drizzle-orm/mysql-core";',
        '',
        'export const Team = mysqlTable("team", {',
        '  id: int().autoincrement().primaryKey(),',
        '});',
        '',
        'export const TeamRelations = relations(Team, ({ many }) => ({',
        '  userList: many(User),',
        '}));',
      ]);
    });
  });

  describe('imports', () => {
    function createProbeFixture(database: number) {
      return createState({
        tables: [createTable({ id: 't1', name: 'user', columnIds: ['c1'] })],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'created_at',
            dataType: 'INT',
            options: ColumnOption.notNull,
          }),
        ],
        settings: { database },
      });
    }

    function createDefaultFixture(dataType: string, value: string) {
      return createState({
        tables: [createTable({ id: 't1', name: 'probe', columnIds: ['c1'] })],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'created_at',
            dataType,
            default: value,
          }),
        ],
        settings: { database: Database.MySQL },
      });
    }

    function createTeamFixture() {
      const team = createTable({
        id: 't_team',
        name: 'team',
        columnIds: ['tc_id'],
      });
      const user = createTable({
        id: 't_user',
        name: 'user',
        columnIds: ['uc_team'],
      });

      return createState({
        tables: [team, user],
        columns: [
          createColumn({
            id: 'tc_id',
            tableId: 't_team',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'uc_team',
            tableId: 't_user',
            name: 'team_id',
            dataType: 'int',
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't_team', columnIds: ['tc_id'] },
            end: { tableId: 't_user', columnIds: ['uc_team'] },
          }),
        ],
        settings: { database: Database.MySQL },
      });
    }

    function createWideFixture() {
      return createState({
        tables: [
          createTable({
            id: 't1',
            name: 'users',
            columnIds: ['c1', 'c2', 'c3', 'c4', 'c5'],
          }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'uuid',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'email',
            dataType: 'varchar(255)',
          }),
          createColumn({
            id: 'c3',
            tableId: 't1',
            name: 'bio',
            dataType: 'text',
          }),
          createColumn({
            id: 'c4',
            tableId: 't1',
            name: 'balance',
            dataType: 'numeric(10,2)',
          }),
          createColumn({
            id: 'c5',
            tableId: 't1',
            name: 'last_seen',
            dataType: 'timestamptz',
          }),
        ],
        settings: { database: Database.PostgreSQL },
      });
    }

    function createSelfReferenceFixture() {
      return createState({
        tables: [
          createTable({ id: 't1', name: 'node', columnIds: ['c1', 'c2'] }),
        ],
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
        settings: { database: Database.PostgreSQL },
      });
    }

    it('names only the builders the document actually calls', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'event', columnIds: ['c1', 'c2'] }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'name',
            dataType: 'varchar(60)',
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'happened_at',
            dataType: 'timestamp',
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";',
        '',
        'export const Event = mysqlTable("event", {',
        '  name: varchar({ length: 60 }),',
        '  happenedAt: timestamp("happened_at"),',
        '});',
        '',
      ]);
    });

    it('reaches for relations only when the document has a relationship', () => {
      const header = 'import { relations } from "drizzle-orm";';

      expect(createCode(createTeamFixture()).split('\n')).toContain(header);
      expect(
        createCode(createProbeFixture(Database.MySQL)).split('\n')
      ).not.toContain(header);
    });

    it('reaches for sql only when a default falls back to the template', () => {
      const header = 'import { sql } from "drizzle-orm";';

      expect(
        createCode(
          createDefaultFixture('timestamp', 'CURRENT_TIMESTAMP')
        ).split('\n')
      ).toContain(header);
      expect(
        createCode(createDefaultFixture('int', '5')).split('\n')
      ).not.toContain(header);
    });

    it('points the dialect module at the core the database selects', () => {
      const cases: Array<[number, string]> = [
        [
          Database.MariaDB,
          'import { int, mysqlTable } from "drizzle-orm/mysql-core";',
        ],
        [
          Database.MySQL,
          'import { int, mysqlTable } from "drizzle-orm/mysql-core";',
        ],
        [
          Database.PostgreSQL,
          'import { integer, pgTable } from "drizzle-orm/pg-core";',
        ],
        [
          Database.SQLite,
          'import { integer, sqliteTable } from "drizzle-orm/sqlite-core";',
        ],
        [
          Database.MSSQL,
          'import { integer, pgTable } from "drizzle-orm/pg-core";',
        ],
        [
          Database.Oracle,
          'import { bigint, pgTable } from "drizzle-orm/pg-core";',
        ],
        [
          Database.Databricks,
          'import { integer, pgTable } from "drizzle-orm/pg-core";',
        ],
        [
          Database.Snowflake,
          'import { bigint, pgTable } from "drizzle-orm/pg-core";',
        ],
      ];

      cases.forEach(([database, header]) => {
        expect(createCode(createProbeFixture(database)).split('\n')[1]).toBe(
          header
        );
      });
    });

    it('breaks a name list too long for one line onto one name per line', () => {
      expect(createCode(createWideFixture()).split('\n').slice(0, 10)).toEqual([
        '',
        'import {',
        '  numeric,',
        '  pgTable,',
        '  text,',
        '  timestamp,',
        '  uuid,',
        '  varchar,',
        '} from "drizzle-orm/pg-core";',
        '',
      ]);
    });

    it('emits a type-only import on a line of its own', () => {
      expect(createCode(createSelfReferenceFixture()).split('\n')).toEqual([
        '',
        'import { relations } from "drizzle-orm";',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        'import type { AnyPgColumn } from "drizzle-orm/pg-core";',
        '',
        'export const Node = pgTable("node", {',
        '  id: integer().primaryKey(),',
        '  parentId: integer("parent_id").references((): AnyPgColumn => Node.id),',
        '});',
        '',
        'export const NodeRelations = relations(Node, ({ one, many }) => ({',
        '  parentNode: one(Node, {',
        '    fields: [Node.parentId],',
        '    references: [Node.id],',
        '    relationName: "Node_parentNode",',
        '  }),',
        '  nodeList: many(Node, { relationName: "Node_parentNode" }),',
        '}));',
        '',
      ]);
    });
  });

  describe('empty tables', () => {
    it('renders every table of a document that declares no column', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'alpha' }),
          createTable({ id: 't2', name: 'beta' }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { mysqlTable } from "drizzle-orm/mysql-core";',
        '',
        'export const Alpha = mysqlTable("alpha", {});',
        '',
        'export const Beta = mysqlTable("beta", {});',
        '',
      ]);
    });

    it('omits the extra-config argument from a table with no constraint', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'user', columnIds: ['c1'] })],
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

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { int, mysqlTable } from "drizzle-orm/mysql-core";',
        '',
        'export const User = mysqlTable("user", {',
        '  createdAt: int("created_at").notNull(),',
        '});',
        '',
      ]);
      expect(createCode(state)).not.toContain('table =>');
    });
  });

  describe('name cases', () => {
    function createOrderFixture(
      tableNameCase: number,
      columnNameCase: number
    ): RootState {
      return createState({
        tables: [
          createTable({
            id: 't1',
            name: 'order_item',
            columnIds: ['c1', 'c2'],
          }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'unit_price',
            dataType: 'int',
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'qty',
            dataType: 'int',
          }),
        ],
        settings: { database: Database.MySQL, tableNameCase, columnNameCase },
      });
    }

    function createTeamFixture(tableNameCase: number): RootState {
      const team = createTable({
        id: 't_team',
        name: 'team',
        columnIds: ['tc_id'],
      });
      const user = createTable({
        id: 't_user',
        name: 'user',
        columnIds: ['uc_team'],
      });

      return createState({
        tables: [team, user],
        columns: [
          createColumn({
            id: 'tc_id',
            tableId: 't_team',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'uc_team',
            tableId: 't_user',
            name: 'team_id',
            dataType: 'int',
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't_team', columnIds: ['tc_id'] },
            end: { tableId: 't_user', columnIds: ['uc_team'] },
          }),
        ],
        settings: { database: Database.MySQL, tableNameCase },
      });
    }

    it('spells the table const under each of the four table name cases', () => {
      const cases: Array<[number, string]> = [
        [NameCase.none, 'export const order_item = mysqlTable("order_item", {'],
        [
          NameCase.camelCase,
          'export const orderItem = mysqlTable("order_item", {',
        ],
        [
          NameCase.pascalCase,
          'export const OrderItem = mysqlTable("order_item", {',
        ],
        [
          NameCase.snakeCase,
          'export const order_item = mysqlTable("order_item", {',
        ],
      ];

      cases.forEach(([tableNameCase, head]) => {
        expect(
          createCode(
            createOrderFixture(tableNameCase, NameCase.camelCase)
          ).split('\n')
        ).toEqual([
          '',
          'import { int, mysqlTable } from "drizzle-orm/mysql-core";',
          '',
          head,
          '  unitPrice: int("unit_price"),',
          '  qty: int(),',
          '});',
          '',
        ]);
      });
    });

    it('spells the column property under each of the four column name cases', () => {
      const cases: Array<[number, string[]]> = [
        [NameCase.none, ['  unit_price: int(),', '  qty: int(),']],
        [
          NameCase.camelCase,
          ['  unitPrice: int("unit_price"),', '  qty: int(),'],
        ],
        [
          NameCase.pascalCase,
          ['  UnitPrice: int("unit_price"),', '  Qty: int("qty"),'],
        ],
        [NameCase.snakeCase, ['  unit_price: int(),', '  qty: int(),']],
      ];

      cases.forEach(([columnNameCase, properties]) => {
        expect(
          createCode(
            createOrderFixture(NameCase.pascalCase, columnNameCase)
          ).split('\n')
        ).toEqual([
          '',
          'import { int, mysqlTable } from "drizzle-orm/mysql-core";',
          '',
          'export const OrderItem = mysqlTable("order_item", {',
          ...properties,
          '});',
          '',
        ]);
      });
    });

    it('passes the database name only where the property does not spell it', () => {
      const camel = createCode(
        createOrderFixture(NameCase.pascalCase, NameCase.camelCase)
      ).split('\n');
      const none = createCode(
        createOrderFixture(NameCase.pascalCase, NameCase.none)
      ).split('\n');

      expect(camel).toContain('  unitPrice: int("unit_price"),');
      expect(camel).toContain('  qty: int(),');
      expect(none).toContain('  unit_price: int(),');
      expect(none).toContain('  qty: int(),');
    });

    it('derives the relations const name from the table const name', () => {
      const cases: Array<[number, string, string]> = [
        [NameCase.none, 'team', 'teamRelations'],
        [NameCase.camelCase, 'team', 'teamRelations'],
        [NameCase.pascalCase, 'Team', 'TeamRelations'],
        [NameCase.snakeCase, 'team', 'teamRelations'],
      ];

      cases.forEach(([tableNameCase, constName, relationsName]) => {
        expect(
          createCode(createTeamFixture(tableNameCase)).split('\n')
        ).toContain(
          `export const ${relationsName} = relations(${constName}, ({ many }) => ({`
        );
      });
    });
  });

  describe('line wrapping', () => {
    function createChainFixture() {
      return createState({
        tables: [
          createTable({ id: 't1', name: 'probe', columnIds: ['c1', 'c2'] }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'some_very_long_column_name',
            dataType: 'varchar(255)',
            default: "'hello'",
            options: ColumnOption.notNull | ColumnOption.unique,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'short',
            dataType: 'int',
            options: ColumnOption.notNull,
          }),
        ],
        settings: { database: Database.MySQL },
      });
    }

    function createIndexFixture() {
      return createState({
        tables: [
          createTable({
            id: 't1',
            name: 'measurement',
            columnIds: ['c1', 'c2', 'c3'],
          }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'sensor_id',
            dataType: 'int',
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'recorded_at',
            dataType: 'int',
          }),
          createColumn({
            id: 'c3',
            tableId: 't1',
            name: 'location_code',
            dataType: 'int',
          }),
        ],
        indexes: [
          createIndex({
            id: 'i1',
            tableId: 't1',
            name: 'IDX_measurement_sensor_recorded',
            indexColumnIds: ['ic1', 'ic2', 'ic3'],
          }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c1' }),
          createIndexColumn({ id: 'ic2', indexId: 'i1', columnId: 'c2' }),
          createIndexColumn({ id: 'ic3', indexId: 'i1', columnId: 'c3' }),
        ],
        settings: { database: Database.MySQL },
      });
    }

    function createForeignKeyFixture() {
      return createState({
        tables: [
          createTable({
            id: 't1',
            name: 'organization',
            columnIds: ['oc1', 'oc2'],
          }),
          createTable({
            id: 't2',
            name: 'membership',
            columnIds: ['mc1', 'mc2'],
          }),
        ],
        columns: [
          createColumn({
            id: 'oc1',
            tableId: 't1',
            name: 'region_code',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'oc2',
            tableId: 't1',
            name: 'org_number',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'mc1',
            tableId: 't2',
            name: 'region_code',
            dataType: 'int',
          }),
          createColumn({
            id: 'mc2',
            tableId: 't2',
            name: 'org_number',
            dataType: 'int',
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't1', columnIds: ['oc1', 'oc2'] },
            end: { tableId: 't2', columnIds: ['mc1', 'mc2'] },
          }),
        ],
        settings: { database: Database.MySQL },
      });
    }

    function createShortIndexFixture() {
      return createState({
        tables: [createTable({ id: 't1', name: 'm', columnIds: ['c1'] })],
        columns: [
          createColumn({ id: 'c1', tableId: 't1', name: 'a', dataType: 'int' }),
        ],
        indexes: [
          createIndex({
            id: 'i1',
            tableId: 't1',
            name: 'IDX_m',
            indexColumnIds: ['ic1'],
            unique: true,
          }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c1' }),
        ],
        settings: { database: Database.MySQL },
      });
    }

    it('breaks a chain past the column limit onto one method per line', () => {
      expect(createCode(createChainFixture()).split('\n')).toEqual([
        '',
        'import { int, mysqlTable, varchar } from "drizzle-orm/mysql-core";',
        '',
        'export const Probe = mysqlTable("probe", {',
        '  someVeryLongColumnName: varchar("some_very_long_column_name", { length: 255 })',
        '    .notNull()',
        '    .unique()',
        '    .default("hello"),',
        '  short: int().notNull(),',
        '});',
        '',
      ]);
    });

    it('keeps a chain that fits beside the property on one line', () => {
      expect(createCode(createChainFixture()).split('\n')).toContain(
        '  short: int().notNull(),'
      );
    });

    it('breaks an index too wide to inline onto one column per line', () => {
      expect(createCode(createIndexFixture()).split('\n')).toEqual([
        '',
        'import { index, int, mysqlTable } from "drizzle-orm/mysql-core";',
        '',
        'export const Measurement = mysqlTable(',
        '  "measurement",',
        '  {',
        '    sensorId: int("sensor_id"),',
        '    recordedAt: int("recorded_at"),',
        '    locationCode: int("location_code"),',
        '  },',
        '  table => [',
        '    index("IDX_measurement_sensor_recorded").on(',
        '      table.sensorId,',
        '      table.recordedAt,',
        '      table.locationCode',
        '    ),',
        '  ]',
        ');',
        '',
      ]);
    });

    it('breaks a foreignKey too wide to inline onto one entry per line', () => {
      expect(createCode(createForeignKeyFixture()).split('\n')).toEqual([
        '',
        'import {',
        '  foreignKey,',
        '  int,',
        '  mysqlTable,',
        '  primaryKey,',
        '} from "drizzle-orm/mysql-core";',
        '',
        'export const Membership = mysqlTable(',
        '  "membership",',
        '  {',
        '    regionCode: int("region_code"),',
        '    orgNumber: int("org_number"),',
        '  },',
        '  table => [',
        '    foreignKey({',
        '      columns: [table.regionCode, table.orgNumber],',
        '      foreignColumns: [Organization.regionCode, Organization.orgNumber],',
        '    }),',
        '  ]',
        ');',
        '',
        'export const Organization = mysqlTable(',
        '  "organization",',
        '  {',
        '    regionCode: int("region_code").notNull(),',
        '    orgNumber: int("org_number").notNull(),',
        '  },',
        '  table => [primaryKey({ columns: [table.regionCode, table.orgNumber] })]',
        ');',
        '',
      ]);
    });

    it('chains the referential actions onto a composite foreignKey', () => {
      const state = createForeignKeyFixture();
      Object.assign(state.collections.relationshipEntities.r1, {
        onDelete: ReferentialAction.restrict,
        onUpdate: ReferentialAction.noAction,
      });
      const lines = createCode(state).split('\n');
      const head = lines.indexOf('    foreignKey({');

      expect(lines.slice(head, head + 4)).toEqual([
        '    foreignKey({',
        '      columns: [table.regionCode, table.orgNumber],',
        '      foreignColumns: [Organization.regionCode, Organization.orgNumber],',
        '    }).onDelete("restrict").onUpdate("no action"),',
      ]);
    });

    it('collapses the extra-config array onto one line for a short entry', () => {
      expect(createCode(createShortIndexFixture()).split('\n')).toEqual([
        '',
        'import { int, mysqlTable, uniqueIndex } from "drizzle-orm/mysql-core";',
        '',
        'export const M = mysqlTable(',
        '  "m",',
        '  {',
        '    a: int(),',
        '  },',
        '  table => [uniqueIndex("IDX_m").on(table.a)]',
        ');',
        '',
      ]);
    });
  });

  describe('type mapping', () => {
    const HEAD = '  value: ';

    function createTypeFixture(dataType: string, database: number): string {
      const table = createTable({ id: 't1', name: 'probe', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({ id: 'c1', tableId: 't1', name: 'value', dataType }),
        ],
        settings: { database },
      });
      const line = render(state, table).find(entry => entry.startsWith(HEAD));

      return line === undefined ? '' : line.slice(HEAD.length, -1);
    }

    function createTypeCode(dataType: string, database: number): string[] {
      const table = createTable({ id: 't1', name: 'probe', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({ id: 'c1', tableId: 't1', name: 'value', dataType }),
        ],
        settings: { database },
      });

      return createCode(state).split('\n');
    }

    function createDialectFixture(database: number): string[] {
      const table = createTable({ id: 't1', name: 'probe', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
          }),
        ],
        settings: { database },
      });

      return createCode(state).split('\n');
    }

    function createFallbackFixture(database: number): string[] {
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
            dataType: 'uuid',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'amount',
            dataType: 'numeric(10,2)',
          }),
        ],
        settings: { database },
      });

      return createCode(state).split('\n');
    }

    it('names the table function and the module of the dialect the database picks', () => {
      expect(createDialectFixture(Database.PostgreSQL)).toEqual([
        '',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const Probe = pgTable("probe", {',
        '  id: integer(),',
        '});',
        '',
      ]);
      expect(createDialectFixture(Database.MySQL)).toEqual([
        '',
        'import { int, mysqlTable } from "drizzle-orm/mysql-core";',
        '',
        'export const Probe = mysqlTable("probe", {',
        '  id: int(),',
        '});',
        '',
      ]);
      expect(createDialectFixture(Database.MariaDB)).toEqual([
        '',
        'import { int, mysqlTable } from "drizzle-orm/mysql-core";',
        '',
        'export const Probe = mysqlTable("probe", {',
        '  id: int(),',
        '});',
        '',
      ]);
      expect(createDialectFixture(Database.SQLite)).toEqual([
        '',
        'import { integer, sqliteTable } from "drizzle-orm/sqlite-core";',
        '',
        'export const Probe = sqliteTable("probe", {',
        '  id: integer(),',
        '});',
        '',
      ]);
    });

    it('reaches pg-core for the three databases drizzle publishes no dialect for', () => {
      const expected = [
        '',
        'import { numeric, pgTable, uuid } from "drizzle-orm/pg-core";',
        '',
        'export const Probe = pgTable("probe", {',
        '  id: uuid().primaryKey(),',
        '  amount: numeric({ precision: 10, scale: 2 }),',
        '});',
        '',
      ];

      expect(createFallbackFixture(Database.MSSQL)).toEqual(expected);
      expect(createFallbackFixture(Database.Oracle)).toEqual(expected);
      expect(createFallbackFixture(Database.Databricks)).toEqual(expected);
    });

    it('carries a length onto a pg character builder only where one is stated', () => {
      expect(createTypeFixture('char', Database.PostgreSQL)).toBe('char()');
      expect(createTypeFixture('char(10)', Database.PostgreSQL)).toBe(
        'char({ length: 10 })'
      );
      expect(createTypeFixture('varchar', Database.PostgreSQL)).toBe(
        'varchar()'
      );
      expect(createTypeFixture('varchar(255)', Database.PostgreSQL)).toBe(
        'varchar({ length: 255 })'
      );
      expect(createTypeFixture('text', Database.PostgreSQL)).toBe('text()');
    });

    it('names the pg builders that take no argument list at all', () => {
      expect(createTypeFixture('uuid', Database.PostgreSQL)).toBe('uuid()');
      expect(createTypeFixture('json', Database.PostgreSQL)).toBe('json()');
      expect(createTypeFixture('jsonb', Database.PostgreSQL)).toBe('jsonb()');
      expect(createTypeFixture('boolean', Database.PostgreSQL)).toBe(
        'boolean()'
      );
      expect(createTypeFixture('bool', Database.PostgreSQL)).toBe('boolean()');
    });

    it('states the mode a 64-bit pg integer reads its value in', () => {
      expect(createTypeFixture('smallint', Database.PostgreSQL)).toBe(
        'smallint()'
      );
      expect(createTypeFixture('integer', Database.PostgreSQL)).toBe(
        'integer()'
      );
      expect(createTypeFixture('mediumint', Database.PostgreSQL)).toBe(
        'integer()'
      );
      expect(createTypeFixture('bigint', Database.PostgreSQL)).toBe(
        'bigint({ mode: "number" })'
      );
    });

    it('picks the pg serial builder that matches the integer width', () => {
      expect(createTypeFixture('smallserial', Database.PostgreSQL)).toBe(
        'smallserial()'
      );
      expect(createTypeFixture('serial', Database.PostgreSQL)).toBe('serial()');
      expect(createTypeFixture('bigserial', Database.PostgreSQL)).toBe(
        'bigserial({ mode: "number" })'
      );
    });

    it('lifts a precision and a scale onto pg numeric but not onto its floats', () => {
      expect(createTypeFixture('real', Database.PostgreSQL)).toBe('real()');
      expect(createTypeFixture('double precision', Database.PostgreSQL)).toBe(
        'doublePrecision()'
      );
      expect(createTypeFixture('numeric', Database.PostgreSQL)).toBe(
        'numeric()'
      );
      expect(createTypeFixture('numeric(10)', Database.PostgreSQL)).toBe(
        'numeric({ precision: 10 })'
      );
      expect(createTypeFixture('numeric(10,2)', Database.PostgreSQL)).toBe(
        'numeric({ precision: 10, scale: 2 })'
      );
    });

    it('marks the pg date and time builders that keep a zone', () => {
      expect(createTypeFixture('date', Database.PostgreSQL)).toBe('date()');
      expect(createTypeFixture('time', Database.PostgreSQL)).toBe('time()');
      expect(
        createTypeFixture('time with time zone', Database.PostgreSQL)
      ).toBe('time({ withTimezone: true })');
      expect(createTypeFixture('timestamp', Database.PostgreSQL)).toBe(
        'timestamp()'
      );
      expect(
        createTypeFixture('timestamp with time zone', Database.PostgreSQL)
      ).toBe('timestamp({ withTimezone: true })');
    });

    it('keeps the zone of every spelling of a zoned timestamp alike', () => {
      ['TIMESTAMP_TZ', 'TIMESTAMPTZ', 'TIMESTAMP_LTZ', 'TIMESTAMPLTZ'].forEach(
        dataType =>
          expect(createTypeFixture(dataType, Database.Snowflake)).toBe(
            'timestamp({ withTimezone: true })'
          )
      );
      expect(createTypeFixture('TIMESTAMP_NTZ', Database.Snowflake)).toBe(
        'timestamp()'
      );
      expect(
        createTypeFixture('TIMESTAMP WITH LOCAL TIME ZONE', Database.Oracle)
      ).toBe('timestamp({ withTimezone: true })');
    });

    it('states interval fields only for a span pg names', () => {
      expect(createTypeFixture('interval', Database.PostgreSQL)).toBe(
        'interval()'
      );
      expect(
        createTypeFixture('interval day to second', Database.PostgreSQL)
      ).toBe('interval({ fields: "day to second" })');
      expect(
        createTypeFixture('interval day(2) to second(6)', Database.PostgreSQL)
      ).toBe('interval({ fields: "day to second" })');
      expect(createTypeFixture('interval quarter', Database.PostgreSQL)).toBe(
        'interval()'
      );
      expect(
        createTypeFixture('INTERVAL DAY(3) TO SECOND(2)', Database.Oracle)
      ).toBe('interval({ fields: "day to second" })');
      expect(createTypeFixture('interval second(3)', Database.PostgreSQL)).toBe(
        'interval({ fields: "second", precision: 3 })'
      );
    });

    it('reads an interval precision only after SECOND or the INTERVAL keyword', () => {
      expect(
        createTypeFixture('INTERVAL YEAR(2) TO MONTH', Database.Oracle)
      ).toBe('interval({ fields: "year to month" })');
      expect(
        createTypeFixture('INTERVAL DAY(3) TO SECOND', Database.Oracle)
      ).toBe('interval({ fields: "day to second" })');
      expect(
        createTypeFixture('INTERVAL HOUR(2) TO MINUTE', Database.PostgreSQL)
      ).toBe('interval({ fields: "hour to minute" })');
      expect(createTypeFixture('INTERVAL MONTH(3)', Database.PostgreSQL)).toBe(
        'interval({ fields: "month" })'
      );
      expect(
        createTypeFixture('INTERVAL DAY TO SECOND(3)', Database.Oracle)
      ).toBe('interval({ fields: "day to second", precision: 3 })');
      expect(
        createTypeFixture('interval minute to second (2)', Database.PostgreSQL)
      ).toBe('interval({ fields: "minute to second", precision: 2 })');
      expect(createTypeFixture('INTERVAL (3)', Database.PostgreSQL)).toBe(
        'interval({ precision: 3 })'
      );
      expect(
        createTypeFixture('interval year(2) to month[]', Database.PostgreSQL)
      ).toBe('interval({ fields: "year to month" }).array()');
    });

    it('names the pg network and geometry builders', () => {
      expect(createTypeFixture('inet', Database.PostgreSQL)).toBe('inet()');
      expect(createTypeFixture('cidr', Database.PostgreSQL)).toBe('cidr()');
      expect(createTypeFixture('macaddr', Database.PostgreSQL)).toBe(
        'macaddr()'
      );
      expect(createTypeFixture('macaddr8', Database.PostgreSQL)).toBe(
        'macaddr8()'
      );
      expect(createTypeFixture('point', Database.PostgreSQL)).toBe('point()');
      expect(createTypeFixture('line', Database.PostgreSQL)).toBe('line()');
    });

    it('falls through to the primitive table for a name pg does not list', () => {
      expect(createTypeFixture('geography', Database.PostgreSQL)).toBe(
        'varchar()'
      );
      expect(createTypeFixture('pg_lsn', Database.PostgreSQL)).toBe(
        'varchar()'
      );
      expect(createTypeFixture('circle', Database.PostgreSQL)).toBe(
        'varchar()'
      );
      expect(createTypeFixture('', Database.PostgreSQL)).toBe('varchar()');
    });

    it('declares a pg type pg-core has no builder for under its own name', () => {
      expect(createTypeFixture('tsvector', Database.PostgreSQL)).toBe(
        'tsvector()'
      );
      expect(createTypeFixture('tsquery', Database.PostgreSQL)).toBe(
        'tsquery()'
      );
      expect(createTypeFixture('xml', Database.PostgreSQL)).toBe('xml()');
      expect(createTypeFixture('money', Database.PostgreSQL)).toBe('money()');
      expect(createTypeFixture('int4range', Database.PostgreSQL)).toBe(
        'int4range()'
      );
      expect(createTypeFixture('daterange', Database.PostgreSQL)).toBe(
        'daterange()'
      );
      expect(createTypeFixture('box', Database.PostgreSQL)).toBe('box()');
      expect(createTypeFixture('polygon', Database.PostgreSQL)).toBe(
        'polygon()'
      );
      expect(createTypeCode('money', Database.PostgreSQL)).toEqual([
        '',
        'import { customType, pgTable } from "drizzle-orm/pg-core";',
        '',
        'const money = customType<{ data: string }>({ dataType: () => "money" });',
        '',
        'export const Probe = pgTable("probe", {',
        '  value: money(),',
        '});',
        '',
      ]);
    });

    it('keeps the decimal stand-in for money on a database pg-core borrows for', () => {
      expect(createTypeFixture('money', Database.MSSQL)).toBe('numeric()');
      expect(createTypeFixture('smallmoney', Database.MSSQL)).toBe('numeric()');
      expect(createTypeFixture('xml', Database.MSSQL)).toBe('text()');
    });

    it('widens a type to what the database pg-core borrows for stores', () => {
      expect(createTypeFixture('DATE', Database.Oracle)).toBe('timestamp()');
      expect(createTypeFixture('TIMESTAMP', Database.Databricks)).toBe(
        'timestamp({ withTimezone: true })'
      );
      expect(createTypeFixture('INT', Database.Oracle)).toBe(
        'bigint({ mode: "number" })'
      );
      expect(createTypeFixture('SMALLINT', Database.Oracle)).toBe(
        'bigint({ mode: "number" })'
      );
      expect(createTypeFixture('TINYINT', Database.Snowflake)).toBe(
        'bigint({ mode: "number" })'
      );
      expect(createTypeFixture('BYTEINT', Database.Snowflake)).toBe(
        'bigint({ mode: "number" })'
      );
      expect(createTypeFixture('REAL', Database.Oracle)).toBe(
        'doublePrecision()'
      );
      expect(createTypeFixture('FLOAT4', Database.Snowflake)).toBe(
        'doublePrecision()'
      );
    });

    it('keeps the width a type has on PostgreSQL where the database stores no more', () => {
      expect(createTypeFixture('DATE', Database.Snowflake)).toBe('date()');
      expect(createTypeFixture('TIMESTAMP_NTZ', Database.Databricks)).toBe(
        'timestamp()'
      );
      expect(createTypeFixture('INT', Database.MSSQL)).toBe('integer()');
      expect(createTypeFixture('SMALLINT', Database.Databricks)).toBe(
        'smallint()'
      );
      expect(createTypeFixture('REAL', Database.MSSQL)).toBe('real()');
      expect(createTypeFixture('NUMBER(10)', Database.Oracle)).toBe(
        'numeric({ precision: 10 })'
      );
      expect(createTypeFixture('date', Database.PostgreSQL)).toBe('date()');
    });

    it('gives the identity of an auto-increment key the width it widens to', () => {
      const table = createTable({ id: 't1', name: 'probe', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'value',
            dataType: 'INTEGER',
            options: ColumnOption.primaryKey | ColumnOption.autoIncrement,
          }),
        ],
        settings: { database: Database.Oracle },
      });

      expect(render(state, table)).toContain(
        '  value: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),'
      );
    });

    it('keeps each mysql integer width rather than widening it', () => {
      expect(createTypeFixture('tinyint', Database.MySQL)).toBe('tinyint()');
      expect(createTypeFixture('smallint', Database.MySQL)).toBe('smallint()');
      expect(createTypeFixture('mediumint', Database.MySQL)).toBe(
        'mediumint()'
      );
      expect(createTypeFixture('int', Database.MySQL)).toBe('int()');
      expect(createTypeFixture('integer', Database.MySQL)).toBe('int()');
      expect(createTypeFixture('bigint', Database.MySQL)).toBe(
        'bigint({ mode: "number" })'
      );
    });

    it('appends unsigned only on mysql and mariadb and only where the builder takes it', () => {
      expect(createTypeFixture('int unsigned', Database.MySQL)).toBe(
        'int({ unsigned: true })'
      );
      expect(createTypeFixture('bigint unsigned', Database.MySQL)).toBe(
        'bigint({ mode: "number", unsigned: true })'
      );
      expect(createTypeFixture('decimal(10,2) unsigned', Database.MySQL)).toBe(
        'decimal({ precision: 10, scale: 2, unsigned: true })'
      );
      expect(createTypeFixture('int unsigned', Database.MariaDB)).toBe(
        'int({ unsigned: true })'
      );
      expect(createTypeFixture('varchar(10) unsigned', Database.MySQL)).toBe(
        'varchar({ length: 10 })'
      );
      expect(createTypeFixture('int unsigned', Database.PostgreSQL)).toBe(
        'integer()'
      );
      expect(createTypeFixture('int unsigned', Database.SQLite)).toBe(
        'integer()'
      );
    });

    it('drops every mysql sign word from a type name on the other databases', () => {
      expect(
        createTypeFixture('MEDIUMINT(8) UNSIGNED ZEROFILL', Database.PostgreSQL)
      ).toBe('integer()');
      expect(
        createTypeFixture('SMALLINT(5) ZEROFILL', Database.PostgreSQL)
      ).toBe('smallint()');
      expect(createTypeFixture('TINYINT(3) ZEROFILL', Database.MSSQL)).toBe(
        'smallint()'
      );
      expect(createTypeFixture('INT(10) SIGNED', Database.PostgreSQL)).toBe(
        'integer()'
      );
      expect(createTypeFixture('INT8 ZEROFILL', Database.MSSQL)).toBe(
        'bigint({ mode: "number" })'
      );
      expect(createTypeFixture('INT ZEROFILL', Database.SQLite)).toBe(
        'integer()'
      );
    });

    it('lifts a precision and a scale onto the mysql fixed and floating builders', () => {
      expect(createTypeFixture('decimal', Database.MySQL)).toBe('decimal()');
      expect(createTypeFixture('decimal(10)', Database.MySQL)).toBe(
        'decimal({ precision: 10 })'
      );
      expect(createTypeFixture('decimal(10,2)', Database.MySQL)).toBe(
        'decimal({ precision: 10, scale: 2 })'
      );
      expect(createTypeFixture('float(10,2)', Database.MySQL)).toBe(
        'float({ precision: 10, scale: 2 })'
      );
      expect(createTypeFixture('double(10,2)', Database.MySQL)).toBe(
        'double({ precision: 10, scale: 2 })'
      );
      expect(createTypeFixture('double precision', Database.MySQL)).toBe(
        'double()'
      );
      expect(createTypeFixture('real', Database.MySQL)).toBe('double()');
    });

    it('keeps the size of a mysql text column in the builder name', () => {
      expect(createTypeFixture('tinytext', Database.MySQL)).toBe('tinytext()');
      expect(createTypeFixture('text', Database.MySQL)).toBe('text()');
      expect(createTypeFixture('mediumtext', Database.MySQL)).toBe(
        'mediumtext()'
      );
      expect(createTypeFixture('longtext', Database.MySQL)).toBe('longtext()');
    });

    it('reads the mysql long text spellings as the mediumtext they store', () => {
      expect(createTypeFixture('LONG', Database.MySQL)).toBe('mediumtext()');
      expect(createTypeFixture('LONG VARCHAR', Database.MariaDB)).toBe(
        'mediumtext()'
      );
      expect(createTypeFixture('long character varying', Database.MySQL)).toBe(
        'mediumtext()'
      );
      expect(createTypeFixture('TEXT(50)', Database.MySQL)).toBe('text()');
      expect(createTypeFixture('LONG VARCHAR', Database.PostgreSQL)).toBe(
        'text()'
      );
    });

    it('reads mariadb oracle mode clob and bare number as the types it stores', () => {
      expect(createTypeFixture('CLOB', Database.MariaDB)).toBe('longtext()');
      expect(createTypeFixture('NUMBER', Database.MariaDB)).toBe('double()');
      expect(createTypeFixture('NUMBER(10)', Database.MariaDB)).toBe(
        'decimal({ precision: 10 })'
      );
      expect(createTypeFixture('NUMBER(10,2)', Database.MariaDB)).toBe(
        'decimal({ precision: 10, scale: 2 })'
      );
      expect(createTypeFixture('CLOB', Database.MySQL)).toBe('text()');
      expect(createTypeFixture('NUMBER', Database.MySQL)).toBe('decimal()');
    });

    it('reads a mysql character type past the attributes written after it', () => {
      expect(createTypeFixture('CHAR(36) BINARY', Database.MySQL)).toBe(
        'char({ length: 36 })'
      );
      expect(
        createTypeFixture('CHAR(2) CHARACTER SET latin1', Database.MariaDB)
      ).toBe('char({ length: 2 })');
      expect(
        createTypeFixture(
          'char(2) charset latin1 collate latin1_bin',
          Database.MySQL
        )
      ).toBe('char({ length: 2 })');
      expect(createTypeFixture('CHAR(10) ASCII', Database.MySQL)).toBe(
        'char({ length: 10 })'
      );
      expect(createTypeFixture('TINYTEXT BINARY', Database.MariaDB)).toBe(
        'tinytext()'
      );
      expect(
        createTypeFixture('LONGTEXT COLLATE utf8mb4_bin', Database.MySQL)
      ).toBe('longtext()');
      expect(createTypeFixture('BINARY(16)', Database.MySQL)).toBe(
        'binary({ length: 16 })'
      );
      expect(createTypeFixture('LONG VARBINARY', Database.MySQL)).toBe(
        'mediumblob()'
      );
    });

    it('degrades a mysql builder that requires a length when none is stated', () => {
      expect(createTypeFixture('char', Database.MySQL)).toBe('char()');
      expect(createTypeFixture('char(16)', Database.MySQL)).toBe(
        'char({ length: 16 })'
      );
      expect(createTypeFixture('varchar(255)', Database.MySQL)).toBe(
        'varchar({ length: 255 })'
      );
      expect(createTypeFixture('varchar', Database.MySQL)).toBe('text()');
      expect(createTypeFixture('binary(16)', Database.MySQL)).toBe(
        'binary({ length: 16 })'
      );
      expect(createTypeFixture('binary', Database.MySQL)).toBe('binary()');
      expect(createTypeFixture('varbinary(255)', Database.MySQL)).toBe(
        'varbinary({ length: 255 })'
      );
      expect(createTypeFixture('varbinary', Database.MySQL)).toBe('blob()');
    });

    it('keeps a zero length on mysql and mariadb and drops it elsewhere', () => {
      expect(createTypeFixture('CHAR(0)', Database.MySQL)).toBe(
        'char({ length: 0 })'
      );
      expect(createTypeFixture('VARCHAR(0)', Database.MariaDB)).toBe(
        'varchar({ length: 0 })'
      );
      expect(createTypeFixture('BINARY(0)', Database.MySQL)).toBe(
        'binary({ length: 0 })'
      );
      expect(createTypeFixture('VARBINARY(0)', Database.MariaDB)).toBe(
        'varbinary({ length: 0 })'
      );
      expect(createTypeFixture('char(0)', Database.PostgreSQL)).toBe('char()');
      expect(createTypeFixture('varchar(0)', Database.PostgreSQL)).toBe(
        'varchar()'
      );
      expect(createTypeFixture('varchar(0)', Database.SQLite)).toBe('text()');
    });

    it('names the mysql date and time builders including year', () => {
      expect(createTypeFixture('date', Database.MySQL)).toBe('date()');
      expect(createTypeFixture('datetime', Database.MySQL)).toBe('datetime()');
      expect(createTypeFixture('timestamp', Database.MySQL)).toBe(
        'timestamp()'
      );
      expect(createTypeFixture('time', Database.MySQL)).toBe('time()');
      expect(createTypeFixture('year', Database.MySQL)).toBe('year()');
    });

    it('names mysql json and serial but reads jsonb as plain text', () => {
      expect(createTypeFixture('json', Database.MySQL)).toBe('json()');
      expect(createTypeFixture('serial', Database.MySQL)).toBe('serial()');
      expect(createTypeFixture('jsonb', Database.MySQL)).toBe('text()');
      expect(createTypeFixture('', Database.MySQL)).toBe('text()');
    });

    it('reads a sqlite column onto one of the five storage classes', () => {
      expect(createTypeFixture('integer', Database.SQLite)).toBe('integer()');
      expect(createTypeFixture('bigint', Database.SQLite)).toBe('integer()');
      expect(createTypeFixture('boolean', Database.SQLite)).toBe(
        'integer({ mode: "boolean" })'
      );
      expect(createTypeFixture('real', Database.SQLite)).toBe('real()');
      expect(createTypeFixture('numeric(10,2)', Database.SQLite)).toBe(
        'numeric()'
      );
      expect(createTypeFixture('text', Database.SQLite)).toBe('text()');
      expect(createTypeFixture('varchar(255)', Database.SQLite)).toBe(
        'text({ length: 255 })'
      );
      expect(createTypeFixture('blob', Database.SQLite)).toBe(
        'blob({ mode: "buffer" })'
      );
      expect(createTypeFixture('binary(16)', Database.SQLite)).toBe(
        'blob({ mode: "buffer" })'
      );
    });

    it('lands the whole sqlite date and time family on text', () => {
      expect(createTypeFixture('date', Database.SQLite)).toBe('text()');
      expect(createTypeFixture('time', Database.SQLite)).toBe('text()');
      expect(createTypeFixture('datetime', Database.SQLite)).toBe('text()');
      expect(createTypeFixture('timestamp', Database.SQLite)).toBe('text()');
      expect(createTypeFixture('time with time zone', Database.SQLite)).toBe(
        'text()'
      );
      expect(createTypeFixture('', Database.SQLite)).toBe('text()');
    });

    it('reads the width off a name the unsigned modifier is written on', () => {
      expect(createTypeFixture('tinyint unsigned', Database.MySQL)).toBe(
        'tinyint({ unsigned: true })'
      );
      expect(createTypeFixture('smallint unsigned', Database.MySQL)).toBe(
        'smallint({ unsigned: true })'
      );
      expect(createTypeFixture('mediumint unsigned', Database.MySQL)).toBe(
        'mediumint({ unsigned: true })'
      );
      expect(createTypeFixture('bigint unsigned', Database.MySQL)).toBe(
        'bigint({ mode: "number", unsigned: true })'
      );
    });

    it('reads a mysql float precision as the float or double it stores', () => {
      expect(createTypeFixture('FLOAT(10)', Database.MySQL)).toBe('float()');
      expect(createTypeFixture('FLOAT(24)', Database.MariaDB)).toBe('float()');
      expect(createTypeFixture('FLOAT(25)', Database.MySQL)).toBe('double()');
      expect(createTypeFixture('FLOAT(53) SIGNED', Database.MySQL)).toBe(
        'double()'
      );
      expect(createTypeFixture('FLOAT(30) UNSIGNED', Database.MySQL)).toBe(
        'double({ unsigned: true })'
      );
      expect(createTypeFixture('FLOAT(30) ZEROFILL', Database.MariaDB)).toBe(
        'double({ unsigned: true })'
      );
    });

    it('drops the precision a mysql double refuses without a scale', () => {
      expect(createTypeFixture('DOUBLE(10)', Database.MySQL)).toBe('double()');
      expect(createTypeFixture('REAL(10,2)', Database.MySQL)).toBe(
        'double({ precision: 10, scale: 2 })'
      );
    });

    it('reads zerofill as unsigned and a signed type at its own width', () => {
      expect(createTypeFixture('INT(11) ZEROFILL', Database.MySQL)).toBe(
        'int({ unsigned: true })'
      );
      expect(
        createTypeFixture('SMALLINT(5) UNSIGNED ZEROFILL', Database.MySQL)
      ).toBe('smallint({ unsigned: true })');
      expect(
        createTypeFixture('DECIMAL(10,2) ZEROFILL', Database.MariaDB)
      ).toBe('decimal({ precision: 10, scale: 2, unsigned: true })');
      expect(createTypeFixture('TINYINT SIGNED', Database.MySQL)).toBe(
        'tinyint()'
      );
      expect(createTypeFixture('MEDIUMINT SIGNED', Database.MySQL)).toBe(
        'mediumint()'
      );
    });

    it('keeps a length off a non-numeric name the modifier is written on', () => {
      expect(createTypeFixture('char(10) unsigned', Database.MySQL)).toBe(
        'char({ length: 10 })'
      );
    });

    it('lands every binary type on a bytea it declares under pg-core', () => {
      expect(createTypeFixture('bytea', Database.PostgreSQL)).toBe('bytea()');
      expect(createTypeFixture('varbinary(255)', Database.MSSQL)).toBe(
        'bytea()'
      );
      expect(createTypeFixture('image', Database.MSSQL)).toBe('bytea()');
      expect(createTypeFixture('blob', Database.Oracle)).toBe('bytea()');
      expect(createTypeFixture('RAW(16)', Database.Oracle)).toBe('bytea()');
      expect(createTypeFixture('BINARY', Database.Snowflake)).toBe('bytea()');
      expect(createTypeCode('bytea', Database.PostgreSQL)).toEqual([
        '',
        'import { customType, pgTable } from "drizzle-orm/pg-core";',
        '',
        'const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });',
        '',
        'export const Probe = pgTable("probe", {',
        '  value: bytea(),',
        '});',
        '',
      ]);
    });

    it('lands each mysql blob on a type it declares under that name', () => {
      expect(createTypeFixture('blob', Database.MySQL)).toBe('blob()');
      expect(createTypeFixture('TINYBLOB', Database.MySQL)).toBe('tinyblob()');
      expect(createTypeFixture('MEDIUMBLOB', Database.MariaDB)).toBe(
        'mediumblob()'
      );
      expect(createTypeFixture('LONGBLOB', Database.MySQL)).toBe('longblob()');
      expect(createTypeFixture('LONG VARBINARY', Database.MySQL)).toBe(
        'mediumblob()'
      );
      expect(createTypeFixture('image', Database.MySQL)).toBe('blob()');
      expect(createTypeCode('LONGBLOB', Database.MySQL)[3]).toBe(
        'const longblob = customType<{ data: Buffer }>({ dataType: () => "longblob" });'
      );
      expect(createTypeCode('MEDIUMBLOB', Database.MySQL)).toEqual([
        '',
        'import { customType, mysqlTable } from "drizzle-orm/mysql-core";',
        '',
        'const mediumblob = customType<{ data: Buffer }>({',
        '  dataType: () => "mediumblob",',
        '});',
        '',
        'export const Probe = mysqlTable("probe", {',
        '  value: mediumblob(),',
        '});',
        '',
      ]);
    });

    it('reads a mysql blob length as the smallest blob that holds it', () => {
      [
        ['BLOB(1)', 'tinyblob()'],
        ['BLOB(255)', 'tinyblob()'],
        ['BLOB(256)', 'blob()'],
        ['BLOB(65535)', 'blob()'],
        ['BLOB(65536)', 'mediumblob()'],
        ['BLOB(16777215)', 'mediumblob()'],
        ['BLOB(16777216)', 'longblob()'],
        ['BLOB(4294967295)', 'longblob()'],
        ['BLOB(0)', 'blob()'],
      ].forEach(([dataType, expected]) =>
        expect(createTypeFixture(dataType, Database.MySQL)).toBe(expected)
      );
      expect(createTypeFixture('BLOB(100)', Database.MariaDB)).toBe(
        'tinyblob()'
      );
      expect(createTypeCode('BLOB(100)', Database.MySQL)[3]).toBe(
        'const tinyblob = customType<{ data: Buffer }>({ dataType: () => "tinyblob" });'
      );
      expect(createTypeFixture('BLOB(100)', Database.PostgreSQL)).toBe(
        'bytea()'
      );
      expect(createTypeFixture('BLOB(100)', Database.SQLite)).toBe(
        'blob({ mode: "buffer" })'
      );
    });

    it('reads the binary synonyms mysql and mariadb take as their binary builders', () => {
      expect(createTypeFixture('CHAR(16) BYTE', Database.MySQL)).toBe(
        'binary({ length: 16 })'
      );
      expect(createTypeFixture('RAW(16)', Database.MariaDB)).toBe(
        'varbinary({ length: 16 })'
      );
      expect(createTypeFixture('binary varying(8)', Database.MySQL)).toBe(
        'varbinary({ length: 8 })'
      );
      expect(createTypeFixture('CHAR(16) BYTE', Database.SQLite)).toBe(
        'blob({ mode: "buffer" })'
      );
    });

    it('carries fractional seconds as precision on the pg temporal types', () => {
      expect(createTypeFixture('timestamp(3)', Database.PostgreSQL)).toBe(
        'timestamp({ precision: 3 })'
      );
      expect(
        createTypeFixture('timestamp(3) with time zone', Database.PostgreSQL)
      ).toBe('timestamp({ withTimezone: true, precision: 3 })');
      expect(createTypeFixture('time(6)', Database.PostgreSQL)).toBe(
        'time({ precision: 6 })'
      );
      expect(createTypeFixture('interval(6)', Database.PostgreSQL)).toBe(
        'interval({ precision: 6 })'
      );
      expect(
        createTypeFixture('interval day to second(6)', Database.PostgreSQL)
      ).toBe('interval({ fields: "day to second", precision: 6 })');
    });

    it('carries fractional seconds as fsp on the mysql temporal types', () => {
      expect(createTypeFixture('DATETIME(3)', Database.MySQL)).toBe(
        'datetime({ fsp: 3 })'
      );
      expect(createTypeFixture('TIMESTAMP(6)', Database.MySQL)).toBe(
        'timestamp({ fsp: 6 })'
      );
      expect(createTypeFixture('TIME(3)', Database.MySQL)).toBe(
        'time({ fsp: 3 })'
      );
    });

    it('drops a fractional second count outside the range drizzle takes', () => {
      expect(createTypeFixture('timestamp(9)', Database.PostgreSQL)).toBe(
        'timestamp()'
      );
    });

    it('declares a pg bit string as its own type rather than as pgvector or a number', () => {
      expect(createTypeFixture('bit(8)', Database.PostgreSQL)).toBe(
        'bit({ length: 8 })'
      );
      expect(createTypeFixture('bit', Database.PostgreSQL)).toBe('bit()');
      expect(createTypeFixture('varbit(16)', Database.PostgreSQL)).toBe(
        'varbit({ length: 16 })'
      );
      expect(createTypeFixture('bit varying', Database.PostgreSQL)).toBe(
        'varbit()'
      );
      expect(createTypeCode('bit varying(8)', Database.PostgreSQL)).toEqual([
        '',
        'import { customType, pgTable } from "drizzle-orm/pg-core";',
        '',
        'const varbit = customType<{ data: string; config: { length?: number } }>({',
        '  dataType: (config) =>',
        '    typeof config?.length === "number"',
        '      ? `bit varying(${config.length})`',
        '      : "bit varying",',
        '});',
        '',
        'export const Probe = pgTable("probe", {',
        '  value: varbit({ length: 8 }),',
        '});',
        '',
      ]);
      expect(createTypeCode('bit(8)', Database.PostgreSQL).slice(3, 6)).toEqual(
        [
          'const bit = customType<{ data: string; config: { length?: number } }>({',
          '  dataType: (config) => `bit(${config?.length ?? 1})`,',
          '});',
        ]
      );
    });

    it('writes the varbit declaration with no global name a table const could shadow', () => {
      const shadow = createTable({
        id: 't1',
        name: 'undefined',
        columnIds: ['c1', 'c2'],
      });
      const state = createState({
        tables: [shadow],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'integer',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'flags',
            dataType: 'varbit',
          }),
        ],
        settings: {
          database: Database.PostgreSQL,
          tableNameCase: NameCase.none,
          columnNameCase: NameCase.none,
        },
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { customType, integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'const varbit = customType<{ data: string; config: { length?: number } }>({',
        '  dataType: (config) =>',
        '    typeof config?.length === "number"',
        '      ? `bit varying(${config.length})`',
        '      : "bit varying",',
        '});',
        '',
        'export const undefined = pgTable("undefined", {',
        '  id: integer().primaryKey(),',
        '  flags: varbit(),',
        '});',
        '',
      ]);
    });

    it('reads the bit sql server stores a flag in as a boolean', () => {
      expect(createTypeFixture('bit', Database.MSSQL)).toBe('boolean()');
    });

    it('declares a mysql bit field as a type that reads bytes', () => {
      expect(createTypeFixture('BIT(8)', Database.MySQL)).toBe(
        'bit({ length: 8 })'
      );
      expect(createTypeFixture('BIT', Database.MariaDB)).toBe('bit()');
      expect(createTypeCode('BIT(1)', Database.MySQL).slice(3, 6)).toEqual([
        'const bit = customType<{ data: Buffer; config: { length?: number } }>({',
        '  dataType: (config) => `bit(${config?.length ?? 1})`,',
        '});',
      ]);
    });

    it('declares each mysql spatial type under its own name', () => {
      expect(createTypeFixture('GEOMETRY', Database.MySQL)).toBe('geometry()');
      expect(createTypeFixture('POINT', Database.MySQL)).toBe('point()');
      expect(createTypeFixture('MULTIPOLYGON', Database.MariaDB)).toBe(
        'multipolygon()'
      );
      expect(createTypeCode('POINT', Database.MySQL)[3]).toBe(
        'const point = customType<{ data: unknown }>({ dataType: () => "point" });'
      );
    });

    it('declares the mariadb uuid and address types mysql-core has no builder for', () => {
      expect(createTypeFixture('UUID', Database.MariaDB)).toBe('uuid()');
      expect(createTypeFixture('INET4', Database.MariaDB)).toBe('inet4()');
      expect(createTypeFixture('INET6', Database.MariaDB)).toBe('inet6()');
      expect(createTypeCode('UUID', Database.MariaDB).slice(1, 6)).toEqual([
        'import { customType, mysqlTable } from "drizzle-orm/mysql-core";',
        '',
        'const uuid = customType<{ data: string }>({ dataType: () => "uuid" });',
        '',
        'export const Probe = mysqlTable("probe", {',
      ]);
      expect(createTypeFixture('UUID', Database.MySQL)).toBe('text()');
    });

    it('lets the diagram database decide a name two vendors disagree on', () => {
      expect(createTypeFixture('LONG', Database.Databricks)).toBe(
        'bigint({ mode: "number" })'
      );
      expect(createTypeFixture('LONG', Database.Oracle)).toBe('text()');
      expect(createTypeFixture('TIMESTAMP', Database.MSSQL)).toBe('varchar()');
      expect(createTypeFixture('TIMESTAMP', Database.Oracle)).toBe(
        'timestamp()'
      );
      expect(createTypeFixture('datetime', Database.MSSQL)).toBe('timestamp()');
    });

    it('drops an argument no builder could hold', () => {
      expect(
        createTypeFixture(`varchar(${'9'.repeat(400)})`, Database.PostgreSQL)
      ).toBe('varchar()');
      expect(
        createTypeFixture(
          'numeric(999999999999999999999,5)',
          Database.PostgreSQL
        )
      ).toBe('numeric()');
    });
  });

  describe('arrays', () => {
    function createArrayFixture(
      dataType: string,
      database: number = Database.PostgreSQL,
      column: Partial<Column> = {}
    ): string[] {
      const table = createTable({ id: 't1', name: 'probe', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'list',
            dataType,
            ...column,
          }),
        ],
        settings: { database },
      });

      return createCode(state).split('\n');
    }

    function columnLine(lines: string[]): string {
      return lines.find(line => line.startsWith('  list: ')) ?? '';
    }

    it('chains array once per dimension onto the element builder', () => {
      expect(columnLine(createArrayFixture('int[]'))).toBe(
        '  list: integer().array(),'
      );
      expect(columnLine(createArrayFixture('int[][]'))).toBe(
        '  list: integer().array().array(),'
      );
      expect(columnLine(createArrayFixture('int[3][]'))).toBe(
        '  list: integer().array().array(),'
      );
      expect(columnLine(createArrayFixture('integer ARRAY'))).toBe(
        '  list: integer().array(),'
      );
      expect(columnLine(createArrayFixture('integer ARRAY[4]'))).toBe(
        '  list: integer().array(),'
      );
    });

    it('resolves the element with its own arguments and options', () => {
      expect(columnLine(createArrayFixture('varchar(20)[]'))).toBe(
        '  list: varchar({ length: 20 }).array(),'
      );
      expect(columnLine(createArrayFixture('text[]'))).toBe(
        '  list: text().array(),'
      );
      expect(columnLine(createArrayFixture('uuid[]'))).toBe(
        '  list: uuid().array(),'
      );
      expect(columnLine(createArrayFixture('timestamptz(3)[]'))).toBe(
        '  list: timestamp({ withTimezone: true, precision: 3 }).array(),'
      );
      expect(columnLine(createArrayFixture('interval[]'))).toBe(
        '  list: interval().array(),'
      );
      expect(createArrayFixture('bytea[]')).toEqual([
        '',
        'import { customType, pgTable } from "drizzle-orm/pg-core";',
        '',
        'const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });',
        '',
        'export const Probe = pgTable("probe", {',
        '  list: bytea().array(),',
        '});',
        '',
      ]);
    });

    it('chains array onto the pg enum an array of one declares', () => {
      expect(createArrayFixture("enum('a','b')[]")).toEqual([
        '',
        'import { pgEnum, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const ProbeListEnum = pgEnum("probe_list", ["a", "b"]);',
        '',
        'export const Probe = pgTable("probe", {',
        '  list: ProbeListEnum().array(),',
        '});',
        '',
      ]);
    });

    it('reads an array suffix only on postgresql', () => {
      expect(columnLine(createArrayFixture('int[]', Database.MySQL))).toBe(
        '  list: int(),'
      );
      expect(columnLine(createArrayFixture('int[]', Database.MSSQL))).toBe(
        '  list: integer(),'
      );
    });

    it('gives an array key no identity and its default only through sql', () => {
      expect(
        columnLine(
          createArrayFixture('int[]', Database.PostgreSQL, {
            options: ColumnOption.primaryKey | ColumnOption.autoIncrement,
          })
        )
      ).toBe('  list: integer().array().primaryKey(),');
      expect(
        columnLine(
          createArrayFixture('text[]', Database.PostgreSQL, {
            default: "'{a,b}'",
          })
        )
      ).toBe("  list: text().array().default(sql`'{a,b}'`),");
      expect(
        columnLine(
          createArrayFixture('int[]', Database.PostgreSQL, { default: '1' })
        )
      ).toBe('  list: integer().array().default(sql`1`),');
    });
  });

  describe('custom types', () => {
    function createCustomFixture(
      settings: Partial<RootState['settings']> = {}
    ): RootState {
      const first = createTable({
        id: 't1',
        name: 'money',
        columnIds: ['c1', 'c2', 'c3', 'c4'],
      });
      const second = createTable({
        id: 't2',
        name: 'plain',
        columnIds: ['c5'],
      });

      return createState({
        tables: [first, second],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'vector',
            dataType: 'tsvector',
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'amount',
            dataType: 'money',
          }),
          createColumn({
            id: 'c3',
            tableId: 't1',
            name: 'payload',
            dataType: 'bytea',
          }),
          createColumn({
            id: 'c4',
            tableId: 't1',
            name: 'total',
            dataType: 'money',
          }),
          createColumn({
            id: 'c5',
            tableId: 't2',
            name: 'id',
            dataType: 'int',
          }),
        ],
        settings: { database: Database.PostgreSQL, ...settings },
      });
    }

    it('declares each type once, by name, between the imports and the tables', () => {
      expect(createCode(createCustomFixture())).toEqual(
        [
          '',
          'import { customType, integer, pgTable } from "drizzle-orm/pg-core";',
          '',
          'const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });',
          'const money = customType<{ data: string }>({ dataType: () => "money" });',
          'const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });',
          '',
          'export const Money = pgTable("money", {',
          '  vector: tsvector(),',
          '  amount: money(),',
          '  payload: bytea(),',
          '  total: money(),',
          '});',
          '',
          'export const Plain = pgTable("plain", {',
          '  id: integer(),',
          '});',
          '',
        ].join('\n')
      );
    });

    it('carries into one table only the declarations its columns need', () => {
      const state = createCustomFixture();
      const [first, second] = state.doc.tableIds.map(
        id => state.collections.tableEntities[id]
      );

      expect(render(state, first).slice(0, 5)).toEqual([
        'import { customType, pgTable } from "drizzle-orm/pg-core";',
        '',
        'const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });',
        'const money = customType<{ data: string }>({ dataType: () => "money" });',
        'const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });',
      ]);
      expect(render(state, second)).toEqual([
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const Plain = pgTable("plain", {',
        '  id: integer(),',
        '});',
      ]);
    });

    it('numbers a table const that would take the name of a declared type', () => {
      const code = createCode(
        createCustomFixture({ tableNameCase: NameCase.none })
      );

      expect(code).toContain('export const money2 = pgTable("money", {');
      expect(code).toContain('export const plain = pgTable("plain", {');

      const table = createTable({ id: 't1', name: 'money', columnIds: ['c1'] });
      const unused = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
          }),
        ],
        settings: {
          database: Database.PostgreSQL,
          tableNameCase: NameCase.none,
        },
      });

      expect(createCode(unused)).toContain(
        'export const money = pgTable("money", {'
      );
    });

    it('numbers a table const that would take the type a length picks', () => {
      function createLengthFixture(
        name: string,
        dataType: string,
        database: number
      ): string[] {
        const table = createTable({ id: 't1', name, columnIds: ['c1'] });
        const state = createState({
          tables: [table],
          columns: [
            createColumn({
              id: 'c1',
              tableId: 't1',
              name: 'payload',
              dataType,
            }),
          ],
          settings: { database, tableNameCase: NameCase.none },
        });

        return createCode(state).split('\n');
      }

      expect(createLengthFixture('blob', 'VARBINARY', Database.MySQL)).toEqual([
        '',
        'import { customType, mysqlTable } from "drizzle-orm/mysql-core";',
        '',
        'const blob = customType<{ data: Buffer }>({ dataType: () => "blob" });',
        '',
        'export const blob2 = mysqlTable("blob", {',
        '  payload: blob(),',
        '});',
        '',
      ]);
      expect(createLengthFixture('blob', 'RAW', Database.MariaDB)).toContain(
        'export const blob2 = mysqlTable("blob", {'
      );
      expect(
        createLengthFixture('tinyblob', 'BLOB(100)', Database.MySQL)
      ).toContain('export const tinyblob2 = mysqlTable("tinyblob", {');
      expect(
        createLengthFixture('blob', 'BLOB(100)', Database.MySQL)
      ).toContain('export const blob = mysqlTable("blob", {');
    });

    it('passes a quoted default to a type that reads text, and sql to one that reads bytes', () => {
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
            name: 'flags',
            dataType: 'bit(4)',
            default: "'1010'",
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'payload',
            dataType: 'bytea',
            default: "'\\x00'",
          }),
        ],
        settings: { database: Database.PostgreSQL },
      });
      const lines = createCode(state).split('\n');

      expect(lines).toContain('  flags: bit({ length: 4 }).default("1010"),');
      expect(lines).toContain("  payload: bytea().default(sql`'\\\\x00'`),");
    });
  });

  describe('enum columns', () => {
    function createEnumFixture(
      dataType: string,
      database: number,
      name = 'grade'
    ): string[] {
      const table = createTable({ id: 't1', name: 'probe', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [createColumn({ id: 'c1', tableId: 't1', name, dataType })],
        settings: { database },
      });

      return createCode(state).split('\n');
    }

    function createTwoColumnFixture(): string[] {
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
            name: 'rating',
            dataType: "enum('G','R')",
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'status',
            dataType: "enum('on','off')",
          }),
        ],
        settings: { database: Database.PostgreSQL },
      });

      return createCode(state).split('\n');
    }

    function createTwoTableFixture(): string[] {
      const first = createTable({ id: 't1', name: 'movie', columnIds: ['c1'] });
      const second = createTable({
        id: 't2',
        name: 'movie',
        columnIds: ['c2'],
      });
      const state = createState({
        tables: [first, second],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'rating',
            dataType: "enum('G','R')",
          }),
          createColumn({
            id: 'c2',
            tableId: 't2',
            name: 'rating',
            dataType: "enum('a','b')",
          }),
        ],
        settings: { database: Database.PostgreSQL },
      });

      return createCode(state).split('\n');
    }

    it('declares a pg enum above the table and calls the const as the builder', () => {
      expect(createEnumFixture("enum('a','b')", Database.PostgreSQL)).toEqual([
        '',
        'import { pgEnum, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const ProbeGradeEnum = pgEnum("probe_grade", ["a", "b"]);',
        '',
        'export const Probe = pgTable("probe", {',
        '  grade: ProbeGradeEnum(),',
        '});',
        '',
      ]);
    });

    it('gives two enum columns of one table their own const and pg type name', () => {
      expect(createTwoColumnFixture()).toEqual([
        '',
        'import { pgEnum, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const MovieRatingEnum = pgEnum("movie_rating", ["G", "R"]);',
        '',
        'export const MovieStatusEnum = pgEnum("movie_status", ["on", "off"]);',
        '',
        'export const Movie = pgTable("movie", {',
        '  rating: MovieRatingEnum(),',
        '  status: MovieStatusEnum(),',
        '});',
        '',
      ]);
    });

    it('keeps the enums of two tables that share a name apart', () => {
      expect(createTwoTableFixture()).toEqual([
        '',
        'import { pgEnum, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const MovieRatingEnum = pgEnum("movie_rating", ["G", "R"]);',
        '',
        'export const Movie = pgTable("movie", {',
        '  rating: MovieRatingEnum(),',
        '});',
        '',
        'export const MovieRatingEnum2 = pgEnum("movie_rating2", ["a", "b"]);',
        '',
        'export const Movie2 = pgTable("movie", {',
        '  rating: MovieRatingEnum2(),',
        '});',
        '',
      ]);
    });

    it('numbers a pg enum type past the row type a table of its name holds', () => {
      const user = createTable({
        id: 't1',
        name: 'user',
        columnIds: ['c1'],
      });
      const userRole = createTable({ id: 't2', name: 'user_role' });
      const state = createState({
        tables: [user, userRole],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'role',
            dataType: "enum('a','b')",
          }),
        ],
        settings: { database: Database.PostgreSQL },
      });

      expect(createCode(state).split('\n').slice(3, 4)).toEqual([
        'export const UserRoleEnum = pgEnum("user_role2", ["a", "b"]);',
      ]);
      state.settings.database = Database.Oracle;
      expect(render(state, user)[2]).toBe(
        'export const UserRoleEnum = pgEnum("user_role2", ["a", "b"]);'
      );
      userRole.name = 'User_Role';
      expect(render(state, user)[2]).toBe(
        'export const UserRoleEnum = pgEnum("user_role", ["a", "b"]);'
      );
    });

    it('carries the members inline on mysql and always names the column', () => {
      expect(createEnumFixture("enum('a','b')", Database.MySQL)).toEqual([
        '',
        'import { mysqlEnum, mysqlTable } from "drizzle-orm/mysql-core";',
        '',
        'export const Probe = mysqlTable("probe", {',
        '  grade: mysqlEnum("grade", ["a", "b"]),',
        '});',
        '',
      ]);
      expect(
        createEnumFixture("enum('a','b')", Database.MySQL, 'my grade')
      ).toContain('  myGrade: mysqlEnum("my grade", ["a", "b"]),');
    });

    it('carries the members as a text option on sqlite', () => {
      expect(createEnumFixture("enum('a','b')", Database.SQLite)).toEqual([
        '',
        'import { sqliteTable, text } from "drizzle-orm/sqlite-core";',
        '',
        'export const Probe = sqliteTable("probe", {',
        '  grade: text({ enum: ["a", "b"] }),',
        '});',
        '',
      ]);
    });

    it('reads a member list written with double quotes', () => {
      expect(createEnumFixture('enum("a","b")', Database.PostgreSQL)).toEqual([
        '',
        'import { pgEnum, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const ProbeGradeEnum = pgEnum("probe_grade", ["a", "b"]);',
        '',
        'export const Probe = pgTable("probe", {',
        '  grade: ProbeGradeEnum(),',
        '});',
        '',
      ]);
    });

    it('keeps a quote a member doubles to escape it', () => {
      expect(
        createEnumFixture("enum('it''s','b')", Database.PostgreSQL)
      ).toContain(
        'export const ProbeGradeEnum = pgEnum("probe_grade", ["it\'s", "b"]);'
      );
      expect(
        createEnumFixture('enum("a""b","c")', Database.PostgreSQL)
      ).toContain(
        'export const ProbeGradeEnum = pgEnum("probe_grade", ["a\\"b", "c"]);'
      );
    });

    it('declares a mysql set with its members, and leaves one elsewhere as text', () => {
      expect(createEnumFixture("set('a','b')", Database.PostgreSQL)).toEqual([
        '',
        'import { pgTable, varchar } from "drizzle-orm/pg-core";',
        '',
        'export const Probe = pgTable("probe", {',
        '  grade: varchar(),',
        '});',
        '',
      ]);
      expect(
        createEnumFixture("set('a','b''c','d\\\\e')", Database.MySQL)
      ).toEqual([
        '',
        'import { customType, mysqlTable } from "drizzle-orm/mysql-core";',
        '',
        'const set = customType<{',
        '  data: string;',
        '  config: { values: string[] };',
        '  configRequired: true;',
        '}>({',
        '  dataType: (config) =>',
        '    `set(${config.values',
        "      .map((value) => `'${value.replace(/\\\\/g, \"\\\\\\\\\").replace(/'/g, \"''\")}'`)",
        '      .join(",")})`,',
        '});',
        '',
        'export const Probe = mysqlTable("probe", {',
        '  grade: set({ values: ["a", "b\'c", "d\\\\e"] }),',
        '});',
        '',
      ]);
      expect(createEnumFixture('set', Database.MySQL)).toContain(
        '  grade: text(),'
      );
    });

    it('reads a member as mysql reads a string literal, backslash escapes too', () => {
      expect(createEnumFixture("enum('a\\'b')", Database.MySQL)).toContain(
        '  grade: mysqlEnum("grade", ["a\'b"]),'
      );
      expect(createEnumFixture("enum('a", Database.MySQL)).toContain(
        '  grade: text(),'
      );
    });

    it('writes a backslash in a mysql enum member twice, as its DDL needs', () => {
      const dataType = String.raw`ENUM('a\\','\\','c\\d','e\%')`;

      expect(createEnumFixture(dataType, Database.MySQL)).toContain(
        String.raw`  grade: mysqlEnum("grade", ["a\\\\", "\\\\", "c\\\\d", "e\\\\%"]),`
      );
      expect(createEnumFixture(dataType, Database.MariaDB)).toContain(
        String.raw`  grade: mysqlEnum("grade", ["a\\\\", "\\\\", "c\\\\d", "e\\\\%"]),`
      );
      expect(
        createEnumFixture(String.raw`ENUM('a\\')`, Database.PostgreSQL)
      ).toContain(
        String.raw`export const ProbeGradeEnum = pgEnum("probe_grade", ["a\\"]);`
      );
      expect(
        createEnumFixture(String.raw`ENUM('a\\')`, Database.SQLite)
      ).toContain(String.raw`  grade: text({ enum: ["a\\"] }),`);
    });

    it('keeps each line break in a member as its own escape', () => {
      expect(
        createEnumFixture("ENUM('a\\rb','c\\r\\nd','e\\nf')", Database.MySQL)
      ).toContain(
        '  grade: mysqlEnum("grade", ["a\\rb", "c\\r\\nd", "e\\nf"]),'
      );
      expect(
        createEnumFixture("SET('a\\rb','c\\r\\nd','e\\nf')", Database.MySQL)
      ).toContain('  grade: set({ values: ["a\\rb", "c\\r\\nd", "e\\nf"] }),');
      expect(
        createEnumFixture(
          `enum('a${LINE_SEPARATOR}b','c${PARAGRAPH_SEPARATOR}d')`,
          Database.PostgreSQL
        )
      ).toContain(
        'export const ProbeGradeEnum = pgEnum("probe_grade", ["a\\u2028b", "c\\u2029d"]);'
      );
    });

    it('falls back to the ordinary type path for a list it cannot read', () => {
      expect(createEnumFixture('enum(a, b)', Database.PostgreSQL)).toEqual([
        '',
        'import { pgTable, varchar } from "drizzle-orm/pg-core";',
        '',
        'export const Probe = pgTable("probe", {',
        '  grade: varchar(),',
        '});',
        '',
      ]);
      expect(createEnumFixture('enum()', Database.PostgreSQL)).toContain(
        '  grade: varchar(),'
      );
      expect(createEnumFixture('enum', Database.MySQL)).toContain(
        '  grade: text(),'
      );
    });

    it('reads a member that carries the character closing the list', () => {
      expect(createEnumFixture("enum('x)y','z')", Database.PostgreSQL)).toEqual(
        [
          '',
          'import { pgEnum, pgTable } from "drizzle-orm/pg-core";',
          '',
          'export const ProbeGradeEnum = pgEnum("probe_grade", ["x)y", "z"]);',
          '',
          'export const Probe = pgTable("probe", {',
          '  grade: ProbeGradeEnum(),',
          '});',
          '',
        ]
      );
    });
  });

  describe('constraints', () => {
    function createKeyFixture(
      database: number,
      options: number,
      dataType = 'int'
    ): string[] {
      const table = createTable({ id: 't1', name: 'probe', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType,
            options,
          }),
        ],
        settings: { database },
      });

      return createCode(state).split('\n');
    }

    function createCompositeFixture(database: number, options = 0): string[] {
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
            name: 'a_id',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'b_id',
            dataType: 'int',
            options: ColumnOption.primaryKey | options,
          }),
        ],
        settings: { database },
      });

      return createCode(state).split('\n');
    }

    function createDefaultKeyFixture(database: number): string[] {
      const table = createTable({ id: 't1', name: 'probe', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
            default: '7',
            options: ColumnOption.primaryKey | ColumnOption.autoIncrement,
          }),
        ],
        settings: { database },
      });

      return createCode(state).split('\n');
    }

    it('states primaryKey alone for a single key column that is also NOT NULL', () => {
      expect(
        createKeyFixture(
          Database.PostgreSQL,
          ColumnOption.primaryKey | ColumnOption.notNull
        )
      ).toEqual([
        '',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const Probe = pgTable("probe", {',
        '  id: integer().primaryKey(),',
        '});',
        '',
      ]);
    });

    it('moves a composite key into the extra config and states notNull on every member', () => {
      expect(createCompositeFixture(Database.PostgreSQL)).toEqual([
        '',
        'import { integer, pgTable, primaryKey } from "drizzle-orm/pg-core";',
        '',
        'export const Probe = pgTable(',
        '  "probe",',
        '  {',
        '    aId: integer("a_id").notNull(),',
        '    bId: integer("b_id").notNull(),',
        '  },',
        '  table => [primaryKey({ columns: [table.aId, table.bId] })]',
        ');',
        '',
      ]);
    });

    it('keeps autoincrement beside notNull on a composite key member', () => {
      expect(
        createCompositeFixture(Database.MySQL, ColumnOption.autoIncrement)
      ).toEqual([
        '',
        'import { int, mysqlTable, primaryKey } from "drizzle-orm/mysql-core";',
        '',
        'export const Probe = mysqlTable(',
        '  "probe",',
        '  {',
        '    aId: int("a_id").notNull(),',
        '    bId: int("b_id").autoincrement().notNull(),',
        '  },',
        '  table => [primaryKey({ columns: [table.aId, table.bId] })]',
        ');',
        '',
      ]);
    });

    it('marks a unique column but never one that is already a key', () => {
      expect(
        createKeyFixture(
          Database.PostgreSQL,
          ColumnOption.unique | ColumnOption.notNull,
          'varchar(255)'
        )
      ).toContain('  id: varchar({ length: 255 }).notNull().unique(),');
      expect(
        createKeyFixture(
          Database.PostgreSQL,
          ColumnOption.unique | ColumnOption.primaryKey
        )
      ).toContain('  id: integer().primaryKey(),');
    });

    it('names the auto-increment marker each dialect spells', () => {
      const options = ColumnOption.primaryKey | ColumnOption.autoIncrement;

      expect(createKeyFixture(Database.PostgreSQL, options)).toContain(
        '  id: integer().primaryKey().generatedAlwaysAsIdentity(),'
      );
      expect(createKeyFixture(Database.MySQL, options)).toContain(
        '  id: int().autoincrement().primaryKey(),'
      );
      expect(createKeyFixture(Database.SQLite, options)).toContain(
        '  id: integer().primaryKey({ autoIncrement: true }),'
      );
    });

    it('drops auto-increment from a builder that cannot carry it', () => {
      const options = ColumnOption.primaryKey | ColumnOption.autoIncrement;

      expect(createKeyFixture(Database.PostgreSQL, options, 'uuid')).toContain(
        '  id: uuid().primaryKey(),'
      );
      expect(
        createKeyFixture(Database.PostgreSQL, options, 'varchar(10)')
      ).toContain('  id: varchar({ length: 10 }).primaryKey(),');
      expect(
        createKeyFixture(Database.PostgreSQL, options, 'serial')
      ).toContain('  id: serial().primaryKey(),');
    });

    it('suppresses the default value of an auto-increment key', () => {
      expect(createDefaultKeyFixture(Database.PostgreSQL)).toEqual([
        '',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const Probe = pgTable("probe", {',
        '  id: integer().primaryKey().generatedAlwaysAsIdentity(),',
        '});',
        '',
      ]);
      expect(createDefaultKeyFixture(Database.MySQL)).toContain(
        '  id: int().autoincrement().primaryKey(),'
      );
      expect(createDefaultKeyFixture(Database.SQLite)).toContain(
        '  id: integer().primaryKey({ autoIncrement: true }),'
      );
    });

    it('keeps the default of a SQLite column auto-increment cannot mark', () => {
      const table = createTable({ id: 't1', name: 'probe', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'seq',
            dataType: 'int',
            default: '5',
            options: ColumnOption.autoIncrement,
          }),
        ],
        settings: { database: Database.SQLite },
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { integer, sqliteTable } from "drizzle-orm/sqlite-core";',
        '',
        'export const Probe = sqliteTable("probe", {',
        '  seq: integer().default(5),',
        '});',
        '',
      ]);
    });

    it('keeps unique on a column the composite key only shares', () => {
      expect(
        createCompositeFixture(Database.PostgreSQL, ColumnOption.unique)
      ).toEqual([
        '',
        'import { integer, pgTable, primaryKey } from "drizzle-orm/pg-core";',
        '',
        'export const Probe = pgTable(',
        '  "probe",',
        '  {',
        '    aId: integer("a_id").notNull(),',
        '    bId: integer("b_id").notNull().unique(),',
        '  },',
        '  table => [primaryKey({ columns: [table.aId, table.bId] })]',
        ');',
        '',
      ]);
    });

    it('spells a mariadb serial out as the unsigned bigint it stands for', () => {
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
            name: 'id',
            dataType: 'SERIAL',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'seq',
            dataType: 'serial',
            default: '7',
          }),
          createColumn({
            id: 'c3',
            tableId: 't1',
            name: 'tally',
            dataType: 'SERIAL',
            options: ColumnOption.notNull | ColumnOption.unique,
          }),
        ],
        settings: { database: Database.MariaDB },
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { bigint, mysqlTable } from "drizzle-orm/mysql-core";',
        '',
        'export const Probe = mysqlTable("probe", {',
        '  id: bigint({ mode: "number", unsigned: true }).autoincrement().primaryKey(),',
        '  seq: bigint({ mode: "number", unsigned: true })',
        '    .autoincrement()',
        '    .notNull()',
        '    .unique(),',
        '  tally: bigint({ mode: "number", unsigned: true })',
        '    .autoincrement()',
        '    .notNull()',
        '    .unique(),',
        '});',
        '',
      ]);
    });

    it('keeps a mariadb serial in a composite key unique, and mysql serial as is', () => {
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
            name: 'a_id',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'b_id',
            dataType: 'SERIAL',
            options: ColumnOption.primaryKey,
          }),
        ],
        settings: { database: Database.MariaDB },
      });

      expect(render(state, table).slice(2, 10)).toEqual([
        'export const Probe = mysqlTable(',
        '  "probe",',
        '  {',
        '    aId: int("a_id").notNull(),',
        '    bId: bigint("b_id", { mode: "number", unsigned: true })',
        '      .autoincrement()',
        '      .notNull()',
        '      .unique(),',
      ]);
      expect(
        createKeyFixture(Database.MySQL, ColumnOption.primaryKey, 'SERIAL')
      ).toContain('  id: serial().primaryKey(),');
    });
  });

  describe('default values', () => {
    function createDefaultFixture(
      value: string,
      dataType: string,
      database: number = Database.PostgreSQL
    ): string[] {
      const table = createTable({ id: 't1', name: 'probe', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'value',
            dataType,
            default: value,
          }),
        ],
        settings: { database },
      });

      return createCode(state).split('\n');
    }

    it('passes a bare integer literal to a builder whose type is a number', () => {
      expect(createDefaultFixture('0', 'int')).toEqual([
        '',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const Probe = pgTable("probe", {',
        '  value: integer().default(0),',
        '});',
        '',
      ]);
      expect(createDefaultFixture('-3', 'int')).toContain(
        '  value: integer().default(-3),'
      );
    });

    it('quotes the same literal for a builder whose type is a string', () => {
      expect(createDefaultFixture('0', 'numeric(10,2)')).toEqual([
        '',
        'import { numeric, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const Probe = pgTable("probe", {',
        '  value: numeric({ precision: 10, scale: 2 }).default("0"),',
        '});',
        '',
      ]);
    });

    it('unquotes a SQL string literal for a string builder', () => {
      expect(createDefaultFixture("'hi'", 'varchar(10)')).toEqual([
        '',
        'import { pgTable, varchar } from "drizzle-orm/pg-core";',
        '',
        'export const Probe = pgTable("probe", {',
        '  value: varchar({ length: 10 }).default("hi"),',
        '});',
        '',
      ]);
      expect(createDefaultFixture("'it''s'", 'varchar(10)')).toContain(
        '  value: varchar({ length: 10 }).default("it\'s"),'
      );
    });

    it('passes true and false to a boolean builder whatever their case', () => {
      expect(createDefaultFixture('true', 'boolean')).toEqual([
        '',
        'import { boolean, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const Probe = pgTable("probe", {',
        '  value: boolean().default(true),',
        '});',
        '',
      ]);
      expect(createDefaultFixture('FALSE', 'boolean')).toContain(
        '  value: boolean().default(false),'
      );
    });

    it('passes 1 and 0 to a boolean builder as true and false', () => {
      expect(createDefaultFixture('1', 'boolean')).toEqual([
        '',
        'import { boolean, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const Probe = pgTable("probe", {',
        '  value: boolean().default(true),',
        '});',
        '',
      ]);
      expect(createDefaultFixture('0', 'bit', Database.MSSQL)).toContain(
        '  value: boolean().default(false),'
      );
      expect(createDefaultFixture('1', 'boolean', Database.MySQL)).toContain(
        '  value: boolean().default(true),'
      );
      expect(createDefaultFixture('0', 'boolean', Database.SQLite)).toContain(
        '  value: integer({ mode: "boolean" }).default(false),'
      );
      expect(createDefaultFixture('2', 'boolean')).toContain(
        '  value: boolean().default(sql`2`),'
      );
    });

    it('passes an enum member as a plain string on every dialect', () => {
      expect(createDefaultFixture("'a'", "enum('a','b')")).toContain(
        '  value: ProbeValueEnum().default("a"),'
      );
      expect(
        createDefaultFixture("'a'", "enum('a','b')", Database.MySQL)
      ).toContain('  value: mysqlEnum("value", ["a", "b"]).default("a"),');
      expect(
        createDefaultFixture("'a'", "enum('a','b')", Database.SQLite)
      ).toContain('  value: text({ enum: ["a", "b"] }).default("a"),');
    });

    it('passes a mysql enum member holding a backslash as its DDL spells it', () => {
      expect(
        createDefaultFixture(
          String.raw`'a\\'`,
          String.raw`ENUM('a\\','b')`,
          Database.MySQL
        )
      ).toContain(
        String.raw`  value: mysqlEnum("value", ["a\\\\", "b"]).default("a\\\\"),`
      );
    });

    it('wraps a value the enum does not list in the sql template', () => {
      expect(createDefaultFixture("'z'", "enum('a','b')")).toEqual([
        '',
        'import { sql } from "drizzle-orm";',
        'import { pgEnum, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const ProbeValueEnum = pgEnum("probe_value", ["a", "b"]);',
        '',
        'export const Probe = pgTable("probe", {',
        "  value: ProbeValueEnum().default(sql`'z'`),",
        '});',
        '',
      ]);
    });

    it('wraps a function call in the sql template and imports the helper', () => {
      expect(createDefaultFixture('gen_random_uuid()', 'uuid')).toEqual([
        '',
        'import { sql } from "drizzle-orm";',
        'import { pgTable, uuid } from "drizzle-orm/pg-core";',
        '',
        'export const Probe = pgTable("probe", {',
        '  value: uuid().default(sql`gen_random_uuid()`),',
        '});',
        '',
      ]);
    });

    it('wraps a literal whose leading zeros a number would drop', () => {
      expect(createDefaultFixture('007', 'int')).toEqual([
        '',
        'import { sql } from "drizzle-orm";',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const Probe = pgTable("probe", {',
        '  value: integer().default(sql`007`),',
        '});',
        '',
      ]);
      expect(createDefaultFixture("'5'", 'int')).toContain(
        "  value: integer().default(sql`'5'`),"
      );
    });

    it('wraps a literal double precision cannot hold but keeps one it can', () => {
      expect(createDefaultFixture('12345678901234567890', 'int')).toContain(
        '  value: integer().default(sql`12345678901234567890`),'
      );
      expect(createDefaultFixture('1.50', 'real')).toContain(
        '  value: real().default(1.50),'
      );
    });

    it('escapes a backtick and an interpolation inside the sql template', () => {
      expect(createDefaultFixture('a`b${c}', 'varchar(10)')).toEqual([
        '',
        'import { sql } from "drizzle-orm";',
        'import { pgTable, varchar } from "drizzle-orm/pg-core";',
        '',
        'export const Probe = pgTable("probe", {',
        '  value: varchar({ length: 10 }).default(sql`a\\`b\\${c}`),',
        '});',
        '',
      ]);
    });

    it('keeps each line break of a default and a name as its own escape', () => {
      expect(
        createDefaultFixture(`'a\r\nb\rc\nd${LINE_SEPARATOR}e'`, 'varchar(10)')
      ).toContain(
        '  value: varchar({ length: 10 }).default("a\\r\\nb\\rc\\nd\\u2028e"),'
      );
      expect(
        createDefaultFixture(`'a\rb${PARAGRAPH_SEPARATOR}c'`, 'int')
      ).toContain("  value: integer().default(sql`'a\\rb\\u2029c'`),");

      const table = createTable({
        id: 't1',
        name: 'line\r\nbreak',
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
          }),
        ],
        settings: { database: Database.PostgreSQL },
      });

      expect(createCode(state)).toContain('pgTable("line\\r\\nbreak", {');
    });

    it('emits no modifier at all for a default that is only whitespace', () => {
      expect(createDefaultFixture('   ', 'int')).toEqual([
        '',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const Probe = pgTable("probe", {',
        '  value: integer(),',
        '});',
        '',
      ]);
    });
  });

  describe('relationships', () => {
    function createKeyColumn(id: string, tableId: string) {
      return createColumn({
        id,
        tableId,
        name: 'id',
        dataType: 'int',
        options: ColumnOption.primaryKey | ColumnOption.autoIncrement,
        ui: { keys: ColumnUIKey.primaryKey },
      });
    }

    function createRefColumn(id: string, tableId: string, name: string) {
      return createColumn({
        id,
        tableId,
        name,
        dataType: 'int',
        ui: { keys: ColumnUIKey.foreignKey },
      });
    }

    function createTeamFixture(
      relationshipType: number = RelationshipType.ZeroN
    ) {
      const team = createTable({ id: 't1', name: 'team', columnIds: ['c1'] });
      const user = createTable({
        id: 't2',
        name: 'user',
        columnIds: ['c2', 'c3'],
      });
      const state = createState({
        tables: [team, user],
        columns: [
          createKeyColumn('c1', 't1'),
          createKeyColumn('c2', 't2'),
          createRefColumn('c3', 't2', 'team_id'),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType,
            start: { tableId: 't1', columnIds: ['c1'] },
            end: { tableId: 't2', columnIds: ['c3'] },
          }),
        ],
        settings: { database: Database.PostgreSQL },
      });

      return { state, team, user };
    }

    function createChainFixture() {
      const team = createTable({ id: 't1', name: 'team', columnIds: ['c1'] });
      const user = createTable({
        id: 't2',
        name: 'user',
        columnIds: ['c2', 'c3'],
      });
      const post = createTable({
        id: 't3',
        name: 'post',
        columnIds: ['c4', 'c5'],
      });
      const state = createState({
        tables: [team, user, post],
        columns: [
          createKeyColumn('c1', 't1'),
          createKeyColumn('c2', 't2'),
          createRefColumn('c3', 't2', 'team_id'),
          createKeyColumn('c4', 't3'),
          createRefColumn('c5', 't3', 'user_id'),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't1', columnIds: ['c1'] },
            end: { tableId: 't2', columnIds: ['c3'] },
          }),
          createRelationship({
            id: 'r2',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't2', columnIds: ['c2'] },
            end: { tableId: 't3', columnIds: ['c5'] },
          }),
        ],
        settings: { database: Database.PostgreSQL },
      });

      return { state, team, user, post };
    }

    it('pairs a one() on the child with a many() on the parent', () => {
      const { state } = createTeamFixture();

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { relations } from "drizzle-orm";',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const Team = pgTable("team", {',
        '  id: integer().primaryKey().generatedAlwaysAsIdentity(),',
        '});',
        '',
        'export const TeamRelations = relations(Team, ({ many }) => ({',
        '  userList: many(User),',
        '}));',
        '',
        'export const User = pgTable("user", {',
        '  id: integer().primaryKey().generatedAlwaysAsIdentity(),',
        '  teamId: integer("team_id").references(() => Team.id),',
        '});',
        '',
        'export const UserRelations = relations(User, ({ one }) => ({',
        '  team: one(Team, { fields: [User.teamId], references: [Team.id] }),',
        '}));',
        '',
      ]);
    });

    it('gives a one-to-one a one() on each of its two ends', () => {
      const { state } = createTeamFixture(RelationshipType.ZeroOne);

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { relations } from "drizzle-orm";',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const Team = pgTable("team", {',
        '  id: integer().primaryKey().generatedAlwaysAsIdentity(),',
        '});',
        '',
        'export const TeamRelations = relations(Team, ({ one }) => ({',
        '  user: one(User),',
        '}));',
        '',
        'export const User = pgTable("user", {',
        '  id: integer().primaryKey().generatedAlwaysAsIdentity(),',
        '  teamId: integer("team_id").references(() => Team.id),',
        '});',
        '',
        'export const UserRelations = relations(User, ({ one }) => ({',
        '  team: one(Team, { fields: [User.teamId], references: [Team.id] }),',
        '}));',
        '',
      ]);
    });

    it('destructures only the helpers a relations const goes on to call', () => {
      const { state } = createChainFixture();

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { relations } from "drizzle-orm";',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const Post = pgTable("post", {',
        '  id: integer().primaryKey().generatedAlwaysAsIdentity(),',
        '  userId: integer("user_id").references(() => User.id),',
        '});',
        '',
        'export const PostRelations = relations(Post, ({ one }) => ({',
        '  user: one(User, { fields: [Post.userId], references: [User.id] }),',
        '}));',
        '',
        'export const Team = pgTable("team", {',
        '  id: integer().primaryKey().generatedAlwaysAsIdentity(),',
        '});',
        '',
        'export const TeamRelations = relations(Team, ({ many }) => ({',
        '  userList: many(User),',
        '}));',
        '',
        'export const User = pgTable("user", {',
        '  id: integer().primaryKey().generatedAlwaysAsIdentity(),',
        '  teamId: integer("team_id").references(() => Team.id),',
        '});',
        '',
        'export const UserRelations = relations(User, ({ one, many }) => ({',
        '  team: one(Team, { fields: [User.teamId], references: [Team.id] }),',
        '  postList: many(Post),',
        '}));',
        '',
      ]);
    });

    it('rides a single-column foreign key on the column that owns it', () => {
      const { state, user } = createTeamFixture();

      expect(render(state, user)).toEqual([
        'import { relations } from "drizzle-orm";',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const User = pgTable("user", {',
        '  id: integer().primaryKey().generatedAlwaysAsIdentity(),',
        '  teamId: integer("team_id").references(() => Team.id),',
        '});',
        '',
        'export const UserRelations = relations(User, ({ one }) => ({',
        '  team: one(Team, { fields: [User.teamId], references: [Team.id] }),',
        '}));',
      ]);
    });

    it('drops a relationship whose columns are gone from the document', () => {
      const { state } = createTeamFixture();
      state.collections.relationshipEntities.r1.end.columnIds = ['missing'];

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const Team = pgTable("team", {',
        '  id: integer().primaryKey().generatedAlwaysAsIdentity(),',
        '});',
        '',
        'export const User = pgTable("user", {',
        '  id: integer().primaryKey().generatedAlwaysAsIdentity(),',
        '  teamId: integer("team_id"),',
        '});',
        '',
      ]);
    });

    it('drops a relationship reaching a table the document does not list', () => {
      const { state } = createTeamFixture();
      state.doc.tableIds = ['t2'];

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const User = pgTable("user", {',
        '  id: integer().primaryKey().generatedAlwaysAsIdentity(),',
        '  teamId: integer("team_id"),',
        '});',
        '',
      ]);
    });

    it('leaves out the relations const for an unrelated table', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'user', columnIds: ['c1'] })],
        columns: [createKeyColumn('c1', 't1')],
        settings: { database: Database.PostgreSQL },
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const User = pgTable("user", {',
        '  id: integer().primaryKey().generatedAlwaysAsIdentity(),',
        '});',
        '',
      ]);
    });
  });

  describe('self-referential relationships', () => {
    function createCategoryFixture() {
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
            ui: { keys: ColumnUIKey.primaryKey },
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'parent_id',
            dataType: 'int',
            ui: { keys: ColumnUIKey.foreignKey },
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
        settings: { database: Database.PostgreSQL },
      });

      return { state, table };
    }

    function createNodeFixture() {
      const table = createTable({
        id: 't1',
        name: 'node',
        columnIds: ['c1', 'c2', 'c3', 'c4'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'space',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'code',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'c3',
            tableId: 't1',
            name: 'parent_space',
            dataType: 'int',
            ui: { keys: ColumnUIKey.foreignKey },
          }),
          createColumn({
            id: 'c4',
            tableId: 't1',
            name: 'parent_code',
            dataType: 'int',
            ui: { keys: ColumnUIKey.foreignKey },
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't1', columnIds: ['c1', 'c2'] },
            end: { tableId: 't1', columnIds: ['c3', 'c4'] },
          }),
        ],
        settings: { database: Database.PostgreSQL },
      });

      return { state, table };
    }

    it('names the owning property after the parent it points back to', () => {
      const { state } = createCategoryFixture();

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { relations } from "drizzle-orm";',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        'import type { AnyPgColumn } from "drizzle-orm/pg-core";',
        '',
        'export const Category = pgTable("category", {',
        '  id: integer().primaryKey().generatedAlwaysAsIdentity(),',
        '  parentId: integer("parent_id").references((): AnyPgColumn => Category.id),',
        '});',
        '',
        'export const CategoryRelations = relations(Category, ({ one, many }) => ({',
        '  parentCategory: one(Category, {',
        '    fields: [Category.parentId],',
        '    references: [Category.id],',
        '    relationName: "Category_parentCategory",',
        '  }),',
        '  categoryList: many(Category, { relationName: "Category_parentCategory" }),',
        '}));',
        '',
      ]);
    });

    it('states the column type the reference resolves to and imports it', () => {
      const { state, table } = createCategoryFixture();

      expect(render(state, table)).toContain(
        '  parentId: integer("parent_id").references((): AnyPgColumn => Category.id),'
      );
      expect(render(state, table)).toContain(
        'import type { AnyPgColumn } from "drizzle-orm/pg-core";'
      );
    });

    it('reaches a composite self reference through the callback parameter', () => {
      const { state } = createNodeFixture();

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { foreignKey, integer, pgTable, primaryKey } from "drizzle-orm/pg-core";',
        '',
        'export const Node = pgTable(',
        '  "node",',
        '  {',
        '    space: integer().notNull(),',
        '    code: integer().notNull(),',
        '    parentSpace: integer("parent_space"),',
        '    parentCode: integer("parent_code"),',
        '  },',
        '  table => [',
        '    primaryKey({ columns: [table.space, table.code] }),',
        '    foreignKey({',
        '      columns: [table.parentSpace, table.parentCode],',
        '      foreignColumns: [table.space, table.code],',
        '    }),',
        '  ]',
        ');',
        '',
      ]);
    });

    it('spells one relationName across the two ends it has to pair', () => {
      const { state, table } = createCategoryFixture();

      expect(render(state, table)).toContain(
        '    relationName: "Category_parentCategory",'
      );
      expect(render(state, table)).toContain(
        '  categoryList: many(Category, { relationName: "Category_parentCategory" }),'
      );
    });
  });

  describe('reference cycles', () => {
    function createMutualFixture(settings?: Partial<RootState['settings']>) {
      const team = createTable({
        id: 't1',
        name: 'team',
        columnIds: ['c1', 'c2'],
      });
      const user = createTable({
        id: 't2',
        name: 'user',
        columnIds: ['c3', 'c4'],
      });
      const state = createState({
        tables: [team, user],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey | ColumnOption.autoIncrement,
            ui: { keys: ColumnUIKey.primaryKey },
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'lead_id',
            dataType: 'int',
            ui: { keys: ColumnUIKey.foreignKey },
          }),
          createColumn({
            id: 'c3',
            tableId: 't2',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey | ColumnOption.autoIncrement,
            ui: { keys: ColumnUIKey.primaryKey },
          }),
          createColumn({
            id: 'c4',
            tableId: 't2',
            name: 'team_id',
            dataType: 'int',
            ui: { keys: ColumnUIKey.foreignKey },
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't1', columnIds: ['c1'] },
            end: { tableId: 't2', columnIds: ['c4'] },
          }),
          createRelationship({
            id: 'r2',
            relationshipType: RelationshipType.ZeroOne,
            start: { tableId: 't2', columnIds: ['c3'] },
            end: { tableId: 't1', columnIds: ['c2'] },
          }),
        ],
        settings: { database: Database.PostgreSQL, ...settings },
      });

      return { state, team, user };
    }

    function createCompositePairFixture() {
      const team = createTable({
        id: 't1',
        name: 'team',
        columnIds: ['c1', 'c2', 'c3', 'c4'],
      });
      const user = createTable({
        id: 't2',
        name: 'user',
        columnIds: ['c5', 'c6', 'c7', 'c8'],
      });
      const key = (id: string, tableId: string, name: string) =>
        createColumn({
          id,
          tableId,
          name,
          dataType: 'int',
          options: ColumnOption.primaryKey,
        });
      const ref = (id: string, tableId: string, name: string) =>
        createColumn({
          id,
          tableId,
          name,
          dataType: 'int',
          ui: { keys: ColumnUIKey.foreignKey },
        });
      const state = createState({
        tables: [team, user],
        columns: [
          key('c1', 't1', 'a'),
          key('c2', 't1', 'b'),
          ref('c3', 't1', 'ux'),
          ref('c4', 't1', 'uy'),
          key('c5', 't2', 'x'),
          key('c6', 't2', 'y'),
          ref('c7', 't2', 'ta'),
          ref('c8', 't2', 'tb'),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't1', columnIds: ['c1', 'c2'] },
            end: { tableId: 't2', columnIds: ['c7', 'c8'] },
          }),
          createRelationship({
            id: 'r2',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't2', columnIds: ['c5', 'c6'] },
            end: { tableId: 't1', columnIds: ['c3', 'c4'] },
          }),
        ],
        settings: { database: Database.PostgreSQL },
      });

      return { state, team, user };
    }

    function createLineFixture() {
      const team = createTable({ id: 't1', name: 'team', columnIds: ['c1'] });
      const user = createTable({
        id: 't2',
        name: 'user',
        columnIds: ['c2', 'c3'],
      });
      const post = createTable({
        id: 't3',
        name: 'post',
        columnIds: ['c4', 'c5'],
      });
      const key = (id: string, tableId: string) =>
        createColumn({
          id,
          tableId,
          name: 'id',
          dataType: 'int',
          options: ColumnOption.primaryKey | ColumnOption.autoIncrement,
          ui: { keys: ColumnUIKey.primaryKey },
        });
      const ref = (id: string, tableId: string, name: string) =>
        createColumn({
          id,
          tableId,
          name,
          dataType: 'int',
          ui: { keys: ColumnUIKey.foreignKey },
        });
      const state = createState({
        tables: [team, user, post],
        columns: [
          key('c1', 't1'),
          key('c2', 't2'),
          ref('c3', 't2', 'team_id'),
          key('c4', 't3'),
          ref('c5', 't3', 'user_id'),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't1', columnIds: ['c1'] },
            end: { tableId: 't2', columnIds: ['c3'] },
          }),
          createRelationship({
            id: 'r2',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't2', columnIds: ['c2'] },
            end: { tableId: 't3', columnIds: ['c5'] },
          }),
        ],
        settings: { database: Database.PostgreSQL },
      });

      return { state };
    }

    it('states the column type on both ends when two tables point at each other', () => {
      const { state } = createMutualFixture();

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { relations } from "drizzle-orm";',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        'import type { AnyPgColumn } from "drizzle-orm/pg-core";',
        '',
        'export const Team = pgTable("team", {',
        '  id: integer().primaryKey().generatedAlwaysAsIdentity(),',
        '  leadId: integer("lead_id").references((): AnyPgColumn => User.id),',
        '});',
        '',
        'export const TeamRelations = relations(Team, ({ one, many }) => ({',
        '  user: one(User, {',
        '    fields: [Team.leadId],',
        '    references: [User.id],',
        '    relationName: "Team_user",',
        '  }),',
        '  userList: many(User, { relationName: "User_team" }),',
        '}));',
        '',
        'export const User = pgTable("user", {',
        '  id: integer().primaryKey().generatedAlwaysAsIdentity(),',
        '  teamId: integer("team_id").references((): AnyPgColumn => Team.id),',
        '});',
        '',
        'export const UserRelations = relations(User, ({ one }) => ({',
        '  team: one(Team, {',
        '    fields: [User.teamId],',
        '    references: [Team.id],',
        '    relationName: "User_team",',
        '  }),',
        '  team2: one(Team, {',
        '    fields: [User.id],',
        '    references: [Team.leadId],',
        '    relationName: "Team_user",',
        '  }),',
        '}));',
        '',
      ]);
    });

    it('leaves a line of references that never returns to its start bare', () => {
      const { state } = createLineFixture();

      expect(createCode(state)).toContain(
        '  teamId: integer("team_id").references(() => Team.id),'
      );
      expect(createCode(state)).toContain(
        '  userId: integer("user_id").references(() => User.id),'
      );
      expect(createCode(state)).not.toContain('AnyPgColumn');
    });

    it('states the callback return type when the loop runs on composite keys', () => {
      const { state } = createCompositePairFixture();

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { foreignKey, integer, pgTable, primaryKey } from "drizzle-orm/pg-core";',
        'import type { PgTableExtraConfigValue } from "drizzle-orm/pg-core";',
        '',
        'export const Team = pgTable(',
        '  "team",',
        '  {',
        '    a: integer().notNull(),',
        '    b: integer().notNull(),',
        '    ux: integer(),',
        '    uy: integer(),',
        '  },',
        '  (table): PgTableExtraConfigValue[] => [',
        '    primaryKey({ columns: [table.a, table.b] }),',
        '    foreignKey({',
        '      columns: [table.ux, table.uy],',
        '      foreignColumns: [User.x, User.y],',
        '    }),',
        '  ]',
        ');',
        '',
        'export const User = pgTable(',
        '  "user",',
        '  {',
        '    x: integer().notNull(),',
        '    y: integer().notNull(),',
        '    ta: integer(),',
        '    tb: integer(),',
        '  },',
        '  (table): PgTableExtraConfigValue[] => [',
        '    primaryKey({ columns: [table.x, table.y] }),',
        '    foreignKey({',
        '      columns: [table.ta, table.tb],',
        '      foreignColumns: [Team.a, Team.b],',
        '    }),',
        '  ]',
        ');',
        '',
      ]);
    });

    it('takes the name of the stated type from the database in settings', () => {
      const mysql = createMutualFixture({ database: Database.MySQL });
      const sqlite = createMutualFixture({ database: Database.SQLite });

      expect(createCode(mysql.state)).toContain(
        'import type { AnyMySqlColumn } from "drizzle-orm/mysql-core";'
      );
      expect(createCode(mysql.state)).toContain(
        '  teamId: int("team_id").references((): AnyMySqlColumn => Team.id),'
      );
      expect(createCode(sqlite.state)).toContain(
        'import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";'
      );
      expect(createCode(sqlite.state)).toContain(
        '  teamId: integer("team_id").references((): AnySQLiteColumn => Team.id),'
      );
    });
  });

  describe('relationName', () => {
    function createKeyColumn(id: string, tableId: string) {
      return createColumn({
        id,
        tableId,
        name: 'id',
        dataType: 'int',
        options: ColumnOption.primaryKey | ColumnOption.autoIncrement,
        ui: { keys: ColumnUIKey.primaryKey },
      });
    }

    function createRefColumn(id: string, tableId: string, name: string) {
      return createColumn({
        id,
        tableId,
        name,
        dataType: 'int',
        ui: { keys: ColumnUIKey.foreignKey },
      });
    }

    function createPairFixture(second: boolean) {
      const team = createTable({ id: 't1', name: 'team', columnIds: ['c1'] });
      const user = createTable({
        id: 't2',
        name: 'user',
        columnIds: second ? ['c2', 'c3', 'c4'] : ['c2', 'c3'],
      });
      const state = createState({
        tables: [team, user],
        columns: [
          createKeyColumn('c1', 't1'),
          createKeyColumn('c2', 't2'),
          createRefColumn('c3', 't2', 'team_id'),
          createRefColumn('c4', 't2', 'backup_team_id'),
        ],
        relationships: second
          ? [
              createRelationship({
                id: 'r1',
                relationshipType: RelationshipType.ZeroN,
                start: { tableId: 't1', columnIds: ['c1'] },
                end: { tableId: 't2', columnIds: ['c3'] },
              }),
              createRelationship({
                id: 'r2',
                relationshipType: RelationshipType.ZeroN,
                start: { tableId: 't1', columnIds: ['c1'] },
                end: { tableId: 't2', columnIds: ['c4'] },
              }),
            ]
          : [
              createRelationship({
                id: 'r1',
                relationshipType: RelationshipType.ZeroN,
                start: { tableId: 't1', columnIds: ['c1'] },
                end: { tableId: 't2', columnIds: ['c3'] },
              }),
            ],
        settings: { database: Database.PostgreSQL },
      });

      return { state, team, user };
    }

    function createLoopFixture() {
      const table = createTable({
        id: 't1',
        name: 'node',
        columnIds: ['c1', 'c2'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createKeyColumn('c1', 't1'),
          createRefColumn('c2', 't1', 'next_id'),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroOne,
            start: { tableId: 't1', columnIds: ['c1'] },
            end: { tableId: 't1', columnIds: ['c2'] },
          }),
        ],
        settings: { database: Database.PostgreSQL },
      });

      return { state, table };
    }

    it('tells apart two relationships joining the same pair of tables', () => {
      const { state } = createPairFixture(true);

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { relations } from "drizzle-orm";',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const Team = pgTable("team", {',
        '  id: integer().primaryKey().generatedAlwaysAsIdentity(),',
        '});',
        '',
        'export const TeamRelations = relations(Team, ({ many }) => ({',
        '  userList: many(User, { relationName: "User_team" }),',
        '  userList2: many(User, { relationName: "User_team2" }),',
        '}));',
        '',
        'export const User = pgTable("user", {',
        '  id: integer().primaryKey().generatedAlwaysAsIdentity(),',
        '  teamId: integer("team_id").references(() => Team.id),',
        '  backupTeamId: integer("backup_team_id").references(() => Team.id),',
        '});',
        '',
        'export const UserRelations = relations(User, ({ one }) => ({',
        '  team: one(Team, {',
        '    fields: [User.teamId],',
        '    references: [Team.id],',
        '    relationName: "User_team",',
        '  }),',
        '  team2: one(Team, {',
        '    fields: [User.backupTeamId],',
        '    references: [Team.id],',
        '    relationName: "User_team2",',
        '  }),',
        '}));',
        '',
      ]);
    });

    it('names a relationship that leaves and returns to one table', () => {
      const { state } = createLoopFixture();

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { relations } from "drizzle-orm";',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        'import type { AnyPgColumn } from "drizzle-orm/pg-core";',
        '',
        'export const Node = pgTable("node", {',
        '  id: integer().primaryKey().generatedAlwaysAsIdentity(),',
        '  nextId: integer("next_id").references((): AnyPgColumn => Node.id),',
        '});',
        '',
        'export const NodeRelations = relations(Node, ({ one }) => ({',
        '  parentNode: one(Node, {',
        '    fields: [Node.nextId],',
        '    references: [Node.id],',
        '    relationName: "Node_parentNode",',
        '  }),',
        '  node: one(Node, {',
        '    fields: [Node.id],',
        '    references: [Node.nextId],',
        '    relationName: "Node_parentNode",',
        '  }),',
        '}));',
        '',
      ]);
    });

    it('says nothing where one relationship joins two tables', () => {
      const { state } = createPairFixture(false);

      expect(createCode(state)).not.toContain('relationName');
      expect(createCode(state)).toContain('  userList: many(User),');
    });

    it('reads the same on the end that owns the key and on the end that does not', () => {
      const { state, team, user } = createPairFixture(true);

      expect(render(state, team)).toContain(
        '  userList: many(User, { relationName: "User_team" }),'
      );
      expect(render(state, user)).toContain('    relationName: "User_team",');
    });
  });

  describe('indexes', () => {
    function createIndexFixture(
      overrides: {
        name?: string;
        unique?: boolean;
        columnIds?: string[];
      } = {}
    ) {
      const {
        name = 'IDX_name',
        unique = false,
        columnIds = ['c1'],
      } = overrides;
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
            name,
            unique,
            indexColumnIds: columnIds.map((_, order) => `ic${order + 1}`),
          }),
        ],
        indexColumns: columnIds.map((columnId, order) =>
          createIndexColumn({ id: `ic${order + 1}`, indexId: 'i1', columnId })
        ),
        settings: { database: Database.PostgreSQL },
      });

      return { state, table };
    }

    it('carries the name the document gave an index', () => {
      const { state } = createIndexFixture();

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { index, pgTable, varchar } from "drizzle-orm/pg-core";',
        '',
        'export const User = pgTable(',
        '  "user",',
        '  {',
        '    firstName: varchar("first_name", { length: 50 }),',
        '    lastName: varchar("last_name", { length: 50 }),',
        '  },',
        '  table => [index("IDX_name").on(table.firstName)]',
        ');',
        '',
      ]);
    });

    it('falls back to the table it sits on when the name is blank', () => {
      const { state } = createIndexFixture({ name: '  ' });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { index, pgTable, varchar } from "drizzle-orm/pg-core";',
        '',
        'export const User = pgTable(',
        '  "user",',
        '  {',
        '    firstName: varchar("first_name", { length: 50 }),',
        '    lastName: varchar("last_name", { length: 50 }),',
        '  },',
        '  table => [index("IDX_user").on(table.firstName)]',
        ');',
        '',
      ]);
    });

    it('reaches for a different builder once the index is unique', () => {
      const { state } = createIndexFixture({ unique: true });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";',
        '',
        'export const User = pgTable(',
        '  "user",',
        '  {',
        '    firstName: varchar("first_name", { length: 50 }),',
        '    lastName: varchar("last_name", { length: 50 }),',
        '  },',
        '  table => [uniqueIndex("IDX_name").on(table.firstName)]',
        ');',
        '',
      ]);
    });

    it('passes every column of a multi-column index in document order', () => {
      const { state } = createIndexFixture({ columnIds: ['c1', 'c2'] });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { index, pgTable, varchar } from "drizzle-orm/pg-core";',
        '',
        'export const User = pgTable(',
        '  "user",',
        '  {',
        '    firstName: varchar("first_name", { length: 50 }),',
        '    lastName: varchar("last_name", { length: 50 }),',
        '  },',
        '  table => [index("IDX_name").on(table.firstName, table.lastName)]',
        ');',
        '',
      ]);
    });

    it('mentions a column once even where the index names it twice', () => {
      const { state } = createIndexFixture({ columnIds: ['c1', 'c1'] });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { index, pgTable, varchar } from "drizzle-orm/pg-core";',
        '',
        'export const User = pgTable(',
        '  "user",',
        '  {',
        '    firstName: varchar("first_name", { length: 50 }),',
        '    lastName: varchar("last_name", { length: 50 }),',
        '  },',
        '  table => [index("IDX_name").on(table.firstName)]',
        ');',
        '',
      ]);
    });

    it('walks past an index column whose column is gone', () => {
      const { state } = createIndexFixture({ columnIds: ['missing', 'c2'] });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { index, pgTable, varchar } from "drizzle-orm/pg-core";',
        '',
        'export const User = pgTable(',
        '  "user",',
        '  {',
        '    firstName: varchar("first_name", { length: 50 }),',
        '    lastName: varchar("last_name", { length: 50 }),',
        '  },',
        '  table => [index("IDX_name").on(table.lastName)]',
        ');',
        '',
      ]);
    });

    it('writes no extra config where nothing of the index survives', () => {
      const { state } = createIndexFixture({ columnIds: ['missing'] });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { pgTable, varchar } from "drizzle-orm/pg-core";',
        '',
        'export const User = pgTable("user", {',
        '  firstName: varchar("first_name", { length: 50 }),',
        '  lastName: varchar("last_name", { length: 50 }),',
        '});',
        '',
      ]);
    });

    it('states a descending index column and leaves ascending implied', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'post', columnIds: ['c1', 'c2'] }),
        ],
        columns: [
          createColumn({ id: 'c1', tableId: 't1', name: 'a', dataType: 'int' }),
          createColumn({ id: 'c2', tableId: 't1', name: 'b', dataType: 'int' }),
        ],
        indexes: [
          createIndex({
            id: 'i1',
            tableId: 't1',
            name: 'idx_ab',
            indexColumnIds: ['ic1', 'ic2'],
          }),
        ],
        indexColumns: [
          createIndexColumn({
            id: 'ic1',
            indexId: 'i1',
            columnId: 'c1',
            orderType: OrderType.DESC,
          }),
          createIndexColumn({
            id: 'ic2',
            indexId: 'i1',
            columnId: 'c2',
            orderType: OrderType.ASC,
          }),
        ],
        settings: { database: Database.PostgreSQL },
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { index, integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const Post = pgTable(',
        '  "post",',
        '  {',
        '    a: integer(),',
        '    b: integer(),',
        '  },',
        '  table => [index("idx_ab").on(table.a.desc(), table.b)]',
        ');',
        '',
      ]);
    });

    it('leaves the order off mysql and sqlite, whose columns cannot state it', () => {
      const build = (database: number) =>
        createState({
          tables: [
            createTable({ id: 't1', name: 'post', columnIds: ['c1', 'c2'] }),
          ],
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
              name: 'b',
              dataType: 'int',
            }),
          ],
          indexes: [
            createIndex({
              id: 'i1',
              tableId: 't1',
              name: 'idx_ab',
              indexColumnIds: ['ic1', 'ic2'],
            }),
          ],
          indexColumns: [
            createIndexColumn({
              id: 'ic1',
              indexId: 'i1',
              columnId: 'c1',
              orderType: OrderType.DESC,
            }),
            createIndexColumn({ id: 'ic2', indexId: 'i1', columnId: 'c2' }),
          ],
          settings: { database },
        });

      expect(createCode(build(Database.MySQL))).toContain(
        'index("idx_ab").on(table.a, table.b)'
      );
      expect(createCode(build(Database.SQLite))).toContain(
        'index("idx_ab").on(table.a, table.b)'
      );
    });
  });

  describe('identifiers', () => {
    function createNameFixture(
      tableName: string,
      columnNames: string[],
      settings?: Partial<RootState['settings']>
    ) {
      const table = createTable({
        id: 't1',
        name: tableName,
        columnIds: columnNames.map((_, order) => `c${order + 1}`),
      });
      const state = createState({
        tables: [table],
        columns: columnNames.map((name, order) =>
          createColumn({
            id: `c${order + 1}`,
            tableId: 't1',
            name,
            dataType: 'int',
          })
        ),
        settings: { database: Database.PostgreSQL, ...settings },
      });

      return { state, table };
    }

    it('suffixes a word neither a const nor a property may spell', () => {
      const { state } = createNameFixture('class', ['default', 'new'], {
        tableNameCase: NameCase.none,
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const class_ = pgTable("class", {',
        '  default_: integer("default"),',
        '  new_: integer("new"),',
        '});',
        '',
      ]);
    });

    it('swaps out the characters an identifier has no room for', () => {
      const { state } = createNameFixture('user-log', ['a-b', 'c d'], {
        tableNameCase: NameCase.none,
        columnNameCase: NameCase.none,
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const user_log = pgTable("user-log", {',
        '  a_b: integer("a-b"),',
        '  c_d: integer("c d"),',
        '});',
        '',
      ]);
    });

    it('moves a name that would open on a digit', () => {
      const { state } = createNameFixture('1st', ['2nd'], {
        tableNameCase: NameCase.none,
        columnNameCase: NameCase.none,
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const x1st = pgTable("1st", {',
        '  x2nd: integer("2nd"),',
        '});',
        '',
      ]);
    });

    it('numbers a const that would shadow a builder the header imports', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'text', columnIds: ['c1'] }),
          createTable({ id: 't2', name: 'index' }),
        ],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'body',
            dataType: 'text',
          }),
        ],
        settings: {
          database: Database.PostgreSQL,
          tableNameCase: NameCase.none,
        },
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { pgTable, text } from "drizzle-orm/pg-core";',
        '',
        'export const index2 = pgTable("index", {});',
        '',
        'export const text2 = pgTable("text", {',
        '  body: text(),',
        '});',
        '',
      ]);
    });

    it('numbers a const that would shadow the extra-config parameter', () => {
      const { state } = createNameFixture('table', ['id'], {
        tableNameCase: NameCase.none,
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const table2 = pgTable("table", {',
        '  id: integer(),',
        '});',
        '',
      ]);
    });

    it('numbers a property or a relation that would take the prototype key', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 't', columnIds: ['c1', 'c2'] }),
          createTable({ id: 't2', name: '__proto__', columnIds: ['c3'] }),
        ],
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
            name: '__proto__',
            dataType: 'int',
            options: ColumnOption.notNull,
          }),
          createColumn({
            id: 'c3',
            tableId: 't2',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't2', columnIds: ['c3'] },
            end: { tableId: 't1', columnIds: ['c2'] },
          }),
        ],
        settings: {
          database: Database.PostgreSQL,
          tableNameCase: NameCase.none,
          columnNameCase: NameCase.none,
        },
      });
      const lines = createCode(state).split('\n');

      expect(lines).toContain(
        '  __proto__2: integer("__proto__").notNull().references(() => __proto__.id),'
      );
      expect(lines).toContain('  __proto__2: one(__proto__, {');
      expect(lines).toContain(
        'export const __proto__ = pgTable("__proto__", {'
      );
    });

    it('numbers a property that would take a name the table itself holds', () => {
      const { state } = createNameFixture('probe', ['_'], {
        columnNameCase: NameCase.none,
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const Probe = pgTable("probe", {',
        '  _2: integer("_"),',
        '});',
        '',
      ]);
    });

    it('renames a table that would collide with an annotation type', () => {
      const { state } = createNameFixture('AnyPgColumn', ['id'], {
        tableNameCase: NameCase.none,
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const AnyPgColumn2 = pgTable("AnyPgColumn", {',
        '  id: integer(),',
        '});',
        '',
      ]);
    });

    it('renames a table that would shadow a relations callback helper', () => {
      const state = createState({
        tables: [
          createTable({ id: 'to', name: 'one', columnIds: ['o1'] }),
          createTable({ id: 'tm', name: 'many', columnIds: ['m1', 'm2'] }),
        ],
        columns: [
          createColumn({
            id: 'o1',
            tableId: 'to',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'm1',
            tableId: 'tm',
            name: 'id',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'm2',
            tableId: 'tm',
            name: 'one_id',
            dataType: 'int',
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 'to', columnIds: ['o1'] },
            end: { tableId: 'tm', columnIds: ['m2'] },
          }),
        ],
        settings: {
          database: Database.PostgreSQL,
          tableNameCase: NameCase.none,
          columnNameCase: NameCase.none,
        },
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { relations } from "drizzle-orm";',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const many2 = pgTable("many", {',
        '  id: integer().primaryKey(),',
        '  one_id: integer().references(() => one2.id),',
        '});',
        '',
        'export const many2Relations = relations(many2, ({ one }) => ({',
        '  one: one(one2, { fields: [many2.one_id], references: [one2.id] }),',
        '}));',
        '',
        'export const one2 = pgTable("one", {',
        '  id: integer().primaryKey(),',
        '});',
        '',
        'export const one2Relations = relations(one2, ({ many }) => ({',
        '  manyList: many(many2),',
        '}));',
        '',
      ]);
    });
  });

  describe('duplicate column names', () => {
    function createEmailFixture(indexed: boolean) {
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
        indexes: indexed
          ? [
              createIndex({
                id: 'i1',
                tableId: 't1',
                name: 'IDX_email',
                indexColumnIds: ['ic1'],
              }),
            ]
          : [],
        indexColumns: indexed
          ? [createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c2' })]
          : [],
        settings: { database: Database.PostgreSQL },
      });

      return { state, table };
    }

    it('declares one property for two columns of one database name', () => {
      const { state } = createEmailFixture(false);

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { pgTable, varchar } from "drizzle-orm/pg-core";',
        '',
        'export const User = pgTable("user", {',
        '  email: varchar({ length: 50 }).notNull(),',
        '});',
        '',
      ]);
    });

    it('sends the column that never declared anything to the same property', () => {
      const { state } = createEmailFixture(true);

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { index, pgTable, varchar } from "drizzle-orm/pg-core";',
        '',
        'export const User = pgTable(',
        '  "user",',
        '  {',
        '    email: varchar({ length: 50 }).notNull(),',
        '  },',
        '  table => [index("IDX_email").on(table.email)]',
        ');',
        '',
      ]);
    });

    it('keeps the foreign key of a column whose name a sibling already took', () => {
      const state = createState({
        tables: [
          createTable({ id: 'ta', name: 'a', columnIds: ['a1'] }),
          createTable({ id: 'tb', name: 'b', columnIds: ['b1', 'b2'] }),
        ],
        columns: [
          createColumn({
            id: 'a1',
            tableId: 'ta',
            name: 'k',
            dataType: 'int',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'b1',
            tableId: 'tb',
            name: 'fk',
            dataType: 'int',
          }),
          createColumn({
            id: 'b2',
            tableId: 'tb',
            name: 'fk',
            dataType: 'int',
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 'ta', columnIds: ['a1'] },
            end: { tableId: 'tb', columnIds: ['b2'] },
          }),
        ],
        settings: { database: Database.PostgreSQL },
      });

      expect(createCode(state)).toContain(
        '  fk: integer().references(() => A.k),'
      );
    });
  });

  describe('duplicate table names', () => {
    function createTwinFixture() {
      const first = createTable({ id: 't1', name: 'user', columnIds: ['c1'] });
      const second = createTable({
        id: 't2',
        name: 'user',
        columnIds: ['c2', 'c3'],
      });
      const key = (id: string, tableId: string) =>
        createColumn({
          id,
          tableId,
          name: 'id',
          dataType: 'int',
          options: ColumnOption.primaryKey | ColumnOption.autoIncrement,
          ui: { keys: ColumnUIKey.primaryKey },
        });
      const state = createState({
        tables: [first, second],
        columns: [
          key('c1', 't1'),
          key('c2', 't2'),
          createColumn({
            id: 'c3',
            tableId: 't2',
            name: 'user_id',
            dataType: 'int',
            ui: { keys: ColumnUIKey.foreignKey },
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't1', columnIds: ['c1'] },
            end: { tableId: 't2', columnIds: ['c3'] },
          }),
        ],
        settings: { database: Database.PostgreSQL },
      });

      return { state, first, second };
    }

    it('keeps one database name across two consts and their relations', () => {
      const { state } = createTwinFixture();

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { relations } from "drizzle-orm";',
        'import { integer, pgTable } from "drizzle-orm/pg-core";',
        '',
        'export const User = pgTable("user", {',
        '  id: integer().primaryKey().generatedAlwaysAsIdentity(),',
        '});',
        '',
        'export const UserRelations = relations(User, ({ many }) => ({',
        '  userList: many(User2),',
        '}));',
        '',
        'export const User2 = pgTable("user", {',
        '  id: integer().primaryKey().generatedAlwaysAsIdentity(),',
        '  userId: integer("user_id").references(() => User.id),',
        '});',
        '',
        'export const User2Relations = relations(User2, ({ one }) => ({',
        '  user: one(User, { fields: [User2.userId], references: [User.id] }),',
        '}));',
        '',
      ]);
    });
  });

  describe('shared numbering', () => {
    function createTwinIndexFixture() {
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
        settings: { database: Database.PostgreSQL },
      });

      return { state, first, second };
    }

    it('hands one table on its own the number the whole document gives it', () => {
      const { state, second } = createTwinIndexFixture();

      expect(render(state, second)).toEqual([
        'import { index, pgTable, varchar } from "drizzle-orm/pg-core";',
        '',
        'export const User2 = pgTable(',
        '  "user",',
        '  {',
        '    email: varchar({ length: 50 }),',
        '  },',
        '  table => [index("IDX_user1").on(table.email)]',
        ');',
      ]);
    });

    it('counts the auto index names off the whole document either way', () => {
      const { state, first, second } = createTwinIndexFixture();

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import { index, pgTable, varchar } from "drizzle-orm/pg-core";',
        '',
        'export const User = pgTable(',
        '  "user",',
        '  {',
        '    email: varchar({ length: 50 }),',
        '  },',
        '  table => [index("IDX_user").on(table.email)]',
        ');',
        '',
        'export const User2 = pgTable(',
        '  "user",',
        '  {',
        '    email: varchar({ length: 50 }),',
        '  },',
        '  table => [index("IDX_user1").on(table.email)]',
        ');',
        '',
      ]);
      expect(render(state, first)).toContain(
        '  table => [index("IDX_user").on(table.email)]'
      );
      expect(render(state, second)).toContain(
        '  table => [index("IDX_user1").on(table.email)]'
      );
    });
  });
});
