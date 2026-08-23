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
import { createCode, formatTable } from '@/utils/generator-code/sqlalchemy';

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

/**
 * The document `generator-code/index.test.ts` shares across every language:
 * one `user` table with a single `created_at INT NOT NULL` column on MySQL.
 */
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

/**
 * The `users` table from the feature request: a PostgreSQL-native document
 * whose types (`uuid`, `text`, `timestamptz`) all sit outside the eleven
 * primitive types.
 */
function createUsersFixture(settings?: Partial<RootState['settings']>) {
  const table = createTable({
    id: 't_users',
    name: 'users',
    columnIds: [
      'c_id',
      'c_sub',
      'c_email',
      'c_verified',
      'c_created',
      'c_seen',
    ],
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
        id: 'c_sub',
        tableId: 't_users',
        name: 'google_sub',
        dataType: 'text',
        options: ColumnOption.notNull | ColumnOption.unique,
      }),
      createColumn({
        id: 'c_email',
        tableId: 't_users',
        name: 'email',
        dataType: 'text',
        options: ColumnOption.notNull | ColumnOption.unique,
      }),
      createColumn({
        id: 'c_verified',
        tableId: 't_users',
        name: 'email_verified',
        dataType: 'boolean',
        default: 'false',
        options: ColumnOption.notNull,
      }),
      createColumn({
        id: 'c_created',
        tableId: 't_users',
        name: 'created_at',
        dataType: 'timestamptz',
        default: 'now()',
        options: ColumnOption.notNull,
      }),
      createColumn({
        id: 'c_seen',
        tableId: 't_users',
        name: 'last_login_at',
        dataType: 'timestamptz',
        default: 'now()',
        options: ColumnOption.notNull,
      }),
    ],
    settings: { database: Database.PostgreSQL, ...settings },
  });

  return { state, table };
}

/**
 * team (1) ── (N) player
 *
 * The join is a two-column composite foreign key, and both of its columns are
 * also part of `player`'s three-column composite primary key.
 */
function createCompositeFixture() {
  const team = createTable({
    id: 't_team',
    name: 'team',
    columnIds: ['team_id', 'team_code', 'team_name'],
  });
  const player = createTable({
    id: 't_player',
    name: 'player',
    columnIds: ['p_team_id', 'p_team_code', 'p_no', 'p_nickname'],
  });
  const pkFk = ColumnUIKey.primaryKey | ColumnUIKey.foreignKey;
  const state = createState({
    // deliberately out of order so the sort is observable
    tables: [team, player],
    columns: [
      createColumn({
        id: 'team_id',
        tableId: 't_team',
        name: 'id',
        dataType: 'INT',
        options: ColumnOption.primaryKey,
        ui: { keys: ColumnUIKey.primaryKey },
      }),
      createColumn({
        id: 'team_code',
        tableId: 't_team',
        name: 'code',
        dataType: 'VARCHAR(20)',
        options: ColumnOption.primaryKey,
        ui: { keys: ColumnUIKey.primaryKey },
      }),
      createColumn({
        id: 'team_name',
        tableId: 't_team',
        name: 'name',
        dataType: 'VARCHAR(50)',
        options: ColumnOption.notNull,
      }),
      createColumn({
        id: 'p_team_id',
        tableId: 't_player',
        name: 'team_id',
        dataType: 'INT',
        options: ColumnOption.primaryKey,
        ui: { keys: pkFk },
      }),
      createColumn({
        id: 'p_team_code',
        tableId: 't_player',
        name: 'team_code',
        dataType: 'VARCHAR(20)',
        options: ColumnOption.primaryKey,
        ui: { keys: pkFk },
      }),
      createColumn({
        id: 'p_no',
        tableId: 't_player',
        name: 'no',
        dataType: 'INT',
        options: ColumnOption.primaryKey,
        ui: { keys: ColumnUIKey.primaryKey },
      }),
      createColumn({
        id: 'p_nickname',
        tableId: 't_player',
        name: 'nickname',
        dataType: 'VARCHAR(50)',
      }),
    ],
    relationships: [
      createRelationship({
        id: 'r1',
        relationshipType: RelationshipType.ZeroN,
        start: { tableId: 't_team', columnIds: ['team_id', 'team_code'] },
        end: { tableId: 't_player', columnIds: ['p_team_id', 'p_team_code'] },
      }),
    ],
    settings: { database: Database.MySQL },
  });

  return { state, team, player };
}

describe('generator-code/sqlalchemy', () => {
  describe('createCode', () => {
    it('returns an empty string when the document has no tables', () => {
      expect(createCode(createState({}))).toBe('');
    });

    it('renders the shared single-table document', () => {
      const { state } = createSharedFixture();

      expect(createCode(state).split('\n')).toEqual([
        '',
        'from sqlalchemy import Integer',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class User(Base):',
        '    __tablename__ = "user"',
        '',
        '    createdAt: Mapped[int] = mapped_column("created_at", Integer, nullable=False)',
        '',
      ]);
    });

    it('renders the PostgreSQL users table under the default name cases', () => {
      const { state } = createUsersFixture();

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import uuid',
        'from datetime import datetime',
        '',
        'from sqlalchemy import Boolean, DateTime, Text, text',
        'from sqlalchemy.dialects.postgresql import UUID',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class Users(Base):',
        '    __tablename__ = "users"',
        '',
        '    id: Mapped[uuid.UUID] = mapped_column(',
        '        UUID(as_uuid=True),',
        '        primary_key=True,',
        '        server_default=text("gen_random_uuid()"),',
        '    )',
        '    googleSub: Mapped[str] = mapped_column(',
        '        "google_sub",',
        '        Text,',
        '        nullable=False,',
        '        unique=True,',
        '    )',
        '    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True)',
        '    emailVerified: Mapped[bool] = mapped_column(',
        '        "email_verified",',
        '        Boolean,',
        '        nullable=False,',
        '        server_default=text("false"),',
        '    )',
        '    createdAt: Mapped[datetime] = mapped_column(',
        '        "created_at",',
        '        DateTime(timezone=True),',
        '        nullable=False,',
        '        server_default=text("now()"),',
        '    )',
        '    lastLoginAt: Mapped[datetime] = mapped_column(',
        '        "last_login_at",',
        '        DateTime(timezone=True),',
        '        nullable=False,',
        '        server_default=text("now()"),',
        '    )',
        '',
      ]);
    });

    it('renders the users table with snake_case attributes, comments and a docstring', () => {
      const { state } = createUsersFixture({
        columnNameCase: NameCase.snakeCase,
      });
      state.collections.tableEntities['t_users'].comment =
        "Stores authenticated users. Keyed on Google's sub claim.";
      const comments: Record<string, string> = {
        c_id: 'internal private key',
        c_sub: "Google's immutable user identifier from the `sub` claim",
        c_email: 'updated on every login in case user changes it',
        c_verified: 'from Google token, always true for Google auth',
        c_created: 'set once on provisioning, never updated',
        c_seen: 'updated on every login',
      };
      Object.keys(comments).forEach(id => {
        state.collections.tableColumnEntities[id].comment = comments[id];
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'import uuid',
        'from datetime import datetime',
        '',
        'from sqlalchemy import Boolean, DateTime, Text, text',
        'from sqlalchemy.dialects.postgresql import UUID',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class Users(Base):',
        '    """Stores authenticated users. Keyed on Google\'s sub claim."""',
        '',
        '    __tablename__ = "users"',
        '    __table_args__ = {',
        '        "comment": "Stores authenticated users. Keyed on Google\'s sub claim.",',
        '    }',
        '',
        '    id: Mapped[uuid.UUID] = mapped_column(',
        '        UUID(as_uuid=True),',
        '        primary_key=True,',
        '        server_default=text("gen_random_uuid()"),',
        '        comment="internal private key",',
        '    )',
        '    google_sub: Mapped[str] = mapped_column(',
        '        Text,',
        '        nullable=False,',
        '        unique=True,',
        '        comment="Google\'s immutable user identifier from the `sub` claim",',
        '    )',
        '    email: Mapped[str] = mapped_column(',
        '        Text,',
        '        nullable=False,',
        '        unique=True,',
        '        comment="updated on every login in case user changes it",',
        '    )',
        '    email_verified: Mapped[bool] = mapped_column(',
        '        Boolean,',
        '        nullable=False,',
        '        server_default=text("false"),',
        '        comment="from Google token, always true for Google auth",',
        '    )',
        '    created_at: Mapped[datetime] = mapped_column(',
        '        DateTime(timezone=True),',
        '        nullable=False,',
        '        server_default=text("now()"),',
        '        comment="set once on provisioning, never updated",',
        '    )',
        '    last_login_at: Mapped[datetime] = mapped_column(',
        '        DateTime(timezone=True),',
        '        nullable=False,',
        '        server_default=text("now()"),',
        '        comment="updated on every login",',
        '    )',
        '',
      ]);
    });

    it('renders a composite foreign key as a ForeignKeyConstraint on both sides, sorted by table name', () => {
      const { state } = createCompositeFixture();

      expect(createCode(state).split('\n')).toEqual([
        '',
        'from typing import List, Optional',
        '',
        'from sqlalchemy import ForeignKeyConstraint, Integer, String',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class Player(Base):',
        '    __tablename__ = "player"',
        '    __table_args__ = (',
        '        ForeignKeyConstraint(["team_id", "team_code"], ["team.id", "team.code"]),',
        '    )',
        '',
        '    teamId: Mapped[int] = mapped_column("team_id", Integer, primary_key=True)',
        '    teamCode: Mapped[str] = mapped_column("team_code", String(20), primary_key=True)',
        '    no: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    nickname: Mapped[Optional[str]] = mapped_column(String(50))',
        '',
        '    team: Mapped["Team"] = relationship(back_populates="playerList")',
        '',
        '',
        'class Team(Base):',
        '    __tablename__ = "team"',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    code: Mapped[str] = mapped_column(String(20), primary_key=True)',
        '    name: Mapped[str] = mapped_column(String(50), nullable=False)',
        '',
        '    playerList: Mapped[List["Player"]] = relationship(back_populates="team")',
        '',
      ]);
    });

    it('skips table ids that are not in the collection', () => {
      const { state } = createSharedFixture();
      state.doc.tableIds = ['missing', 't1'];

      expect(createCode(state).split('\n').at(-2)).toBe(
        '    createdAt: Mapped[int] = mapped_column("created_at", Integer, nullable=False)'
      );
    });
  });

  describe('formatTable', () => {
    it('appends to an existing buffer instead of replacing it', () => {
      const { state, table } = createSharedFixture();
      const buffer = ['# leading'];

      formatTable(state, { buffer, table });

      expect(buffer[0]).toBe('# leading');
      expect(buffer.at(-1)).toBe(
        '    createdAt: Mapped[int] = mapped_column("created_at", Integer, nullable=False)'
      );
    });

    it('matches createCode byte for byte for a single-table document', () => {
      const { state, table } = createSharedFixture();
      const buffer: string[] = [''];

      formatTable(state, { buffer, table });
      buffer.push('');

      expect(buffer.join('\n')).toBe(createCode(state));
    });

    it('renders one table of a multi-table document with its own import header', () => {
      const { state, player } = createCompositeFixture();

      expect(render(state, player)).toEqual([
        'from typing import Optional',
        '',
        'from sqlalchemy import ForeignKeyConstraint, Integer, String',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class Player(Base):',
        '    __tablename__ = "player"',
        '    __table_args__ = (',
        '        ForeignKeyConstraint(["team_id", "team_code"], ["team.id", "team.code"]),',
        '    )',
        '',
        '    teamId: Mapped[int] = mapped_column("team_id", Integer, primary_key=True)',
        '    teamCode: Mapped[str] = mapped_column("team_code", String(20), primary_key=True)',
        '    no: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    nickname: Mapped[Optional[str]] = mapped_column(String(50))',
        '',
        '    team: Mapped["Team"] = relationship(back_populates="playerList")',
      ]);
    });
  });

  describe('type mapping', () => {
    it('maps every primitive type to a SQLAlchemy type and a Mapped annotation', () => {
      const table = createTable({
        id: 't1',
        name: 'types',
        columnIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'],
      });
      const dataTypes: Array<[string, string, string]> = [
        ['a', 'intCol', 'INT'],
        ['b', 'longCol', 'BIGINT'],
        ['c', 'floatCol', 'FLOAT'],
        ['d', 'doubleCol', 'DOUBLE'],
        ['e', 'decimalCol', 'DECIMAL(10, 2)'],
        ['f', 'booleanCol', 'BOOLEAN'],
        ['g', 'stringCol', 'VARCHAR(10)'],
        ['h', 'lobCol', 'LONG'],
        ['i', 'dateCol', 'DATE'],
        ['j', 'dateTimeCol', 'DATETIME'],
        ['k', 'timeCol', 'TIME'],
        ['l', 'unknownCol', 'NOT_A_TYPE'],
      ];
      const state = createState({
        tables: [table],
        columns: dataTypes.map(([id, name, dataType]) =>
          createColumn({ id, tableId: 't1', name, dataType })
        ),
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toEqual([
        'from datetime import date, datetime, time',
        'from decimal import Decimal',
        'from typing import Optional',
        '',
        'from sqlalchemy import (',
        '    BigInteger,',
        '    Boolean,',
        '    Date,',
        '    DateTime,',
        '    Double,',
        '    Float,',
        '    Integer,',
        '    Numeric,',
        '    String,',
        '    Text,',
        '    Time,',
        ')',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class Types(Base):',
        '    __tablename__ = "types"',
        '',
        '    intCol: Mapped[Optional[int]] = mapped_column(Integer)',
        '    longCol: Mapped[Optional[int]] = mapped_column(BigInteger)',
        '    floatCol: Mapped[Optional[float]] = mapped_column(Float)',
        '    doubleCol: Mapped[Optional[float]] = mapped_column(Double)',
        '    decimalCol: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))',
        '    booleanCol: Mapped[Optional[bool]] = mapped_column(Boolean)',
        '    stringCol: Mapped[Optional[str]] = mapped_column(String(10))',
        '    lobCol: Mapped[Optional[str]] = mapped_column(Text)',
        '    dateCol: Mapped[Optional[date]] = mapped_column(Date)',
        '    dateTimeCol: Mapped[Optional[datetime]] = mapped_column(DateTime)',
        '    timeCol: Mapped[Optional[time]] = mapped_column(Time)',
        '    unknownCol: Mapped[Optional[str]] = mapped_column(String)',
      ]);
    });

    it('overrides the primitive type from the raw data type name', () => {
      const table = createTable({
        id: 't1',
        name: 'raw',
        columnIds: ['a', 'b', 'c', 'd', 'e'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({ id: 'a', tableId: 't1', name: 'a', dataType: 'blob' }),
          createColumn({
            id: 'b',
            tableId: 't1',
            name: 'b',
            dataType: 'jsonb',
          }),
          createColumn({ id: 'c', tableId: 't1', name: 'c', dataType: 'uuid' }),
          createColumn({
            id: 'd',
            tableId: 't1',
            name: 'd',
            dataType: 'timetz',
          }),
          createColumn({
            id: 'e',
            tableId: 't1',
            name: 'e',
            dataType: 'VARCHAR(200)',
          }),
        ],
        settings: {
          database: Database.PostgreSQL,
          columnNameCase: NameCase.none,
        },
      });

      expect(render(state, table).slice(-5)).toEqual([
        '    a: Mapped[Optional[bytes]] = mapped_column(LargeBinary)',
        '    b: Mapped[Optional[Any]] = mapped_column(JSONB)',
        '    c: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))',
        '    d: Mapped[Optional[time]] = mapped_column(Time(timezone=True))',
        '    e: Mapped[Optional[str]] = mapped_column(String(200))',
      ]);
    });

    it('falls back to the portable types outside PostgreSQL', () => {
      const table = createTable({
        id: 't1',
        name: 'raw',
        columnIds: ['a', 'b', 'c'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'a',
            tableId: 't1',
            name: 'a',
            dataType: 'uniqueidentifier',
          }),
          createColumn({ id: 'b', tableId: 't1', name: 'b', dataType: 'json' }),
          createColumn({
            id: 'c',
            tableId: 't1',
            name: 'c',
            dataType: 'datetimeoffset',
          }),
        ],
        settings: { database: Database.MSSQL, columnNameCase: NameCase.none },
      });

      expect(render(state, table)).toEqual([
        'import uuid',
        'from datetime import datetime',
        'from typing import Any, Optional',
        '',
        'from sqlalchemy import JSON, DateTime, Uuid',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class Raw(Base):',
        '    __tablename__ = "raw"',
        '',
        '    a: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)',
        '    b: Mapped[Optional[Any]] = mapped_column(JSON)',
        '    c: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))',
      ]);
    });

    it('keeps a numeric type argument list and drops one it cannot read as integers', () => {
      const table = createTable({
        id: 't1',
        name: 'raw',
        columnIds: ['a', 'b', 'c'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'a',
            tableId: 't1',
            name: 'a',
            dataType: 'VARCHAR(MAX)',
          }),
          createColumn({
            id: 'b',
            tableId: 't1',
            name: 'b',
            dataType: 'DECIMAL',
          }),
          createColumn({
            id: 'c',
            tableId: 't1',
            name: 'c',
            dataType: 'DECIMAL(10)',
          }),
        ],
        settings: { database: Database.MSSQL, columnNameCase: NameCase.none },
      });

      expect(render(state, table).slice(-3)).toEqual([
        '    a: Mapped[Optional[str]] = mapped_column(String)',
        '    b: Mapped[Optional[Decimal]] = mapped_column(Numeric)',
        '    c: Mapped[Optional[Decimal]] = mapped_column(Numeric(10))',
      ]);
    });

    // `getColumnType` normalizes a data type before it looks the raw name up:
    // the argument list goes, every run of whitespace collapses, and the ends
    // are trimmed. Drop any one step and the name misses its set and falls
    // back to the primitive type -- `VARBINARY(255)` lands on `String`, which
    // is the collapse the raw-name lists exist to prevent.
    it('strips arguments and repeated whitespace before matching a raw type name', () => {
      const table = createTable({
        id: 't1',
        name: 'args',
        columnIds: ['pk', 'a', 'b', 'c', 'd'],
      });
      const state = createState({
        tables: [table],
        columns: [
          primaryKey('pk', 't1'),
          createColumn({
            id: 'a',
            tableId: 't1',
            name: 'a',
            dataType: 'VARBINARY(255)',
          }),
          createColumn({
            id: 'b',
            tableId: 't1',
            name: 'b',
            dataType: 'BLOB(100)',
          }),
          createColumn({
            id: 'c',
            tableId: 't1',
            name: 'c',
            dataType: 'TIME(6) WITH TIME ZONE',
          }),
          // two runs of stray whitespace, so collapsing only the first leaves
          // `timestamp with  time zone` unmatched
          createColumn({
            id: 'd',
            tableId: 't1',
            name: 'd',
            dataType: 'TIMESTAMP(3)  WITH  TIME ZONE',
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toEqual([
        'from datetime import datetime, time',
        'from typing import Optional',
        '',
        'from sqlalchemy import DateTime, Integer, LargeBinary, Time',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class Args(Base):',
        '    __tablename__ = "args"',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    a: Mapped[Optional[bytes]] = mapped_column(LargeBinary)',
        '    b: Mapped[Optional[bytes]] = mapped_column(LargeBinary)',
        '    c: Mapped[Optional[time]] = mapped_column(Time(timezone=True))',
        '    d: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))',
      ]);
    });

    // `JSONB` and `UUID` live in `sqlalchemy.dialects.postgresql`, so the
    // database check is what keeps them out of a MySQL document. Emitting
    // JSONB anyway costs the model its portability: create_all against SQLite
    // raises CompileError ("(in table 'portable', column 'a'): Compiler
    // <sqlalchemy.dialects.sqlite.base.SQLiteTypeCompiler object> can't render
    // element of type JSONB").
    it('keeps the portable type for jsonb and uuid outside PostgreSQL', () => {
      const table = createTable({
        id: 't1',
        name: 'portable',
        columnIds: ['pk', 'a', 'b'],
      });
      const state = createState({
        tables: [table],
        columns: [
          primaryKey('pk', 't1'),
          createColumn({
            id: 'a',
            tableId: 't1',
            name: 'a',
            dataType: 'JSONB',
          }),
          createColumn({ id: 'b', tableId: 't1', name: 'b', dataType: 'UUID' }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toEqual([
        'import uuid',
        'from typing import Any, Optional',
        '',
        'from sqlalchemy import JSON, Integer, Uuid',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class Portable(Base):',
        '    __tablename__ = "portable"',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    a: Mapped[Optional[Any]] = mapped_column(JSON)',
        '    b: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)',
      ]);
    });

    // A data type argument reaches `String(n)` / `Numeric(p, s)` only as a
    // positive integer. `VARCHAR(MAX)` is SQL Server's own spelling and
    // `Number('MAX')` is NaN, which Python does not define: the module dies at
    // import with NameError ("name 'NaN' is not defined"). `VARCHAR(0)` is the
    // other end -- it imports, but create_all writes `VARCHAR(0)`.
    it('ignores a type argument that is not a positive integer', () => {
      const table = createTable({
        id: 't1',
        name: 'bad_args',
        columnIds: ['pk', 'a', 'b', 'c', 'd', 'e'],
      });
      const state = createState({
        tables: [table],
        columns: [
          primaryKey('pk', 't1'),
          createColumn({
            id: 'a',
            tableId: 't1',
            name: 'a',
            dataType: 'VARCHAR(MAX)',
          }),
          // one of the two is a number, so the whole list still has to go
          createColumn({
            id: 'b',
            tableId: 't1',
            name: 'b',
            dataType: 'DECIMAL(10, X)',
          }),
          // digits, but not an integer
          createColumn({
            id: 'c',
            tableId: 't1',
            name: 'c',
            dataType: 'DECIMAL(10.5)',
          }),
          createColumn({
            id: 'd',
            tableId: 't1',
            name: 'd',
            dataType: 'VARCHAR(0)',
          }),
          // String takes one argument, never two
          createColumn({
            id: 'e',
            tableId: 't1',
            name: 'e',
            dataType: 'VARCHAR(10, 20)',
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toEqual([
        'from decimal import Decimal',
        'from typing import Optional',
        '',
        'from sqlalchemy import Integer, Numeric, String',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class BadArgs(Base):',
        '    __tablename__ = "bad_args"',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    a: Mapped[Optional[str]] = mapped_column(String)',
        '    b: Mapped[Optional[Decimal]] = mapped_column(Numeric)',
        '    c: Mapped[Optional[Decimal]] = mapped_column(Numeric)',
        '    d: Mapped[Optional[str]] = mapped_column(String)',
        '    e: Mapped[Optional[str]] = mapped_column(String)',
      ]);
    });

    // An empty argument list is free text like any other, and `TYPE_ARGUMENTS`
    // captures the empty string from it: only the `+` in `DIGITS` keeps
    // `Number('')` from reaching the expression as 0. Both spellings have to
    // land on the bare callable -- `Numeric(0)` imports without complaint, and
    // create_all then writes `a NUMERIC(0)` where `Numeric` writes `a NUMERIC`.
    it('drops an empty type argument list', () => {
      const table = createTable({
        id: 't1',
        name: 'empty_args',
        columnIds: ['pk', 'a', 'b', 'c'],
      });
      const state = createState({
        tables: [table],
        columns: [
          primaryKey('pk', 't1'),
          createColumn({
            id: 'a',
            tableId: 't1',
            name: 'a',
            dataType: 'decimal()',
          }),
          // and with nothing but whitespace between the parentheses
          createColumn({
            id: 'b',
            tableId: 't1',
            name: 'b',
            dataType: 'numeric( )',
          }),
          createColumn({
            id: 'c',
            tableId: 't1',
            name: 'c',
            dataType: 'varchar()',
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toEqual([
        'from decimal import Decimal',
        'from typing import Optional',
        '',
        'from sqlalchemy import Integer, Numeric, String',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class EmptyArgs(Base):',
        '    __tablename__ = "empty_args"',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    a: Mapped[Optional[Decimal]] = mapped_column(Numeric)',
        '    b: Mapped[Optional[Decimal]] = mapped_column(Numeric)',
        '    c: Mapped[Optional[str]] = mapped_column(String)',
      ]);
    });
  });

  describe('imports', () => {
    it('omits every import the document does not use', () => {
      const table = createTable({ id: 't1', name: 'plain', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'INT',
            options: ColumnOption.primaryKey,
          }),
        ],
        settings: { database: Database.MySQL },
      });
      const lines = render(state, table);

      expect(lines.slice(0, 2)).toEqual([
        'from sqlalchemy import Integer',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column',
      ]);
      expect(lines.join('\n')).not.toContain('Optional');
      expect(lines.join('\n')).not.toContain('relationship');
      expect(lines.join('\n')).not.toContain('ForeignKey');
      expect(lines.join('\n')).not.toContain('import text');
      expect(lines.join('\n')).not.toContain('typing');
      expect(lines.join('\n')).not.toContain('datetime');
    });

    // Every from-import the generator can write, in the order `isort 6.1.0
    // --profile black` leaves them: the CONSTANT bucket first, then the rest by
    // name. A name added to the tuples in `sqlalchemy.ts` has to land here,
    // which is what keeps `sortImportNames` checkable -- nothing a document can
    // say makes the sort observable on its own.
    it('orders a from-import the way isort does', () => {
      const code = createCode(createEveryImportState());

      expect(fromImportNames(code, 'sqlalchemy')).toEqual([
        'JSON',
        'BigInteger',
        'Boolean',
        'Date',
        'DateTime',
        'Double',
        'Float',
        'ForeignKey',
        'ForeignKeyConstraint',
        'Index',
        'Integer',
        'LargeBinary',
        'Numeric',
        'String',
        'Text',
        'Time',
        'Uuid',
        'text',
      ]);
      expect(fromImportNames(code, 'sqlalchemy.orm')).toEqual([
        'DeclarativeBase',
        'Mapped',
        'mapped_column',
        'relationship',
      ]);
      expect(fromImportNames(code, 'datetime')).toEqual([
        'date',
        'datetime',
        'time',
      ]);
      expect(fromImportNames(code, 'decimal')).toEqual(['Decimal']);
      expect(fromImportNames(code, 'typing')).toEqual([
        'Any',
        'List',
        'Optional',
      ]);
      expect(
        fromImportNames(
          createCode(createPostgresImportState()),
          'sqlalchemy.dialects.postgresql'
        )
      ).toEqual(['JSONB', 'UUID']);
    });

    it('emits no Mapped or mapped_column import for a table with no columns', () => {
      const table = createTable({ id: 't1', name: 'empty' });
      const state = createState({ tables: [table] });

      expect(render(state, table)).toEqual([
        'from sqlalchemy.orm import DeclarativeBase',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class Empty(Base):',
        '    __tablename__ = "empty"',
      ]);
    });
  });

  describe('name cases', () => {
    const table = createTable({
      id: 't1',
      name: 'user_table',
      columnIds: ['c1'],
    });
    const column = createColumn({
      id: 'c1',
      tableId: 't1',
      name: 'user_name',
      dataType: 'VARCHAR(10)',
      options: ColumnOption.notNull,
    });

    const cases: Array<[string, number, number, string, string]> = [
      ['none', NameCase.none, NameCase.none, 'user_table', 'user_name'],
      [
        'camelCase',
        NameCase.camelCase,
        NameCase.camelCase,
        'userTable',
        'userName',
      ],
      [
        'pascalCase',
        NameCase.pascalCase,
        NameCase.pascalCase,
        'UserTable',
        'UserName',
      ],
      [
        'snakeCase',
        NameCase.snakeCase,
        NameCase.snakeCase,
        'user_table',
        'user_name',
      ],
    ];

    it.each(cases)(
      'applies the %s name case to the class and the attribute',
      (_name, tableNameCase, columnNameCase, className, attribute) => {
        const state = createState({
          tables: [table],
          columns: [column],
          settings: {
            database: Database.MySQL,
            tableNameCase,
            columnNameCase,
          },
        });
        const positional = attribute === 'user_name' ? '' : '"user_name", ';

        expect(createCode(state).split('\n').slice(-5, -1)).toEqual([
          `class ${className}(Base):`,
          '    __tablename__ = "user_table"',
          '',
          `    ${attribute}: Mapped[str] = mapped_column(${positional}String(10), nullable=False)`,
        ]);
      }
    );

    it('keeps the raw table and column names on the database side', () => {
      const state = createState({
        tables: [table],
        columns: [column],
        settings: {
          database: Database.MySQL,
          tableNameCase: NameCase.pascalCase,
          columnNameCase: NameCase.pascalCase,
        },
      });

      expect(createCode(state)).toContain('__tablename__ = "user_table"');
      expect(createCode(state)).toContain('mapped_column("user_name"');
    });
  });

  describe('constraints', () => {
    it('emits autoincrement and suppresses the server default it would conflict with', () => {
      const table = createTable({
        id: 't1',
        name: 'seq',
        columnIds: ['c1', 'c2'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'INT',
            default: '1',
            options: ColumnOption.primaryKey | ColumnOption.autoIncrement,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'slug',
            dataType: 'VARCHAR(10)',
            default: "'draft'",
            options: ColumnOption.unique,
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table).slice(-6)).toEqual([
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)',
        '    slug: Mapped[Optional[str]] = mapped_column(',
        '        String(10),',
        '        unique=True,',
        '        server_default=text("\'draft\'"),',
        '    )',
      ]);
    });

    it('never emits nullable=True; the Optional annotation carries it', () => {
      const table = createTable({
        id: 't1',
        name: 'opt',
        columnIds: ['c1'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'note',
            dataType: 'VARCHAR(10)',
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(createCode(state)).not.toContain('nullable=True');
      expect(createCode(state)).toContain(
        '    note: Mapped[Optional[str]] = mapped_column(String(10))'
      );
    });

    it('omits nullable=False on a primary key and skips a whitespace-only comment or default', () => {
      const table = createTable({
        id: 't1',
        name: 'blank',
        comment: '   ',
        columnIds: ['c1'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType: 'INT',
            comment: '   ',
            default: '   ',
            options: ColumnOption.primaryKey | ColumnOption.notNull,
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table).slice(-3)).toEqual([
        '    __tablename__ = "blank"',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
      ]);
    });

    it('escapes a quote, a backslash and a newline in a default, a comment and a name', () => {
      const table = createTable({
        id: 't1',
        name: 'we"ird',
        comment: 'line one\nline "two"',
        columnIds: ['c1'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'pa"th',
            dataType: 'VARCHAR(10)',
            comment: 'a\\b',
            default: 'a"b\\c',
            options: ColumnOption.notNull,
          }),
        ],
        settings: {
          database: Database.MySQL,
          tableNameCase: NameCase.none,
          columnNameCase: NameCase.none,
        },
      });

      expect(render(state, table)).toEqual([
        'from sqlalchemy import String, text',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class we_ird(Base):',
        '    """line one line \\"two\\" """',
        '',
        '    __tablename__ = "we\\"ird"',
        '    __table_args__ = {"comment": "line one line \\"two\\""}',
        '',
        '    pa_th: Mapped[str] = mapped_column(',
        '        "pa\\"th",',
        '        String(10),',
        '        nullable=False,',
        '        server_default=text("a\\"b\\\\c"),',
        '        comment="a\\\\b",',
        '    )',
      ]);
    });

    // Each escape is global: one backslash left raw makes the module a
    // SyntaxError ("invalid escape sequence \\c"), one newline left in place
    // ends the string early ("EOL while scanning string literal"), and a CRLF
    // matched as two breaks leaves a double space in the comment.
    it('escapes every backslash and every newline, and a CRLF only once', () => {
      const table = createTable({
        id: 't1',
        name: 'escapes',
        comment: 'one\r\ntwo',
        columnIds: ['p1', 'c1'],
      });
      const state = createState({
        tables: [table],
        columns: [
          primaryKey('p1', 't1'),
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'path',
            dataType: 'VARCHAR(10)',
            comment: 'a\\b\\c',
            default: "'x\ny\nz'",
            options: ColumnOption.notNull,
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toEqual([
        'from sqlalchemy import Integer, String, text',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class Escapes(Base):',
        '    """one two"""',
        '',
        '    __tablename__ = "escapes"',
        '    __table_args__ = {"comment": "one two"}',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    path: Mapped[str] = mapped_column(',
        '        String(10),',
        '        nullable=False,',
        '        server_default=text("\'x y z\'"),',
        '        comment="a\\\\b\\\\c",',
        '    )',
      ]);
    });

    // A classic-Mac lone CR is a line break as well, and Python's tokenizer
    // reads one in source as a newline: left in the literal it ends the string
    // early and the module dies at import with SyntaxError ("EOL while
    // scanning string literal"). Flattened, the module imports and create_all
    // runs clean.
    it('flattens a lone carriage return in a comment and a default', () => {
      const table = createTable({
        id: 't1',
        name: 'cr_table',
        comment: 'one\rtwo',
        columnIds: ['p1', 'c1'],
      });
      const state = createState({
        tables: [table],
        columns: [
          primaryKey('p1', 't1'),
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'note',
            dataType: 'VARCHAR(10)',
            comment: 'left\rright',
            default: "'a\rb'",
            options: ColumnOption.notNull,
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toEqual([
        'from sqlalchemy import Integer, String, text',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class CrTable(Base):',
        '    """one two"""',
        '',
        '    __tablename__ = "cr_table"',
        '    __table_args__ = {"comment": "one two"}',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    note: Mapped[str] = mapped_column(',
        '        String(10),',
        '        nullable=False,',
        '        server_default=text("\'a b\'"),',
        '        comment="left right",',
        '    )',
      ]);
    });

    // A comment of nothing but spaces is a comment the document does not
    // carry: it reaches neither the docstring nor `__table_args__`.
    it('ignores a table comment that is only whitespace', () => {
      const table = createTable({
        id: 't1',
        name: 'blank',
        comment: '   ',
        columnIds: ['c1'],
      });
      const state = createState({
        tables: [table],
        columns: [primaryKey('c1', 't1')],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toEqual([
        'from sqlalchemy import Integer',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class Blank(Base):',
        '    __tablename__ = "blank"',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
      ]);
    });
  });

  describe('identifiers', () => {
    it('escapes Python keywords and DeclarativeBase-reserved attribute names', () => {
      const table = createTable({
        id: 't1',
        name: 'class',
        columnIds: ['c1', 'c2', 'c3'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'class',
            dataType: 'INT',
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'metadata',
            dataType: 'INT',
          }),
          createColumn({
            id: 'c3',
            tableId: 't1',
            name: '2nd place!',
            dataType: 'INT',
          }),
        ],
        settings: {
          database: Database.MySQL,
          tableNameCase: NameCase.none,
          columnNameCase: NameCase.none,
        },
      });

      expect(render(state, table).slice(-6, -2)).toEqual([
        'class class_(Base):',
        '    __tablename__ = "class"',
        '',
        '    class_: Mapped[Optional[int]] = mapped_column("class", Integer)',
      ]);
      expect(createCode(state)).toContain(
        '    metadata_: Mapped[Optional[int]] = mapped_column("metadata", Integer)'
      );
      expect(createCode(state)).toContain(
        '    x2nd_place_: Mapped[Optional[int]] = mapped_column("2nd place!", Integer)'
      );
    });

    it('renames a metadata column but not a registry one', () => {
      const table = createTable({
        id: 't1',
        name: 'note',
        columnIds: ['c1', 'c2'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'registry',
            dataType: 'INT',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'metadata',
            dataType: 'INT',
          }),
        ],
        settings: { database: Database.MySQL, columnNameCase: NameCase.none },
      });
      const code = createCode(state);

      expect(code).toContain(
        '    registry: Mapped[int] = mapped_column(Integer, primary_key=True)'
      );
      expect(code).toContain(
        '    metadata_: Mapped[Optional[int]] = mapped_column("metadata", Integer)'
      );
    });

    it('deduplicates a class name two tables would both claim', () => {
      const spaced = createTable({
        id: 't_1',
        name: 'user post',
        columnIds: ['x1'],
      });
      const scored = createTable({
        id: 't_2',
        name: 'user_post',
        columnIds: ['x2'],
      });
      const state = createState({
        tables: [spaced, scored],
        columns: [
          createColumn({
            id: 'x1',
            tableId: 't_1',
            name: 'id',
            dataType: 'INT',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'x2',
            tableId: 't_2',
            name: 'id',
            dataType: 'INT',
            options: ColumnOption.primaryKey,
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(createCode(state)).toContain('class UserPost(Base):');
      expect(createCode(state)).toContain('class UserPost_2(Base):');
      expect(render(state, spaced)).toContain('class UserPost(Base):');
      expect(render(state, scored)).toContain('class UserPost_2(Base):');
    });

    // Which of two colliding tables keeps the un-suffixed class name is
    // decided by the order `createClassContext` pre-resolves them, and that
    // loop only matches `createCode`'s emission order because it sorts the
    // same way. Drop the sort and it walks `doc.tableIds` instead: both names
    // are still unique and the module still imports clean, so nothing fails --
    // the `_2` just moves to the other table, silently renaming the class a
    // saved document already generated.
    it('gives the un-suffixed class name to the table emitted first, not the one listed first', () => {
      // sorted by name, "zeta profile" precedes "zeta_profile" -- the reverse
      // of the document order below
      const listedFirst = createTable({
        id: 'ta',
        name: 'zeta_profile',
        columnIds: ['a_id'],
      });
      const emittedFirst = createTable({
        id: 'tz',
        name: 'zeta profile',
        columnIds: ['z_id'],
      });
      const state = createState({
        tables: [listedFirst, emittedFirst],
        columns: [primaryKey('a_id', 'ta'), primaryKey('z_id', 'tz')],
        settings: {
          database: Database.MySQL,
          tableNameCase: NameCase.pascalCase,
        },
      });
      const code = createCode(state);

      expect(code).toContain(
        'class ZetaProfile(Base):\n    __tablename__ = "zeta profile"'
      );
      expect(code).toContain(
        'class ZetaProfile_2(Base):\n    __tablename__ = "zeta_profile"'
      );
      expect(render(state, emittedFirst)).toContain('class ZetaProfile(Base):');
      expect(render(state, listedFirst)).toContain(
        'class ZetaProfile_2(Base):'
      );
    });

    it('deduplicates an attribute name a relationship would collide with', () => {
      const team = createTable({
        id: 't_team',
        name: 'team',
        columnIds: ['t_id'],
      });
      const player = createTable({
        id: 't_player',
        name: 'player',
        // a plain column already holds the name the relationship wants
        columnIds: ['p_team', 'p_team_id'],
      });
      const state = createState({
        tables: [player, team],
        columns: [
          createColumn({
            id: 't_id',
            tableId: 't_team',
            name: 'id',
            dataType: 'INT',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'p_team',
            tableId: 't_player',
            name: 'team',
            dataType: 'VARCHAR(10)',
          }),
          createColumn({
            id: 'p_team_id',
            tableId: 't_player',
            name: 'team_id',
            dataType: 'INT',
            options: ColumnOption.notNull,
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't_team', columnIds: ['t_id'] },
            end: { tableId: 't_player', columnIds: ['p_team_id'] },
          }),
        ],
        settings: { database: Database.MySQL, columnNameCase: NameCase.none },
      });

      expect(render(state, player).slice(-4)).toEqual([
        '    team: Mapped[Optional[str]] = mapped_column(String(10))',
        '    team_id: Mapped[int] = mapped_column(Integer, ForeignKey("team.id"), nullable=False)',
        '',
        '    team_2: Mapped["Team"] = relationship(back_populates="playerList")',
      ]);
      expect(render(state, team).at(-1)).toBe(
        '    playerList: Mapped[List["Player"]] = relationship(back_populates="team_2")'
      );
    });

    // Verified against SQLAlchemy 2.0.52 with `warnings.simplefilter("error")`,
    // importing the module and running `configure_mappers()` and
    // `create_all(create_engine("sqlite://"))`. Before the repair each of these
    // three failed differently: `__secret` reached the database as
    // `_zzz__secret`, `__doc__` and `__dict__` left no column at all while
    // `createSchemaSQL` still declared them, and `_sa_registry` raised
    // AttributeError ("'MappedColumn' object has no attribute 'constructor'")
    // at import.
    it('moves a leading-underscore column off the namespace it does not own', () => {
      const { state, table } = createUnderscoreFixture(NameCase.none);

      expect(render(state, table).slice(-11)).toEqual([
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    x__secret: Mapped[Optional[str]] = mapped_column("__secret", String(5))',
        '    x__x__: Mapped[Optional[str]] = mapped_column("__x__", String(5))',
        '    x__doc__: Mapped[Optional[str]] = mapped_column("__doc__", String(5))',
        '    x__dict__: Mapped[Optional[str]] = mapped_column("__dict__", String(5))',
        '    x_sa_class_manager: Mapped[Optional[str]] = mapped_column(',
        '        "_sa_class_manager",',
        '        String(5),',
        '    )',
        '    x_sa_registry: Mapped[Optional[str]] = mapped_column("_sa_registry", String(5))',
        '    x_leading: Mapped[Optional[str]] = mapped_column("_leading", String(5))',
      ]);
    });

    it('keeps the database name when a name case has already dropped the underscores', () => {
      const { state, table } = createUnderscoreFixture(NameCase.snakeCase);

      expect(render(state, table).slice(-11)).toEqual([
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    secret: Mapped[Optional[str]] = mapped_column("__secret", String(5))',
        '    x: Mapped[Optional[str]] = mapped_column("__x__", String(5))',
        '    doc: Mapped[Optional[str]] = mapped_column("__doc__", String(5))',
        '    dict: Mapped[Optional[str]] = mapped_column("__dict__", String(5))',
        '    sa_class_manager: Mapped[Optional[str]] = mapped_column(',
        '        "_sa_class_manager",',
        '        String(5),',
        '    )',
        '    sa_registry: Mapped[Optional[str]] = mapped_column("_sa_registry", String(5))',
        '    leading: Mapped[Optional[str]] = mapped_column("_leading", String(5))',
      ]);
    });

    it('moves a leading-underscore table name off the class it would shadow', () => {
      const { state, table } = createUnderscoreTableFixture(NameCase.none);

      expect(render(state, table).slice(-9)).toEqual([
        'class x__thing(Base):',
        '    __tablename__ = "__thing"',
        '    __table_args__ = (',
        '        Index("IDX___thing", "x__a_b"),',
        '    )',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    x__a_b: Mapped[Optional[str]] = mapped_column("__a.b", String(5), key="x__a_b")',
        '    x__metadata: Mapped[Optional[str]] = mapped_column("__metadata", String(5))',
      ]);
    });

    it('leaves the table name alone when a name case has already dropped the underscores', () => {
      const { state, table } = createUnderscoreTableFixture(
        NameCase.pascalCase
      );

      expect(render(state, table).slice(-9)).toEqual([
        'class Thing(Base):',
        '    __tablename__ = "__thing"',
        '    __table_args__ = (',
        '        Index("IDX___thing", "AB"),',
        '    )',
        '',
        '    Id: Mapped[int] = mapped_column("id", Integer, primary_key=True)',
        '    AB: Mapped[Optional[str]] = mapped_column("__a.b", String(5), key="AB")',
        '    Metadata: Mapped[Optional[str]] = mapped_column("__metadata", String(5))',
      ]);
    });

    it('names the moved attribute in back_populates and remote_side', () => {
      const { state, child } = createUnderscoreRelationFixture(NameCase.none);

      expect(render(state, child).slice(-24)).toEqual([
        'class x__child(Base):',
        '    __tablename__ = "__child"',
        '',
        '    x__id: Mapped[int] = mapped_column("__id", Integer, primary_key=True)',
        '    x__secret_id: Mapped[int] = mapped_column(',
        '        "__secret_id",',
        '        Integer,',
        '        ForeignKey("__thing.__id"),',
        '        nullable=False,',
        '    )',
        '    x__parent_id: Mapped[Optional[int]] = mapped_column(',
        '        "__parent_id",',
        '        Integer,',
        '        ForeignKey("__child.__id"),',
        '    )',
        '',
        '    x__thing: Mapped["x__thing"] = relationship(back_populates="x__childList")',
        '    parent___child: Mapped[Optional["x__child"]] = relationship(',
        '        back_populates="x__childList",',
        '        remote_side="[x__child.x__id]",',
        '    )',
        '    x__childList: Mapped[List["x__child"]] = relationship(',
        '        back_populates="parent___child",',
        '    )',
      ]);
    });

    it('keeps the foreign key targets when a name case renames the attributes', () => {
      const { state, child } = createUnderscoreRelationFixture(
        NameCase.pascalCase
      );

      expect(render(state, child).slice(-22)).toEqual([
        'class Child(Base):',
        '    __tablename__ = "__child"',
        '',
        '    Id: Mapped[int] = mapped_column("__id", Integer, primary_key=True)',
        '    SecretId: Mapped[int] = mapped_column(',
        '        "__secret_id",',
        '        Integer,',
        '        ForeignKey("__thing.__id"),',
        '        nullable=False,',
        '    )',
        '    ParentId: Mapped[Optional[int]] = mapped_column(',
        '        "__parent_id",',
        '        Integer,',
        '        ForeignKey("__child.__id"),',
        '    )',
        '',
        '    Thing: Mapped["Thing"] = relationship(back_populates="ChildList")',
        '    ParentChild: Mapped[Optional["Child"]] = relationship(',
        '        back_populates="ChildList",',
        '        remote_side="[Child.Id]",',
        '    )',
        '    ChildList: Mapped[List["Child"]] = relationship(back_populates="ParentChild")',
      ]);
    });

    it('names the moved attribute in foreign_keys', () => {
      const { state, left } = createUnderscoreAmbiguousFixture();

      expect(render(state, left).slice(-18)).toEqual([
        'class x__a(Base):',
        '    __tablename__ = "__a"',
        '',
        '    x__id: Mapped[int] = mapped_column("__id", Integer, primary_key=True)',
        '    x__b_id: Mapped[Optional[int]] = mapped_column(',
        '        "__b_id",',
        '        Integer,',
        '        ForeignKey("__b.__id"),',
        '    )',
        '',
        '    x__b: Mapped[Optional["x__b"]] = relationship(',
        '        back_populates="x__aList",',
        '        foreign_keys="[x__a.x__b_id]",',
        '    )',
        '    x__bList: Mapped[List["x__b"]] = relationship(',
        '        back_populates="x__a",',
        '        foreign_keys="[x__b.x__a_id]",',
        '    )',
      ]);
    });

    // Three column names normalize to `a_b`, so `uniqueName` has to keep
    // counting: stopping after one retry hands `a-b` and `a+b` the same
    // attribute, and the later class-body assignment wins -- the model loses
    // `a-b` entirely while the DDL still declares it.
    it('keeps numbering past the second collision on one attribute name', () => {
      const table = createTable({
        id: 't1',
        name: 'collide',
        columnIds: ['a', 'b', 'c', 'd'],
      });
      const state = createState({
        tables: [table],
        columns: [
          primaryKey('a', 't1'),
          createColumn({
            id: 'b',
            tableId: 't1',
            name: 'a b',
            dataType: 'VARCHAR(10)',
          }),
          createColumn({
            id: 'c',
            tableId: 't1',
            name: 'a-b',
            dataType: 'VARCHAR(10)',
          }),
          createColumn({
            id: 'd',
            tableId: 't1',
            name: 'a+b',
            dataType: 'VARCHAR(10)',
          }),
        ],
        settings: {
          database: Database.MySQL,
          columnNameCase: NameCase.none,
        },
      });

      expect(render(state, table)).toEqual([
        'from typing import Optional',
        '',
        'from sqlalchemy import Integer, String',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class Collide(Base):',
        '    __tablename__ = "collide"',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    a_b: Mapped[Optional[str]] = mapped_column("a b", String(10))',
        '    a_b_2: Mapped[Optional[str]] = mapped_column("a-b", String(10))',
        '    a_b_3: Mapped[Optional[str]] = mapped_column("a+b", String(10))',
      ]);
    });
  });

  describe('relationships', () => {
    it('emits a single-column ForeignKey on the child column', () => {
      const state = createOneToManyState(RelationshipType.ZeroN);

      expect(
        render(state, state.collections.tableEntities['t_post']).slice(-4)
      ).toEqual([
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("user.id"), nullable=False)',
        '',
        '    user: Mapped["User"] = relationship(back_populates="postList")',
      ]);
    });

    // Pins the guarantee `formatRelation` leans on for its `Optional` import:
    // every column a relationship names belongs to the table at that end.
    it('drops a relationship whose end column the table does not hold', () => {
      const user = createTable({
        id: 't_user',
        name: 'user',
        columnIds: ['u_id'],
      });
      const post = createTable({
        id: 't_post',
        name: 'post',
        columnIds: ['p_id'],
      });
      const state = createState({
        tables: [user, post],
        columns: [
          primaryKey('u_id', 't_user'),
          primaryKey('p_id', 't_post'),
          // a stray column, left on `user` rather than on `post`
          createColumn({
            id: 'p_user_id',
            tableId: 't_user',
            name: 'user_id',
            dataType: 'INT',
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't_user', columnIds: ['u_id'] },
            end: { tableId: 't_post', columnIds: ['p_user_id'] },
          }),
        ],
        settings: { database: Database.MySQL, columnNameCase: NameCase.none },
      });
      const code = createCode(state);

      expect(code).not.toContain('ForeignKey');
      expect(code).not.toContain('relationship');
    });

    // Asserted whole so the `from typing import Optional` line is pinned: the
    // annotation is a NameError away from an unimportable module.
    it('marks the parent Optional when the foreign key is nullable', () => {
      const state = createOneToManyState(RelationshipType.ZeroN, 0);

      expect(render(state, state.collections.tableEntities['t_post'])).toEqual([
        'from typing import Optional',
        '',
        'from sqlalchemy import ForeignKey, Integer',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class Post(Base):',
        '    __tablename__ = "post"',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("user.id"))',
        '',
        '    user: Mapped[Optional["User"]] = relationship(back_populates="postList")',
      ]);
    });

    // `user`'s one column is its primary key, so the scalar relationship is the
    // only Optional here -- the parent side has to import the name itself.
    it('renders a one relationship as a scalar on both sides', () => {
      const state = createOneToManyState(RelationshipType.ZeroOne);

      expect(render(state, state.collections.tableEntities['t_user'])).toEqual([
        'from typing import Optional',
        '',
        'from sqlalchemy import Integer',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class User(Base):',
        '    __tablename__ = "user"',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '',
        '    post: Mapped[Optional["Post"]] = relationship(back_populates="user")',
      ]);
    });

    it('emits foreign_keys on both sides when two relationships join the same pair', () => {
      const user = createTable({
        id: 't_user',
        name: 'user',
        columnIds: ['u'],
      });
      const message = createTable({
        id: 't_msg',
        name: 'message',
        columnIds: ['m_from', 'm_to'],
      });
      const state = createState({
        tables: [user, message],
        columns: [
          createColumn({
            id: 'u',
            tableId: 't_user',
            name: 'id',
            dataType: 'INT',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'm_from',
            tableId: 't_msg',
            name: 'from_id',
            dataType: 'INT',
            options: ColumnOption.notNull,
          }),
          createColumn({
            id: 'm_to',
            tableId: 't_msg',
            name: 'to_id',
            dataType: 'INT',
            options: ColumnOption.notNull,
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't_user', columnIds: ['u'] },
            end: { tableId: 't_msg', columnIds: ['m_from'] },
          }),
          createRelationship({
            id: 'r2',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't_user', columnIds: ['u'] },
            end: { tableId: 't_msg', columnIds: ['m_to'] },
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, message).slice(-8)).toEqual([
        '    user: Mapped["User"] = relationship(',
        '        back_populates="messageList",',
        '        foreign_keys="[Message.fromId]",',
        '    )',
        '    user_2: Mapped["User"] = relationship(',
        '        back_populates="messageList_2",',
        '        foreign_keys="[Message.toId]",',
        '    )',
      ]);
      expect(render(state, user).slice(-8)).toEqual([
        '    messageList: Mapped[List["Message"]] = relationship(',
        '        back_populates="user",',
        '        foreign_keys="[Message.fromId]",',
        '    )',
        '    messageList_2: Mapped[List["Message"]] = relationship(',
        '        back_populates="user_2",',
        '        foreign_keys="[Message.toId]",',
        '    )',
      ]);
    });

    it('emits foreign_keys on all four relationships when two tables reference each other', () => {
      const { state, article, content } = createMutualForeignKeyFixture();

      expect(render(state, article).slice(-8)).toEqual([
        '    content: Mapped[Optional["Content"]] = relationship(',
        '        back_populates="articleList",',
        '        foreign_keys="[Article.contentId]",',
        '    )',
        '    contentList: Mapped[List["Content"]] = relationship(',
        '        back_populates="article",',
        '        foreign_keys="[Content.articleId]",',
        '    )',
      ]);
      expect(render(state, content).slice(-8)).toEqual([
        '    article: Mapped[Optional["Article"]] = relationship(',
        '        back_populates="contentList",',
        '        foreign_keys="[Content.articleId]",',
        '    )',
        '    articleList: Mapped[List["Article"]] = relationship(',
        '        back_populates="content",',
        '        foreign_keys="[Article.contentId]",',
        '    )',
      ]);
    });

    it('counts a foreign key the document carries without a relationship', () => {
      const user = createTable({
        id: 't_user',
        name: 'user',
        columnIds: ['u'],
      });
      const post = createTable({
        id: 't_post',
        name: 'post',
        columnIds: ['p_author', 'p_editor'],
      });
      const state = createState({
        tables: [user, post],
        columns: [
          createColumn({
            id: 'u',
            tableId: 't_user',
            name: 'id',
            dataType: 'INT',
            options: ColumnOption.primaryKey,
          }),
          createColumn({
            id: 'p_author',
            tableId: 't_post',
            name: 'author_id',
            dataType: 'INT',
          }),
          createColumn({
            id: 'p_editor',
            tableId: 't_post',
            name: 'editor_id',
            dataType: 'INT',
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't_user', columnIds: ['u'] },
            end: { tableId: 't_post', columnIds: ['p_author'] },
          }),
          // no relationship() of its own, but still a second join path
          createRelationship({
            id: 'r2',
            relationshipType: 0,
            start: { tableId: 't_user', columnIds: ['u'] },
            end: { tableId: 't_post', columnIds: ['p_editor'] },
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, post).slice(-4)).toEqual([
        '    user: Mapped[Optional["User"]] = relationship(',
        '        back_populates="postList",',
        '        foreign_keys="[Post.authorId]",',
        '    )',
      ]);
    });

    it('emits no relationship when the type is neither one nor N, but keeps the foreign key', () => {
      const state = createOneToManyState(0);

      expect(
        render(state, state.collections.tableEntities['t_post']).slice(-2)
      ).toEqual([
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("user.id"), nullable=False)',
      ]);
      expect(
        render(state, state.collections.tableEntities['t_user']).at(-1)
      ).toBe('    id: Mapped[int] = mapped_column(Integer, primary_key=True)');
    });

    it('skips a relationship whose table or column cannot be resolved', () => {
      const post = createTable({ id: 't_post', name: 'post', columnIds: [] });
      const orphan = createTable({ id: 't_orphan', name: 'orphan' });
      const state = createState({
        tables: [post, orphan],
        relationships: [
          createRelationship({
            id: 'r_no_table',
            relationshipType: RelationshipType.OneN,
            start: { tableId: 'gone', columnIds: [] },
            end: { tableId: 't_post', columnIds: [] },
          }),
          createRelationship({
            id: 'r_no_columns',
            relationshipType: RelationshipType.OneN,
            start: { tableId: 't_orphan', columnIds: [] },
            end: { tableId: 't_post', columnIds: ['missing'] },
          }),
        ],
      });

      expect(render(state, post)).toEqual([
        'from sqlalchemy.orm import DeclarativeBase',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class Post(Base):',
        '    __tablename__ = "post"',
      ]);
    });

    // Every other guard in `resolveRelationships` passes here: both tables
    // resolve, neither column list lost an id, and every column belongs to the
    // table naming it -- only the arity check stands between a two-column
    // parent end and a one-column child end. Without it the pair renders as a
    // plain single-column `ForeignKey("parent.a")`, quietly dropping
    // `parent.b`: the module imports and `configure_mappers()` is happy, but
    // `create_all` writes `FOREIGN KEY(parent_a) REFERENCES parent (a)`
    // against a composite primary key, and the first insert fails with
    // OperationalError (foreign key mismatch - "child" referencing "parent")
    // while `child.parent` joins on half the composite key.
    it('drops a relationship whose two ends name a different number of columns', () => {
      const parent = createTable({
        id: 't_parent',
        name: 'parent',
        columnIds: ['p_a', 'p_b'],
      });
      const child = createTable({
        id: 't_child',
        name: 'child',
        columnIds: ['c_id', 'c_parent_a'],
      });
      const state = createState({
        tables: [parent, child],
        columns: [
          primaryKey('p_a', 't_parent', 'a'),
          primaryKey('p_b', 't_parent', 'b'),
          primaryKey('c_id', 't_child'),
          createColumn({
            id: 'c_parent_a',
            tableId: 't_child',
            name: 'parent_a',
            dataType: 'INT',
            options: ColumnOption.notNull,
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't_parent', columnIds: ['p_a', 'p_b'] },
            end: { tableId: 't_child', columnIds: ['c_parent_a'] },
          }),
        ],
        settings: { database: Database.MySQL, columnNameCase: NameCase.none },
      });
      const code = createCode(state);

      // no half-key foreign key, and no relationship() pair built on one
      expect(code).not.toContain('ForeignKey');
      expect(code).not.toContain('relationship(');
      expect(render(state, child).slice(-2)).toEqual([
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    parent_a: Mapped[int] = mapped_column(Integer, nullable=False)',
      ]);
    });

    // `columnIds` defaults to `[]` in the v3 parser, and a non-array is
    // coerced to `[]` too, so a relationship naming no column at all is a
    // document the parser produces. It cannot become a foreign key: the pair
    // renders as `ForeignKeyConstraint([], [])` and `configure_mappers()`
    // raises NoForeignKeysError ("Could not determine join condition between
    // parent/child tables on relationship Child.parent - there are no foreign
    // keys linking these tables").
    it('skips a relationship whose ends name no columns', () => {
      const parent = createTable({
        id: 'tp',
        name: 'parent',
        columnIds: ['cp'],
      });
      const child = createTable({ id: 'tc', name: 'child', columnIds: ['cc'] });
      const state = createState({
        tables: [parent, child],
        columns: [primaryKey('cp', 'tp'), primaryKey('cc', 'tc', 'parent_id')],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 'tp', columnIds: [] },
            end: { tableId: 'tc', columnIds: [] },
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(createCode(state).split('\n').slice(1, -1)).toEqual([
        'from sqlalchemy import Integer',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class Child(Base):',
        '    __tablename__ = "child"',
        '',
        '    parentId: Mapped[int] = mapped_column("parent_id", Integer, primary_key=True)',
        '',
        '',
        'class Parent(Base):',
        '    __tablename__ = "parent"',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
      ]);
    });

    // Each of these is the only guard standing between the relationship and a
    // foreign key: the others let it through. Every one of them would emit a
    // `ForeignKey` naming a table or column the document cannot resolve.
    it('skips a relationship whose ends do not resolve, one reason at a time', () => {
      const parent = createTable({
        id: 'tp',
        name: 'parent',
        columnIds: ['cp'],
      });
      const child = createTable({
        id: 'tc',
        name: 'child',
        columnIds: ['cc', 'ck'],
      });
      const state = createState({
        tables: [parent, child],
        columns: [
          primaryKey('cp', 'tp'),
          primaryKey('cc', 'tc'),
          createColumn({
            id: 'ck',
            tableId: 'tc',
            name: 'parent_id',
            dataType: 'INT',
          }),
        ],
        relationships: [
          // the start table is gone
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 'gone', columnIds: ['cp'] },
            end: { tableId: 'tc', columnIds: ['ck'] },
          }),
          // the end table is gone
          createRelationship({
            id: 'r2',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 'tp', columnIds: ['cp'] },
            end: { tableId: 'gone', columnIds: ['ck'] },
          }),
          // a start column id resolves to nothing, and the two ends still come
          // out the same length, so only the arity check against
          // `start.columnIds` catches it
          createRelationship({
            id: 'r3',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 'tp', columnIds: ['cp', 'gone'] },
            end: { tableId: 'tc', columnIds: ['ck'] },
          }),
          // the same on the end side
          createRelationship({
            id: 'r4',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 'tp', columnIds: ['cp'] },
            end: { tableId: 'tc', columnIds: ['ck', 'gone'] },
          }),
          // a start column that belongs to the child, not to the parent it is
          // named on -- the mirror of the end-side check above
          createRelationship({
            id: 'r5',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 'tp', columnIds: ['cc'] },
            end: { tableId: 'tc', columnIds: ['ck'] },
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(createCode(state).split('\n').slice(1, -1)).toEqual([
        'from typing import Optional',
        '',
        'from sqlalchemy import Integer',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class Child(Base):',
        '    __tablename__ = "child"',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    parentId: Mapped[Optional[int]] = mapped_column("parent_id", Integer)',
        '',
        '',
        'class Parent(Base):',
        '    __tablename__ = "parent"',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
      ]);
    });

    // Two parents can land on one child column, and both foreign keys have to
    // reach it: `mapped_column` takes them as separate positional arguments.
    // Keeping only the last leaves `Alpha.childList` with nothing to join on
    // and `configure_mappers()` raises NoForeignKeysError.
    it('keeps every foreign key that lands on one child column', () => {
      const alpha = createTable({ id: 'ta', name: 'alpha', columnIds: ['ca'] });
      const beta = createTable({ id: 'tb', name: 'beta', columnIds: ['cb'] });
      const child = createTable({
        id: 'tc',
        name: 'child',
        columnIds: ['cc', 'ck'],
      });
      const state = createState({
        tables: [alpha, beta, child],
        columns: [
          primaryKey('ca', 'ta'),
          primaryKey('cb', 'tb'),
          primaryKey('cc', 'tc'),
          createColumn({
            id: 'ck',
            tableId: 'tc',
            name: 'ref_id',
            dataType: 'INT',
            options: ColumnOption.notNull,
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 'ta', columnIds: ['ca'] },
            end: { tableId: 'tc', columnIds: ['ck'] },
          }),
          createRelationship({
            id: 'r2',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 'tb', columnIds: ['cb'] },
            end: { tableId: 'tc', columnIds: ['ck'] },
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(createCode(state).split('\n').slice(1, -1)).toEqual([
        'from typing import List',
        '',
        'from sqlalchemy import ForeignKey, Integer',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class Alpha(Base):',
        '    __tablename__ = "alpha"',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '',
        '    childList: Mapped[List["Child"]] = relationship(back_populates="alpha")',
        '',
        '',
        'class Beta(Base):',
        '    __tablename__ = "beta"',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '',
        '    childList: Mapped[List["Child"]] = relationship(back_populates="beta")',
        '',
        '',
        'class Child(Base):',
        '    __tablename__ = "child"',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    refId: Mapped[int] = mapped_column(',
        '        "ref_id",',
        '        Integer,',
        '        ForeignKey("alpha.id"),',
        '        ForeignKey("beta.id"),',
        '        nullable=False,',
        '    )',
        '',
        '    alpha: Mapped["Alpha"] = relationship(back_populates="childList")',
        '    beta: Mapped["Beta"] = relationship(back_populates="childList")',
      ]);
    });

    // The parent is required only when *every* column carrying the composite
    // key is one: `code` is nullable here, so the row can exist with no
    // parent and the annotation has to say so. `Mapped["Parent"]` would be a
    // lie the type checker believes -- SQLAlchemy itself loads None either
    // way.
    it('marks the parent Optional when one half of a composite key is nullable', () => {
      const parent = createTable({
        id: 'tp',
        name: 'parent',
        columnIds: ['p1', 'p2'],
      });
      const child = createTable({
        id: 'tc',
        name: 'child',
        columnIds: ['c0', 'c1', 'c2'],
      });
      const state = createState({
        tables: [parent, child],
        columns: [
          primaryKey('p1', 'tp', 'tenant_id'),
          primaryKey('p2', 'tp', 'code'),
          primaryKey('c0', 'tc'),
          createColumn({
            id: 'c1',
            tableId: 'tc',
            name: 'tenant_id',
            dataType: 'INT',
            options: ColumnOption.notNull,
          }),
          createColumn({
            id: 'c2',
            tableId: 'tc',
            name: 'code',
            dataType: 'INT',
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 'tp', columnIds: ['p1', 'p2'] },
            end: { tableId: 'tc', columnIds: ['c1', 'c2'] },
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(createCode(state).split('\n').slice(1, -1)).toEqual([
        'from typing import List, Optional',
        '',
        'from sqlalchemy import ForeignKeyConstraint, Integer',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class Child(Base):',
        '    __tablename__ = "child"',
        '    __table_args__ = (',
        '        ForeignKeyConstraint(',
        '            ["tenant_id", "code"],',
        '            ["parent.tenant_id", "parent.code"],',
        '        ),',
        '    )',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    tenantId: Mapped[int] = mapped_column("tenant_id", Integer, nullable=False)',
        '    code: Mapped[Optional[int]] = mapped_column(Integer)',
        '',
        '    parent: Mapped[Optional["Parent"]] = relationship(back_populates="childList")',
        '',
        '',
        'class Parent(Base):',
        '    __tablename__ = "parent"',
        '',
        '    tenantId: Mapped[int] = mapped_column("tenant_id", Integer, primary_key=True)',
        '    code: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '',
        '    childList: Mapped[List["Child"]] = relationship(back_populates="parent")',
      ]);
    });

    // The column names inside a ForeignKeyConstraint are Python string
    // literals like every other name the generator writes, so a quote in a
    // column name has to be escaped there too: unescaped, the tuple reads as
    // `["a"b", ...]` and the module never parses (SyntaxError).
    it('escapes a quoted column name inside a ForeignKeyConstraint', () => {
      const parent = createTable({
        id: 'tp',
        name: 'parent',
        columnIds: ['p1', 'p2'],
      });
      const child = createTable({
        id: 'tc',
        name: 'child',
        columnIds: ['c0', 'c1', 'c2'],
      });
      const state = createState({
        tables: [parent, child],
        columns: [
          primaryKey('p1', 'tp', 'a"b'),
          primaryKey('p2', 'tp', 'code'),
          primaryKey('c0', 'tc'),
          createColumn({
            id: 'c1',
            tableId: 'tc',
            name: 'a"b',
            dataType: 'INT',
            options: ColumnOption.notNull,
          }),
          createColumn({
            id: 'c2',
            tableId: 'tc',
            name: 'code',
            dataType: 'INT',
            options: ColumnOption.notNull,
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 'tp', columnIds: ['p1', 'p2'] },
            end: { tableId: 'tc', columnIds: ['c1', 'c2'] },
          }),
        ],
        settings: { database: Database.MySQL, columnNameCase: NameCase.none },
      });

      expect(createCode(state).split('\n').slice(1, -1)).toEqual([
        'from typing import List',
        '',
        'from sqlalchemy import ForeignKeyConstraint, Integer',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class Child(Base):',
        '    __tablename__ = "child"',
        '    __table_args__ = (',
        '        ForeignKeyConstraint(["a\\"b", "code"], ["parent.a\\"b", "parent.code"]),',
        '    )',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    a_b: Mapped[int] = mapped_column("a\\"b", Integer, nullable=False)',
        '    code: Mapped[int] = mapped_column(Integer, nullable=False)',
        '',
        '    parent: Mapped["Parent"] = relationship(back_populates="childList")',
        '',
        '',
        'class Parent(Base):',
        '    __tablename__ = "parent"',
        '',
        '    a_b: Mapped[int] = mapped_column("a\\"b", Integer, primary_key=True)',
        '    code: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '',
        '    childList: Mapped[List["Child"]] = relationship(back_populates="parent")',
      ]);
    });
  });

  describe('self-referential relationships', () => {
    it('marks the many-to-one end of an adjacency list with remote_side', () => {
      const { state, employee } = createSelfReferenceFixture(
        RelationshipType.ZeroN
      );

      expect(render(state, employee).slice(-7)).toEqual([
        '    parentEmployee: Mapped[Optional["Employee"]] = relationship(',
        '        back_populates="employeeList",',
        '        remote_side="[Employee.id]",',
        '    )',
        '    employeeList: Mapped[List["Employee"]] = relationship(',
        '        back_populates="parentEmployee",',
        '    )',
      ]);
    });

    it('renders a one-to-one self reference as a scalar on both ends', () => {
      const { state, employee } = createSelfReferenceFixture(
        RelationshipType.ZeroOne
      );

      expect(render(state, employee).slice(-7)).toEqual([
        '    parentEmployee: Mapped[Optional["Employee"]] = relationship(',
        '        back_populates="employee",',
        '        remote_side="[Employee.id]",',
        '    )',
        '    employee: Mapped[Optional["Employee"]] = relationship(',
        '        back_populates="parentEmployee",',
        '    )',
      ]);
    });

    it('names every referenced column of a composite self reference', () => {
      const folder = createTable({
        id: 't_folder',
        name: 'folder',
        columnIds: ['f_account', 'f_id', 'f_parent_account', 'f_parent_id'],
      });
      const state = createState({
        tables: [folder],
        columns: [
          createColumn({
            id: 'f_account',
            tableId: 't_folder',
            name: 'account_id',
            dataType: 'INT',
            options: ColumnOption.primaryKey,
            ui: { keys: ColumnUIKey.primaryKey },
          }),
          createColumn({
            id: 'f_id',
            tableId: 't_folder',
            name: 'folder_id',
            dataType: 'INT',
            options: ColumnOption.primaryKey,
            ui: { keys: ColumnUIKey.primaryKey },
          }),
          createColumn({
            id: 'f_parent_account',
            tableId: 't_folder',
            name: 'parent_account_id',
            dataType: 'INT',
          }),
          createColumn({
            id: 'f_parent_id',
            tableId: 't_folder',
            name: 'parent_folder_id',
            dataType: 'INT',
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't_folder', columnIds: ['f_account', 'f_id'] },
            end: {
              tableId: 't_folder',
              columnIds: ['f_parent_account', 'f_parent_id'],
            },
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, folder).slice(-5)).toEqual([
        '    parentFolder: Mapped[Optional["Folder"]] = relationship(',
        '        back_populates="folderList",',
        '        remote_side="[Folder.accountId, Folder.folderId]",',
        '    )',
        '    folderList: Mapped[List["Folder"]] = relationship(back_populates="parentFolder")',
      ]);
    });

    it('emits both foreign_keys and remote_side when a table references itself twice', () => {
      const comment = createTable({
        id: 't_comment',
        name: 'comment',
        columnIds: ['c_id', 'c_parent', 'c_root'],
      });
      const state = createState({
        tables: [comment],
        columns: [
          createColumn({
            id: 'c_id',
            tableId: 't_comment',
            name: 'id',
            dataType: 'INT',
            options: ColumnOption.primaryKey,
            ui: { keys: ColumnUIKey.primaryKey },
          }),
          createColumn({
            id: 'c_parent',
            tableId: 't_comment',
            name: 'parent_id',
            dataType: 'INT',
          }),
          createColumn({
            id: 'c_root',
            tableId: 't_comment',
            name: 'root_id',
            dataType: 'INT',
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't_comment', columnIds: ['c_id'] },
            end: { tableId: 't_comment', columnIds: ['c_parent'] },
          }),
          createRelationship({
            id: 'r2',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't_comment', columnIds: ['c_id'] },
            end: { tableId: 't_comment', columnIds: ['c_root'] },
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, comment).slice(-18)).toEqual([
        '    parentComment: Mapped[Optional["Comment"]] = relationship(',
        '        back_populates="commentList",',
        '        foreign_keys="[Comment.parentId]",',
        '        remote_side="[Comment.id]",',
        '    )',
        '    parentComment_2: Mapped[Optional["Comment"]] = relationship(',
        '        back_populates="commentList_2",',
        '        foreign_keys="[Comment.rootId]",',
        '        remote_side="[Comment.id]",',
        '    )',
        '    commentList: Mapped[List["Comment"]] = relationship(',
        '        back_populates="parentComment",',
        '        foreign_keys="[Comment.parentId]",',
        '    )',
        '    commentList_2: Mapped[List["Comment"]] = relationship(',
        '        back_populates="parentComment_2",',
        '        foreign_keys="[Comment.rootId]",',
        '    )',
      ]);
    });

    it('leaves a relationship to another table unambiguous alongside a self reference', () => {
      const category = createTable({
        id: 't_category',
        name: 'category',
        columnIds: ['k_id', 'k_parent'],
      });
      const item = createTable({
        id: 't_item',
        name: 'item',
        columnIds: ['i_category'],
      });
      const state = createState({
        tables: [category, item],
        columns: [
          createColumn({
            id: 'k_id',
            tableId: 't_category',
            name: 'id',
            dataType: 'INT',
            options: ColumnOption.primaryKey,
            ui: { keys: ColumnUIKey.primaryKey },
          }),
          createColumn({
            id: 'k_parent',
            tableId: 't_category',
            name: 'parent_id',
            dataType: 'INT',
          }),
          createColumn({
            id: 'i_category',
            tableId: 't_item',
            name: 'category_id',
            dataType: 'INT',
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't_category', columnIds: ['k_id'] },
            end: { tableId: 't_category', columnIds: ['k_parent'] },
          }),
          createRelationship({
            id: 'r2',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't_category', columnIds: ['k_id'] },
            end: { tableId: 't_item', columnIds: ['i_category'] },
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, category).slice(-8)).toEqual([
        '    parentCategory: Mapped[Optional["Category"]] = relationship(',
        '        back_populates="categoryList",',
        '        remote_side="[Category.id]",',
        '    )',
        '    categoryList: Mapped[List["Category"]] = relationship(',
        '        back_populates="parentCategory",',
        '    )',
        '    itemList: Mapped[List["Item"]] = relationship(back_populates="category")',
      ]);
      expect(render(state, item).at(-1)).toBe(
        '    category: Mapped[Optional["Category"]] = relationship(back_populates="itemList")'
      );
    });
  });

  describe('indexes', () => {
    it('renders named and auto-named indexes into __table_args__', () => {
      const table = createTable({
        id: 't1',
        name: 'users',
        columnIds: ['c1', 'c2'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'email',
            dataType: 'VARCHAR(50)',
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'google_sub',
            dataType: 'VARCHAR(50)',
          }),
        ],
        indexes: [
          createIndex({ id: 'i1', tableId: 't1', indexColumnIds: ['ic1'] }),
          createIndex({ id: 'i2', tableId: 't1', indexColumnIds: ['ic2'] }),
          createIndex({
            id: 'i3',
            tableId: 't1',
            name: 'uq_users_google_sub',
            unique: true,
            indexColumnIds: ['ic2'],
          }),
          // no resolvable columns, so it never reaches the model
          createIndex({ id: 'i4', tableId: 't1', indexColumnIds: ['gone'] }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c1' }),
          createIndexColumn({ id: 'ic2', indexId: 'i2', columnId: 'c2' }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table).slice(-8, -3)).toEqual([
        '    __table_args__ = (',
        '        Index("IDX_users", "email"),',
        '        Index("IDX_users1", "google_sub"),',
        '        Index("uq_users_google_sub", "google_sub", unique=True),',
        '    )',
      ]);
    });

    it('puts the table comment last when __table_args__ is a tuple', () => {
      const table = createTable({
        id: 't1',
        name: 'users',
        comment: 'people',
        columnIds: ['c1'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'email',
            dataType: 'VARCHAR(50)',
          }),
        ],
        indexes: [
          createIndex({
            id: 'i1',
            tableId: 't1',
            name: 'idx_email',
            indexColumnIds: ['ic1'],
          }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c1' }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table).slice(-7, -2)).toEqual([
        '    __tablename__ = "users"',
        '    __table_args__ = (',
        '        Index("idx_email", "email"),',
        '        {"comment": "people"},',
        '    )',
      ]);
    });

    // An index column whose column is gone drops out of the list rather than
    // reaching `columnKey` as undefined, and an index named only whitespace is
    // an index with no name -- both are shapes the v3 parser produces, since
    // `columnId` and `name` are plain strings it never cross-checks.
    it('drops an unresolved index column and auto-names a whitespace-only index', () => {
      const users = createTable({
        id: 't1',
        name: 'users',
        columnIds: ['p1', 'c1'],
      });
      const other = createTable({
        id: 't2',
        name: 'other',
        columnIds: ['p2', 'c2'],
      });
      const state = createState({
        tables: [users, other],
        columns: [
          primaryKey('p1', 't1'),
          primaryKey('p2', 't2'),
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'email',
            dataType: 'VARCHAR(50)',
          }),
          createColumn({
            id: 'c2',
            tableId: 't2',
            name: 'nickname',
            dataType: 'VARCHAR(50)',
          }),
        ],
        indexes: [
          createIndex({
            id: 'i1',
            tableId: 't1',
            indexColumnIds: ['ic1', 'ic2'],
          }),
          createIndex({
            id: 'i2',
            tableId: 't1',
            name: '   ',
            indexColumnIds: ['ic3'],
          }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c1' }),
          createIndexColumn({ id: 'ic2', indexId: 'i1', columnId: 'gone' }),
          createIndexColumn({ id: 'ic3', indexId: 'i2', columnId: 'c1' }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(createCode(state).split('\n').slice(1, -1)).toEqual([
        'from typing import Optional',
        '',
        'from sqlalchemy import Index, Integer, String',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class Other(Base):',
        '    __tablename__ = "other"',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    nickname: Mapped[Optional[str]] = mapped_column(String(50))',
        '',
        '',
        'class Users(Base):',
        '    __tablename__ = "users"',
        '    __table_args__ = (',
        '        Index("IDX_users", "email"),',
        '        Index("IDX_users1", "email"),',
        '    )',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    email: Mapped[Optional[str]] = mapped_column(String(50))',
      ]);
    });

    // An index column can name a column of another table, and the index still
    // belongs to this one. The column keeps its own name, which is what
    // `createSchemaSQL` writes into `CREATE INDEX ... ON users (nickname)` as
    // well -- both generators describe the same document and let the target
    // reject it, SQLAlchemy at import with ConstraintColumnNotFoundError
    // ("Can't create Index on table 'users': no column named 'nickname' is
    // present.").
    it('keeps the raw name of an index column the table does not hold', () => {
      const users = createTable({
        id: 't1',
        name: 'users',
        columnIds: ['p1', 'c1'],
      });
      const other = createTable({
        id: 't2',
        name: 'other',
        columnIds: ['p2', 'c2'],
      });
      const state = createState({
        tables: [users, other],
        columns: [
          primaryKey('p1', 't1'),
          primaryKey('p2', 't2'),
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'email',
            dataType: 'VARCHAR(50)',
          }),
          createColumn({
            id: 'c2',
            tableId: 't2',
            name: 'nickname',
            dataType: 'VARCHAR(50)',
          }),
        ],
        indexes: [
          createIndex({
            id: 'i1',
            tableId: 't1',
            name: 'idx_cross',
            indexColumnIds: ['ic1'],
          }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c2' }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(createCode(state).split('\n').slice(1, -1)).toEqual([
        'from typing import Optional',
        '',
        'from sqlalchemy import Index, Integer, String',
        'from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column',
        '',
        '',
        'class Base(DeclarativeBase):',
        '    pass',
        '',
        '',
        'class Other(Base):',
        '    __tablename__ = "other"',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    nickname: Mapped[Optional[str]] = mapped_column(String(50))',
        '',
        '',
        'class Users(Base):',
        '    __tablename__ = "users"',
        '    __table_args__ = (',
        '        Index("idx_cross", "nickname"),',
        '    )',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    email: Mapped[Optional[str]] = mapped_column(String(50))',
      ]);
    });
  });

  describe('module scope shadowing', () => {
    it('renames the class of a table named base, keeping the declarative Base', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'base', columnIds: ['c1'] }),
          createTable({ id: 't2', name: 'zzz', columnIds: ['c2'] }),
        ],
        columns: [primaryKey('c1', 't1'), primaryKey('c2', 't2')],
      });
      const lines = createCode(state).split('\n');

      expect(lines).toContain('class Base(DeclarativeBase):');
      expect(lines).toContain('class Base_2(Base):');
      expect(lines).toContain('    __tablename__ = "base"');
      expect(lines).toContain('class Zzz(Base):');
    });

    it('renames the class of a table named list so a later List stays typing.List', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'list', columnIds: ['c1'] }),
          createTable({ id: 't2', name: 'parent', columnIds: ['c2'] }),
          createTable({ id: 't3', name: 'child', columnIds: ['c3', 'c4'] }),
        ],
        columns: [
          primaryKey('c1', 't1'),
          primaryKey('c2', 't2'),
          primaryKey('c3', 't3'),
          createColumn({
            id: 'c4',
            tableId: 't3',
            name: 'parent_id',
            dataType: 'INT',
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't2', columnIds: ['c2'] },
            end: { tableId: 't3', columnIds: ['c4'] },
          }),
        ],
      });
      const lines = createCode(state).split('\n');

      expect(lines).toContain('from typing import List, Optional');
      expect(lines).toContain('class List_2(Base):');
      expect(lines).toContain('    __tablename__ = "list"');
      expect(lines).toContain(
        '    childList: Mapped[List["Child"]] = relationship(back_populates="parent")'
      );
    });

    it('renames the class of a table named text so a later column can use Text', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'text', columnIds: ['c1'] }),
          createTable({ id: 't2', name: 'zzz', columnIds: ['c2', 'c3'] }),
        ],
        columns: [
          primaryKey('c1', 't1'),
          primaryKey('c2', 't2'),
          createColumn({
            id: 'c3',
            tableId: 't2',
            name: 'body',
            dataType: 'LONGTEXT',
          }),
        ],
        settings: { database: Database.MySQL },
      });
      const lines = createCode(state).split('\n');

      expect(lines).toContain('from sqlalchemy import Integer, Text');
      expect(lines).toContain('class Text_2(Base):');
      expect(lines).toContain('    __tablename__ = "text"');
      expect(lines).toContain(
        '    body: Mapped[Optional[str]] = mapped_column(Text)'
      );
    });

    it('renames the class of a table named optional', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'optional', columnIds: ['c1'] }),
          createTable({ id: 't2', name: 'zzz', columnIds: ['c2', 'c3'] }),
        ],
        columns: [
          primaryKey('c1', 't1'),
          primaryKey('c2', 't2'),
          createColumn({
            id: 'c3',
            tableId: 't2',
            name: 'memo',
            dataType: 'VARCHAR(50)',
          }),
        ],
        settings: { database: Database.MySQL },
      });
      const lines = createCode(state).split('\n');

      expect(lines).toContain('class Optional_2(Base):');
      expect(lines).toContain('    __tablename__ = "optional"');
      expect(lines).toContain(
        '    memo: Mapped[Optional[str]] = mapped_column(String(50))'
      );
    });

    it('renames a column named text ahead of a server_default, keeping the database name', () => {
      const state = createState({
        tables: [
          createTable({
            id: 't1',
            name: 'note',
            columnIds: ['c1', 'c2', 'c3'],
          }),
        ],
        columns: [
          primaryKey('c1', 't1'),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'text',
            dataType: 'VARCHAR(100)',
          }),
          createColumn({
            id: 'c3',
            tableId: 't1',
            name: 'created_at',
            dataType: 'DATETIME',
            default: 'CURRENT_TIMESTAMP',
          }),
        ],
        settings: { database: Database.MySQL },
      });
      const lines = createCode(state).split('\n');

      expect(lines).toContain(
        '    text_2: Mapped[Optional[str]] = mapped_column("text", String(100))'
      );
      expect(lines).toContain(
        '        server_default=text("CURRENT_TIMESTAMP"),'
      );
    });

    it('renames a column named uuid ahead of a PostgreSQL uuid column', () => {
      const state = createState({
        tables: [
          createTable({
            id: 't1',
            name: 'token',
            columnIds: ['c1', 'c2', 'c3'],
          }),
        ],
        columns: [
          primaryKey('c1', 't1'),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'uuid',
            dataType: 'varchar(36)',
          }),
          createColumn({
            id: 'c3',
            tableId: 't1',
            name: 'trace',
            dataType: 'uuid',
          }),
        ],
        settings: { database: Database.PostgreSQL },
      });
      const lines = createCode(state).split('\n');

      expect(lines).toContain('import uuid');
      expect(lines).toContain(
        '    uuid_2: Mapped[Optional[str]] = mapped_column("uuid", String(36))'
      );
      expect(lines).toContain(
        '    trace: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))'
      );
    });

    it.each(MODULE_SCOPE_IDENTIFIERS)(
      'reserves %s against a class name',
      name => {
        const state = createState({
          tables: [createTable({ id: 't1', name, columnIds: ['c1'] })],
          columns: [primaryKey('c1', 't1')],
          settings: { tableNameCase: NameCase.none },
        });
        const lines = createCode(state).split('\n');

        expect(lines).toContain(`class ${name}_2(Base):`);
        expect(lines).toContain(`    __tablename__ = "${name}"`);
      }
    );

    it.each(MODULE_SCOPE_IDENTIFIERS)(
      'reserves %s against a column attribute',
      name => {
        const state = createState({
          tables: [createTable({ id: 't1', name: 'note', columnIds: ['c1'] })],
          columns: [
            createColumn({
              id: 'c1',
              tableId: 't1',
              name,
              dataType: 'INT',
              options: ColumnOption.primaryKey,
            }),
          ],
          settings: { columnNameCase: NameCase.none },
        });
        // A long name pushes the call past the line limit, where `formatCall`
        // breaks it one argument to a line -- match both layouts.
        const code = createCode(state);

        expect(code).toContain(`    ${name}_2: Mapped[int] = mapped_column(`);
        expect(code).toMatch(new RegExp(`mapped_column\\(\\s*"${name}"`));
      }
    );

    // The sweeps above are only as complete as the list they walk, so an
    // emitter importing a name that is not on it has to turn this red.
    it('imports no identifier outside the reserved list', () => {
      const names = new Set([
        ...importedNames(createCode(createEveryImportState())),
        ...importedNames(createCode(createPostgresImportState())),
      ]);

      expect(Array.from(names).sort()).toEqual(
        MODULE_SCOPE_IDENTIFIERS.filter(
          name => !NEVER_IMPORTED.includes(name)
        ).sort()
      );
    });
  });

  describe('duplicate column names', () => {
    it('declares one column when two share a database name', () => {
      const table = createTable({
        id: 't1',
        name: 'note',
        columnIds: ['c1', 'c2', 'c3'],
      });
      const state = createState({
        tables: [table],
        columns: [
          primaryKey('c1', 't1'),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'body',
            dataType: 'VARCHAR(10)',
          }),
          createColumn({
            id: 'c3',
            tableId: 't1',
            name: 'body',
            dataType: 'INT',
            options: ColumnOption.notNull,
          }),
        ],
        indexes: [
          createIndex({
            id: 'i1',
            tableId: 't1',
            name: 'idx_body',
            indexColumnIds: ['ic1'],
          }),
        ],
        // the index names the second of the two, which is not the one declared
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c3' }),
        ],
        settings: { database: Database.MySQL, columnNameCase: NameCase.none },
      });
      const code = createCode(state);

      expect(code).toContain(
        '    body: Mapped[Optional[str]] = mapped_column(String(10))'
      );
      expect(code).not.toContain('body_2');
      expect(code).toContain('        Index("idx_body", "body"),');
    });

    it('moves a foreign key onto the column that carries the name', () => {
      const parent = createTable({
        id: 't_parent',
        name: 'parent',
        columnIds: ['p_id'],
      });
      const child = createTable({
        id: 't_child',
        name: 'child',
        columnIds: ['c_id', 'c_fk', 'c_dup'],
      });
      const state = createState({
        tables: [parent, child],
        columns: [
          primaryKey('p_id', 't_parent'),
          primaryKey('c_id', 't_child'),
          createColumn({
            id: 'c_fk',
            tableId: 't_child',
            name: 'parent_id',
            dataType: 'INT',
            options: ColumnOption.notNull,
          }),
          createColumn({
            id: 'c_dup',
            tableId: 't_child',
            name: 'parent_id',
            dataType: 'INT',
          }),
        ],
        // the relationship ends on the duplicate, which is never declared
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't_parent', columnIds: ['p_id'] },
            end: { tableId: 't_child', columnIds: ['c_dup'] },
          }),
        ],
        settings: { database: Database.MySQL, columnNameCase: NameCase.none },
      });
      const lines = render(state, child);

      expect(lines).toContain('        ForeignKey("parent.id"),');
      expect(lines.join('\n')).not.toContain('parent_id_2');
      // the declared column is NOT NULL, so the relationship follows it
      expect(lines.at(-1)).toBe(
        '    parent: Mapped["Parent"] = relationship(back_populates="childList")'
      );
    });

    // The carrier's repaired names have to reach the duplicate, because every
    // string that names a column resolves against `Table.c` and the duplicate
    // never declared one of its own. Verified against SQLAlchemy 2.0.52:
    // without the copy the index names `a.b`, a key no column holds, and
    // `create_all` raises ConstraintColumnNotFoundError ("Can't create Index on
    // table 'zzz': no column named 'a.b' is present").
    it('gives a duplicate the repaired key of the column that carries it', () => {
      const table = createTable({
        id: 't1',
        name: 'zzz',
        columnIds: ['c_id', 'c_a', 'c_b'],
      });
      const state = createState({
        tables: [table],
        columns: [
          primaryKey('c_id', 't1'),
          createColumn({
            id: 'c_a',
            tableId: 't1',
            name: 'a.b',
            dataType: 'INT',
          }),
          createColumn({
            id: 'c_b',
            tableId: 't1',
            name: 'a.b',
            dataType: 'INT',
          }),
        ],
        indexes: [
          createIndex({
            id: 'i1',
            tableId: 't1',
            name: 'IDX_1',
            indexColumnIds: ['ic1'],
          }),
        ],
        // the index names the second of the two, which is not the one declared
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c_b' }),
        ],
        settings: { database: Database.MySQL, columnNameCase: NameCase.none },
      });
      const code = createCode(state);

      expect(code).toContain('        Index("IDX_1", "a_b"),');
      expect(code).toContain(
        '    a_b: Mapped[Optional[int]] = mapped_column("a.b", Integer, key="a_b")'
      );
      expect(code).not.toContain('"a.b"),');
    });

    // The other half of the same copy: `foreign_keys` names the Python
    // attribute, and a duplicate that kept its raw `__b_id` would name one the
    // class never grew -- SQLAlchemy 2.0.52 raises AttributeError ("Class
    // <class 'x__a'> does not have a mapped column named '__b_id'") at
    // `configure_mappers()`.
    it('gives a duplicate the repaired attribute of the column that carries it', () => {
      const { state, left } = createDuplicateAmbiguousFixture();

      expect(render(state, left).slice(-15)).toEqual([
        '    x__id: Mapped[int] = mapped_column("__id", Integer, primary_key=True)',
        '    x__b_id: Mapped[Optional[int]] = mapped_column(',
        '        "__b_id",',
        '        Integer,',
        '        ForeignKey("__b.__id"),',
        '    )',
        '',
        '    x__b: Mapped[Optional["x__b"]] = relationship(',
        '        back_populates="x__aList",',
        '        foreign_keys="[x__a.x__b_id]",',
        '    )',
        '    x__bList: Mapped[List["x__b"]] = relationship(',
        '        back_populates="x__a",',
        '        foreign_keys="[x__b.x__a_id]",',
        '    )',
      ]);
      expect(render(state, left).join('\n')).not.toContain('x__a.__b_id');
    });
  });

  describe('duplicate table names', () => {
    // erd-editor lets two tables carry one name and `createSchemaSQL` emits two
    // `CREATE TABLE zzz` statements for them, so this generator renders them the
    // same way rather than inventing a second table name the DDL would not
    // share. `uniqueName` still separates the two *class* names, because two
    // `class Zzz` statements would leave the second silently replacing the
    // first. Verified against SQLAlchemy 2.0.52: importing the module raises
    // InvalidRequestError ("Table 'zzz' is already defined for this MetaData
    // instance"), which is the same shape of failure a table with no primary
    // key already produces.
    it('renders two tables of one name as two classes sharing a __tablename__', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'zzz', columnIds: ['c1'] }),
          createTable({ id: 't2', name: 'zzz', columnIds: ['c2'] }),
        ],
        columns: [primaryKey('c1', 't1'), primaryKey('c2', 't2')],
        settings: { database: Database.MySQL },
      });
      const lines = createCode(state).split('\n');

      expect(lines).toContain('class Zzz(Base):');
      expect(lines).toContain('class Zzz_2(Base):');
      expect(
        lines.filter(line => line === '    __tablename__ = "zzz"')
      ).toEqual(['    __tablename__ = "zzz"', '    __tablename__ = "zzz"']);
    });
  });

  describe('unnamed columns', () => {
    // A column can exist with no name, and `createSchemaSQL` renders it as a
    // nameless slot the database rejects. Rendering it here keeps the two
    // generators saying the same thing: the empty name reaches
    // `mapped_column("")`, which SQLAlchemy 2.0.52 refuses with ArgumentError
    // ("Column must be constructed with a non-blank name"). Dropping the column
    // instead would be the one failure the leading-underscore repair exists to
    // prevent -- a model quietly missing a column the DDL declares.
    it('renders an unnamed column with a repaired attribute and an empty name', () => {
      const table = createTable({
        id: 't1',
        name: 'zzz',
        columnIds: ['c_id', 'c_empty'],
      });
      const state = createState({
        tables: [table],
        columns: [
          primaryKey('c_id', 't1'),
          createColumn({
            id: 'c_empty',
            tableId: 't1',
            name: '',
            dataType: 'INT',
          }),
        ],
        settings: { database: Database.MySQL, columnNameCase: NameCase.none },
      });

      expect(render(state, table).at(-1)).toBe(
        '    x: Mapped[Optional[int]] = mapped_column("", Integer)'
      );
    });
  });

  describe('dotted names', () => {
    it('keys a dotted column by its attribute so a ForeignKey can name it', () => {
      const parent = createTable({
        id: 't_parent',
        name: 'my.parent',
        columnIds: ['p_id'],
      });
      const child = createTable({
        id: 't_child',
        name: 'child',
        columnIds: ['c_id', 'c_fk'],
      });
      const state = createState({
        tables: [parent, child],
        columns: [
          createColumn({
            id: 'p_id',
            tableId: 't_parent',
            name: 'the.id',
            dataType: 'INT',
            options: ColumnOption.primaryKey,
          }),
          primaryKey('c_id', 't_child'),
          createColumn({
            id: 'c_fk',
            tableId: 't_child',
            name: 'parent.id',
            dataType: 'INT',
            options: ColumnOption.notNull,
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't_parent', columnIds: ['p_id'] },
            end: { tableId: 't_child', columnIds: ['c_fk'] },
          }),
        ],
        indexes: [
          createIndex({
            id: 'i1',
            tableId: 't_child',
            name: 'idx_parent',
            indexColumnIds: ['ic1'],
          }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c_fk' }),
        ],
        settings: { database: Database.MySQL, columnNameCase: NameCase.none },
      });
      const code = createCode(state);

      // the database side keeps every dot, the key never has one
      expect(code).toContain('    __tablename__ = "my.parent"');
      expect(code).toContain('        "the.id",');
      expect(code).toContain('        key="the_id",');
      expect(code).toContain('        ForeignKey("my.parent.the_id"),');
      expect(code).toContain('        Index("idx_parent", "parent_id"),');
    });

    it('keys both ends of a composite ForeignKeyConstraint', () => {
      const pair = createTable({
        id: 't_pair',
        name: 'pair',
        columnIds: ['p_a', 'p_b'],
      });
      const child = createTable({
        id: 't_child',
        name: 'pair_child',
        columnIds: ['c_id', 'c_a', 'c_b'],
      });
      const state = createState({
        tables: [pair, child],
        columns: [
          createColumn({
            id: 'p_a',
            tableId: 't_pair',
            name: 'a.1',
            dataType: 'INT',
            options: ColumnOption.primaryKey,
          }),
          primaryKey('p_b', 't_pair', 'b'),
          primaryKey('c_id', 't_child'),
          createColumn({
            id: 'c_a',
            tableId: 't_child',
            name: 'a.1',
            dataType: 'INT',
            options: ColumnOption.notNull,
          }),
          createColumn({
            id: 'c_b',
            tableId: 't_child',
            name: 'b',
            dataType: 'INT',
            options: ColumnOption.notNull,
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't_pair', columnIds: ['p_a', 'p_b'] },
            end: { tableId: 't_child', columnIds: ['c_a', 'c_b'] },
          }),
        ],
        settings: { database: Database.MySQL, columnNameCase: NameCase.none },
      });

      expect(createCode(state)).toContain(
        '        ForeignKeyConstraint(["a_1", "b"], ["pair.a_1", "pair.b"]),'
      );
    });

    it('leaves a dotted table name in the ForeignKey target', () => {
      const parent = createTable({
        id: 't_parent',
        name: 'dbo.parent',
        columnIds: ['p_id'],
      });
      const child = createTable({
        id: 't_child',
        name: 'child',
        columnIds: ['c_id', 'c_fk'],
      });
      const state = createState({
        tables: [parent, child],
        columns: [
          primaryKey('p_id', 't_parent'),
          primaryKey('c_id', 't_child'),
          createColumn({
            id: 'c_fk',
            tableId: 't_child',
            name: 'parent_id',
            dataType: 'INT',
            options: ColumnOption.notNull,
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r1',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 't_parent', columnIds: ['p_id'] },
            end: { tableId: 't_child', columnIds: ['c_fk'] },
          }),
        ],
        settings: { database: Database.MySQL, columnNameCase: NameCase.none },
      });
      const code = createCode(state);

      // SQLAlchemy joins the leftover tokens back into the table key, so a
      // dotted table survives the split and needs no key of its own
      expect(code).toContain('        ForeignKey("dbo.parent.id"),');
      expect(code).not.toContain('key="');
    });

    // `assignColumnKeys` runs two passes, and the order is the whole point:
    // every dot-free column claims its own name as its `Table.c` key first, so
    // a dotted column repairing itself is the side that has to yield. Run the
    // passes the other way round and the dotted `a.b` takes `a_b` from an
    // empty used set, leaving the plain `a_b` column -- whose branch sets its
    // key unconditionally -- nothing left to claim. SQLAlchemy 2.0.52 then
    // refuses the class with DuplicateColumnError ("A column with name 'a_b'
    // is already present in table 'zzz'.") and the module never imports.
    it('lets a plain column keep the key a dotted one has to repair around', () => {
      const table = createTable({
        id: 't1',
        name: 'zzz',
        columnIds: ['c_id', 'c_dotted', 'c_plain'],
      });
      const state = createState({
        tables: [table],
        columns: [
          primaryKey('c_id', 't1'),
          createColumn({
            id: 'c_dotted',
            tableId: 't1',
            name: 'a.b',
            dataType: 'INT',
          }),
          createColumn({
            id: 'c_plain',
            tableId: 't1',
            name: 'a_b',
            dataType: 'INT',
          }),
        ],
        settings: { database: Database.MySQL, columnNameCase: NameCase.none },
      });

      // the dotted column is the one carrying an explicit key, and it is the
      // repaired `a_b_2` -- not the `a_b` the plain column owns
      expect(render(state, table).slice(-2)).toEqual([
        '    a_b: Mapped[Optional[int]] = mapped_column("a.b", Integer, key="a_b_2")',
        '    a_b_2: Mapped[Optional[int]] = mapped_column("a_b", Integer)',
      ]);
    });
  });
});

function createOneToManyState(
  relationshipType: number,
  foreignKeyOptions: number = ColumnOption.notNull
): RootState {
  const user = createTable({ id: 't_user', name: 'user', columnIds: ['u_id'] });
  const post = createTable({
    id: 't_post',
    name: 'post',
    columnIds: ['p_id', 'p_user_id'],
  });

  return createState({
    tables: [user, post],
    columns: [
      createColumn({
        id: 'u_id',
        tableId: 't_user',
        name: 'id',
        dataType: 'INT',
        options: ColumnOption.primaryKey,
        ui: { keys: ColumnUIKey.primaryKey },
      }),
      createColumn({
        id: 'p_id',
        tableId: 't_post',
        name: 'id',
        dataType: 'INT',
        options: ColumnOption.primaryKey,
        ui: { keys: ColumnUIKey.primaryKey },
      }),
      createColumn({
        id: 'p_user_id',
        tableId: 't_post',
        name: 'user_id',
        dataType: 'INT',
        options: foreignKeyOptions,
        ui: { keys: ColumnUIKey.foreignKey },
      }),
    ],
    relationships: [
      createRelationship({
        id: 'r1',
        relationshipType,
        start: { tableId: 't_user', columnIds: ['u_id'] },
        end: { tableId: 't_post', columnIds: ['p_user_id'] },
      }),
    ],
    settings: { database: Database.MySQL, columnNameCase: NameCase.none },
  });
}

/**
 * An adjacency list: `employee.manager_id` points back at `employee.id`, so
 * both ends of the relationship land on the one class.
 */
function createSelfReferenceFixture(relationshipType: number) {
  const employee = createTable({
    id: 't_employee',
    name: 'employee',
    columnIds: ['e_id', 'e_manager'],
  });
  const state = createState({
    tables: [employee],
    columns: [
      createColumn({
        id: 'e_id',
        tableId: 't_employee',
        name: 'id',
        dataType: 'INT',
        options: ColumnOption.primaryKey,
        ui: { keys: ColumnUIKey.primaryKey },
      }),
      createColumn({
        id: 'e_manager',
        tableId: 't_employee',
        name: 'manager_id',
        dataType: 'INT',
        ui: { keys: ColumnUIKey.foreignKey },
      }),
    ],
    relationships: [
      createRelationship({
        id: 'r1',
        relationshipType,
        start: { tableId: 't_employee', columnIds: ['e_id'] },
        end: { tableId: 't_employee', columnIds: ['e_manager'] },
      }),
    ],
    settings: { database: Database.MySQL },
  });

  return { state, employee };
}

/**
 * Two tables holding a foreign key to each other, the way `data/test.json`
 * pairs `article` with `content`.
 */
function createMutualForeignKeyFixture() {
  const article = createTable({
    id: 't_article',
    name: 'article',
    columnIds: ['a_id', 'a_content'],
  });
  const content = createTable({
    id: 't_content',
    name: 'content',
    columnIds: ['c_id', 'c_article'],
  });
  const state = createState({
    tables: [article, content],
    columns: [
      createColumn({
        id: 'a_id',
        tableId: 't_article',
        name: 'id',
        dataType: 'INT',
        options: ColumnOption.primaryKey,
        ui: { keys: ColumnUIKey.primaryKey },
      }),
      createColumn({
        id: 'a_content',
        tableId: 't_article',
        name: 'content_id',
        dataType: 'INT',
        ui: { keys: ColumnUIKey.foreignKey },
      }),
      createColumn({
        id: 'c_id',
        tableId: 't_content',
        name: 'id',
        dataType: 'INT',
        options: ColumnOption.primaryKey,
        ui: { keys: ColumnUIKey.primaryKey },
      }),
      createColumn({
        id: 'c_article',
        tableId: 't_content',
        name: 'article_id',
        dataType: 'INT',
        ui: { keys: ColumnUIKey.foreignKey },
      }),
    ],
    relationships: [
      createRelationship({
        id: 'r1',
        relationshipType: RelationshipType.ZeroN,
        start: { tableId: 't_content', columnIds: ['c_id'] },
        end: { tableId: 't_article', columnIds: ['a_content'] },
      }),
      createRelationship({
        id: 'r2',
        relationshipType: RelationshipType.ZeroN,
        start: { tableId: 't_article', columnIds: ['a_id'] },
        end: { tableId: 't_content', columnIds: ['c_article'] },
      }),
    ],
    settings: { database: Database.MySQL },
  });

  return { state, article, content };
}

/**
 * Every identifier `sqlalchemy.ts` can put at module scope: `Base`, the names
 * it can import, and the builtins its annotations name. A class or a column
 * attribute taking any of these shadows it for the statements that follow.
 */
const MODULE_SCOPE_IDENTIFIERS = [
  'Any',
  'Base',
  'BigInteger',
  'Boolean',
  'Date',
  'DateTime',
  'Decimal',
  'DeclarativeBase',
  'Double',
  'Float',
  'ForeignKey',
  'ForeignKeyConstraint',
  'Index',
  'Integer',
  'JSON',
  'JSONB',
  'LargeBinary',
  'List',
  'Mapped',
  'Numeric',
  'Optional',
  'String',
  'Text',
  'Time',
  'UUID',
  'Uuid',
  'bool',
  'bytes',
  'date',
  'datetime',
  'float',
  'int',
  'mapped_column',
  'relationship',
  'str',
  'text',
  'time',
  'uuid',
];

/** `Base` is declared, not imported; the rest are builtins. */
const NEVER_IMPORTED = ['Base', 'bool', 'bytes', 'float', 'int', 'str'];

function importedNames(code: string): string[] {
  const names: string[] = [];
  let open = false;

  code.split('\n').forEach(line => {
    const value = line.trim();

    if (open) {
      if (value === ')') {
        open = false;
        return;
      }
      names.push(value.replace(/,$/, ''));
      return;
    }
    if (value.startsWith('import ')) {
      names.push(value.slice('import '.length).trim());
      return;
    }

    const matched = /^from \S+ import (.+)$/.exec(value);
    if (!matched) {
      return;
    }
    if (matched[1] === '(') {
      open = true;
      return;
    }
    matched[1].split(',').forEach(name => names.push(name.trim()));
  });

  return names;
}

/** The names of one `from <module> import ...`, in the order they are written. */
function fromImportNames(code: string, module: string): string[] {
  const lines = code.split('\n');
  const head = lines.indexOf(`from ${module} import (`);

  if (head === -1) {
    const single = lines.find(line =>
      line.startsWith(`from ${module} import `)
    );
    return single
      ? single.slice(`from ${module} import `.length).split(', ')
      : [];
  }

  return lines
    .slice(head + 1, lines.indexOf(')', head))
    .map(line => line.trim().replace(/,$/, ''));
}

function primaryKey(id: string, tableId: string, name = 'id'): Column {
  return createColumn({
    id,
    tableId,
    name,
    dataType: 'INT',
    options: ColumnOption.primaryKey,
    ui: { keys: ColumnUIKey.primaryKey },
  });
}

/**
 * One MySQL document reaching every import the generator can emit outside the
 * two PostgreSQL dialect types: every primitive type, the raw types that sit
 * outside them, an index, a server default, a single-column foreign key and a
 * composite one, and both ends of a one-to-many.
 */
function createEveryImportState(): RootState {
  const types = [
    ['INT', 'c_int'],
    ['BIGINT', 'c_long'],
    ['FLOAT', 'c_float'],
    ['DOUBLE', 'c_double'],
    ['DECIMAL(10,2)', 'c_decimal'],
    ['BOOLEAN', 'c_boolean'],
    ['VARCHAR(10)', 'c_string'],
    ['LONGTEXT', 'c_text'],
    ['BLOB', 'c_binary'],
    ['JSON', 'c_json'],
    ['UNIQUEIDENTIFIER', 'c_uuid'],
    ['DATE', 'c_date'],
    ['DATETIME', 'c_datetime'],
    ['TIME', 'c_time'],
  ];

  return createState({
    tables: [
      createTable({
        id: 't_types',
        name: 'types',
        columnIds: [...types.map(([, id]) => id), 'c_default'],
      }),
      createTable({ id: 't_one', name: 'one', columnIds: ['o_id'] }),
      createTable({ id: 't_many', name: 'many', columnIds: ['m_id', 'm_one'] }),
      createTable({
        id: 't_pair',
        name: 'pair',
        columnIds: ['p_a', 'p_b'],
      }),
      createTable({
        id: 't_pair_child',
        name: 'pair_child',
        columnIds: ['pc_a', 'pc_b'],
      }),
    ],
    columns: [
      ...types.map(([dataType, id]) =>
        createColumn({ id, tableId: 't_types', name: id, dataType })
      ),
      createColumn({
        id: 'c_default',
        tableId: 't_types',
        name: 'c_default',
        dataType: 'DATETIME',
        default: 'CURRENT_TIMESTAMP',
      }),
      primaryKey('o_id', 't_one'),
      primaryKey('m_id', 't_many'),
      createColumn({
        id: 'm_one',
        tableId: 't_many',
        name: 'one_id',
        dataType: 'INT',
      }),
      primaryKey('p_a', 't_pair', 'a'),
      primaryKey('p_b', 't_pair', 'b'),
      createColumn({
        id: 'pc_a',
        tableId: 't_pair_child',
        name: 'a',
        dataType: 'INT',
      }),
      createColumn({
        id: 'pc_b',
        tableId: 't_pair_child',
        name: 'b',
        dataType: 'INT',
      }),
    ],
    relationships: [
      createRelationship({
        id: 'r1',
        relationshipType: RelationshipType.ZeroN,
        start: { tableId: 't_one', columnIds: ['o_id'] },
        end: { tableId: 't_many', columnIds: ['m_one'] },
      }),
      createRelationship({
        id: 'r2',
        relationshipType: RelationshipType.ZeroN,
        start: { tableId: 't_pair', columnIds: ['p_a', 'p_b'] },
        end: { tableId: 't_pair_child', columnIds: ['pc_a', 'pc_b'] },
      }),
    ],
    indexes: [
      createIndex({
        id: 'i1',
        tableId: 't_types',
        name: 'idx_types',
        indexColumnIds: ['ic1'],
      }),
    ],
    indexColumns: [
      createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c_int' }),
    ],
    settings: { database: Database.MySQL },
  });
}

/** The two `sqlalchemy.dialects.postgresql` names. */
function createPostgresImportState(): RootState {
  return createState({
    tables: [
      createTable({ id: 't1', name: 'pg', columnIds: ['c1', 'c2', 'c3'] }),
    ],
    columns: [
      primaryKey('c1', 't1'),
      createColumn({
        id: 'c2',
        tableId: 't1',
        name: 'payload',
        dataType: 'jsonb',
      }),
      createColumn({
        id: 'c3',
        tableId: 't1',
        name: 'trace',
        dataType: 'uuid',
      }),
    ],
    settings: { database: Database.PostgreSQL },
  });
}

/**
 * One table carrying every column name the leading-underscore rule has to
 * move: private name mangling (`__secret`), the dunders the class machinery
 * owns (`__x__`, `__doc__`, `__dict__`), SQLAlchemy's instrumentation
 * (`_sa_class_manager`, `_sa_registry`) and a plain single underscore.
 */
function createUnderscoreFixture(nameCase: number) {
  const names = [
    '__secret',
    '__x__',
    '__doc__',
    '__dict__',
    '_sa_class_manager',
    '_sa_registry',
    '_leading',
  ];
  const table = createTable({
    id: 't1',
    name: 'zzz',
    columnIds: ['c1', ...names.map((_, index) => `c${index + 2}`)],
  });
  const state = createState({
    tables: [table],
    columns: [
      primaryKey('c1', 't1'),
      ...names.map((name, index) =>
        createColumn({
          id: `c${index + 2}`,
          tableId: 't1',
          name,
          dataType: 'VARCHAR(5)',
        })
      ),
    ],
    settings: {
      database: Database.MySQL,
      tableNameCase: nameCase,
      columnNameCase: nameCase,
    },
  });

  return { state, table };
}

/** A leading-underscore table name, with the dotted `key=` path under it. */
function createUnderscoreTableFixture(nameCase: number) {
  const table = createTable({
    id: 't1',
    name: '__thing',
    columnIds: ['c1', 'c2', 'c3'],
  });
  const index = createIndex({
    id: 'i1',
    tableId: 't1',
    indexColumnIds: ['ic1'],
  });
  const state = createState({
    tables: [table],
    columns: [
      primaryKey('c1', 't1'),
      createColumn({
        id: 'c2',
        tableId: 't1',
        name: '__a.b',
        dataType: 'VARCHAR(5)',
      }),
      createColumn({
        id: 'c3',
        tableId: 't1',
        name: '__metadata',
        dataType: 'VARCHAR(5)',
      }),
    ],
    indexes: [index],
    indexColumns: [
      createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c2' }),
    ],
    settings: {
      database: Database.MySQL,
      tableNameCase: nameCase,
      columnNameCase: nameCase,
    },
  });

  return { state, table };
}

/**
 * Two leading-underscore tables plus an adjacency list on the child, so one
 * class carries `back_populates` on both sides and `remote_side`.
 */
function createUnderscoreRelationFixture(nameCase: number) {
  const parent = createTable({
    id: 'tp',
    name: '__thing',
    columnIds: ['p_id'],
  });
  const child = createTable({
    id: 'tc',
    name: '__child',
    columnIds: ['c_id', 'c_fk', 'c_self'],
  });
  const state = createState({
    tables: [parent, child],
    columns: [
      primaryKey('p_id', 'tp', '__id'),
      primaryKey('c_id', 'tc', '__id'),
      createColumn({
        id: 'c_fk',
        tableId: 'tc',
        name: '__secret_id',
        dataType: 'INT',
        options: ColumnOption.notNull,
      }),
      createColumn({
        id: 'c_self',
        tableId: 'tc',
        name: '__parent_id',
        dataType: 'INT',
      }),
    ],
    relationships: [
      createRelationship({
        id: 'r1',
        relationshipType: RelationshipType.ZeroN,
        start: { tableId: 'tp', columnIds: ['p_id'] },
        end: { tableId: 'tc', columnIds: ['c_fk'] },
      }),
      createRelationship({
        id: 'r2',
        relationshipType: RelationshipType.ZeroN,
        start: { tableId: 'tc', columnIds: ['c_id'] },
        end: { tableId: 'tc', columnIds: ['c_self'] },
      }),
    ],
    settings: {
      database: Database.MySQL,
      tableNameCase: nameCase,
      columnNameCase: nameCase,
    },
  });

  return { state, parent, child };
}

/** Two foreign keys over one pair of leading-underscore tables. */
/**
 * `createUnderscoreAmbiguousFixture` with one column duplicated: `__a` holds
 * `__b_id` twice, and the relationship that makes the pair ambiguous ends on
 * the second of the two -- the one that never declares a column of its own.
 */
function createDuplicateAmbiguousFixture() {
  const left = createTable({
    id: 'ta',
    name: '__a',
    columnIds: ['a_id', 'a_b', 'a_b_2'],
  });
  const right = createTable({
    id: 'tb',
    name: '__b',
    columnIds: ['b_id', 'b_a'],
  });
  const state = createState({
    tables: [left, right],
    columns: [
      primaryKey('a_id', 'ta', '__id'),
      createColumn({
        id: 'a_b',
        tableId: 'ta',
        name: '__b_id',
        dataType: 'INT',
      }),
      createColumn({
        id: 'a_b_2',
        tableId: 'ta',
        name: '__b_id',
        dataType: 'INT',
      }),
      primaryKey('b_id', 'tb', '__id'),
      createColumn({
        id: 'b_a',
        tableId: 'tb',
        name: '__a_id',
        dataType: 'INT',
      }),
    ],
    relationships: [
      createRelationship({
        id: 'r1',
        relationshipType: RelationshipType.ZeroN,
        start: { tableId: 'ta', columnIds: ['a_id'] },
        end: { tableId: 'tb', columnIds: ['b_a'] },
      }),
      createRelationship({
        id: 'r2',
        relationshipType: RelationshipType.ZeroN,
        start: { tableId: 'tb', columnIds: ['b_id'] },
        end: { tableId: 'ta', columnIds: ['a_b_2'] },
      }),
    ],
    settings: {
      database: Database.MySQL,
      tableNameCase: NameCase.none,
      columnNameCase: NameCase.none,
    },
  });

  return { state, left, right };
}

function createUnderscoreAmbiguousFixture() {
  const left = createTable({
    id: 'ta',
    name: '__a',
    columnIds: ['a_id', 'a_b'],
  });
  const right = createTable({
    id: 'tb',
    name: '__b',
    columnIds: ['b_id', 'b_a'],
  });
  const state = createState({
    tables: [left, right],
    columns: [
      primaryKey('a_id', 'ta', '__id'),
      createColumn({
        id: 'a_b',
        tableId: 'ta',
        name: '__b_id',
        dataType: 'INT',
      }),
      primaryKey('b_id', 'tb', '__id'),
      createColumn({
        id: 'b_a',
        tableId: 'tb',
        name: '__a_id',
        dataType: 'INT',
      }),
    ],
    relationships: [
      createRelationship({
        id: 'r1',
        relationshipType: RelationshipType.ZeroN,
        start: { tableId: 'ta', columnIds: ['a_id'] },
        end: { tableId: 'tb', columnIds: ['b_a'] },
      }),
      createRelationship({
        id: 'r2',
        relationshipType: RelationshipType.ZeroN,
        start: { tableId: 'tb', columnIds: ['b_id'] },
        end: { tableId: 'ta', columnIds: ['a_b'] },
      }),
    ],
    settings: {
      database: Database.MySQL,
      tableNameCase: NameCase.none,
      columnNameCase: NameCase.none,
    },
  });

  return { state, left, right };
}
