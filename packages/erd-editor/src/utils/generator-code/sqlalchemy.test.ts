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
import { DatabaseHintMap } from '@/constants/sql/dataType';
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
import { createSchemaSQL } from '@/utils/schema-sql';

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
 * The document generator-code/index.test.ts shares across every language:
 * one user table with a single created_at INT NOT NULL column on MySQL.
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
 * The users table from the feature request: a PostgreSQL-native document
 * whose types (uuid, text, timestamptz) all sit outside the eleven
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
 * team (1) to (N) player, joined by a two-column composite foreign key whose
 * columns are also part of player's three-column composite primary key.
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
        '    Time,',
        ')',
        'from sqlalchemy.dialects.mysql import MEDIUMTEXT',
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
        '    lobCol: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)',
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

    // getColumnType drops the argument list, collapses whitespace and trims
    // before matching a raw name. Skip any step and the name misses its set and
    // falls back to the primitive type, the collapse those lists prevent.
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
          // timestamp with  time zone unmatched
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
        'from sqlalchemy import VARBINARY, DateTime, Integer, LargeBinary, Time',
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
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
        '    a: Mapped[Optional[bytes]] = mapped_column(VARBINARY(255))',
        '    b: Mapped[Optional[bytes]] = mapped_column(LargeBinary(100))',
        '    c: Mapped[Optional[time]] = mapped_column(Time(timezone=True))',
        '    d: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))',
      ]);
    });

    // JSONB and UUID live in sqlalchemy.dialects.postgresql, so the database
    // check keeps them out of a MySQL document. Emitted anyway, create_all
    // against SQLite raises CompileError on rendering the element.
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
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
        '    a: Mapped[Optional[Any]] = mapped_column(JSON)',
        '    b: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)',
      ]);
    });

    // A type argument reaches String(n) or Numeric(p, s) only as a positive
    // integer: SQL Server's VARCHAR(MAX) would emit NaN, which Python does not
    // define, and VARCHAR(0) imports but writes a zero-width column.
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
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
        '    a: Mapped[Optional[str]] = mapped_column(String)',
        '    b: Mapped[Optional[Decimal]] = mapped_column(Numeric)',
        '    c: Mapped[Optional[Decimal]] = mapped_column(Numeric)',
        '    d: Mapped[Optional[str]] = mapped_column(String)',
        '    e: Mapped[Optional[str]] = mapped_column(String)',
      ]);
    });

    // TYPE_ARGUMENTS captures the empty string from an empty argument list, and
    // only the + in DIGITS keeps Number('') from arriving as 0. Both spellings
    // have to land on the bare callable, or create_all writes NUMERIC(0).
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
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
        '    a: Mapped[Optional[Decimal]] = mapped_column(Numeric)',
        '    b: Mapped[Optional[Decimal]] = mapped_column(Numeric)',
        '    c: Mapped[Optional[str]] = mapped_column(String)',
      ]);
    });
  });

  // Alembic compares the type a model maps against the type it reflects, and
  // create_all writes the mapped one, so each database gets the type its own
  // DDL names wherever SQLAlchemy has it.
  describe('database types', () => {
    it('writes the MySQL integer, decimal, float, BIT and YEAR types with their sign', () => {
      const { state, table } = createTypesFixture(Database.MySQL, [
        ['a', 'TINYINT'],
        ['b', 'TINYINT(1)'],
        ['c', 'SMALLINT'],
        ['d', 'MEDIUMINT'],
        ['e', 'TINYINT(3) UNSIGNED'],
        ['f', 'SMALLINT UNSIGNED'],
        ['g', 'MEDIUMINT(8) UNSIGNED'],
        ['h', 'INT UNSIGNED'],
        ['i', 'INT(11) ZEROFILL'],
        ['j', 'INT UNSIGNED ZEROFILL'],
        ['k', 'BIGINT UNSIGNED'],
        ['l', 'SERIAL'],
        ['m', 'DECIMAL(10,2) UNSIGNED'],
        ['n', 'DECIMAL UNSIGNED'],
        ['o', 'FLOAT UNSIGNED'],
        ['p', 'DOUBLE UNSIGNED'],
        ['q', 'BIT'],
        ['r', 'BIT(8)'],
        ['s', 'YEAR'],
      ]);

      expect(render(state, table)).toEqual([
        'from decimal import Decimal',
        'from typing import Optional',
        '',
        'from sqlalchemy import SmallInteger',
        'from sqlalchemy.dialects.mysql import (',
        '    BIGINT,',
        '    BIT,',
        '    DECIMAL,',
        '    DOUBLE,',
        '    FLOAT,',
        '    INTEGER,',
        '    MEDIUMINT,',
        '    SMALLINT,',
        '    TINYINT,',
        '    YEAR,',
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
        '    a: Mapped[Optional[int]] = mapped_column(TINYINT)',
        '    b: Mapped[Optional[int]] = mapped_column(TINYINT(1))',
        '    c: Mapped[Optional[int]] = mapped_column(SmallInteger)',
        '    d: Mapped[Optional[int]] = mapped_column(MEDIUMINT)',
        '    e: Mapped[Optional[int]] = mapped_column(TINYINT(unsigned=True))',
        '    f: Mapped[Optional[int]] = mapped_column(SMALLINT(unsigned=True))',
        '    g: Mapped[Optional[int]] = mapped_column(MEDIUMINT(unsigned=True))',
        '    h: Mapped[Optional[int]] = mapped_column(INTEGER(unsigned=True))',
        '    i: Mapped[Optional[int]] = mapped_column(INTEGER(11, unsigned=True, zerofill=True))',
        '    j: Mapped[Optional[int]] = mapped_column(INTEGER(unsigned=True, zerofill=True))',
        '    k: Mapped[Optional[int]] = mapped_column(BIGINT(unsigned=True))',
        '    l: Mapped[Optional[int]] = mapped_column(BIGINT(unsigned=True), unique=True)',
        '    m: Mapped[Optional[Decimal]] = mapped_column(DECIMAL(10, 2, unsigned=True))',
        '    n: Mapped[Optional[Decimal]] = mapped_column(DECIMAL(unsigned=True))',
        '    o: Mapped[Optional[float]] = mapped_column(FLOAT(unsigned=True))',
        '    p: Mapped[Optional[float]] = mapped_column(DOUBLE(unsigned=True, asdecimal=False))',
        '    q: Mapped[Optional[int]] = mapped_column(BIT)',
        '    r: Mapped[Optional[int]] = mapped_column(BIT(8))',
        '    s: Mapped[Optional[int]] = mapped_column(YEAR)',
      ]);
    });

    // MySQL writes no VARCHAR without a length, so a fixed-width character or
    // binary type keeps its own name, and the sized TEXT and BLOB classes and a
    // fractional second come from the dialect.
    it('writes the MySQL character, binary, sized and fractional-second types', () => {
      const { state, table } = createTypesFixture(Database.MySQL, [
        ['a', 'CHAR(36)'],
        ['b', 'CHAR'],
        ['c', 'NCHAR'],
        ['d', 'NATIONAL CHAR(10)'],
        ['e', 'BINARY(16)'],
        ['f', 'VARBINARY(16)'],
        ['g', 'CHAR(16) BYTE'],
        ['h', 'VARBINARY'],
        ['i', 'TINYTEXT'],
        ['j', 'MEDIUMTEXT'],
        ['k', 'LONGTEXT'],
        ['l', 'LONG VARCHAR'],
        ['m', 'TINYBLOB'],
        ['n', 'MEDIUMBLOB'],
        ['o', 'LONGBLOB'],
        ['p', 'LONG VARBINARY'],
        ['q', 'TIMESTAMP'],
        ['r', 'TIMESTAMP(3)'],
        ['s', 'DATETIME(6)'],
        ['t', 'TIME(3)'],
        ['u', 'DATETIME(0)'],
        ['v', 'TIME'],
        ['w', 'UUID'],
        ['x', 'CLOB'],
      ]);

      expect(render(state, table)).toEqual([
        'import uuid',
        'from datetime import datetime, time',
        'from typing import Optional',
        '',
        'from sqlalchemy import (',
        '    BINARY,',
        '    CHAR,',
        '    NCHAR,',
        '    VARBINARY,',
        '    DateTime,',
        '    LargeBinary,',
        '    Text,',
        '    Time,',
        '    Uuid,',
        ')',
        'from sqlalchemy.dialects.mysql import (',
        '    DATETIME,',
        '    LONGBLOB,',
        '    LONGTEXT,',
        '    MEDIUMBLOB,',
        '    MEDIUMTEXT,',
        '    TIME,',
        '    TIMESTAMP,',
        '    TINYBLOB,',
        '    TINYTEXT,',
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
        '    a: Mapped[Optional[str]] = mapped_column(CHAR(36))',
        '    b: Mapped[Optional[str]] = mapped_column(CHAR)',
        '    c: Mapped[Optional[str]] = mapped_column(NCHAR)',
        '    d: Mapped[Optional[str]] = mapped_column(NCHAR(10))',
        '    e: Mapped[Optional[bytes]] = mapped_column(BINARY(16))',
        '    f: Mapped[Optional[bytes]] = mapped_column(VARBINARY(16))',
        '    g: Mapped[Optional[bytes]] = mapped_column(BINARY(16))',
        '    h: Mapped[Optional[bytes]] = mapped_column(LargeBinary)',
        '    i: Mapped[Optional[str]] = mapped_column(TINYTEXT)',
        '    j: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)',
        '    k: Mapped[Optional[str]] = mapped_column(LONGTEXT)',
        '    l: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)',
        '    m: Mapped[Optional[bytes]] = mapped_column(TINYBLOB)',
        '    n: Mapped[Optional[bytes]] = mapped_column(MEDIUMBLOB)',
        '    o: Mapped[Optional[bytes]] = mapped_column(LONGBLOB)',
        '    p: Mapped[Optional[bytes]] = mapped_column(MEDIUMBLOB)',
        '    q: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP)',
        '    r: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(fsp=3))',
        '    s: Mapped[Optional[datetime]] = mapped_column(DATETIME(fsp=6))',
        '    t: Mapped[Optional[time]] = mapped_column(TIME(fsp=3))',
        '    u: Mapped[Optional[datetime]] = mapped_column(DateTime)',
        '    v: Mapped[Optional[time]] = mapped_column(Time)',
        '    w: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)',
        '    x: Mapped[Optional[str]] = mapped_column(Text)',
      ]);
    });

    // MySQL stores TEXT(n) and BLOB(n) as the smallest class that holds n,
    // which a bare Text or LargeBinary would leave a TEXT or a BLOB: TEXT(70000)
    // as a MEDIUMTEXT, BLOB(100) and TEXT(0) as tiny ones. n goes on to choose.
    it.each([Database.MySQL, Database.MariaDB])(
      'writes TEXT(n) and BLOB(n) with their length on database %i',
      database => {
        const { state, table } = createTypesFixture(database, [
          ['a', 'TEXT(70000)'],
          ['b', 'BLOB(70000)'],
          ['c', 'text(100)'],
          ['d', 'BLOB(100)'],
          ['e', 'TEXT'],
          ['f', 'BLOB'],
          ['g', 'TEXT(0)'],
        ]);

        expect(render(state, table).slice(-7)).toEqual([
          '    a: Mapped[Optional[str]] = mapped_column(Text(70000))',
          '    b: Mapped[Optional[bytes]] = mapped_column(LargeBinary(70000))',
          '    c: Mapped[Optional[str]] = mapped_column(Text(100))',
          '    d: Mapped[Optional[bytes]] = mapped_column(LargeBinary(100))',
          '    e: Mapped[Optional[str]] = mapped_column(Text)',
          '    f: Mapped[Optional[bytes]] = mapped_column(LargeBinary)',
          '    g: Mapped[Optional[str]] = mapped_column(Text(0))',
        ]);
      }
    );

    // A length on any other database is no class of its own.
    it('keeps TEXT(n) a bare Text outside MySQL and MariaDB', () => {
      const { state, table } = createTypesFixture(Database.SQLite, [
        ['a', 'TEXT(100)'],
        ['b', 'BLOB(100)'],
      ]);

      expect(render(state, table).slice(-2)).toEqual([
        '    a: Mapped[Optional[str]] = mapped_column(Text)',
        '    b: Mapped[Optional[bytes]] = mapped_column(LargeBinary)',
      ]);
    });

    // MariaDB takes CLOB, RAW and NUMBER in its Oracle mode alone, where it
    // stores them as LONGTEXT, VARBINARY(n) and, for a bare NUMBER, a DOUBLE.
    it('writes MariaDB INET4, INET6, UUID and its Oracle-mode and LONG synonyms', () => {
      const { state, table } = createTypesFixture(Database.MariaDB, [
        ['a', 'INET4'],
        ['b', 'INET6'],
        ['c', 'UUID'],
        ['d', 'CLOB'],
        ['e', 'LONG CHAR VARYING'],
        ['f', 'SQL_TSI_YEAR'],
        ['g', 'RAW(16)'],
        ['h', 'RAW'],
        ['i', 'NUMBER'],
        ['j', 'NUMBER(10)'],
        ['k', 'NUMBER(10,2)'],
      ]);

      expect(render(state, table)).toEqual([
        'import uuid',
        'from decimal import Decimal',
        'from typing import Optional',
        '',
        'from sqlalchemy import UUID, VARBINARY, Double, LargeBinary, Numeric',
        'from sqlalchemy.dialects.mysql import INET4, INET6, LONGTEXT, MEDIUMTEXT, YEAR',
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
        '    a: Mapped[Optional[str]] = mapped_column(INET4)',
        '    b: Mapped[Optional[str]] = mapped_column(INET6)',
        '    c: Mapped[Optional[uuid.UUID]] = mapped_column(UUID)',
        '    d: Mapped[Optional[str]] = mapped_column(LONGTEXT)',
        '    e: Mapped[Optional[str]] = mapped_column(MEDIUMTEXT)',
        '    f: Mapped[Optional[int]] = mapped_column(YEAR)',
        '    g: Mapped[Optional[bytes]] = mapped_column(VARBINARY(16))',
        '    h: Mapped[Optional[bytes]] = mapped_column(LargeBinary)',
        '    i: Mapped[Optional[float]] = mapped_column(Double)',
        '    j: Mapped[Optional[Decimal]] = mapped_column(Numeric(10))',
        '    k: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))',
      ]);
    });

    // MySQL and MariaDB store every national varying spelling as a VARCHAR in
    // utf8mb3, which only the dialect's VARCHAR can name for create_all.
    it.each([
      ['MySQL', Database.MySQL],
      ['MariaDB', Database.MariaDB],
    ])(
      'writes the %s national varying types as a utf8mb3 VARCHAR',
      (_, database) => {
        const { state, table } = createTypesFixture(database, [
          ['a', 'NVARCHAR(20)'],
          ['b', 'NATIONAL VARCHAR(20)'],
          ['c', 'NATIONAL VARCHARACTER(20)'],
          ['d', 'NCHAR VARCHAR(20)'],
          ['e', 'NCHAR VARCHARACTER(20)'],
          ['f', 'nchar varying(20)'],
          ['g', 'NATIONAL CHAR VARYING(20)'],
          ['h', 'NATIONAL CHARACTER VARYING(20)'],
          ['i', 'NVARCHAR'],
        ]);
        const lines = render(state, table);

        expect(lines).toContain('from sqlalchemy import String');
        expect(lines).toContain(
          'from sqlalchemy.dialects.mysql import VARCHAR'
        );
        expect(lines.slice(-9)).toEqual([
          ...['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(
            name =>
              `    ${name}: Mapped[Optional[str]] = mapped_column(VARCHAR(20, charset="utf8mb3"))`
          ),
          '    i: Mapped[Optional[str]] = mapped_column(String)',
        ]);
      }
    );

    // Each member goes back as a Python literal, an escape for a backslash or a
    // control character, and single quotes only where black would pick them:
    // where the member holds more double quotes than single ones.
    it('writes ENUM and SET members as Python string literals', () => {
      const members = String.raw`'it''s','a\\b','x"y','l\nm\rn\to','\Z'`;
      const { state, table } = createTypesFixture(Database.MySQL, [
        ['a', `ENUM(${members},'del${String.fromCharCode(0x7f)}')`],
        ['b', "SET('r','w')"],
        ['c', 'ENUM'],
        ['d', String.raw`ENUM('p"q''r','"two" "dq" ''one''','x"\\')`],
      ]);
      const lines = render(state, table);

      expect(lines).toContain('from typing import Optional, Set');
      expect(lines).toContain('from sqlalchemy import Enum, String');
      expect(lines).toContain('from sqlalchemy.dialects.mysql import SET');
      expect(lines.slice(-8)).toEqual([
        '    a: Mapped[Optional[str]] = mapped_column(',
        String.raw`        Enum("it's", "a\\b", 'x"y', "l\nm\rn\to", "\x1a", "del\x7f"),`,
        '    )',
        '    b: Mapped[Optional[Set[str]]] = mapped_column(SET("r", "w"))',
        '    c: Mapped[Optional[str]] = mapped_column(String)',
        '    d: Mapped[Optional[str]] = mapped_column(',
        String.raw`        Enum("p\"q'r", '"two" "dq" \'one\'', 'x"\\'),`,
        '    )',
      ]);
    });

    // A call black would split keeps its members one to a line, the trailing
    // comma telling black to leave them there.
    it('writes the members of an ENUM or SET past the line limit one to a line', () => {
      const { state, table } = createKeyFixture(Database.MySQL, [
        [
          'rating',
          "ENUM('G','PG','PG-13','R','NC-17','X','XX','XXX','unrated','pending','withdrawn')",
          ColumnOption.notNull,
        ],
        [
          'special_features',
          "SET('Trailers','Commentaries','Deleted Scenes','Behind the Scenes','Bloopers')",
          0,
        ],
      ]);

      expect(render(state, table).slice(-25)).toEqual([
        '    rating: Mapped[str] = mapped_column(',
        '        Enum(',
        '            "G",',
        '            "PG",',
        '            "PG-13",',
        '            "R",',
        '            "NC-17",',
        '            "X",',
        '            "XX",',
        '            "XXX",',
        '            "unrated",',
        '            "pending",',
        '            "withdrawn",',
        '        ),',
        '        nullable=False,',
        '    )',
        '    special_features: Mapped[Optional[Set[str]]] = mapped_column(',
        '        SET(',
        '            "Trailers",',
        '            "Commentaries",',
        '            "Deleted Scenes",',
        '            "Behind the Scenes",',
        '            "Bloopers",',
        '        ),',
        '    )',
      ]);
    });

    it('writes the PostgreSQL dialect types with their precision and fields', () => {
      const { state, table } = createTypesFixture(Database.PostgreSQL, [
        ['a', 'smallint'],
        ['b', 'smallserial'],
        ['c', 'real'],
        ['d', 'float(24)'],
        ['e', 'char(5)'],
        ['f', 'bpchar(5)'],
        ['g', 'bpchar'],
        ['h', 'bit'],
        ['i', 'bit(8)'],
        ['j', 'varbit(8)'],
        ['k', 'bit varying'],
        ['l', 'money'],
        ['m', 'inet'],
        ['n', 'macaddr8'],
        ['o', 'tsvector'],
        ['p', 'oid'],
        ['q', 'int4range'],
        ['r', 'numrange'],
        ['s', 'daterange'],
        ['t', 'tstzrange'],
        ['u', 'interval'],
        ['v', 'interval day to second(3)'],
        ['w', 'interval(3)'],
        ['x', 'interval year to month'],
        ['y', 'time(3)'],
        ['z', 'timetz(3)'],
        ['aa', 'timestamp(3)'],
        ['ab', 'timestamp(6) with time zone'],
        ['ac', 'timestamptz'],
        ['ad', 'varchar(20)'],
      ]);

      expect(render(state, table)).toEqual([
        'from datetime import date, datetime, time, timedelta',
        'from decimal import Decimal',
        'from typing import Optional',
        '',
        'from sqlalchemy import CHAR, REAL, DateTime, Interval, SmallInteger, String',
        'from sqlalchemy.dialects.postgresql import (',
        '    BIT,',
        '    DATERANGE,',
        '    INET,',
        '    INT4RANGE,',
        '    INTERVAL,',
        '    MACADDR8,',
        '    MONEY,',
        '    NUMRANGE,',
        '    OID,',
        '    TIME,',
        '    TIMESTAMP,',
        '    TSTZRANGE,',
        '    TSVECTOR,',
        '    Range,',
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
        '    a: Mapped[Optional[int]] = mapped_column(SmallInteger)',
        '    b: Mapped[Optional[int]] = mapped_column(SmallInteger)',
        '    c: Mapped[Optional[float]] = mapped_column(REAL)',
        '    d: Mapped[Optional[float]] = mapped_column(REAL)',
        '    e: Mapped[Optional[str]] = mapped_column(CHAR(5))',
        '    f: Mapped[Optional[str]] = mapped_column(CHAR(5))',
        '    g: Mapped[Optional[str]] = mapped_column(String)',
        '    h: Mapped[Optional[str]] = mapped_column(BIT)',
        '    i: Mapped[Optional[str]] = mapped_column(BIT(8))',
        '    j: Mapped[Optional[str]] = mapped_column(BIT(8, varying=True))',
        '    k: Mapped[Optional[str]] = mapped_column(BIT(varying=True))',
        '    l: Mapped[Optional[str]] = mapped_column(MONEY)',
        '    m: Mapped[Optional[str]] = mapped_column(INET)',
        '    n: Mapped[Optional[str]] = mapped_column(MACADDR8)',
        '    o: Mapped[Optional[str]] = mapped_column(TSVECTOR)',
        '    p: Mapped[Optional[int]] = mapped_column(OID)',
        '    q: Mapped[Optional[Range[int]]] = mapped_column(INT4RANGE)',
        '    r: Mapped[Optional[Range[Decimal]]] = mapped_column(NUMRANGE)',
        '    s: Mapped[Optional[Range[date]]] = mapped_column(DATERANGE)',
        '    t: Mapped[Optional[Range[datetime]]] = mapped_column(TSTZRANGE)',
        '    u: Mapped[Optional[timedelta]] = mapped_column(Interval)',
        '    v: Mapped[Optional[timedelta]] = mapped_column(',
        '        INTERVAL(fields="day to second", precision=3),',
        '    )',
        '    w: Mapped[Optional[timedelta]] = mapped_column(INTERVAL(precision=3))',
        '    x: Mapped[Optional[timedelta]] = mapped_column(INTERVAL(fields="year to month"))',
        '    y: Mapped[Optional[time]] = mapped_column(TIME(precision=3))',
        '    z: Mapped[Optional[time]] = mapped_column(TIME(timezone=True, precision=3))',
        '    aa: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(precision=3))',
        '    ab: Mapped[Optional[datetime]] = mapped_column(',
        '        TIMESTAMP(timezone=True, precision=6),',
        '    )',
        '    ac: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))',
        '    ad: Mapped[Optional[str]] = mapped_column(String(20))',
      ]);
    });

    // psycopg2 parses an array into a list only for the element types it knows
    // and hands any other over as one string such as {a,b}, which an ARRAY
    // would split into its letters: an enum, a bit string, xml, a point, an xid.
    it('writes a PostgreSQL array as an ARRAY of its element, a List a dimension', () => {
      const { state, table } = createTypesFixture(Database.PostgreSQL, [
        ['a', 'int[]'],
        ['b', 'text[][]'],
        ['c', 'varchar(20)[]'],
        ['d', 'uuid[]'],
        ['e', 'integer ARRAY'],
        ['f', 'timestamptz[][][]'],
        ['g', 'numeric(10,2)[]'],
        ['h', '"mood"[]'],
        ['i', 'bit(8)[]'],
        ['j', 'xml[]'],
        ['k', 'point[]'],
        ['l', 'xid[]'],
        ['m', 'money[]'],
        ['n', 'tsvector[]'],
        ['o', 'int4multirange[]'],
        ['p', 'inet[]'],
        ['q', 'int4range[]'],
        ['r', 'interval day[]'],
        ['s', 'dec(10,2)[]'],
        ['t', 'dec[]'],
      ]);

      expect(render(state, table)).toEqual([
        'import uuid',
        'from datetime import datetime, timedelta',
        'from decimal import Decimal',
        'from typing import List, Optional',
        '',
        'from sqlalchemy import ARRAY, DateTime, Integer, Numeric, String, Text',
        'from sqlalchemy.dialects.postgresql import INET, INT4RANGE, INTERVAL, UUID, Range',
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
        '    a: Mapped[Optional[List[int]]] = mapped_column(ARRAY(Integer))',
        '    b: Mapped[Optional[List[List[str]]]] = mapped_column(ARRAY(Text, dimensions=2))',
        '    c: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String(20)))',
        '    d: Mapped[Optional[List[uuid.UUID]]] = mapped_column(ARRAY(UUID(as_uuid=True)))',
        '    e: Mapped[Optional[List[int]]] = mapped_column(ARRAY(Integer))',
        '    f: Mapped[Optional[List[List[List[datetime]]]]] = mapped_column(',
        '        ARRAY(DateTime(timezone=True), dimensions=3),',
        '    )',
        '    g: Mapped[Optional[List[Decimal]]] = mapped_column(ARRAY(Numeric(10, 2)))',
        '    h: Mapped[Optional[str]] = mapped_column(String)',
        '    i: Mapped[Optional[str]] = mapped_column(String)',
        '    j: Mapped[Optional[str]] = mapped_column(String)',
        '    k: Mapped[Optional[str]] = mapped_column(String)',
        '    l: Mapped[Optional[str]] = mapped_column(String)',
        '    m: Mapped[Optional[str]] = mapped_column(String)',
        '    n: Mapped[Optional[str]] = mapped_column(String)',
        '    o: Mapped[Optional[str]] = mapped_column(String)',
        '    p: Mapped[Optional[List[str]]] = mapped_column(ARRAY(INET))',
        '    q: Mapped[Optional[List[Range[int]]]] = mapped_column(ARRAY(INT4RANGE))',
        '    r: Mapped[Optional[List[timedelta]]] = mapped_column(ARRAY(INTERVAL(fields="day")))',
        '    s: Mapped[Optional[List[Decimal]]] = mapped_column(ARRAY(Numeric(10, 2)))',
        '    t: Mapped[Optional[List[Decimal]]] = mapped_column(ARRAY(Numeric))',
      ]);
    });

    // psycopg2 hands a multirange over as its text form and cannot write one;
    // psycopg reads and writes the list of ranges.
    it('writes a PostgreSQL multirange as its dialect type, a List of Range', () => {
      const { state, table } = createTypesFixture(Database.PostgreSQL, [
        ['a', 'int4multirange'],
        ['b', 'int8multirange'],
        ['c', 'nummultirange'],
        ['d', 'datemultirange'],
        ['e', 'tsmultirange'],
        ['f', 'tstzmultirange'],
      ]);

      expect(render(state, table)).toEqual([
        'from datetime import date, datetime',
        'from decimal import Decimal',
        'from typing import List, Optional',
        '',
        'from sqlalchemy.dialects.postgresql import (',
        '    DATEMULTIRANGE,',
        '    INT4MULTIRANGE,',
        '    INT8MULTIRANGE,',
        '    NUMMULTIRANGE,',
        '    TSMULTIRANGE,',
        '    TSTZMULTIRANGE,',
        '    Range,',
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
        '    a: Mapped[Optional[List[Range[int]]]] = mapped_column(INT4MULTIRANGE)',
        '    b: Mapped[Optional[List[Range[int]]]] = mapped_column(INT8MULTIRANGE)',
        '    c: Mapped[Optional[List[Range[Decimal]]]] = mapped_column(NUMMULTIRANGE)',
        '    d: Mapped[Optional[List[Range[date]]]] = mapped_column(DATEMULTIRANGE)',
        '    e: Mapped[Optional[List[Range[datetime]]]] = mapped_column(TSMULTIRANGE)',
        '    f: Mapped[Optional[List[Range[datetime]]]] = mapped_column(TSTZMULTIRANGE)',
      ]);
    });

    it('writes the SQL Server money, national character and binary types', () => {
      const { state, table } = createTypesFixture(Database.MSSQL, [
        ['a', 'money'],
        ['b', 'smallmoney'],
        ['c', 'nvarchar(50)'],
        ['d', 'nvarchar(max)'],
        ['e', 'national character varying(20)'],
        ['f', 'nchar(10)'],
        ['g', 'nchar'],
        ['h', 'ntext'],
        ['i', 'national text'],
        ['j', 'binary(16)'],
        ['k', 'binary'],
        ['l', 'varbinary(16)'],
        ['m', 'binary varying(16)'],
        ['n', 'varbinary(max)'],
        ['o', 'bit'],
        ['p', 'numeric(10,2)'],
        ['q', 'char(10)'],
      ]);

      expect(render(state, table)).toEqual([
        'from decimal import Decimal',
        'from typing import Optional',
        '',
        'from sqlalchemy import (',
        '    BINARY,',
        '    CHAR,',
        '    NCHAR,',
        '    NVARCHAR,',
        '    VARBINARY,',
        '    Boolean,',
        '    LargeBinary,',
        '    Numeric,',
        ')',
        'from sqlalchemy.dialects.mssql import MONEY, NTEXT, SMALLMONEY',
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
        '    a: Mapped[Optional[Decimal]] = mapped_column(MONEY)',
        '    b: Mapped[Optional[Decimal]] = mapped_column(SMALLMONEY)',
        '    c: Mapped[Optional[str]] = mapped_column(NVARCHAR(50))',
        '    d: Mapped[Optional[str]] = mapped_column(NVARCHAR)',
        '    e: Mapped[Optional[str]] = mapped_column(NVARCHAR(20))',
        '    f: Mapped[Optional[str]] = mapped_column(NCHAR(10))',
        '    g: Mapped[Optional[str]] = mapped_column(NCHAR)',
        '    h: Mapped[Optional[str]] = mapped_column(NTEXT)',
        '    i: Mapped[Optional[str]] = mapped_column(NTEXT)',
        '    j: Mapped[Optional[bytes]] = mapped_column(BINARY(16))',
        '    k: Mapped[Optional[bytes]] = mapped_column(BINARY)',
        '    l: Mapped[Optional[bytes]] = mapped_column(VARBINARY(16))',
        '    m: Mapped[Optional[bytes]] = mapped_column(VARBINARY(16))',
        '    n: Mapped[Optional[bytes]] = mapped_column(LargeBinary)',
        '    o: Mapped[Optional[bool]] = mapped_column(Boolean)',
        '    p: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))',
        '    q: Mapped[Optional[str]] = mapped_column(CHAR(10))',
      ]);
    });

    // SQLAlchemy writes DATE and every TIMESTAMP as an Oracle DATE unless the
    // dialect's own types are used, and has no type for INTERVAL YEAR TO MONTH,
    // which therefore stays an Interval.
    it('writes the Oracle date, timestamp, national, raw, interval and NUMBER types', () => {
      const { state, table } = createTypesFixture(Database.Oracle, [
        ['a', 'DATE'],
        ['b', 'TIMESTAMP'],
        ['c', 'TIMESTAMP(3)'],
        ['d', 'TIMESTAMP(6) WITH TIME ZONE'],
        ['e', 'TIMESTAMP(6) WITH LOCAL TIME ZONE'],
        ['f', 'NVARCHAR2(20)'],
        ['g', 'NVARCHAR2(20 CHAR)'],
        ['h', 'NVARCHAR2'],
        ['i', 'RAW(16)'],
        ['j', 'RAW'],
        ['k', 'INTERVAL DAY(2) TO SECOND(6)'],
        ['l', 'INTERVAL DAY(5) TO SECOND'],
        ['m', 'INTERVAL DAY TO SECOND'],
        ['n', 'INTERVAL YEAR TO MONTH'],
        ['o', 'NUMBER(10,2)'],
        ['p', 'NUMBER(*,2)'],
        ['q', 'NUMBER'],
        ['r', 'VARCHAR2(100 BYTE)'],
        ['s', 'CHAR(5)'],
        ['t', 'NCHAR(5)'],
        ['u', 'NCLOB'],
        ['v', 'NCHAR VARYING(20)'],
        ['w', 'NATIONAL CHAR VARYING(20)'],
        ['x', 'NATIONAL CHARACTER VARYING(20)'],
      ]);

      expect(render(state, table)).toEqual([
        'from datetime import datetime, timedelta',
        'from decimal import Decimal',
        'from typing import Optional',
        '',
        'from sqlalchemy import CHAR, NCHAR, BigInteger, Interval, LargeBinary, Numeric, String',
        'from sqlalchemy.dialects.oracle import DATE, NCLOB, NVARCHAR2, RAW, TIMESTAMP',
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
        '    a: Mapped[Optional[datetime]] = mapped_column(DATE)',
        '    b: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP)',
        '    c: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP)',
        '    d: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))',
        '    e: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(local_timezone=True))',
        '    f: Mapped[Optional[str]] = mapped_column(NVARCHAR2(20))',
        '    g: Mapped[Optional[str]] = mapped_column(NVARCHAR2(20))',
        '    h: Mapped[Optional[str]] = mapped_column(String)',
        '    i: Mapped[Optional[bytes]] = mapped_column(RAW(16))',
        '    j: Mapped[Optional[bytes]] = mapped_column(LargeBinary)',
        '    k: Mapped[Optional[timedelta]] = mapped_column(',
        '        Interval(day_precision=2, second_precision=6),',
        '    )',
        '    l: Mapped[Optional[timedelta]] = mapped_column(Interval(day_precision=5))',
        '    m: Mapped[Optional[timedelta]] = mapped_column(Interval)',
        '    n: Mapped[Optional[timedelta]] = mapped_column(Interval)',
        '    o: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))',
        '    p: Mapped[Optional[Decimal]] = mapped_column(Numeric(38, 2))',
        '    q: Mapped[Optional[int]] = mapped_column(BigInteger)',
        '    r: Mapped[Optional[str]] = mapped_column(String(100))',
        '    s: Mapped[Optional[str]] = mapped_column(CHAR(5))',
        '    t: Mapped[Optional[str]] = mapped_column(NCHAR(5))',
        '    u: Mapped[Optional[str]] = mapped_column(NCLOB)',
        '    v: Mapped[Optional[str]] = mapped_column(NVARCHAR2(20))',
        '    w: Mapped[Optional[str]] = mapped_column(NVARCHAR2(20))',
        '    x: Mapped[Optional[str]] = mapped_column(NVARCHAR2(20))',
      ]);
    });

    // psycopg2 reads xid, cid and xid8 as text and PostgreSQL casts no integer
    // to them, so a BigInteger reads a str and refuses to write an int.
    it('writes PostgreSQL xid, cid and xid8 as a String', () => {
      const { state, table } = createKeyFixture(Database.PostgreSQL, [
        ['k', 'xid', ColumnOption.primaryKey],
        ['a', 'cid', ColumnOption.notNull],
        ['b', 'xid8', 0],
      ]);

      expect(render(state, table).slice(2, 3)).toEqual([
        'from sqlalchemy import String',
      ]);
      expect(render(state, table).slice(-3)).toEqual([
        '    k: Mapped[str] = mapped_column(String, primary_key=True)',
        '    a: Mapped[str] = mapped_column(String, nullable=False)',
        '    b: Mapped[Optional[str]] = mapped_column(String)',
      ]);
    });

    // pymssql reads a rowversion and the CLR types as bytes; the dialect's
    // TIMESTAMP is the rowversion Alembic reflects, its ROWVERSION is not.
    it('writes a SQL Server rowversion as TIMESTAMP and the types read as bytes', () => {
      const { state, table } = createTypesFixture(Database.MSSQL, [
        ['a', 'rowversion'],
        ['b', 'timestamp'],
        ['c', 'hierarchyid'],
        ['d', 'geography'],
        ['e', 'geometry'],
        ['f', 'sql_variant'],
      ]);

      expect(render(state, table)).toEqual([
        'from typing import Optional',
        '',
        'from sqlalchemy import String',
        'from sqlalchemy.dialects.mssql import TIMESTAMP',
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
        '    a: Mapped[Optional[bytes]] = mapped_column(TIMESTAMP)',
        '    b: Mapped[Optional[bytes]] = mapped_column(TIMESTAMP)',
        '    c: Mapped[Optional[bytes]] = mapped_column(String)',
        '    d: Mapped[Optional[bytes]] = mapped_column(String)',
        '    e: Mapped[Optional[bytes]] = mapped_column(String)',
        '    f: Mapped[Optional[bytes]] = mapped_column(String)',
      ]);
    });

    // python-oracledb hands an object type over as a DbObject, a VECTOR as an
    // array.array and a BFILE as a LOB, none of them a str or bytes.
    it('annotates the Oracle types read as a python-oracledb object Any', () => {
      const { state, table } = createTypesFixture(Database.Oracle, [
        ['a', 'ANYDATA'],
        ['b', 'URIType'],
        ['c', 'VECTOR'],
        ['d', 'VECTOR(3, FLOAT32)'],
        ['e', 'BFILE'],
        ['f', 'XMLType'],
      ]);

      expect(render(state, table)).toEqual([
        'from typing import Any, Optional',
        '',
        'from sqlalchemy import LargeBinary, String',
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
        '    a: Mapped[Optional[Any]] = mapped_column(String)',
        '    b: Mapped[Optional[Any]] = mapped_column(String)',
        '    c: Mapped[Optional[Any]] = mapped_column(String)',
        '    d: Mapped[Optional[Any]] = mapped_column(String)',
        '    e: Mapped[Optional[Any]] = mapped_column(LargeBinary)',
        '    f: Mapped[Optional[str]] = mapped_column(String)',
      ]);
    });

    it('writes an interval as Interval on a database with no dialect type for it', () => {
      const { state, table } = createTypesFixture(Database.Databricks, [
        ['a', 'INTERVAL DAY TO SECOND'],
        ['b', 'INTERVAL YEAR TO MONTH'],
      ]);

      expect(render(state, table).slice(0, 4)).toEqual([
        'from datetime import timedelta',
        'from typing import Optional',
        '',
        'from sqlalchemy import Interval',
      ]);
      expect(render(state, table).slice(-2)).toEqual([
        '    a: Mapped[Optional[timedelta]] = mapped_column(Interval)',
        '    b: Mapped[Optional[timedelta]] = mapped_column(Interval)',
      ]);
    });

    // MySQL and SQL Server have no interval column, so the name is no type
    // there and keeps the string the vendor list files it under.
    it('leaves an interval a string on a database with no interval type', () => {
      const mysql = createTypesFixture(Database.MySQL, [
        ['a', 'interval day to second'],
      ]);
      const mssql = createTypesFixture(Database.MSSQL, [['a', 'interval(3)']]);

      expect(render(mysql.state, mysql.table).slice(-1)).toEqual([
        '    a: Mapped[Optional[str]] = mapped_column(String)',
      ]);
      expect(render(mssql.state, mssql.table).slice(-1)).toEqual([
        '    a: Mapped[Optional[str]] = mapped_column(String(3))',
      ]);
    });
  });

  // SQLAlchemy's autoincrement="auto" turns a lone integer or numeric key into
  // SERIAL, AUTO_INCREMENT or IDENTITY, which the document's DDL never declared
  // and which refuses an explicit key on SQL Server.
  describe('autoincrement', () => {
    it('writes autoincrement=False on a lone numeric key the document does not flag', () => {
      const numeric = createKeyFixture(Database.PostgreSQL, [
        ['k', 'numeric(10,2)', ColumnOption.primaryKey],
      ]);
      const real = createKeyFixture(Database.PostgreSQL, [
        ['k', 'real', ColumnOption.primaryKey],
      ]);
      const unsigned = createKeyFixture(Database.MySQL, [
        ['k', 'DECIMAL(10,2) UNSIGNED', ColumnOption.primaryKey],
      ]);
      const double = createKeyFixture(Database.MySQL, [
        ['k', 'DOUBLE', ColumnOption.primaryKey],
      ]);
      const mssql = createKeyFixture(Database.MSSQL, [
        ['k', 'numeric(10)', ColumnOption.primaryKey],
      ]);

      expect(render(numeric.state, numeric.table).slice(-5)).toEqual([
        '    k: Mapped[Decimal] = mapped_column(',
        '        Numeric(10, 2),',
        '        primary_key=True,',
        '        autoincrement=False,',
        '    )',
      ]);
      expect(render(real.state, real.table).slice(-1)).toEqual([
        '    k: Mapped[float] = mapped_column(REAL, primary_key=True, autoincrement=False)',
      ]);
      expect(render(unsigned.state, unsigned.table).slice(-5)).toEqual([
        '    k: Mapped[Decimal] = mapped_column(',
        '        DECIMAL(10, 2, unsigned=True),',
        '        primary_key=True,',
        '        autoincrement=False,',
        '    )',
      ]);
      expect(render(double.state, double.table).slice(-1)).toEqual([
        '    k: Mapped[float] = mapped_column(Double, primary_key=True, autoincrement=False)',
      ]);
      expect(render(mssql.state, mssql.table).slice(-5)).toEqual([
        '    k: Mapped[Decimal] = mapped_column(',
        '        Numeric(10),',
        '        primary_key=True,',
        '        autoincrement=False,',
        '    )',
      ]);
    });

    // SQLite numbers the rows of a key declared exactly INTEGER itself, as an
    // alias of the rowid, which SQLAlchemy's default models; INT, BIGINT and
    // INTEGER(10) number nothing there.
    it('leaves a lone SQLite INTEGER key to SQLAlchemy, which reads it as the rowid', () => {
      const rowid = createKeyFixture(Database.SQLite, [
        ['id', 'INTEGER', ColumnOption.primaryKey],
      ]);
      const lower = createKeyFixture(Database.SQLite, [
        ['id', 'integer', ColumnOption.primaryKey],
      ]);
      const sized = createKeyFixture(Database.SQLite, [
        ['id', 'INTEGER(10)', ColumnOption.primaryKey],
      ]);
      const int = createKeyFixture(Database.SQLite, [
        ['id', 'INT', ColumnOption.primaryKey],
      ]);
      const postgres = createKeyFixture(Database.PostgreSQL, [
        ['id', 'INTEGER', ColumnOption.primaryKey],
      ]);

      expect(render(rowid.state, rowid.table).slice(-1)).toEqual([
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
      ]);
      expect(render(lower.state, lower.table).slice(-1)).toEqual([
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True)',
      ]);
      expect(render(sized.state, sized.table).slice(-1)).toEqual([
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
      ]);
      expect(render(int.state, int.table).slice(-1)).toEqual([
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
      ]);
      expect(render(postgres.state, postgres.table).slice(-1)).toEqual([
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
      ]);
    });

    it('writes autoincrement=False on a lone integer key the document does not flag', () => {
      const { state, table } = createKeyFixture(Database.MySQL, [
        ['id', 'BIGINT UNSIGNED', ColumnOption.primaryKey],
        ['name', 'VARCHAR(20)', 0],
      ]);

      expect(render(state, table).slice(-6)).toEqual([
        '    id: Mapped[int] = mapped_column(',
        '        BIGINT(unsigned=True),',
        '        primary_key=True,',
        '        autoincrement=False,',
        '    )',
        '    name: Mapped[Optional[str]] = mapped_column(String(20))',
      ]);
    });

    // A serial type numbers its rows itself, so its key keeps the sequence
    // create_all makes for it, and drops the default it would conflict with.
    it.each([
      [
        'serial',
        Database.PostgreSQL,
        [
          '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)',
        ],
      ],
      [
        'bigserial',
        Database.PostgreSQL,
        [
          '    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)',
        ],
      ],
      [
        'smallserial',
        Database.PostgreSQL,
        [
          '    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, autoincrement=True)',
        ],
      ],
      [
        'SERIAL',
        Database.MySQL,
        [
          '    id: Mapped[int] = mapped_column(',
          '        BIGINT(unsigned=True),',
          '        primary_key=True,',
          '        autoincrement=True,',
          '        unique=True,',
          '    )',
        ],
      ],
    ])('treats a %s key as flagged', (dataType, database, lines) => {
      const table = createTable({ id: 't1', name: 'seq', columnIds: ['c1'] });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'id',
            dataType,
            default: '1',
            options: ColumnOption.primaryKey,
          }),
        ],
        settings: { database },
      });

      expect(render(state, table).slice(-lines.length)).toEqual(lines);
    });

    // MySQL's SERIAL is BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE, so the
    // unique index it adds belongs to the model wherever the column stands.
    it('writes unique=True on every MySQL and MariaDB SERIAL column', () => {
      const mariadb = createKeyFixture(Database.MariaDB, [
        ['k', 'SERIAL', ColumnOption.primaryKey],
      ]);
      const composite = createKeyFixture(Database.MySQL, [
        ['a', 'INT', ColumnOption.primaryKey],
        ['k', 'SERIAL', ColumnOption.primaryKey],
      ]);
      const column = createKeyFixture(Database.MySQL, [
        ['id', 'INT', ColumnOption.primaryKey],
        ['k', 'serial', ColumnOption.notNull],
        ['u', 'SERIAL', ColumnOption.notNull | ColumnOption.unique],
      ]);

      expect(render(mariadb.state, mariadb.table).slice(-6)).toEqual([
        '    k: Mapped[int] = mapped_column(',
        '        BIGINT(unsigned=True),',
        '        primary_key=True,',
        '        autoincrement=True,',
        '        unique=True,',
        '    )',
      ]);
      expect(render(composite.state, composite.table).slice(-2)).toEqual([
        '    a: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    k: Mapped[int] = mapped_column(BIGINT(unsigned=True), primary_key=True, unique=True)',
      ]);
      expect(render(column.state, column.table).slice(-3)).toEqual([
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
        '    k: Mapped[int] = mapped_column(BIGINT(unsigned=True), nullable=False, unique=True)',
        '    u: Mapped[int] = mapped_column(BIGINT(unsigned=True), nullable=False, unique=True)',
      ]);
    });

    // The editor's DDL numbers a flagged column only where its database takes
    // an identity on the type, and SQLAlchemy refuses autoincrement=True on a
    // type of neither Integer nor Numeric affinity.
    it.each([
      [
        'PostgreSQL',
        'varchar(10)',
        Database.PostgreSQL,
        ['    id: Mapped[str] = mapped_column(String(10), primary_key=True)'],
      ],
      [
        'PostgreSQL',
        'uuid',
        Database.PostgreSQL,
        [
          '    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)',
        ],
      ],
      [
        'PostgreSQL',
        'numeric(10)',
        Database.PostgreSQL,
        [
          '    id: Mapped[Decimal] = mapped_column(',
          '        Numeric(10),',
          '        primary_key=True,',
          '        autoincrement=False,',
          '    )',
        ],
      ],
      [
        'PostgreSQL',
        'int4',
        Database.PostgreSQL,
        [
          '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)',
        ],
      ],
      [
        'SQLite',
        'TEXT',
        Database.SQLite,
        ['    id: Mapped[str] = mapped_column(Text, primary_key=True)'],
      ],
      [
        'SQLite',
        'VARCHAR(36)',
        Database.SQLite,
        ['    id: Mapped[str] = mapped_column(String(36), primary_key=True)'],
      ],
      [
        'SQLite',
        'NUMERIC',
        Database.SQLite,
        [
          '    id: Mapped[Decimal] = mapped_column(Numeric, primary_key=True, autoincrement=False)',
        ],
      ],
      [
        'SQLite',
        'BIGINT',
        Database.SQLite,
        [
          '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)',
        ],
      ],
      [
        'MySQL',
        'VARCHAR(10)',
        Database.MySQL,
        ['    id: Mapped[str] = mapped_column(String(10), primary_key=True)'],
      ],
      [
        'Oracle',
        'VARCHAR2(10)',
        Database.Oracle,
        ['    id: Mapped[str] = mapped_column(String(10), primary_key=True)'],
      ],
      [
        'Oracle',
        'NUMBER(10,2)',
        Database.Oracle,
        [
          '    id: Mapped[Decimal] = mapped_column(',
          '        Numeric(10, 2),',
          '        primary_key=True,',
          '        autoincrement=True,',
          '    )',
        ],
      ],
      [
        'MySQL',
        'DOUBLE',
        Database.MySQL,
        [
          '    id: Mapped[float] = mapped_column(Double, primary_key=True, autoincrement=False)',
        ],
      ],
      [
        'MySQL',
        'TINYINT',
        Database.MySQL,
        [
          '    id: Mapped[int] = mapped_column(TINYINT, primary_key=True, autoincrement=True)',
        ],
      ],
      [
        'MariaDB',
        'DOUBLE',
        Database.MariaDB,
        [
          '    id: Mapped[float] = mapped_column(Double, primary_key=True, autoincrement=True)',
        ],
      ],
      [
        'MariaDB',
        'DECIMAL(10,0)',
        Database.MariaDB,
        [
          '    id: Mapped[Decimal] = mapped_column(',
          '        Numeric(10, 0),',
          '        primary_key=True,',
          '        autoincrement=False,',
          '    )',
        ],
      ],
      [
        'SQL Server',
        'numeric(10)',
        Database.MSSQL,
        [
          '    id: Mapped[Decimal] = mapped_column(',
          '        Numeric(10),',
          '        primary_key=True,',
          '        autoincrement=True,',
          '    )',
        ],
      ],
      [
        'SQL Server',
        'decimal(10,2)',
        Database.MSSQL,
        [
          '    id: Mapped[Decimal] = mapped_column(',
          '        Numeric(10, 2),',
          '        primary_key=True,',
          '        autoincrement=False,',
          '    )',
        ],
      ],
      [
        'SQL Server',
        'float',
        Database.MSSQL,
        [
          '    id: Mapped[float] = mapped_column(Double, primary_key=True, autoincrement=False)',
        ],
      ],
      [
        'Databricks',
        'INT',
        Database.Databricks,
        [
          '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
        ],
      ],
      [
        'Databricks',
        'BIGINT',
        Database.Databricks,
        [
          '    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)',
        ],
      ],
    ])(
      'numbers a flagged lone %s key of %s only where the database does',
      (_name, dataType, database, lines) => {
        const { state, table } = createKeyFixture(database, [
          [
            'id',
            dataType,
            ColumnOption.primaryKey |
              ColumnOption.notNull |
              ColumnOption.autoIncrement,
          ],
        ]);

        expect(render(state, table).slice(-lines.length)).toEqual(lines);
      }
    );

    // PostgreSQL and Databricks take an identity on their integer names alone
    // and SQLite its AUTOINCREMENT on a lone integer key, where the editor's
    // DDL writes one; a serial numbers its rows without it.
    it.each([
      ['PostgreSQL', Database.PostgreSQL, /GENERATED ALWAYS AS IDENTITY/, []],
      [
        'SQLite',
        Database.SQLite,
        /AUTOINCREMENT\)/,
        ['INT(10)', 'BIGINT(20)', 'UNSIGNED BIG INT', 'SMALLINT UNSIGNED'],
      ],
      ['Databricks', Database.Databricks, /GENERATED ALWAYS AS IDENTITY/, []],
    ])(
      'writes autoincrement=True on a flagged %s key exactly where the DDL numbers it',
      (_name, database, numbered, extra) => {
        const dataTypes = [
          ...DatabaseHintMap[database].map(({ name }) => name),
          ...extra,
        ];

        dataTypes.forEach(dataType => {
          const { state } = createKeyFixture(database, [
            [
              'id',
              dataType,
              ColumnOption.primaryKey |
                ColumnOption.notNull |
                ColumnOption.autoIncrement,
            ],
          ]);

          expect({
            dataType,
            autoIncrement: createCode(state).includes('autoincrement=True'),
          }).toEqual({
            dataType,
            autoIncrement:
              /serial/i.test(dataType) || numbered.test(createSchemaSQL(state)),
          });
        });
      }
    );

    // SQLite numbers a key declared exactly INTEGER, the rowid, and no other:
    // a flagged key create_all wrote as BIGINT, INT8 or UNSIGNED BIG INT would
    // fail every insert without a key (NOT NULL constraint failed).
    it('types a flagged lone SQLite integer key as the INTEGER its DDL writes', () => {
      const flagged =
        ColumnOption.primaryKey |
        ColumnOption.notNull |
        ColumnOption.autoIncrement;
      const dataTypes = [
        'TINYINT',
        'SMALLINT',
        'MEDIUMINT',
        'INT',
        'INTEGER',
        'BIGINT',
        'INT2',
        'INT8',
        'UNSIGNED BIG INT',
        'int(10)',
        'BIGINT(20)',
      ];

      dataTypes.forEach(dataType => {
        const { state, table } = createKeyFixture(Database.SQLite, [
          ['id', dataType, flagged],
        ]);

        expect({
          dataType,
          ddl: /^ {2}id INTEGER NOT NULL,$/m.test(createSchemaSQL(state)),
          lines: render(state, table).slice(-1),
          imports: render(state, table)[0],
        }).toEqual({
          dataType,
          ddl: true,
          lines: [
            '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)',
          ],
          imports: 'from sqlalchemy import Integer',
        });
      });

      const unflagged = createKeyFixture(Database.SQLite, [
        ['id', 'BIGINT', ColumnOption.primaryKey | ColumnOption.notNull],
      ]);
      const composite = createKeyFixture(Database.SQLite, [
        ['a', 'BIGINT', flagged],
        ['b', 'BIGINT', flagged],
      ]);
      const text = createKeyFixture(Database.SQLite, [
        ['id', 'BIGINT UNSIGNED', flagged],
      ]);

      expect(render(unflagged.state, unflagged.table).slice(-1)).toEqual([
        '    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)',
      ]);
      expect(render(composite.state, composite.table).slice(-2)).toEqual([
        '    a: Mapped[int] = mapped_column(BigInteger, primary_key=True)',
        '    b: Mapped[int] = mapped_column(BigInteger, primary_key=True)',
      ]);
      expect(render(text.state, text.table).slice(-1)).toEqual([
        '    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)',
      ]);
    });

    it('marks one flagged key of a composite key, the first its database numbers', () => {
      const flagged =
        ColumnOption.primaryKey |
        ColumnOption.notNull |
        ColumnOption.autoIncrement;
      const both = createKeyFixture(Database.PostgreSQL, [
        ['a', 'int', flagged],
        ['b', 'int', flagged],
      ]);
      const text = createKeyFixture(Database.PostgreSQL, [
        ['a', 'varchar(10)', flagged],
        ['b', 'bigint', flagged],
      ]);
      const sqlite = createKeyFixture(Database.SQLite, [
        ['a', 'INTEGER', flagged],
        ['b', 'INTEGER', flagged],
      ]);

      expect(render(both.state, both.table).slice(-2)).toEqual([
        '    a: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)',
        '    b: Mapped[int] = mapped_column(Integer, primary_key=True)',
      ]);
      expect(render(text.state, text.table).slice(-2)).toEqual([
        '    a: Mapped[str] = mapped_column(String(10), primary_key=True)',
        '    b: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)',
      ]);
      expect(render(sqlite.state, sqlite.table).slice(-2)).toEqual([
        '    a: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    b: Mapped[int] = mapped_column(Integer, primary_key=True)',
      ]);
    });

    // The editor's DDL writes no DEFAULT on a flagged column, numbered or not.
    it('keeps the default off a flagged column the database does not number', () => {
      const table = createTable({
        id: 't1',
        name: 'code',
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
            name: 'code',
            dataType: 'varchar(10)',
            default: "'x'",
            options: ColumnOption.notNull | ColumnOption.autoIncrement,
          }),
        ],
        settings: { database: Database.PostgreSQL },
      });

      expect(render(state, table).slice(-1)).toEqual([
        '    code: Mapped[str] = mapped_column(String(10), nullable=False)',
      ]);
    });

    it('leaves a composite key, a key of another type and a serial column alone', () => {
      const composite = createKeyFixture(Database.PostgreSQL, [
        ['a', 'integer', ColumnOption.primaryKey],
        ['b', 'integer', ColumnOption.primaryKey],
        ['c', 'serial', ColumnOption.notNull],
      ]);
      const text = createKeyFixture(Database.PostgreSQL, [
        ['code', 'varchar(10)', ColumnOption.primaryKey],
      ]);
      const year = createKeyFixture(Database.MySQL, [
        ['y', 'YEAR', ColumnOption.primaryKey],
      ]);

      expect(render(composite.state, composite.table).slice(-3)).toEqual([
        '    a: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    b: Mapped[int] = mapped_column(Integer, primary_key=True)',
        '    c: Mapped[int] = mapped_column(Integer, nullable=False)',
      ]);
      expect(render(text.state, text.table).slice(-1)).toEqual([
        '    code: Mapped[str] = mapped_column(String(10), primary_key=True)',
      ]);
      expect(render(year.state, year.table).slice(-1)).toEqual([
        '    y: Mapped[int] = mapped_column(YEAR, primary_key=True)',
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

    // Every from-import the generator can write, in the order isort leaves
    // them: the CONSTANT bucket first, then the rest by name. A name added to
    // the tuples in sqlalchemy.ts has to land here, or the sort is unchecked.
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

    // Each database imports from its own dialect module, so every dialect name
    // has a state that reaches it, and the CONSTANT bucket sorts before Range.
    it('orders every dialect import the way isort does', () => {
      const states = createDialectImportStates();

      expect(fromImportNames(createCode(states.mysql), 'sqlalchemy')).toEqual([
        'BINARY',
        'CHAR',
        'NCHAR',
        'VARBINARY',
        'Enum',
        'SmallInteger',
      ]);
      expect(
        fromImportNames(createCode(states.mysql), 'sqlalchemy.dialects.mysql')
      ).toEqual([
        'BIGINT',
        'BIT',
        'DATETIME',
        'DECIMAL',
        'DOUBLE',
        'FLOAT',
        'INTEGER',
        'LONGBLOB',
        'LONGTEXT',
        'MEDIUMBLOB',
        'MEDIUMINT',
        'MEDIUMTEXT',
        'SET',
        'SMALLINT',
        'TIME',
        'TIMESTAMP',
        'TINYBLOB',
        'TINYINT',
        'TINYTEXT',
        'VARCHAR',
        'YEAR',
      ]);
      expect(fromImportNames(createCode(states.mysql), 'typing')).toEqual([
        'Optional',
        'Set',
      ]);
      expect(
        fromImportNames(createCode(states.mariadb), 'sqlalchemy.dialects.mysql')
      ).toEqual(['INET4', 'INET6']);
      expect(fromImportNames(createCode(states.mariadb), 'sqlalchemy')).toEqual(
        ['UUID']
      );
      expect(
        fromImportNames(createCode(states.postgresql), 'sqlalchemy')
      ).toEqual(['ARRAY', 'REAL', 'Integer', 'Interval']);
      expect(
        fromImportNames(
          createCode(states.postgresql),
          'sqlalchemy.dialects.postgresql'
        )
      ).toEqual([
        'BIT',
        'CIDR',
        'DATEMULTIRANGE',
        'DATERANGE',
        'INET',
        'INT4MULTIRANGE',
        'INT4RANGE',
        'INT8MULTIRANGE',
        'INT8RANGE',
        'INTERVAL',
        'JSONPATH',
        'MACADDR',
        'MACADDR8',
        'MONEY',
        'NUMMULTIRANGE',
        'NUMRANGE',
        'OID',
        'REGCLASS',
        'REGCONFIG',
        'TIME',
        'TIMESTAMP',
        'TSMULTIRANGE',
        'TSQUERY',
        'TSRANGE',
        'TSTZMULTIRANGE',
        'TSTZRANGE',
        'TSVECTOR',
        'Range',
      ]);
      expect(
        fromImportNames(createCode(states.postgresql), 'datetime')
      ).toEqual(['date', 'datetime', 'time', 'timedelta']);
      expect(
        fromImportNames(createCode(states.mssql), 'sqlalchemy.dialects.mssql')
      ).toEqual(['MONEY', 'NTEXT', 'SMALLMONEY']);
      expect(fromImportNames(createCode(states.mssql), 'sqlalchemy')).toEqual([
        'NVARCHAR',
      ]);
      expect(
        fromImportNames(createCode(states.oracle), 'sqlalchemy.dialects.oracle')
      ).toEqual(['DATE', 'NCLOB', 'NVARCHAR2', 'RAW', 'TIMESTAMP']);
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
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
      ]);
    });

    // Each string is a Python literal in the quote black keeps: double quotes
    // unless the value holds more of them than single ones.
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
        `    __tablename__ = 'we"ird'`,
        `    __table_args__ = {"comment": 'line one\\nline "two"'}`,
        '',
        '    pa_th: Mapped[str] = mapped_column(',
        `        'pa"th',`,
        '        String(10),',
        '        nullable=False,',
        `        server_default=text('a"b\\\\c'),`,
        '        comment="a\\\\b",',
        '    )',
      ]);
    });

    // Each escape is global: a raw backslash makes the module a SyntaxError and
    // a newline left in place ends the string early. A string keeps each break
    // as its escape, the comment the database holds; the docstring flattens one.
    it('escapes every backslash and every newline, and flattens a CRLF once', () => {
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
        '    __table_args__ = {"comment": "one\\r\\ntwo"}',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
        '    path: Mapped[str] = mapped_column(',
        '        String(10),',
        '        nullable=False,',
        '        server_default=text("\'x\\ny\\nz\'"),',
        '        comment="a\\\\b\\\\c",',
        '    )',
      ]);
    });

    // Python's tokenizer reads a lone CR in source as a newline, so one left in
    // the literal ends the string early and the module dies at import. Written
    // as an escape it stays in the value; the docstring flattens it.
    it('escapes a lone carriage return in a comment and a default', () => {
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
        '    __table_args__ = {"comment": "one\\rtwo"}',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
        '    note: Mapped[str] = mapped_column(',
        '        String(10),',
        '        nullable=False,',
        '        server_default=text("\'a\\rb\'"),',
        '        comment="left\\rright",',
        '    )',
      ]);
    });

    // A comment of nothing but spaces is a comment the document does not
    // carry: it reaches neither the docstring nor __table_args__.
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
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
      ]);
    });
  });

  describe('layout', () => {
    // A long default would leave its line past the limit, where black opens
    // the text call; the trailing comma tells black to leave it open.
    it('opens a server default past the line limit inside its text call', () => {
      const value = `'${'y'.repeat(80)}'`;
      const { state, table } = createTypesFixture(Database.MySQL, [
        ['v', 'VARCHAR(100)'],
      ]);
      state.collections.tableColumnEntities['v'].default = value;

      expect(render(state, table).slice(-6)).toEqual([
        '    v: Mapped[Optional[str]] = mapped_column(',
        '        String(100),',
        '        server_default=text(',
        `            "${value}",`,
        '        ),',
        '    )',
      ]);
    });

    // Black puts the call on a line of its own inside parentheses where the
    // line would open past the limit and the target with = ( fits.
    it('puts a call that would open past the line limit inside parentheses', () => {
      const parent = createTable({
        id: 't_parent',
        name: 'customer_group',
        columnIds: ['p_id'],
      });
      const child = createTable({
        id: 't_child',
        name: 'salesrule_product_attribute',
        columnIds: ['c_id', 'c_fk', 'c_long'],
      });
      const state = createState({
        tables: [parent, child],
        columns: [
          primaryKey('p_id', 't_parent'),
          primaryKey('c_id', 't_child'),
          createColumn({
            id: 'c_fk',
            tableId: 't_child',
            name: 'customer_group_id',
            dataType: 'INT',
            options: ColumnOption.notNull,
          }),
          createColumn({
            id: 'c_long',
            tableId: 't_child',
            name: 'a_rather_long_column_name_for_the_last_date_it_was_seen',
            dataType: 'DATETIME',
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
        settings: { database: Database.MySQL },
      });
      const lines = createCode(state).split('\n');

      expect(lines).toEqual(
        expect.arrayContaining([
          '    salesruleProductAttributeList: Mapped[List["SalesruleProductAttribute"]] = (',
          '        relationship(back_populates="customerGroup")',
          '    )',
          '    aRatherLongColumnNameForTheLastDateItWasSeen: Mapped[Optional[datetime]] = (',
          '        mapped_column(',
          '            "a_rather_long_column_name_for_the_last_date_it_was_seen",',
          '            DateTime,',
          '        )',
          '    )',
        ])
      );
    });

    // Where the target with = ( is past the limit too, black opens the
    // brackets of Mapped instead and the call follows the closing one.
    it('opens the annotation where the target alone passes the line limit', () => {
      const name = 'x'.repeat(60);
      const longer = 'z'.repeat(75);
      const { state, table } = createKeyFixture(Database.MySQL, [
        [name, 'VARCHAR(20)', 0],
        [longer, 'VARCHAR(20)', ColumnOption.notNull],
      ]);
      state.collections.tableColumnEntities[longer].comment = 'c'.repeat(50);

      expect(render(state, table).slice(-10)).toEqual([
        `    ${name}: Mapped[`,
        '        Optional[str]',
        '    ] = mapped_column(String(20))',
        `    ${longer}: Mapped[`,
        '        str',
        '    ] = mapped_column(',
        '        String(20),',
        '        nullable=False,',
        `        comment="${'c'.repeat(50)}",`,
        '    )',
      ]);
    });

    // Black measures a line in columns, two for a Hangul syllable or a CJK
    // ideograph, so a comment in them reaches the limit at half the length.
    it('counts an East Asian wide character as two columns', () => {
      const { state, table } = createTypesFixture(Database.MySQL, [
        ['a', 'VARCHAR(20)'],
      ]);
      const columns = state.collections.tableColumnEntities;
      columns['a'].comment = '한글'.repeat(10);

      expect(render(state, table).slice(-4)).toEqual([
        '    a: Mapped[Optional[str]] = mapped_column(',
        '        String(20),',
        `        comment="${'한글'.repeat(10)}",`,
        '    )',
      ]);

      columns['a'].comment = 'é'.repeat(20);

      expect(render(state, table).at(-1)).toBe(
        `    a: Mapped[Optional[str]] = mapped_column(String(20), comment="${'é'.repeat(20)}")`
      );
    });

    // Black strips a one-line docstring and writes one of nothing as a space.
    it('strips the docstring as black does', () => {
      const { state, table } = createTypesFixture(Database.MySQL, [
        ['a', 'INT'],
      ]);
      const tables = state.collections.tableEntities;

      const docstring = () =>
        render(state, table).find(line => line.startsWith('    """'));

      tables['t1'].comment = '  padded\u3000 ';
      expect(docstring()).toBe('    """padded"""');

      tables['t1'].comment = '\u0085';
      expect(docstring()).toBe('    """ """');
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

    // The constructor DeclarativeBase writes takes self first, so an attribute
    // named self cannot be passed to it by keyword.
    it('renames a self column and keeps its name', () => {
      const { state } = createTypesFixture(Database.PostgreSQL, [
        ['self', 'int'],
        ['Self', 'int'],
      ]);
      const code = createCode(state);

      expect(code).toContain(
        '    self_: Mapped[Optional[int]] = mapped_column("self", Integer)'
      );
      expect(code).toContain(
        '    Self: Mapped[Optional[int]] = mapped_column(Integer)'
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
        [
          '    registry: Mapped[int] = mapped_column(',
          '        Integer,',
          '        primary_key=True,',
          '        autoincrement=False,',
          '    )',
        ].join('\n')
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

    // Which colliding table keeps the un-suffixed class name follows the order
    // createClassContext pre-resolves them, which matches createCode only
    // because it sorts alike. Drop the sort and a saved class silently renames.
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

    // Without the repair each of these fails differently: __secret reaches the
    // database mangled, __doc__ and __dict__ leave no column at all while
    // createSchemaSQL declares them, and _sa_registry raises at import.
    it('moves a leading-underscore column off the namespace it does not own', () => {
      const { state, table } = createUnderscoreFixture(NameCase.none);

      expect(render(state, table).slice(-11)).toEqual([
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
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
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
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

      expect(render(state, table).slice(-7)).toEqual([
        'class x__thing(Base):',
        '    __tablename__ = "__thing"',
        '    __table_args__ = (Index("IDX___thing", "x__a_b"),)',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
        '    x__a_b: Mapped[Optional[str]] = mapped_column("__a.b", String(5), key="x__a_b")',
        '    x__metadata: Mapped[Optional[str]] = mapped_column("__metadata", String(5))',
      ]);
    });

    it('leaves the table name alone when a name case has already dropped the underscores', () => {
      const { state, table } = createUnderscoreTableFixture(
        NameCase.pascalCase
      );

      expect(render(state, table).slice(-12)).toEqual([
        'class Thing(Base):',
        '    __tablename__ = "__thing"',
        '    __table_args__ = (Index("IDX___thing", "AB"),)',
        '',
        '    Id: Mapped[int] = mapped_column(',
        '        "id",',
        '        Integer,',
        '        primary_key=True,',
        '        autoincrement=False,',
        '    )',
        '    AB: Mapped[Optional[str]] = mapped_column("__a.b", String(5), key="AB")',
        '    Metadata: Mapped[Optional[str]] = mapped_column("__metadata", String(5))',
      ]);
    });

    it('names the moved attribute in back_populates and remote_side', () => {
      const { state, child } = createUnderscoreRelationFixture(NameCase.none);

      expect(render(state, child).slice(-29)).toEqual([
        'class x__child(Base):',
        '    __tablename__ = "__child"',
        '',
        '    x__id: Mapped[int] = mapped_column(',
        '        "__id",',
        '        Integer,',
        '        primary_key=True,',
        '        autoincrement=False,',
        '    )',
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

      expect(render(state, child).slice(-27)).toEqual([
        'class Child(Base):',
        '    __tablename__ = "__child"',
        '',
        '    Id: Mapped[int] = mapped_column(',
        '        "__id",',
        '        Integer,',
        '        primary_key=True,',
        '        autoincrement=False,',
        '    )',
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

      expect(render(state, left).slice(-23)).toEqual([
        'class x__a(Base):',
        '    __tablename__ = "__a"',
        '',
        '    x__id: Mapped[int] = mapped_column(',
        '        "__id",',
        '        Integer,',
        '        primary_key=True,',
        '        autoincrement=False,',
        '    )',
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

    // Three column names normalize to a_b, so uniqueName has to keep counting:
    // stopping after one retry hands two of them the same attribute, and the
    // later class-body assignment wins while the DDL still declares both.
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
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
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
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
        '    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("user.id"), nullable=False)',
        '',
        '    user: Mapped["User"] = relationship(back_populates="postList")',
      ]);
    });

    it('passes the referential actions to a single-column ForeignKey', () => {
      const state = createOneToManyState(RelationshipType.ZeroN);
      const [relationshipId] = state.doc.relationshipIds;
      Object.assign(state.collections.relationshipEntities[relationshipId], {
        onDelete: ReferentialAction.cascade,
        onUpdate: ReferentialAction.restrict,
      });

      expect(
        render(state, state.collections.tableEntities['t_post']).join('\n')
      ).toContain(
        'ForeignKey("user.id", ondelete="CASCADE", onupdate="RESTRICT")'
      );
    });

    it('keeps NO ACTION alone under Snowflake, as its DDL does', () => {
      const state = createOneToManyState(RelationshipType.ZeroN);
      state.settings.database = Database.Snowflake;
      const [relationshipId] = state.doc.relationshipIds;
      Object.assign(state.collections.relationshipEntities[relationshipId], {
        onDelete: ReferentialAction.setNull,
        onUpdate: ReferentialAction.noAction,
      });

      expect(
        render(state, state.collections.tableEntities['t_post']).join('\n')
      ).toContain('ForeignKey("user.id", onupdate="NO ACTION")');
    });

    it('passes the referential actions to a ForeignKeyConstraint', () => {
      const { state } = createCompositeFixture();
      Object.assign(state.collections.relationshipEntities.r1, {
        onDelete: ReferentialAction.setNull,
      });

      expect(createCode(state)).toContain(
        [
          '        ForeignKeyConstraint(',
          '            ["team_id", "team_code"],',
          '            ["team.id", "team.code"],',
          '            ondelete="SET NULL",',
          '        ),',
        ].join('\n')
      );
    });

    // Pins the guarantee formatRelation leans on for its Optional import:
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
          // a stray column, left on user rather than on post
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

    // Asserted whole so the from typing import Optional line is pinned: the
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
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
        '    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("user.id"))',
        '',
        '    user: Mapped[Optional["User"]] = relationship(back_populates="postList")',
      ]);
    });

    // user's one column is its primary key, so the scalar relationship is the
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
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
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
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
        '    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("user.id"), nullable=False)',
      ]);
      expect(
        render(state, state.collections.tableEntities['t_user']).at(-1)
      ).toBe(
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)'
      );
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

    // Every other guard passes here, so only the arity check stands between a
    // two-column parent end and a one-column child end. Without it the pair
    // renders as a single-column foreign key and joins on half the key.
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
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
        '    parent_a: Mapped[int] = mapped_column(Integer, nullable=False)',
      ]);
    });

    // columnIds defaults to [] in the v3 parser, so a relationship naming no
    // column is a document the parser produces. It cannot become a foreign key:
    // an empty constraint leaves configure_mappers() with no join condition.
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
        '    parentId: Mapped[int] = mapped_column(',
        '        "parent_id",',
        '        Integer,',
        '        primary_key=True,',
        '        autoincrement=False,',
        '    )',
        '',
        '',
        'class Parent(Base):',
        '    __tablename__ = "parent"',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
      ]);
    });

    // Each of these is the only guard standing between the relationship and a
    // foreign key: the others let it through. Every one of them would emit a
    // ForeignKey naming a table or column the document cannot resolve.
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
          // start.columnIds catches it
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
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
        '    parentId: Mapped[Optional[int]] = mapped_column("parent_id", Integer)',
        '',
        '',
        'class Parent(Base):',
        '    __tablename__ = "parent"',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
      ]);
    });

    // Two parents can land on one child column and both foreign keys have to
    // reach it, as separate positional arguments to mapped_column. Keeping only
    // the last leaves one parent's collection with nothing to join on.
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
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
        '',
        '    childList: Mapped[List["Child"]] = relationship(back_populates="alpha")',
        '',
        '',
        'class Beta(Base):',
        '    __tablename__ = "beta"',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
        '',
        '    childList: Mapped[List["Child"]] = relationship(back_populates="beta")',
        '',
        '',
        'class Child(Base):',
        '    __tablename__ = "child"',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
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

    // The parent is required only when every column carrying the composite key
    // is. One nullable half means the row can exist with no parent, and a
    // non-optional annotation is a lie the type checker believes.
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
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
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

    // The column names inside a ForeignKeyConstraint are Python string literals
    // like every other name the generator writes, so a quote in one takes the
    // other quote there too or the module never parses.
    it('quotes a column name holding a quote inside a ForeignKeyConstraint', () => {
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
        `        ForeignKeyConstraint(['a"b', "code"], ['parent.a"b', "parent.code"]),`,
        '    )',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
        `    a_b: Mapped[int] = mapped_column('a"b', Integer, nullable=False)`,
        '    code: Mapped[int] = mapped_column(Integer, nullable=False)',
        '',
        '    parent: Mapped["Parent"] = relationship(back_populates="childList")',
        '',
        '',
        'class Parent(Base):',
        '    __tablename__ = "parent"',
        '',
        `    a_b: Mapped[int] = mapped_column('a"b', Integer, primary_key=True)`,
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

    // An index column whose column is gone drops out rather than reaching
    // columnKey as undefined, and a whitespace-only index name is no name --
    // both are shapes the v3 parser produces without cross-checking.
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
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
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
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
        '    email: Mapped[Optional[str]] = mapped_column(String(50))',
      ]);
    });

    // An index column can name a column of another table and the index still
    // belongs to this one, keeping the raw name createSchemaSQL also writes:
    // both generators describe the document and let the target reject it.
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
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
        '    nickname: Mapped[Optional[str]] = mapped_column(String(50))',
        '',
        '',
        'class Users(Base):',
        '    __tablename__ = "users"',
        '    __table_args__ = (Index("idx_cross", "nickname"),)',
        '',
        '    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)',
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
            dataType: 'TEXT',
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
        // A long name pushes the call past the line limit, where formatCall
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
        ...Object.values(createDialectImportStates()).flatMap(state =>
          importedNames(createCode(state))
        ),
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
      expect(code).toContain(
        '    __table_args__ = (Index("idx_body", "body"),)'
      );
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

    // The carrier's repaired names have to reach the duplicate: every string
    // naming a column resolves against Table.c, and the duplicate declared none
    // of its own, so without the copy the index names a key no column holds.
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

      expect(code).toContain('    __table_args__ = (Index("IDX_1", "a_b"),)');
      expect(code).toContain(
        '    a_b: Mapped[Optional[int]] = mapped_column("a.b", Integer, key="a_b")'
      );
      expect(code).not.toContain('"a.b"),');
    });

    // The other half of the same copy: foreign_keys names the Python attribute,
    // so a duplicate keeping its raw underscore name would name one the class
    // never grew and configure_mappers() would not find it.
    it('gives a duplicate the repaired attribute of the column that carries it', () => {
      const { state, left } = createDuplicateAmbiguousFixture();

      expect(render(state, left).slice(-20)).toEqual([
        '    x__id: Mapped[int] = mapped_column(',
        '        "__id",',
        '        Integer,',
        '        primary_key=True,',
        '        autoincrement=False,',
        '    )',
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
    // Two tables can carry one name and createSchemaSQL emits both, so this
    // generator does too rather than invent a name the DDL would not share. The
    // class names still separate, or the second statement replaces the first.
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
    // A column can exist with no name, and createSchemaSQL renders it as a
    // nameless slot the database rejects. Rendering it here keeps the two
    // generators saying the same thing rather than quietly dropping a column.
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
      expect(code).toContain(
        '    __table_args__ = (Index("idx_parent", "parent_id"),)'
      );
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
        '    __table_args__ = (ForeignKeyConstraint(["a_1", "b"], ["pair.a_1", "pair.b"]),)'
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

    // assignColumnKeys runs two passes and the order is the point: every
    // dot-free column claims its own name first, so a dotted column repairing
    // itself yields. The other way round, the plain column has nothing left.
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
      // repaired a_b_2 -- not the a_b the plain column owns
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
 * An adjacency list: employee.manager_id points back at employee.id, so
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
 * Two tables holding a foreign key to each other, the way data/test.json
 * pairs article with content.
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
 * Every identifier sqlalchemy.ts can put at module scope: Base, the names
 * it can import, and the builtins its annotations name. A class or a column
 * attribute taking any of these shadows it for the statements that follow.
 */
const MODULE_SCOPE_IDENTIFIERS = [
  'ARRAY',
  'Any',
  'BIGINT',
  'BINARY',
  'BIT',
  'Base',
  'BigInteger',
  'Boolean',
  'CHAR',
  'CIDR',
  'DATE',
  'DATEMULTIRANGE',
  'DATERANGE',
  'DATETIME',
  'DECIMAL',
  'DOUBLE',
  'Date',
  'DateTime',
  'Decimal',
  'DeclarativeBase',
  'Double',
  'Enum',
  'FLOAT',
  'Float',
  'ForeignKey',
  'ForeignKeyConstraint',
  'INET',
  'INET4',
  'INET6',
  'INT4MULTIRANGE',
  'INT4RANGE',
  'INT8MULTIRANGE',
  'INT8RANGE',
  'INTEGER',
  'INTERVAL',
  'Index',
  'Integer',
  'Interval',
  'JSON',
  'JSONB',
  'JSONPATH',
  'LONGBLOB',
  'LONGTEXT',
  'LargeBinary',
  'List',
  'MACADDR',
  'MACADDR8',
  'MEDIUMBLOB',
  'MEDIUMINT',
  'MEDIUMTEXT',
  'MONEY',
  'Mapped',
  'NCHAR',
  'NCLOB',
  'NTEXT',
  'NUMMULTIRANGE',
  'NUMRANGE',
  'NVARCHAR',
  'NVARCHAR2',
  'Numeric',
  'OID',
  'Optional',
  'RAW',
  'REAL',
  'REGCLASS',
  'REGCONFIG',
  'Range',
  'SET',
  'SMALLINT',
  'SMALLMONEY',
  'Set',
  'SmallInteger',
  'String',
  'TIME',
  'TIMESTAMP',
  'TINYBLOB',
  'TINYINT',
  'TINYTEXT',
  'TSMULTIRANGE',
  'TSQUERY',
  'TSRANGE',
  'TSTZMULTIRANGE',
  'TSTZRANGE',
  'TSVECTOR',
  'Text',
  'Time',
  'UUID',
  'Uuid',
  'VARBINARY',
  'VARCHAR',
  'YEAR',
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
  'timedelta',
  'uuid',
];

/** Base is declared, not imported; the rest are builtins. */
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

/** The names of one from <module> import ..., in the order they are written. */
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

/** One table of nullable columns named after their keys, under a database. */
function createTypesFixture(
  database: number,
  dataTypes: Array<[string, string]>
) {
  return createKeyFixture(
    database,
    dataTypes.map(([name, dataType]) => [name, dataType, 0])
  );
}

/** One table of the given columns and options, under a database. */
function createKeyFixture(
  database: number,
  columns: Array<[string, string, number]>
) {
  const table = createTable({
    id: 't1',
    name: 'types',
    columnIds: columns.map(([name]) => name),
  });
  const state = createState({
    tables: [table],
    columns: columns.map(([name, dataType, options]) =>
      createColumn({ id: name, tableId: 't1', name, dataType, options })
    ),
    settings: { database, columnNameCase: NameCase.none },
  });

  return { state, table };
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
 * two PostgreSQL dialect types, from the primitive and raw types through
 * indexes, server defaults, both foreign key shapes and a one-to-many.
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
    ['TEXT', 'c_text'],
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

/**
 * One document per database that imports every name of its dialect module,
 * with the core names only that database reaches.
 */
function createDialectImportStates() {
  return {
    mysql: createTypesFixture(Database.MySQL, [
      ['a', 'BIGINT UNSIGNED'],
      ['b', 'BIT(8)'],
      ['c', 'DATETIME(6)'],
      ['d', 'DECIMAL(10,2) UNSIGNED'],
      ['e', 'DOUBLE UNSIGNED'],
      ['f', 'FLOAT UNSIGNED'],
      ['g', 'INT UNSIGNED'],
      ['h', 'LONGBLOB'],
      ['i', 'LONGTEXT'],
      ['j', 'MEDIUMBLOB'],
      ['k', 'MEDIUMINT'],
      ['l', 'MEDIUMTEXT'],
      ['m', "SET('a')"],
      ['n', 'SMALLINT UNSIGNED'],
      ['o', 'TIME(3)'],
      ['p', 'TIMESTAMP'],
      ['q', 'TINYBLOB'],
      ['r', 'TINYINT'],
      ['s', 'TINYTEXT'],
      ['t', 'YEAR'],
      ['u', 'BINARY(16)'],
      ['v', 'CHAR(36)'],
      ['w', 'NCHAR(10)'],
      ['x', 'VARBINARY(16)'],
      ['y', "ENUM('a')"],
      ['z', 'SMALLINT'],
      ['aa', 'NVARCHAR(20)'],
    ]).state,
    mariadb: createTypesFixture(Database.MariaDB, [
      ['a', 'INET4'],
      ['b', 'INET6'],
      ['c', 'UUID'],
    ]).state,
    postgresql: createTypesFixture(Database.PostgreSQL, [
      ['a', 'bit(8)'],
      ['b', 'cidr'],
      ['c', 'daterange'],
      ['d', 'inet'],
      ['e', 'int4range'],
      ['f', 'int8range'],
      ['g', 'interval day to second'],
      ['h', 'jsonpath'],
      ['i', 'macaddr'],
      ['j', 'macaddr8'],
      ['k', 'money'],
      ['l', 'numrange'],
      ['m', 'oid'],
      ['n', 'regclass'],
      ['o', 'regconfig'],
      ['p', 'time(3)'],
      ['q', 'timestamp(3)'],
      ['r', 'tsquery'],
      ['s', 'tsrange'],
      ['t', 'tstzrange'],
      ['u', 'tsvector'],
      ['v', 'int[]'],
      ['w', 'real'],
      ['x', 'interval'],
      ['y', 'datemultirange'],
      ['z', 'int4multirange'],
      ['aa', 'int8multirange'],
      ['ab', 'nummultirange'],
      ['ac', 'tsmultirange'],
      ['ad', 'tstzmultirange'],
    ]).state,
    mssql: createTypesFixture(Database.MSSQL, [
      ['a', 'money'],
      ['b', 'ntext'],
      ['c', 'smallmoney'],
      ['d', 'nvarchar(10)'],
    ]).state,
    oracle: createTypesFixture(Database.Oracle, [
      ['a', 'DATE'],
      ['b', 'NCLOB'],
      ['c', 'NVARCHAR2(10)'],
      ['d', 'RAW(16)'],
      ['e', 'TIMESTAMP'],
    ]).state,
  };
}

/** The two sqlalchemy.dialects.postgresql names. */
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
 * One table carrying every column name the leading-underscore rule has to move:
 * private name mangling, the dunders the class machinery owns, SQLAlchemy's
 * instrumentation names and a plain single underscore.
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

/** A leading-underscore table name, with the dotted key= path under it. */
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
 * class carries back_populates on both sides and remote_side.
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

/**
 * createUnderscoreAmbiguousFixture with one column duplicated: __a holds __b_id
 * twice, and the relationship making the pair ambiguous ends on the second --
 * the one that never declares a column of its own.
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
