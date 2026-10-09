import { ERDEditorSchemaV3, schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  BracketType,
  ColumnOption,
  ColumnUIKey,
  Database,
  OrderType,
  ReferentialAction,
  RelationshipType,
  StartRelationshipType,
} from '@/constants/schema';
import { createEngineContext } from '@/engine/context';
import { RootState } from '@/engine/state';
import { Column, Index, Relationship, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { createIndex } from '@/utils/collection/index.entity';
import { createIndexColumn } from '@/utils/collection/indexColumn.entity';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createSchemaSQL } from '@/utils/schema-sql';
import { schemaSQLParserToSchemaJson } from '@/utils/schema-sql-parser';

type Schema = Pick<
  ERDEditorSchemaV3,
  '$schema' | 'version' | 'settings' | 'doc' | 'collections'
>;

const ctx = createEngineContext({ toWidth: text => text.length * 10 });

function parse(
  sql: string,
  prepare?: (schema: ERDEditorSchemaV3) => ERDEditorSchemaV3,
  database?: number
): Schema {
  return JSON.parse(schemaSQLParserToSchemaJson(sql, ctx, prepare, database));
}

const tablesOf = (schema: Schema): Table[] =>
  schema.doc.tableIds.map(id => schema.collections.tableEntities[id]);

const tableByName = (schema: Schema, name: string): Table => {
  const table = tablesOf(schema).find(table => table.name === name);
  if (!table) throw new Error(`table not found: ${name}`);
  return table;
};

const columnsOf = (schema: Schema, table: Table): Column[] =>
  table.columnIds.map(id => schema.collections.tableColumnEntities[id]);

const columnByName = (schema: Schema, table: Table, name: string): Column => {
  const column = columnsOf(schema, table).find(column => column.name === name);
  if (!column) throw new Error(`column not found: ${name}`);
  return column;
};

const relationshipsOf = (schema: Schema): Relationship[] =>
  schema.doc.relationshipIds.map(
    id => schema.collections.relationshipEntities[id]
  );

const indexesOf = (schema: Schema): Index[] =>
  schema.doc.indexIds.map(id => schema.collections.indexEntities[id]);

const uniqueColumnNamesOf = (schema: Schema, table: Table): string[] =>
  columnsOf(schema, table)
    .filter(column => bHas(column.options, ColumnOption.unique))
    .map(column => column.name);

/** Each index as its name, its unique flag and its columns with their sort. */
const indexShapesOf = (schema: Schema) =>
  indexesOf(schema).map(index => ({
    name: index.name,
    unique: index.unique,
    columns: index.indexColumnIds.map(id => {
      const { columnId, orderType } =
        schema.collections.indexColumnEntities[id];
      const { name } = schema.collections.tableColumnEntities[columnId];
      return `${name} ${orderType === OrderType.DESC ? 'DESC' : 'ASC'}`;
    }),
  }));

const commentsOf = (schema: Schema) =>
  tablesOf(schema).flatMap(table => [
    table.comment,
    ...columnsOf(schema, table).map(column => column.comment),
  ]);

const stateOf = (schema: Schema) =>
  ({ ...schema, editor: {}, lww: {} }) as unknown as RootState;

describe('schemaSQLParserToSchemaJson', () => {
  it('produces a v3 schema envelope for an empty source', () => {
    const schema = parse('');

    expect(schema.version).toBe('3.0.0');
    expect(schema.$schema).toBe(
      'https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json'
    );
    expect(schema.doc).toEqual({
      tableIds: [],
      relationshipIds: [],
      indexIds: [],
      memoIds: [],
    });
    expect(schema.collections).not.toHaveProperty('tableGroupEntities');
    expect(schema.collections.tableEntities).toEqual({});
    expect(schema.collections.tableColumnEntities).toEqual({});
  });

  it('returns a formatted JSON string, not an object', () => {
    const json = schemaSQLParserToSchemaJson('CREATE TABLE t (a INT);', ctx);

    expect(typeof json).toBe('string');
    expect(json).toContain('\n  "version": "3.0.0"');
  });

  describe('canvas size', () => {
    const createTables = (count: number) =>
      Array.from(
        { length: count },
        (_, i) => `CREATE TABLE t${i} (a INT);`
      ).join('\n');

    it('clamps small schemas up to the canvas minimum', () => {
      const schema = parse(createTables(2));

      expect(schema.settings.width).toBe(2000);
      expect(schema.settings.height).toBe(2000);
    });

    it('scales with the table count between the bounds', () => {
      const schema = parse(createTables(25));

      expect(schema.doc.tableIds).toHaveLength(25);
      expect(schema.settings.width).toBe(2500);
      expect(schema.settings.height).toBe(2500);
    });

    it('clamps large schemas down to the canvas maximum', () => {
      const schema = parse(createTables(205));

      expect(schema.doc.tableIds).toHaveLength(205);
      expect(schema.settings.width).toBe(20000);
      expect(schema.settings.height).toBe(20000);
    });
  });

  describe('table conversion', () => {
    const SQL = `
      CREATE TABLE users (
        id INT NOT NULL AUTO_INCREMENT COMMENT 'pk column',
        name VARCHAR(50) NOT NULL DEFAULT 'anon',
        email VARCHAR(100) UNIQUE,
        bio TEXT,
        PRIMARY KEY (id)
      ) COMMENT 'the user table';
    `;

    it('creates a table with name, comment and column order', () => {
      const schema = parse(SQL);
      const users = tableByName(schema, 'users');

      expect(schema.doc.tableIds).toEqual([users.id]);
      expect(users.comment).toBe('the user table');
      expect(users.columnIds).toEqual(users.seqColumnIds);
      expect(columnsOf(schema, users).map(column => column.name)).toEqual([
        'id',
        'name',
        'email',
        'bio',
      ]);
    });

    it('maps every column option bit', () => {
      const schema = parse(SQL);
      const users = tableByName(schema, 'users');
      const id = columnByName(schema, users, 'id');
      const name = columnByName(schema, users, 'name');
      const email = columnByName(schema, users, 'email');
      const bio = columnByName(schema, users, 'bio');

      expect(id.options).toBe(
        ColumnOption.autoIncrement |
          ColumnOption.primaryKey |
          ColumnOption.notNull
      );
      expect(name.options).toBe(ColumnOption.notNull);
      expect(email.options).toBe(ColumnOption.unique);
      expect(bio.options).toBe(0);
    });

    it('flags the primary key in ui.keys only for the primary key column', () => {
      const schema = parse(SQL);
      const users = tableByName(schema, 'users');

      expect(columnByName(schema, users, 'id').ui.keys).toBe(
        ColumnUIKey.primaryKey
      );
      expect(columnByName(schema, users, 'name').ui.keys).toBe(0);
    });

    it('carries over the column payload', () => {
      const schema = parse(SQL);
      const users = tableByName(schema, 'users');
      const id = columnByName(schema, users, 'id');
      const name = columnByName(schema, users, 'name');

      expect(id.tableId).toBe(users.id);
      expect(id.dataType).toBe('INT');
      expect(id.comment).toBe('pk column');
      expect(name.dataType).toBe('VARCHAR(50)');
      expect(name.default).toBe("'anon'");
    });

    it('sizes widths with toWidth clamped to the column minimum', () => {
      const schema = parse(SQL);
      const users = tableByName(schema, 'users');
      const name = columnByName(schema, users, 'name');

      // 'users'.length * 10 === 50 -> clamped up to 60
      expect(users.ui.widthName).toBe(60);
      // 'the user table'.length * 10 === 140
      expect(users.ui.widthComment).toBe(140);
      // 'VARCHAR(50)'.length * 10 === 110
      expect(name.ui.widthDataType).toBe(110);
      // "'anon'".length * 10 === 60
      expect(name.ui.widthDefault).toBe(60);
      // empty comment -> clamped up to 60
      expect(name.ui.widthComment).toBe(60);
    });

    it('skips CREATE TABLE statements without a name', () => {
      const schema = parse('CREATE TABLE ( id INT );');

      expect(schema.doc.tableIds).toHaveLength(0);
      expect(schema.collections.tableColumnEntities).toEqual({});
    });
  });

  describe('COMMENT ON merging', () => {
    const SQL = `
      CREATE TABLE users
      (
        id    INT          NOT NULL,
        email VARCHAR(255) NOT NULL
      );

      COMMENT ON TABLE users IS 'user table';

      COMMENT ON COLUMN users.id IS 'user id';

      COMMENT ON COLUMN public.users.email IS 'email address';
    `;

    it('applies the PostgreSQL table and column comments', () => {
      const schema = parse(SQL);
      const users = tableByName(schema, 'users');

      expect(users.comment).toBe('user table');
      expect(columnByName(schema, users, 'id').comment).toBe('user id');
      expect(columnByName(schema, users, 'email').comment).toBe(
        'email address'
      );
    });

    it('sizes the comment columns from the applied comments', () => {
      const schema = parse(SQL);
      const users = tableByName(schema, 'users');

      // 'user table'.length * 10 === 100
      expect(users.ui.widthComment).toBe(100);
      // 'user id'.length * 10 === 70
      expect(columnByName(schema, users, 'id').ui.widthComment).toBe(70);
    });

    it('ignores a COMMENT ON that names a table or column the source never created', () => {
      const schema = parse(`
        CREATE TABLE users (id INT);

        COMMENT ON TABLE missing IS 'nope';
        COMMENT ON COLUMN users.missing IS 'nope';
        COMMENT ON COLUMN missing.id IS 'nope';
      `);
      const users = tableByName(schema, 'users');

      expect(users.comment).toBe('');
      expect(columnByName(schema, users, 'id').comment).toBe('');
    });

    it('reads a MySQL table option comment through the equal sign', () => {
      const schema = parse(
        "CREATE TABLE t (id INT) ENGINE=InnoDB COMMENT='(test)bug here!!';"
      );

      expect(tableByName(schema, 't').comment).toBe('(test)bug here!!');
    });
  });

  // SQL Server keeps a comment as the MS_Description extended property, which
  // SSMS scripts after the table and its defaults with named arguments.
  describe('MS_Description merging', () => {
    it('applies the table and column comments an SSMS script adds', () => {
      const schema = parse(
        `
        CREATE TABLE [dbo].[Orders](
          [Id] [int] IDENTITY(1,1) NOT NULL,
          [Qty] [int] NOT NULL
        ) ON [PRIMARY]
        GO
        ALTER TABLE [dbo].[Orders] ADD  DEFAULT ((0)) FOR [Qty]
        GO
        EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'How many' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'Orders', @level2type=N'COLUMN',@level2name=N'Qty'
        GO
        EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Order header' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'Orders'
        GO
      `,
        undefined,
        Database.MSSQL
      );
      const orders = tableByName(schema, 'Orders');
      const qty = columnByName(schema, orders, 'Qty');

      expect(commentsOf(schema)).toEqual(['Order header', '', 'How many']);
      expect(qty.default).toBe('0');
      // 'Order header'.length * 10 === 120, 'How many'.length * 10 === 80
      expect(orders.ui.widthComment).toBe(120);
      expect(qty.ui.widthComment).toBe(80);
    });

    it('ignores another property, level or name the source never created', () => {
      const schema = parse(`
        CREATE TABLE t (id INT)
        GO
        EXEC sys.sp_addextendedproperty @name=N'Caption', @value=N'nope', @level0type=N'SCHEMA', @level0name=N'dbo', @level1type=N'TABLE', @level1name=N't'
        GO
        EXEC sys.sp_addextendedproperty N'MS_Description', N'nope', N'SCHEMA', N'dbo', N'TABLE', N'missing'
        GO
        EXEC sys.sp_addextendedproperty N'MS_Description', N'nope', N'SCHEMA', N'dbo', N'TABLE', N't', N'COLUMN', N'missing'
        GO
        EXEC sys.sp_addextendedproperty N'MS_Description', N'nope', N'SCHEMA', N'dbo', N'TABLE', N't', N'INDEX', N'id'
        GO
      `);

      expect(commentsOf(schema)).toEqual(['', '']);
    });

    it('gives a comment the table its whole name names before the one its last part names', () => {
      const schema = parse(
        `
        CREATE TABLE "dbo.users" (id INT)
        GO
        CREATE TABLE users (id INT)
        GO
        EXEC sys.sp_addextendedproperty N'MS_Description', N'x', N'SCHEMA', N'dbo', N'TABLE', N'dbo.users'
        GO
        EXEC sys.sp_addextendedproperty N'MS_Description', N'y', N'SCHEMA', N'dbo', N'TABLE', N'dbo.users', N'COLUMN', N'id'
        GO
      `,
        undefined,
        Database.MSSQL
      );
      const dotted = tableByName(schema, 'dbo.users');
      const users = tableByName(schema, 'users');

      expect(dotted.comment).toBe('x');
      expect(columnByName(schema, dotted, 'id').comment).toBe('y');
      expect(users.comment).toBe('');
      expect(columnByName(schema, users, 'id').comment).toBe('');
    });
  });

  describe('ALTER TABLE merging', () => {
    it('applies ADD PRIMARY KEY and ADD UNIQUE to existing columns', () => {
      const schema = parse(`
        CREATE TABLE t (a INT, b INT, c INT);
        ALTER TABLE t ADD CONSTRAINT pk_t PRIMARY KEY (a);
        ALTER TABLE t ADD CONSTRAINT uq_t UNIQUE (b);
      `);
      const t = tableByName(schema, 't');

      expect(
        bHas(columnByName(schema, t, 'a').options, ColumnOption.primaryKey)
      ).toBe(true);
      expect(columnByName(schema, t, 'a').ui.keys).toBe(ColumnUIKey.primaryKey);
      expect(
        bHas(columnByName(schema, t, 'b').options, ColumnOption.unique)
      ).toBe(true);
      expect(columnByName(schema, t, 'c').options).toBe(0);
    });

    it('applies the keys SMO scripts as ALTER TABLE after tables scripted without them', () => {
      // SMO's Table.Script with primary keys and indexes off, then Script Key as CREATE per key.
      const schema = parse(`USE [p2r_pk]
GO

/****** Object:  Table [dbo].[Roles]    Script Date: 10/4/2026 12:21:50 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[Roles](
	[Id] [int] NOT NULL,
	[Title] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL
) ON [PRIMARY]
GO

USE [p2r_pk]
GO

/****** Object:  Table [dbo].[UserRoles]    Script Date: 10/4/2026 12:21:50 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[UserRoles](
	[UserId] [int] NOT NULL,
	[RoleId] [int] NOT NULL,
	[Granted] [datetime2](7) NULL
) ON [PRIMARY]
GO

USE [p2r_pk]
GO

/****** Object:  Table [dbo].[Users]    Script Date: 10/4/2026 12:21:50 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[Users](
	[Id] [int] NOT NULL,
	[Name] [nvarchar](50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL
) ON [PRIMARY]
GO

USE [p2r_pk]
GO

/****** Object:  Index [PK_Roles]    Script Date: 10/4/2026 12:21:50 PM ******/
ALTER TABLE [dbo].[Roles] ADD  CONSTRAINT [PK_Roles] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

USE [p2r_pk]
GO

/****** Object:  Index [PK_UserRoles]    Script Date: 10/4/2026 12:21:50 PM ******/
ALTER TABLE [dbo].[UserRoles] ADD  CONSTRAINT [PK_UserRoles] PRIMARY KEY NONCLUSTERED 
(
	[UserId] ASC,
	[RoleId] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

USE [p2r_pk]
GO

/****** Object:  Index [PK_Users]    Script Date: 10/4/2026 12:21:50 PM ******/
ALTER TABLE [dbo].[Users] ADD  CONSTRAINT [PK_Users] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

`);
      const shapes = tablesOf(schema).map(table => [
        table.name,
        columnsOf(schema, table).map(column => [
          column.name,
          column.options,
          column.ui.keys,
        ]),
      ]);
      const primaryKeyOptions = ColumnOption.primaryKey | ColumnOption.notNull;

      expect(shapes).toEqual([
        [
          'Roles',
          [
            ['Id', primaryKeyOptions, ColumnUIKey.primaryKey],
            ['Title', ColumnOption.notNull, 0],
          ],
        ],
        [
          'UserRoles',
          [
            ['UserId', primaryKeyOptions, ColumnUIKey.primaryKey],
            ['RoleId', primaryKeyOptions, ColumnUIKey.primaryKey],
            ['Granted', 0, 0],
          ],
        ],
        [
          'Users',
          [
            ['Id', primaryKeyOptions, ColumnUIKey.primaryKey],
            ['Name', 0, 0],
          ],
        ],
      ]);
      expect(indexesOf(schema)).toEqual([]);
    });

    describe('ADD DEFAULT FOR', () => {
      const defaultsOf = (schema: Schema, table: Table) =>
        Object.fromEntries(
          columnsOf(schema, table).map(column => [column.name, column.default])
        );

      it('applies each DEFAULT an SSMS script adds after its table to the column', () => {
        const schema = parse(
          `
          CREATE TABLE [dbo].[Orders](
            [Id] [int] IDENTITY(1,1) NOT NULL,
            [Status] [nvarchar](20) NOT NULL,
            [Qty] [int] NOT NULL,
            [Created] [datetime2](7) NOT NULL,
            [Note] [nvarchar](50) NULL DEFAULT (N'x')
          ) ON [PRIMARY]
          GO
          ALTER TABLE [dbo].[Orders] ADD  CONSTRAINT [DF_Orders_Status]  DEFAULT ('draft') FOR [Status]
          GO
          ALTER TABLE [dbo].[Orders] ADD  DEFAULT ((0)) FOR [qty]
          GO
          ALTER TABLE [dbo].[Orders] ADD  CONSTRAINT [DF_Orders_Created]  DEFAULT (getdate()) FOR [Created]
          GO
        `,
          undefined,
          Database.MSSQL
        );
        const orders = tableByName(schema, 'Orders');

        expect(defaultsOf(schema, orders)).toEqual({
          Id: '',
          Status: "'draft'",
          Qty: '0',
          Created: 'getdate()',
          Note: "N'x'",
        });
        expect(columnByName(schema, orders, 'Created').ui.widthDefault).toBe(
          90
        );
        expect(indexesOf(schema)).toEqual([]);
        expect(JSON.stringify(schema)).not.toContain('DF_Orders');
      });

      it('writes the defaults it applied into an SQL Server export', () => {
        const schema = parse(`
          CREATE TABLE [dbo].[t]([a] [int] NOT NULL, [b] [datetime] NULL)
          GO
          ALTER TABLE [dbo].[t] ADD  DEFAULT ((0)) FOR [a]
          GO
          ALTER TABLE [dbo].[t] ADD  CONSTRAINT [DF_t_b]  DEFAULT (getdate()) FOR [b]
          GO
        `);
        const exported = createSchemaSQL(stateOf(schema), Database.MSSQL);
        const again = parse(exported, undefined, Database.MSSQL);

        expect(exported).toContain('DEFAULT 0');
        expect(exported).toContain('DEFAULT getdate()');
        expect(defaultsOf(again, tableByName(again, 't'))).toEqual({
          a: '0',
          b: 'getdate()',
        });
      });

      it('applies the whole of a DEFAULT written without its parentheses, column keywords and all', () => {
        const schema = parse(
          `
          CREATE TABLE t (a VARCHAR(10), b INT)
          GO
          ALTER TABLE t ADD DEFAULT 'x' COLLATE Latin1_General_CI_AS FOR a
          GO
          ALTER TABLE t ADD CONSTRAINT df_b DEFAULT CASE WHEN 1 = 1 THEN NULL ELSE 0 END FOR b
          GO
        `,
          undefined,
          Database.MSSQL
        );

        expect(defaultsOf(schema, tableByName(schema, 't'))).toEqual({
          a: "'x' COLLATE Latin1_General_CI_AS",
          b: 'CASE WHEN 1 = 1 THEN NULL ELSE 0 END',
        });
      });

      it('drops a DEFAULT with no column or expression, or for a table or column not created', () => {
        const schema = parse(`
          CREATE TABLE t (a INT, b INT DEFAULT 1);
          ALTER TABLE t ADD DEFAULT 0 FOR missing;
          ALTER TABLE other ADD DEFAULT 0 FOR a;
          ALTER TABLE t ADD DEFAULT 2;
          ALTER TABLE t ADD DEFAULT () FOR b;
        `);

        expect(defaultsOf(schema, tableByName(schema, 't'))).toEqual({
          a: '',
          b: '1',
        });
        expect(tablesOf(schema).map(table => table.name)).toEqual(['t']);
      });
    });

    describe('pg_dump serial and identity columns', () => {
      /** The pg_dump 17.11 --schema-only output schema-sql-parser's fixture holds, byte for byte. */
      const PG_DUMP = String.raw`--
-- PostgreSQL database dump
--

\restrict qil86iAetUiPOk6kuZddEJBORdtdPOhJRWHEqkn1D3eeOqnOd0XxId9hxWldvUE

-- Dumped from database version 17.11 (Debian 17.11-1.pgdg13+2)
-- Dumped by pg_dump version 17.11 (Debian 17.11-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: app; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA app;


ALTER SCHEMA app OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.audit (
    id bigint NOT NULL,
    event_id integer,
    at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.audit OWNER TO postgres;

--
-- Name: COLUMN audit.id; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.audit.id IS 'identity by default from 100';


--
-- Name: audit_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

ALTER TABLE app.audit ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME app.audit_id_seq
    START WITH 100
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: events; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.events (
    id integer NOT NULL,
    order_id bigint,
    kind text NOT NULL
);


ALTER TABLE app.events OWNER TO postgres;

--
-- Name: events_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

ALTER TABLE app.events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME app.events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: some_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.some_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.some_seq OWNER TO postgres;

--
-- Name: orders; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.orders (
    id bigint NOT NULL,
    user_id integer NOT NULL,
    line smallint NOT NULL,
    ticket integer DEFAULT nextval('app.some_seq'::regclass),
    note character varying(50) DEFAULT 'none'::character varying
);


ALTER TABLE app.orders OWNER TO postgres;

--
-- Name: COLUMN orders.ticket; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.orders.ticket IS 'from a shared sequence';


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.orders_id_seq OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.orders_id_seq OWNED BY app.orders.id;


--
-- Name: orders_line_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.orders_line_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.orders_line_seq OWNER TO postgres;

--
-- Name: orders_line_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.orders_line_seq OWNED BY app.orders.line;


--
-- Name: users; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    name text
);


ALTER TABLE app.users OWNER TO postgres;

--
-- Name: TABLE users; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.users IS 'app users';


--
-- Name: COLUMN users.id; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.users.id IS 'user id';


--
-- Name: COLUMN users.email; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.users.email IS 'login email';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.users_id_seq OWNED BY app.users.id;


--
-- Name: items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.items (
    id integer NOT NULL,
    order_id bigint,
    label text DEFAULT 'x'::text
);


ALTER TABLE public.items OWNER TO postgres;

--
-- Name: items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.items_id_seq OWNER TO postgres;

--
-- Name: items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.items_id_seq OWNED BY public.items.id;


--
-- Name: orders id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.orders ALTER COLUMN id SET DEFAULT nextval('app.orders_id_seq'::regclass);


--
-- Name: orders line; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.orders ALTER COLUMN line SET DEFAULT nextval('app.orders_line_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.users ALTER COLUMN id SET DEFAULT nextval('app.users_id_seq'::regclass);


--
-- Name: items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items ALTER COLUMN id SET DEFAULT nextval('public.items_id_seq'::regclass);


--
-- Name: audit audit_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.audit
    ADD CONSTRAINT audit_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: orders_user_idx; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX orders_user_idx ON app.orders USING btree (user_id);


--
-- Name: audit audit_event_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.audit
    ADD CONSTRAINT audit_event_id_fkey FOREIGN KEY (event_id) REFERENCES app.events(id);


--
-- Name: events events_order_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.events
    ADD CONSTRAINT events_order_id_fkey FOREIGN KEY (order_id) REFERENCES app.orders(id);


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id);


--
-- Name: items items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_order_id_fkey FOREIGN KEY (order_id) REFERENCES app.orders(id);


--
-- PostgreSQL database dump complete
--

\unrestrict qil86iAetUiPOk6kuZddEJBORdtdPOhJRWHEqkn1D3eeOqnOd0XxId9hxWldvUE

`;

      /** The mariadb-dump --no-data output of MariaDB 11.8.9 that fixture holds too, byte for byte. */
      const MARIADB_DUMP = `/*M!999999\\- enable the sandbox mode */ 
-- MariaDB dump 10.20-11.8.9-MariaDB, for debian-linux-gnu (aarch64)
--
-- Host: localhost    Database: shop
-- ------------------------------------------------------
-- Server version	11.8.9-MariaDB-ubu2404

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Sequence structure for \`order_seq\`
--

DROP SEQUENCE IF EXISTS \`order_seq\`;
CREATE SEQUENCE \`order_seq\` start with 1 minvalue 1 maxvalue 9223372036854775806 increment by 1 cache 1000 nocycle ENGINE=InnoDB;
DO SETVAL(\`order_seq\`, 1, 0);

--
-- Table structure for table \`invoices\`
--

DROP TABLE IF EXISTS \`invoices\`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE \`invoices\` (
  \`id\` bigint(20) DEFAULT nextval(\`shop\`.\`order_seq\`),
  \`total\` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table \`orders\`
--

DROP TABLE IF EXISTS \`orders\`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE \`orders\` (
  \`id\` bigint(20) NOT NULL DEFAULT nextval(\`shop\`.\`order_seq\`),
  \`note\` varchar(20) DEFAULT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table \`refs\`
--

DROP TABLE IF EXISTS \`refs\`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE \`refs\` (
  \`ref\` bigint(20) DEFAULT nextval(\`shop\`.\`order_seq\`),
  \`code\` int(11) DEFAULT nextval(\`shop\`.\`order_seq\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed on 2026-10-04 11:56:38
`;

      const shapesOf = (schema: Schema, table: Table) =>
        columnsOf(schema, table).map(column => [
          column.name,
          column.default,
          bHas(column.options, ColumnOption.autoIncrement),
        ]);

      const tableShapesOf = (schema: Schema) =>
        tablesOf(schema).map(table => [table.name, shapesOf(schema, table)]);

      it('reads each, and a nextval default on a sequence no column owns, as an auto increment column with no default', () => {
        const schema = parse(PG_DUMP, undefined, Database.PostgreSQL);

        expect(tableShapesOf(schema)).toEqual([
          [
            'audit',
            [
              ['id', '', true],
              ['event_id', '', false],
              ['at', 'now()', false],
            ],
          ],
          [
            'events',
            [
              ['id', '', true],
              ['order_id', '', false],
              ['kind', '', false],
            ],
          ],
          [
            'orders',
            [
              ['id', '', true],
              ['user_id', '', false],
              ['line', '', true],
              ['ticket', '', true],
              ['note', "'none'", false],
            ],
          ],
          [
            'users',
            [
              ['id', '', true],
              ['email', '', false],
              ['name', '', false],
            ],
          ],
          [
            'items',
            [
              ['id', '', true],
              ['order_id', '', false],
              ['label', "'x'", false],
            ],
          ],
        ]);
        expect(
          columnByName(schema, tableByName(schema, 'users'), 'id').options
        ).toBe(
          ColumnOption.autoIncrement |
            ColumnOption.primaryKey |
            ColumnOption.notNull
        );
      });

      it('writes them as identity columns into a PostgreSQL export, which imports the same', () => {
        const schema = parse(PG_DUMP, undefined, Database.PostgreSQL);
        const exported = createSchemaSQL(stateOf(schema), Database.PostgreSQL);
        const again = parse(exported, undefined, Database.PostgreSQL);

        expect(exported.split('GENERATED ALWAYS AS IDENTITY')).toHaveLength(8);
        expect(exported).toContain(
          'line    smallint              NOT NULL GENERATED ALWAYS AS IDENTITY,'
        );
        expect(exported).toContain(
          'ticket  integer               GENERATED ALWAYS AS IDENTITY,'
        );
        expect(exported).not.toContain('nextval');
        expect(Object.fromEntries(tableShapesOf(again))).toEqual(
          Object.fromEntries(tableShapesOf(schema))
        );
        // The export writes its tables by name but its foreign keys in document
        // order, which the import builds table by table, so a second export
        // swaps the foreign keys of orders and items, and a third changes nothing.
        const second = createSchemaSQL(stateOf(again), Database.PostgreSQL);
        const third = createSchemaSQL(
          stateOf(parse(second, undefined, Database.PostgreSQL)),
          Database.PostgreSQL
        );

        expect(second.split('\n\n').sort()).toEqual(
          exported.split('\n\n').sort()
        );
        expect(third).toBe(second);
      });

      it('replaces the default of a column a nextval default is set on, and reads no other SET DEFAULT', () => {
        const schema = parse(`
          CREATE TABLE t (a integer DEFAULT 0, b integer DEFAULT 1);
          ALTER TABLE t ALTER COLUMN a SET DEFAULT nextval('t_a_seq'::regclass);
          ALTER TABLE t ALTER COLUMN b SET DEFAULT 2;
        `);

        expect(shapesOf(schema, tableByName(schema, 't'))).toEqual([
          ['a', '', true],
          ['b', '1', false],
        ]);
      });

      it('drops one with no column, or for a table or column not created', () => {
        const schema = parse(`
          CREATE TABLE t (a integer, b integer DEFAULT 1);
          ALTER TABLE t ALTER COLUMN missing ADD GENERATED ALWAYS AS IDENTITY;
          ALTER TABLE other ALTER COLUMN a ADD GENERATED ALWAYS AS IDENTITY;
          ALTER TABLE t ALTER COLUMN "" ADD GENERATED ALWAYS AS IDENTITY;
          ALTER TABLE "" ALTER COLUMN a ADD GENERATED ALWAYS AS IDENTITY;
        `);

        expect(shapesOf(schema, tableByName(schema, 't'))).toEqual([
          ['a', '', false],
          ['b', '1', false],
        ]);
        expect(tablesOf(schema).map(table => table.name)).toEqual(['t']);
      });

      it("reads the late-bound nextval(('s'::text)::regclass) of an old serial column as auto increment", () => {
        const schema = parse(
          `
            CREATE TABLE public.t (
              id integer DEFAULT nextval(('public.t_id_seq'::text)::regclass) NOT NULL,
              code integer DEFAULT 0
            );
            ALTER TABLE ONLY public.t ALTER COLUMN code SET DEFAULT nextval(('public.t_code_seq'::text)::regclass);
          `,
          undefined,
          Database.PostgreSQL
        );

        expect(shapesOf(schema, tableByName(schema, 't'))).toEqual([
          ['id', '', true],
          ['code', '', true],
        ]);
        expect(
          createSchemaSQL(stateOf(schema), Database.PostgreSQL)
        ).not.toContain('nextval');
      });

      it('keeps a MariaDB nextval on a bare sequence name as the default its export writes', () => {
        const schema = parse(MARIADB_DUMP, undefined, Database.MariaDB);
        const exported = createSchemaSQL(stateOf(schema), Database.MariaDB);
        const nextval = 'nextval(`shop`.`order_seq`)';

        expect(tableShapesOf(schema)).toEqual([
          [
            'invoices',
            [
              ['id', nextval, false],
              ['total', 'NULL', false],
            ],
          ],
          [
            'orders',
            [
              ['id', nextval, false],
              ['note', 'NULL', false],
            ],
          ],
          [
            'refs',
            [
              ['ref', nextval, false],
              ['code', nextval, false],
            ],
          ],
        ]);
        expect(exported.split(`DEFAULT ${nextval}`)).toHaveLength(5);
        expect(exported).not.toContain('AUTO_INCREMENT');
      });

      it('leaves the default a MariaDB SET DEFAULT nextval would set, as any SET DEFAULT but a serial one', () => {
        const schema = parse(
          `
            CREATE TABLE \`orders\` (\`ref\` bigint(20) DEFAULT 0);
            ALTER TABLE \`orders\` ALTER COLUMN \`ref\` SET DEFAULT (NEXTVAL(order_seq));
          `,
          undefined,
          Database.MariaDB
        );

        expect(shapesOf(schema, tableByName(schema, 'orders'))).toEqual([
          ['ref', '0', false],
        ]);
      });
    });

    it('flags no column by the CHECK after the UNIQUE of a column an ALTER adds', () => {
      const schema = parse(`
        CREATE TABLE orders (id INT, price INT);
        ALTER TABLE orders ADD COLUMN discount INT UNIQUE CHECK (price > discount);
      `);

      expect(
        uniqueColumnNamesOf(schema, tableByName(schema, 'orders'))
      ).toEqual([]);
    });

    it('records an ADD UNIQUE over several columns as one unique index', () => {
      const schema = parse(`
        CREATE TABLE t (a INT, b INT, c INT);
        ALTER TABLE t ADD CONSTRAINT uq_ab UNIQUE (a, b);
        ALTER TABLE t ADD UNIQUE KEY uq_bc (b, c DESC);
        ALTER TABLE t ADD UNIQUE (a, c);
        ALTER TABLE t ADD UNIQUE INDEX uq_c (c);
      `);
      const t = tableByName(schema, 't');

      expect(uniqueColumnNamesOf(schema, t)).toEqual(['c']);
      expect(indexShapesOf(schema)).toEqual([
        { name: 'uq_ab', unique: true, columns: ['a ASC', 'b ASC'] },
        { name: 'uq_bc', unique: true, columns: ['b ASC', 'c DESC'] },
        { name: '', unique: true, columns: ['a ASC', 'c ASC'] },
      ]);
      expect(indexesOf(schema).every(index => index.tableId === t.id)).toBe(
        true
      );
    });

    it('reads every key one ALTER TABLE adds, phpMyAdmin style', () => {
      const schema = parse(`
        CREATE TABLE \`t\` (\`id\` int, \`a\` int, \`b\` int, \`c\` int, \`x\` int);
        CREATE TABLE \`y\` (\`id\` int);
        ALTER TABLE \`t\`
          ADD PRIMARY KEY (\`id\`),
          ADD UNIQUE KEY \`uq_ab\` (\`a\`,\`b\`),
          ADD UNIQUE KEY \`uq_c\` (\`c\`),
          ADD KEY \`idx_x\` (\`x\`);
        ALTER TABLE t ADD CONSTRAINT uq_bc UNIQUE (b, c),
          ADD CONSTRAINT fk_x FOREIGN KEY (x) REFERENCES y (id);
      `);
      const t = tableByName(schema, 't');

      expect(columnByName(schema, t, 'id').options).toBe(
        ColumnOption.primaryKey
      );
      expect(uniqueColumnNamesOf(schema, t)).toEqual(['c']);
      expect(indexShapesOf(schema)).toEqual([
        { name: 'uq_ab', unique: true, columns: ['a ASC', 'b ASC'] },
        { name: 'uq_bc', unique: true, columns: ['b ASC', 'c ASC'] },
      ]);
    });

    it('reads the composite unique index a dump tool writes on a qualified table', () => {
      const schema = parse(`
        CREATE TABLE public.sp_region (id INT, code INT, name VARCHAR(20));
        CREATE UNIQUE INDEX i_1 ON public.sp_region USING btree (code, name);
        CREATE UNIQUE NONCLUSTERED INDEX [i_2] ON [dbo].[sp_region] ([name] ASC, [code] DESC)
          WITH (PAD_INDEX = OFF) ON [PRIMARY]
        GO
        CREATE UNIQUE INDEX "HR"."I_3" ON "HR"."SP_REGION" ("ID", "CODE");
      `);

      expect(indexShapesOf(schema)).toEqual([
        { name: 'i_1', unique: true, columns: ['code ASC', 'name ASC'] },
        { name: 'i_2', unique: true, columns: ['name ASC', 'code DESC'] },
        { name: 'I_3', unique: true, columns: ['id ASC', 'code ASC'] },
      ]);
    });

    it('reads an Oracle unique constraint that names an index of its columns as that index, or one column as its flag', () => {
      const schema = parse(`
        CREATE TABLE "HR"."T" ("A" NUMBER, "B" NUMBER, "C" NUMBER, "D" NUMBER);
        CREATE UNIQUE INDEX "HR"."UQ_T_AB_IX" ON "HR"."T" ("A", "B") TABLESPACE "USERS";
        CREATE INDEX "HR"."IX_T_CD" ON "HR"."T" ("C", "D");
        CREATE UNIQUE INDEX "HR"."IX_T_C" ON "HR"."T" ("C");
        CREATE INDEX "HR"."IX_T_ABD" ON "HR"."T" ("A", "B", "D");
        ALTER TABLE "HR"."T" ADD CONSTRAINT "UQ_T_AB" UNIQUE ("A", "B")
          USING INDEX hr.uq_t_ab_ix ENABLE;
        ALTER TABLE "HR"."T" ADD CONSTRAINT "UQ_T_DC" UNIQUE ("D", "C")
          USING INDEX "HR"."IX_T_CD" ENABLE;
        ALTER TABLE "HR"."T" ADD CONSTRAINT "UQ_T_C" UNIQUE ("C")
          USING INDEX "HR"."IX_T_C" ENABLE;
        ALTER TABLE "HR"."T" ADD CONSTRAINT "UQ_T_BA" UNIQUE ("B", "A")
          USING INDEX "HR"."IX_T_ABD" ENABLE;
        ALTER TABLE "HR"."T" ADD CONSTRAINT "UQ_T_AD" UNIQUE ("A", "D")
          USING INDEX "HR"."MISSING" ENABLE;
      `);
      const t = tableByName(schema, 'T');

      expect(uniqueColumnNamesOf(schema, t)).toEqual(['C']);
      expect(indexShapesOf(schema)).toEqual([
        { name: 'UQ_T_AB_IX', unique: true, columns: ['A ASC', 'B ASC'] },
        { name: 'IX_T_CD', unique: true, columns: ['C ASC', 'D ASC'] },
        {
          name: 'IX_T_ABD',
          unique: false,
          columns: ['A ASC', 'B ASC', 'D ASC'],
        },
        { name: 'UQ_T_BA', unique: true, columns: ['B ASC', 'A ASC'] },
        { name: 'UQ_T_AD', unique: true, columns: ['A ASC', 'D ASC'] },
      ]);
    });

    it('reads the index SQL Developer exports for each key of a table as part of that key', () => {
      const schema = parse(`
        CREATE TABLE "HR"."JOB_HISTORY" (
          "EMPLOYEE_ID" NUMBER(6,0) CONSTRAINT "JHIST_EMPLOYEE_NN" NOT NULL ENABLE,
          "START_DATE" DATE, "EMAIL" VARCHAR2(25), "CODE" NUMBER
        ) TABLESPACE "EXAMPLE" ;
        CREATE UNIQUE INDEX "HR"."JHIST_PK" ON "HR"."JOB_HISTORY" ("EMPLOYEE_ID", "START_DATE")
          PCTFREE 10 INITRANS 2 MAXTRANS 255 COMPUTE STATISTICS TABLESPACE "EXAMPLE" ;
        CREATE UNIQUE INDEX "HR"."JHIST_EMAIL_UK" ON "HR"."JOB_HISTORY" ("EMAIL") TABLESPACE "EXAMPLE" ;
        CREATE UNIQUE INDEX "HR"."JHIST_ED_UK" ON "HR"."JOB_HISTORY" ("EMAIL", "START_DATE") ;
        CREATE UNIQUE INDEX "HR"."JHIST_CODE_IX" ON "HR"."JOB_HISTORY" ("CODE") ;
        ALTER TABLE "HR"."JOB_HISTORY" ADD CONSTRAINT "JHIST_PK" PRIMARY KEY ("EMPLOYEE_ID", "START_DATE")
          USING INDEX PCTFREE 10 INITRANS 2 MAXTRANS 255 COMPUTE STATISTICS TABLESPACE "EXAMPLE"  ENABLE;
        ALTER TABLE "HR"."JOB_HISTORY" ADD CONSTRAINT "JHIST_EMAIL_UK" UNIQUE ("EMAIL")
          USING INDEX TABLESPACE "EXAMPLE" ENABLE;
        ALTER TABLE "HR"."JOB_HISTORY" ADD CONSTRAINT "JHIST_ED_UK" UNIQUE ("EMAIL", "START_DATE")
          USING INDEX TABLESPACE "EXAMPLE" ENABLE;
        ALTER TABLE "HR"."JOB_HISTORY" ADD CONSTRAINT "JHIST_CODE_UK" UNIQUE ("CODE")
          USING INDEX "HR"."JHIST_CODE_IX" ENABLE;
      `);
      const history = tableByName(schema, 'JOB_HISTORY');

      expect(
        columnsOf(schema, history)
          .filter(column => bHas(column.options, ColumnOption.primaryKey))
          .map(column => column.name)
      ).toEqual(['EMPLOYEE_ID', 'START_DATE']);
      expect(uniqueColumnNamesOf(schema, history)).toEqual(['EMAIL', 'CODE']);
      expect(indexShapesOf(schema)).toEqual([
        {
          name: 'JHIST_ED_UK',
          unique: true,
          columns: ['EMAIL ASC', 'START_DATE ASC'],
        },
      ]);
    });

    it('reads the index DBMS_METADATA exports for each key a table declares inline as part of that key', () => {
      const schema = parse(`
        CREATE TABLE "HR"."T" (
          "ID" NUMBER, "A" NUMBER, "B" NUMBER, "E" VARCHAR2(10),
          CONSTRAINT "T_PK" PRIMARY KEY ("ID") USING INDEX PCTFREE 10 TABLESPACE "USERS"  ENABLE,
          CONSTRAINT "T_AB_UK" UNIQUE ("A", "B") USING INDEX PCTFREE 10 TABLESPACE "USERS"  ENABLE,
          CONSTRAINT "T_E_UK" UNIQUE ("E") USING INDEX PCTFREE 10 TABLESPACE "USERS"  ENABLE
        ) TABLESPACE "USERS" ;
        CREATE UNIQUE INDEX "HR"."T_PK" ON "HR"."T" ("ID") PCTFREE 10 TABLESPACE "USERS" ;
        CREATE UNIQUE INDEX "HR"."T_AB_UK" ON "HR"."T" ("A", "B") PCTFREE 10 TABLESPACE "USERS" ;
        CREATE UNIQUE INDEX "HR"."T_E_UK" ON "HR"."T" ("E") PCTFREE 10 TABLESPACE "USERS" ;
        CREATE TABLE "HR"."JOB_HISTORY" (
          "EMPLOYEE_ID" NUMBER(6,0) CONSTRAINT "JHIST_EMPLOYEE_NN" NOT NULL ENABLE,
          "START_DATE" DATE, "CODE" NUMBER CONSTRAINT "JHIST_CODE_UK" UNIQUE,
          CONSTRAINT "JHIST_PK" PRIMARY KEY ("EMPLOYEE_ID", "START_DATE") USING INDEX ENABLE
        ) ;
        CREATE UNIQUE INDEX "HR"."JHIST_PK" ON "HR"."JOB_HISTORY" ("START_DATE", "EMPLOYEE_ID") ;
        CREATE UNIQUE INDEX "HR"."JHIST_CODE_UK" ON "HR"."JOB_HISTORY" ("CODE") ;
      `);
      const t = tableByName(schema, 'T');
      const history = tableByName(schema, 'JOB_HISTORY');
      const primaryKeyNamesOf = (table: Table) =>
        columnsOf(schema, table)
          .filter(column => bHas(column.options, ColumnOption.primaryKey))
          .map(column => column.name);

      expect(primaryKeyNamesOf(t)).toEqual(['ID']);
      expect(uniqueColumnNamesOf(schema, t)).toEqual(['E']);
      expect(primaryKeyNamesOf(history)).toEqual(['EMPLOYEE_ID', 'START_DATE']);
      expect(uniqueColumnNamesOf(schema, history)).toEqual(['CODE']);
      expect(indexShapesOf(schema)).toEqual([
        { name: 'T_AB_UK', unique: true, columns: ['A ASC', 'B ASC'] },
      ]);
    });

    it('reads an index a dump repeats under the name of an index over its columns as that index', () => {
      const schema = parse(`
        CREATE TABLE t (a INT, b INT, c INT, INDEX ix_bc (b, c), UNIQUE KEY uq_ac (a, c));
        CREATE UNIQUE INDEX ix_bc ON t (c, b);
        CREATE INDEX uq_ac ON t (a, c);
      `);

      expect(indexShapesOf(schema)).toEqual([
        { name: 'ix_bc', unique: true, columns: ['b ASC', 'c ASC'] },
        { name: 'uq_ac', unique: true, columns: ['a ASC', 'c ASC'] },
      ]);
    });

    it('keeps an index named after an inline key that keys other columns, or after another constraint', () => {
      const schema = parse(`
        CREATE TABLE t (
          a INT CONSTRAINT nn_a NOT NULL PRIMARY KEY, b INT, c INT,
          CONSTRAINT uq_b UNIQUE (b)
        );
        CREATE UNIQUE INDEX nn_a ON t (a);
        CREATE INDEX uq_b ON t (b, c);
      `);
      const t = tableByName(schema, 't');

      expect(columnByName(schema, t, 'a').options).toBe(
        ColumnOption.primaryKey | ColumnOption.notNull
      );
      expect(uniqueColumnNamesOf(schema, t)).toEqual(['b']);
      expect(indexShapesOf(schema)).toEqual([
        { name: 'nn_a', unique: true, columns: ['a ASC'] },
        { name: 'uq_b', unique: false, columns: ['b ASC', 'c ASC'] },
      ]);
    });

    it('reads the index SQL Developer exports for each system-named key as part of that key', () => {
      const schema = parse(`
        CREATE TABLE "HR"."T" ("ID" NUMBER, "A" NUMBER, "B" NUMBER, "E" VARCHAR2(10)) ;
        CREATE UNIQUE INDEX "HR"."SYS_C0012345" ON "HR"."T" ("ID") PCTFREE 10 ;
        CREATE UNIQUE INDEX "HR"."SYS_C0012346" ON "HR"."T" ("A", "B") PCTFREE 10 ;
        CREATE UNIQUE INDEX "HR"."SYS_C0012347" ON "HR"."T" ("E") PCTFREE 10 ;
        ALTER TABLE "HR"."T" ADD PRIMARY KEY ("ID") USING INDEX PCTFREE 10  ENABLE;
        ALTER TABLE "HR"."T" ADD UNIQUE ("A", "B") USING INDEX PCTFREE 10  ENABLE;
        ALTER TABLE "HR"."T" ADD UNIQUE ("E") USING INDEX PCTFREE 10  ENABLE;
      `);
      const t = tableByName(schema, 'T');

      expect(columnByName(schema, t, 'ID').options).toBe(
        ColumnOption.primaryKey
      );
      expect(uniqueColumnNamesOf(schema, t)).toEqual(['E']);
      expect(indexShapesOf(schema)).toEqual([
        { name: 'SYS_C0012346', unique: true, columns: ['A ASC', 'B ASC'] },
      ]);
    });

    it('keeps an index over the columns of a key with no name in another order', () => {
      const schema = parse(`
        CREATE TABLE t (a INT, b INT, c INT);
        CREATE UNIQUE INDEX ix_ba ON t (b, a);
        CREATE INDEX ix_ca ON t (c, a);
        ALTER TABLE t ADD UNIQUE (a, b);
        ALTER TABLE t ADD PRIMARY KEY (a, c);
      `);

      expect(indexShapesOf(schema)).toEqual([
        { name: 'ix_ba', unique: true, columns: ['b ASC', 'a ASC'] },
        { name: 'ix_ca', unique: false, columns: ['c ASC', 'a ASC'] },
        { name: '', unique: true, columns: ['a ASC', 'b ASC'] },
      ]);
    });

    it('lets an ALTER unique key with no name take over the index over its columns in their order, unique or not', () => {
      const schema = parse(`
        CREATE TABLE t (a INT, b INT, c INT, d INT);
        CREATE INDEX ix_ab ON t (a, b);
        CREATE INDEX ix_c ON t (c);
        CREATE UNIQUE INDEX uq_d ON t (d);
        ALTER TABLE t ADD UNIQUE (a, b);
        ALTER TABLE t ADD UNIQUE (c);
        ALTER TABLE t ADD UNIQUE (d);
      `);
      const t = tableByName(schema, 't');

      expect(uniqueColumnNamesOf(schema, t)).toEqual(['c', 'd']);
      expect(indexShapesOf(schema)).toEqual([
        { name: 'ix_ab', unique: true, columns: ['a ASC', 'b ASC'] },
      ]);
    });

    // Oracle enforces a primary key through an index over its columns, a
    // non-unique one too, rather than build another.
    it('lets an ALTER primary key with no name take over a plain index over its columns', () => {
      const schema = parse(`
        CREATE TABLE t (id INT);
        CREATE INDEX ix_id ON t (id);
        ALTER TABLE t ADD PRIMARY KEY (id);
      `);
      const t = tableByName(schema, 't');

      expect(columnByName(schema, t, 'id').options).toBe(
        ColumnOption.primaryKey
      );
      expect(indexesOf(schema)).toEqual([]);
    });

    // DBMS_METADATA's CONSTRAINTS_AS_ALTER output, then the table's dependent
    // index DDL, writes each ALTER before the SYS_C index of its key.
    it('lets an ALTER key with no name take over an index over its columns that the script creates after it', () => {
      const schema = parse(`
        CREATE TABLE s (id INT);
        ALTER TABLE s ADD PRIMARY KEY (id);
        CREATE INDEX ix_id ON s (id);
        CREATE TABLE "HR"."T" ("ID" NUMBER, "A" NUMBER, "B" NUMBER) ;
        ALTER TABLE "HR"."T" ADD PRIMARY KEY ("ID") USING INDEX PCTFREE 10  ENABLE;
        ALTER TABLE "HR"."T" ADD UNIQUE ("A", "B") USING INDEX PCTFREE 10  ENABLE;
        CREATE UNIQUE INDEX "HR"."SYS_C0012345" ON "HR"."T" ("ID") PCTFREE 10 ;
        CREATE UNIQUE INDEX "HR"."SYS_C0012346" ON "HR"."T" ("A", "B") PCTFREE 10 ;
      `);

      expect(columnByName(schema, tableByName(schema, 's'), 'id').options).toBe(
        ColumnOption.primaryKey
      );
      expect(columnByName(schema, tableByName(schema, 'T'), 'ID').options).toBe(
        ColumnOption.primaryKey
      );
      expect(indexShapesOf(schema)).toEqual([
        { name: 'SYS_C0012346', unique: true, columns: ['A ASC', 'B ASC'] },
      ]);
    });

    it('reads the index DBMS_METADATA exports for each system-named key a table declares inline as part of that key', () => {
      const schema = parse(`
        CREATE TABLE "HR"."T" (
          "ID" NUMBER, "A" NUMBER, "B" NUMBER, "E" VARCHAR2(10) UNIQUE USING INDEX ENABLE,
          PRIMARY KEY ("ID") USING INDEX PCTFREE 10 TABLESPACE "USERS"  ENABLE,
          UNIQUE ("A", "B") USING INDEX PCTFREE 10 TABLESPACE "USERS"  ENABLE
        ) TABLESPACE "USERS" ;
        CREATE UNIQUE INDEX "HR"."SYS_C0012345" ON "HR"."T" ("ID") PCTFREE 10 ;
        CREATE UNIQUE INDEX "HR"."SYS_C0012346" ON "HR"."T" ("A", "B") PCTFREE 10 ;
        CREATE UNIQUE INDEX "HR"."SYS_C0012347" ON "HR"."T" ("E") PCTFREE 10 ;
        CREATE INDEX "HR"."T_BA_IX" ON "HR"."T" ("B", "A") ;
      `);
      const t = tableByName(schema, 'T');

      expect(columnByName(schema, t, 'ID').options).toBe(
        ColumnOption.primaryKey
      );
      expect(uniqueColumnNamesOf(schema, t)).toEqual(['E']);
      expect(indexShapesOf(schema)).toEqual([
        { name: 'SYS_C0012346', unique: true, columns: ['A ASC', 'B ASC'] },
        { name: 'T_BA_IX', unique: false, columns: ['B ASC', 'A ASC'] },
      ]);
    });

    it('keeps an index over the columns of an inline unique key with no name and no USING INDEX', () => {
      const schema = parse(`
        CREATE TABLE t (a INT, b INT, UNIQUE (a, b));
        CREATE INDEX ix_ab ON t (a, b);
      `);

      expect(indexShapesOf(schema)).toEqual([
        { name: '', unique: true, columns: ['a ASC', 'b ASC'] },
        { name: 'ix_ab', unique: false, columns: ['a ASC', 'b ASC'] },
      ]);
    });

    it("keeps an index over the columns of a key with no name that PostgreSQL's USING INDEX TABLESPACE follows", () => {
      const schema = parse(`
        CREATE TABLE t (a int, b int, UNIQUE (a, b) USING INDEX TABLESPACE fast);
        CREATE INDEX ix_ab ON t (a, b);
        CREATE TABLE p (a int, b int, PRIMARY KEY (a, b) USING INDEX TABLESPACE fast);
        CREATE INDEX ON p (a, b);
        CREATE UNIQUE INDEX uq ON p (a, b);
        CREATE TABLE e (
          id int PRIMARY KEY USING INDEX TABLESPACE fast,
          e text UNIQUE USING INDEX TABLESPACE fast
        );
        CREATE INDEX ix_id ON e (id);
        CREATE INDEX ix_e ON e (e);
      `);
      const e = tableByName(schema, 'e');

      expect(columnByName(schema, e, 'id').options).toBe(
        ColumnOption.primaryKey
      );
      expect(uniqueColumnNamesOf(schema, e)).toEqual(['e']);
      expect(indexShapesOf(schema)).toEqual([
        { name: '', unique: true, columns: ['a ASC', 'b ASC'] },
        { name: 'ix_ab', unique: false, columns: ['a ASC', 'b ASC'] },
        { name: '', unique: false, columns: ['a ASC', 'b ASC'] },
        { name: 'uq', unique: true, columns: ['a ASC', 'b ASC'] },
        { name: 'ix_id', unique: false, columns: ['id ASC'] },
        { name: 'ix_e', unique: false, columns: ['e ASC'] },
      ]);
    });

    it('keeps an index over the columns of an earlier CREATE INDEX with no name', () => {
      const schema = parse(`
        CREATE TABLE t (a INT, b INT);
        CREATE INDEX ON t (a, b);
        CREATE UNIQUE INDEX uq ON t (a, b);
      `);

      expect(indexShapesOf(schema)).toEqual([
        { name: '', unique: false, columns: ['a ASC', 'b ASC'] },
        { name: 'uq', unique: true, columns: ['a ASC', 'b ASC'] },
      ]);
    });

    it('keeps an index named after a key that keys other columns', () => {
      const schema = parse(`
        CREATE TABLE t (a INT, b INT, c INT);
        CREATE INDEX pk_t ON t (a, b);
        CREATE UNIQUE INDEX uq_t ON t (b, c);
        ALTER TABLE t ADD CONSTRAINT pk_t PRIMARY KEY (a);
        ALTER TABLE t ADD CONSTRAINT uq_t UNIQUE (a, c);
      `);

      expect(indexShapesOf(schema)).toEqual([
        { name: 'pk_t', unique: false, columns: ['a ASC', 'b ASC'] },
        { name: 'uq_t', unique: true, columns: ['b ASC', 'c ASC'] },
        { name: 'uq_t', unique: true, columns: ['a ASC', 'c ASC'] },
      ]);
    });

    it('keeps every column of a pg_dump key whose parts carry a null order, an operator class or a collation', () => {
      const schema = parse(`
        CREATE TABLE public.t (a integer NOT NULL, b integer NOT NULL, deleted_at timestamp);
        CREATE UNIQUE INDEX uq_ab ON public.t USING btree (a, b DESC NULLS LAST);
        CREATE UNIQUE INDEX uq_ba ON public.t USING btree (b text_pattern_ops, a COLLATE "C");
        CREATE UNIQUE INDEX uq_live ON public.t USING btree (a, b) WHERE (deleted_at IS NULL);
        CREATE UNIQUE INDEX uq_set ON public.t USING btree (a, b) WHERE (a IS NOT NULL);
      `);

      expect(indexShapesOf(schema)).toEqual([
        { name: 'uq_ab', unique: true, columns: ['a ASC', 'b DESC'] },
        { name: 'uq_ba', unique: true, columns: ['b ASC', 'a ASC'] },
        { name: 'uq_live', unique: false, columns: ['a ASC', 'b ASC'] },
        { name: 'uq_set', unique: true, columns: ['a ASC', 'b ASC'] },
      ]);
    });

    it('imports a partial unique index as a plain one unless its WHERE drops only NULL keys', () => {
      const schema = parse(`
        CREATE TABLE t (a INT, b INT, c INT, deleted_at TIMESTAMP);
        CREATE UNIQUE INDEX uq_a ON t (a) WHERE a IS NOT NULL;
        CREATE UNIQUE INDEX ix_b ON t (b) WHERE deleted_at IS NULL;
        CREATE UNIQUE INDEX ix_bc ON t (b, c) WHERE b IS NOT NULL OR c > 0;
      `);
      const t = tableByName(schema, 't');

      expect(uniqueColumnNamesOf(schema, t)).toEqual([]);
      expect(indexShapesOf(schema)).toEqual([
        { name: 'uq_a', unique: true, columns: ['a ASC'] },
        { name: 'ix_b', unique: false, columns: ['b ASC'] },
        { name: 'ix_bc', unique: false, columns: ['b ASC', 'c ASC'] },
      ]);
    });

    it('imports a filtered SQL Server inline INDEX n UNIQUE as a plain index unless its WHERE drops only NULL keys', () => {
      const schema = parse(`
        CREATE TABLE [dbo].[t] (
          [a] INT, [b] INT, [c] INT, [d] INT,
          INDEX [uq_ab] UNIQUE NONCLUSTERED ([a], [b]) WHERE ([a] IS NOT NULL AND [b] IS NOT NULL),
          INDEX [ix_bc] UNIQUE ([b], [c] DESC) INCLUDE ([d]) WHERE ([d] > 0),
          INDEX [uq_c] UNIQUE ([c]) WHERE [c] IS NOT NULL,
          INDEX [ix_d] UNIQUE ([d]) WHERE [d] > 0
        )
        GO
      `);
      const t = tableByName(schema, 't');

      expect(uniqueColumnNamesOf(schema, t)).toEqual(['c']);
      expect(indexShapesOf(schema)).toEqual([
        { name: 'uq_ab', unique: true, columns: ['a ASC', 'b ASC'] },
        { name: 'ix_bc', unique: false, columns: ['b ASC', 'c DESC'] },
        { name: 'ix_d', unique: false, columns: ['d ASC'] },
      ]);
    });

    it('matches table and column names case-insensitively', () => {
      const schema = parse(`
        CREATE TABLE t (a INT);
        ALTER TABLE T ADD PRIMARY KEY (A);
      `);
      const t = tableByName(schema, 't');

      expect(
        bHas(columnByName(schema, t, 'a').options, ColumnOption.primaryKey)
      ).toBe(true);
    });

    it('ignores ALTER statements targeting an unknown table', () => {
      const schema = parse(`
        CREATE TABLE t (a INT);
        ALTER TABLE missing ADD PRIMARY KEY (a);
        ALTER TABLE missing ADD UNIQUE (a);
        ALTER TABLE missing ADD FOREIGN KEY (a) REFERENCES t (a);
        CREATE INDEX idx ON missing (a);
      `);
      const t = tableByName(schema, 't');

      expect(columnByName(schema, t, 'a').options).toBe(0);
      expect(schema.doc.relationshipIds).toHaveLength(0);
      expect(schema.doc.indexIds).toHaveLength(0);
    });

    it('ignores ALTER statements targeting an unknown column', () => {
      const schema = parse(`
        CREATE TABLE t (a INT);
        ALTER TABLE t ADD PRIMARY KEY (nope);
        ALTER TABLE t ADD UNIQUE (nope);
      `);
      const t = tableByName(schema, 't');

      expect(columnByName(schema, t, 'a').options).toBe(0);
    });

    it('drops ALTER statements that carry no column names', () => {
      const schema = parse(`
        CREATE TABLE t (a INT);
        ALTER TABLE t ADD PRIMARY KEY ();
        ALTER TABLE t ADD UNIQUE ();
      `);
      const t = tableByName(schema, 't');

      expect(columnByName(schema, t, 'a').options).toBe(0);
    });

    it('drops foreign keys whose column list could not be parsed', () => {
      const schema = parse(`
        CREATE TABLE t (a INT, b INT);
        CREATE TABLE o (c INT);
        ALTER TABLE t ADD FOREIGN KEY (a, b) REFERENCES o (c);
      `);

      expect(schema.doc.relationshipIds).toHaveLength(0);
    });
  });

  describe('relationship conversion', () => {
    it('creates a non-identifying relationship for a plain foreign key', () => {
      const schema = parse(`
        CREATE TABLE users (id INT, PRIMARY KEY (id));
        CREATE TABLE posts (id INT, user_id INT, PRIMARY KEY (id));
        ALTER TABLE posts ADD CONSTRAINT fk_posts FOREIGN KEY (user_id) REFERENCES users (id);
      `);
      const users = tableByName(schema, 'users');
      const posts = tableByName(schema, 'posts');
      const [relationship] = relationshipsOf(schema);

      expect(relationshipsOf(schema)).toHaveLength(1);
      expect(relationship.identification).toBe(false);
      expect(relationship.relationshipType).toBe(RelationshipType.ZeroN);
      expect(relationship.startRelationshipType).toBe(
        StartRelationshipType.dash
      );
      expect(relationship.start.tableId).toBe(users.id);
      expect(relationship.start.columnIds).toEqual([
        columnByName(schema, users, 'id').id,
      ]);
      expect(relationship.end.tableId).toBe(posts.id);
      expect(relationship.end.columnIds).toEqual([
        columnByName(schema, posts, 'user_id').id,
      ]);
      expect(columnByName(schema, posts, 'user_id').ui.keys).toBe(
        ColumnUIKey.foreignKey
      );
      // the primary key of the end table keeps its own key flag
      expect(columnByName(schema, posts, 'id').ui.keys).toBe(
        ColumnUIKey.primaryKey
      );
    });

    it('creates an identifying relationship when every end column is also a primary key', () => {
      const schema = parse(`
        CREATE TABLE parent (id INT, PRIMARY KEY (id));
        CREATE TABLE child (parent_id INT, seq INT, PRIMARY KEY (parent_id, seq));
        ALTER TABLE child ADD FOREIGN KEY (parent_id) REFERENCES parent (id);
      `);
      const child = tableByName(schema, 'child');
      const [relationship] = relationshipsOf(schema);

      expect(relationship.identification).toBe(true);
      expect(columnByName(schema, child, 'parent_id').ui.keys).toBe(
        ColumnUIKey.primaryKey | ColumnUIKey.foreignKey
      );
      expect(columnByName(schema, child, 'seq').ui.keys).toBe(
        ColumnUIKey.primaryKey
      );
    });

    it('supports composite foreign keys', () => {
      const schema = parse(`
        CREATE TABLE parent (a INT, b INT, PRIMARY KEY (a, b));
        CREATE TABLE child (pa INT, pb INT);
        ALTER TABLE child ADD FOREIGN KEY (pa, pb) REFERENCES parent (a, b);
      `);
      const parent = tableByName(schema, 'parent');
      const child = tableByName(schema, 'child');
      const [relationship] = relationshipsOf(schema);

      expect(relationship.start.columnIds).toEqual([
        columnByName(schema, parent, 'a').id,
        columnByName(schema, parent, 'b').id,
      ]);
      expect(relationship.end.columnIds).toEqual([
        columnByName(schema, child, 'pa').id,
        columnByName(schema, child, 'pb').id,
      ]);
      expect(relationship.identification).toBe(false);
    });

    it('supports inline REFERENCES declared inside CREATE TABLE', () => {
      const schema = parse(`
        CREATE TABLE users (id INT, PRIMARY KEY (id));
        CREATE TABLE posts (
          user_id INT,
          FOREIGN KEY (user_id) REFERENCES users (id)
        );
      `);

      expect(relationshipsOf(schema)).toHaveLength(1);
      expect(relationshipsOf(schema)[0].start.tableId).toBe(
        tableByName(schema, 'users').id
      );
    });

    it('skips a foreign key whose referenced table does not exist', () => {
      const schema = parse(`
        CREATE TABLE posts (id INT, user_id INT);
        ALTER TABLE posts ADD FOREIGN KEY (user_id) REFERENCES nosuch (id);
      `);
      const posts = tableByName(schema, 'posts');

      expect(schema.doc.relationshipIds).toHaveLength(0);
      expect(columnByName(schema, posts, 'user_id').ui.keys).toBe(0);
    });

    it.each([
      [
        'an end column',
        'ALTER TABLE posts ADD FOREIGN KEY (nope) REFERENCES users (id);',
      ],
      [
        'a referenced column',
        'ALTER TABLE posts ADD FOREIGN KEY (user_id) REFERENCES users (nope);',
      ],
      [
        'a referenced column inline',
        'CREATE TABLE notes (user_id INT REFERENCES users (uid) ON DELETE CASCADE);',
      ],
    ])(
      'skips a foreign key naming %s the table lacks, keying nothing',
      (_what, sql) => {
        const schema = parse(`
        CREATE TABLE users (id INT, PRIMARY KEY (id));
        CREATE TABLE posts (id INT, user_id INT);
        ${sql}
      `);

        expect(relationshipsOf(schema)).toEqual([]);
        for (const table of tablesOf(schema)) {
          for (const column of columnsOf(schema, table)) {
            expect(bHas(column.ui.keys, ColumnUIKey.foreignKey)).toBe(false);
          }
        }
      }
    );

    it('keeps the ON DELETE and ON UPDATE actions of every foreign key form', () => {
      const schema = parse(`
        CREATE TABLE users (id INT, PRIMARY KEY (id));
        CREATE TABLE shops (id INT PRIMARY KEY);
        CREATE TABLE orders (
          id INT PRIMARY KEY,
          user_id INT REFERENCES users (id) ON DELETE CASCADE,
          shop_id INT,
          FOREIGN KEY (shop_id) REFERENCES shops (id) ON DELETE SET NULL ON UPDATE NO ACTION
        );
        CREATE TABLE items (order_id INT);
        ALTER TABLE items ADD CONSTRAINT fk FOREIGN KEY (order_id) REFERENCES orders (id) ON UPDATE RESTRICT ON DELETE SET DEFAULT;
        CREATE TABLE notes (order_id INT);
        ALTER TABLE notes ADD FOREIGN KEY (order_id) REFERENCES orders (id);
      `);

      expect(
        relationshipsOf(schema).map(({ onDelete, onUpdate }) => [
          onDelete,
          onUpdate,
        ])
      ).toEqual([
        [ReferentialAction.cascade, ReferentialAction.none],
        [ReferentialAction.setNull, ReferentialAction.noAction],
        [ReferentialAction.setDefault, ReferentialAction.restrict],
        [ReferentialAction.none, ReferentialAction.none],
      ]);
    });

    it('keeps the actions of a foreign key SSMS scripts WITH CHECK', () => {
      const schema = parse(`
        CREATE TABLE [dbo].[a](
          [id] [int] IDENTITY(1,1) NOT NULL,
          CONSTRAINT [PK_a] PRIMARY KEY CLUSTERED ([id] ASC)
        ) ON [PRIMARY]
        GO
        CREATE TABLE [dbo].[b]([a_id] [int] NULL) ON [PRIMARY]
        GO
        ALTER TABLE [dbo].[b]  WITH CHECK ADD  CONSTRAINT [FK_b_a] FOREIGN KEY([a_id])
        REFERENCES [dbo].[a] ([id])
        ON DELETE CASCADE
        GO
        ALTER TABLE [dbo].[b] CHECK CONSTRAINT [FK_b_a]
        GO
      `);
      const [relationship] = relationshipsOf(schema);

      expect(relationshipsOf(schema)).toHaveLength(1);
      expect(relationship.end.columnIds).toEqual([
        columnByName(schema, tableByName(schema, 'b'), 'a_id').id,
      ]);
      expect(relationship.onDelete).toBe(ReferentialAction.cascade);
      expect(relationship.onUpdate).toBe(ReferentialAction.none);
    });

    it('relates an inline REFERENCES without a column list to the primary key', () => {
      const schema = parse(`
        CREATE TABLE users (id INT PRIMARY KEY, name TEXT);
        CREATE TABLE posts (user_id INT REFERENCES users ON DELETE CASCADE);
        CREATE TABLE pairs (a INT PRIMARY KEY, b INT PRIMARY KEY);
        CREATE TABLE links (pair_a INT REFERENCES pairs);
      `);
      const users = tableByName(schema, 'users');
      const posts = tableByName(schema, 'posts');
      const [relationship] = relationshipsOf(schema);

      expect(relationshipsOf(schema)).toHaveLength(1);
      expect(relationship.start.columnIds).toEqual([
        columnByName(schema, users, 'id').id,
      ]);
      expect(relationship.end.columnIds).toEqual([
        columnByName(schema, posts, 'user_id').id,
      ]);
      expect(relationship.onDelete).toBe(ReferentialAction.cascade);
      expect(
        columnByName(schema, tableByName(schema, 'links'), 'pair_a').ui.keys
      ).toBe(0);
    });

    it('relates a FOREIGN KEY REFERENCES column and a table key without a column list', () => {
      const schema = parse(`
        CREATE TABLE users (id INT PRIMARY KEY);
        CREATE TABLE posts (
          user_id INT FOREIGN KEY REFERENCES users (id) ON DELETE CASCADE,
          editor_id INT CONSTRAINT fk FOREIGN KEY REFERENCES users,
          owner_id INT,
          title TEXT,
          FOREIGN KEY (owner_id) REFERENCES users ON UPDATE SET NULL
        );
        CREATE TABLE notes (user_id INT);
        ALTER TABLE notes ADD FOREIGN KEY (user_id) REFERENCES users ON DELETE RESTRICT;
      `);
      const posts = tableByName(schema, 'posts');
      const notes = tableByName(schema, 'notes');
      const userId = columnByName(
        schema,
        tableByName(schema, 'users'),
        'id'
      ).id;

      expect(
        relationshipsOf(schema).map(({ start, end, onDelete, onUpdate }) => ({
          start: start.columnIds,
          end: end.columnIds,
          onDelete,
          onUpdate,
        }))
      ).toEqual([
        {
          start: [userId],
          end: [columnByName(schema, posts, 'user_id').id],
          onDelete: ReferentialAction.cascade,
          onUpdate: ReferentialAction.none,
        },
        {
          start: [userId],
          end: [columnByName(schema, posts, 'editor_id').id],
          onDelete: ReferentialAction.none,
          onUpdate: ReferentialAction.none,
        },
        {
          start: [userId],
          end: [columnByName(schema, posts, 'owner_id').id],
          onDelete: ReferentialAction.none,
          onUpdate: ReferentialAction.setNull,
        },
        {
          start: [userId],
          end: [columnByName(schema, notes, 'user_id').id],
          onDelete: ReferentialAction.restrict,
          onUpdate: ReferentialAction.none,
        },
      ]);
    });

    it('skips a composite key with a side short, and a key with no primary key to name', () => {
      const schema = parse(`
        CREATE TABLE users (id INT PRIMARY KEY, code INT);
        CREATE TABLE posts (
          a INT,
          FOREIGN KEY (a, missing) REFERENCES users (id, code)
        );
        CREATE TABLE tags (id INT);
        CREATE TABLE tagged (tag_id INT REFERENCES tags);
      `);

      expect(relationshipsOf(schema)).toEqual([]);
      expect(
        columnByName(schema, tableByName(schema, 'posts'), 'a').ui.keys
      ).toBe(0);
      expect(
        columnByName(schema, tableByName(schema, 'tagged'), 'tag_id').ui.keys
      ).toBe(0);
    });

    it('skips a composite key without a column list, whose pairing follows the declared key order', () => {
      const schema = parse(`
        CREATE TABLE p (a INT NOT NULL, b INT NOT NULL, PRIMARY KEY (b, a));
        CREATE TABLE c (x INT, y INT, FOREIGN KEY (x, y) REFERENCES p ON DELETE CASCADE);
        CREATE TABLE q (a INT NOT NULL, b INT NOT NULL);
        ALTER TABLE q ADD CONSTRAINT q_pk PRIMARY KEY (b, a);
        CREATE TABLE d (x INT, y INT);
        ALTER TABLE d ADD CONSTRAINT d_fk FOREIGN KEY (x, y) REFERENCES q;
      `);

      expect(relationshipsOf(schema)).toEqual([]);
      expect(columnByName(schema, tableByName(schema, 'c'), 'x').ui.keys).toBe(
        0
      );
      expect(columnByName(schema, tableByName(schema, 'd'), 'y').ui.keys).toBe(
        0
      );
    });

    it('creates one relationship per foreign key on the same table', () => {
      const schema = parse(`
        CREATE TABLE a (id INT);
        CREATE TABLE b (id INT);
        CREATE TABLE c (a_id INT, b_id INT);
        ALTER TABLE c ADD FOREIGN KEY (a_id) REFERENCES a (id);
        ALTER TABLE c ADD FOREIGN KEY (b_id) REFERENCES b (id);
      `);

      expect(relationshipsOf(schema)).toHaveLength(2);
      expect(
        relationshipsOf(schema).map(relationship => relationship.start.tableId)
      ).toEqual([tableByName(schema, 'a').id, tableByName(schema, 'b').id]);
    });
  });

  describe('index conversion', () => {
    it('converts CREATE INDEX into an index with ordered columns', () => {
      const schema = parse(`
        CREATE TABLE posts (id INT, title VARCHAR(200), user_id INT);
        CREATE UNIQUE INDEX idx_posts ON posts (title DESC, user_id ASC);
      `);
      const posts = tableByName(schema, 'posts');
      const [index] = indexesOf(schema);

      expect(indexesOf(schema)).toHaveLength(1);
      expect(index.name).toBe('idx_posts');
      expect(index.unique).toBe(true);
      expect(index.tableId).toBe(posts.id);
      expect(index.indexColumnIds).toEqual(index.seqIndexColumnIds);

      const indexColumns = index.indexColumnIds.map(
        id => schema.collections.indexColumnEntities[id]
      );

      expect(indexColumns.map(indexColumn => indexColumn.indexId)).toEqual([
        index.id,
        index.id,
      ]);
      expect(indexColumns.map(indexColumn => indexColumn.columnId)).toEqual([
        columnByName(schema, posts, 'title').id,
        columnByName(schema, posts, 'user_id').id,
      ]);
      expect(indexColumns.map(indexColumn => indexColumn.orderType)).toEqual([
        OrderType.DESC,
        OrderType.ASC,
      ]);
    });

    it('defaults a non-unique index to unique: false', () => {
      const schema = parse(`
        CREATE TABLE posts (id INT);
        CREATE INDEX idx_posts ON posts (id);
      `);

      expect(indexesOf(schema)[0].unique).toBe(false);
    });

    it('converts indexes declared inline in CREATE TABLE', () => {
      const schema = parse(`
        CREATE TABLE t (
          a INT,
          b INT,
          INDEX idx_t (a DESC, b)
        );
      `);
      const t = tableByName(schema, 't');
      const [index] = indexesOf(schema);
      const indexColumns = index.indexColumnIds.map(
        id => schema.collections.indexColumnEntities[id]
      );

      expect(index.name).toBe('idx_t');
      expect(index.tableId).toBe(t.id);
      expect(indexColumns.map(indexColumn => indexColumn.orderType)).toEqual([
        OrderType.DESC,
        OrderType.ASC,
      ]);
    });

    it('converts a named UNIQUE INDEX in CREATE TABLE by its column count', () => {
      const schema = parse(`
        CREATE TABLE rental (
          id INT,
          code VARCHAR(10),
          rental_date DATETIME,
          inventory_id INT,
          UNIQUE INDEX idx_code (code ASC),
          UNIQUE INDEX idx_rental (rental_date ASC, inventory_id DESC)
        );
      `);
      const rental = tableByName(schema, 'rental');
      const [index] = indexesOf(schema);

      expect(columnsOf(schema, rental).map(column => column.name)).toEqual([
        'id',
        'code',
        'rental_date',
        'inventory_id',
      ]);
      expect(
        columnsOf(schema, rental).map(column =>
          bHas(column.options, ColumnOption.unique)
        )
      ).toEqual([false, true, false, false]);
      expect(indexesOf(schema)).toHaveLength(1);
      expect(index.name).toBe('idx_rental');
      expect(index.unique).toBe(true);
      expect(
        index.indexColumnIds.map(id => {
          const { columnId, orderType } =
            schema.collections.indexColumnEntities[id];
          return [columnId, orderType];
        })
      ).toEqual([
        [columnByName(schema, rental, 'rental_date').id, OrderType.ASC],
        [columnByName(schema, rental, 'inventory_id').id, OrderType.DESC],
      ]);
    });

    it('converts every composite UNIQUE spelling in CREATE TABLE into one unique index', () => {
      const schema = parse(`
        CREATE TABLE sp_region (
          id INT,
          code INT,
          name VARCHAR(20),
          email VARCHAR(40),
          PRIMARY KEY (id),
          UNIQUE (code, name),
          UNIQUE KEY uq_name_code (name, code),
          CONSTRAINT uq_code_email UNIQUE (code, email),
          UNIQUE KEY uq_email (email)
        );
      `);
      const region = tableByName(schema, 'sp_region');

      expect(uniqueColumnNamesOf(schema, region)).toEqual(['email']);
      expect(indexShapesOf(schema)).toEqual([
        { name: '', unique: true, columns: ['code ASC', 'name ASC'] },
        {
          name: 'uq_name_code',
          unique: true,
          columns: ['name ASC', 'code ASC'],
        },
        {
          name: 'uq_code_email',
          unique: true,
          columns: ['code ASC', 'email ASC'],
        },
      ]);
    });

    it('skips index columns that do not resolve, keeping the rest', () => {
      const schema = parse(`
        CREATE TABLE posts (id INT);
        CREATE INDEX idx_posts ON posts (id, nope);
      `);
      const posts = tableByName(schema, 'posts');
      const [index] = indexesOf(schema);

      expect(index.indexColumnIds).toHaveLength(1);
      expect(
        schema.collections.indexColumnEntities[index.indexColumnIds[0]].columnId
      ).toBe(columnByName(schema, posts, 'id').id);
    });

    it('drops a unique index with a key column that does not resolve, in every spelling', () => {
      const schema = parse(`
        CREATE TABLE users (id INT PRIMARY KEY, email VARCHAR(255), name VARCHAR(20));
        ALTER TABLE users ADD COLUMN tenant_id INT;
        ALTER TABLE users ADD CONSTRAINT uq_tenant_email UNIQUE (tenant_id, email);
        CREATE UNIQUE INDEX uq_tenant_name ON users (tenant_id, name);
        CREATE TABLE t (a INT, b INT, UNIQUE (a, zz), UNIQUE KEY uq_b (b, zz));
        CREATE INDEX idx_kept ON users (email, tenant_id);
      `);

      expect(uniqueColumnNamesOf(schema, tableByName(schema, 'users'))).toEqual(
        []
      );
      expect(uniqueColumnNamesOf(schema, tableByName(schema, 't'))).toEqual([]);
      expect(indexShapesOf(schema)).toEqual([
        { name: 'idx_kept', unique: false, columns: ['email ASC'] },
      ]);
    });

    it('does not create an index when no column resolves', () => {
      const schema = parse(`
        CREATE TABLE posts (id INT);
        CREATE INDEX idx_posts ON posts (nope);
      `);

      expect(schema.doc.indexIds).toHaveLength(0);
      expect(schema.collections.indexEntities).toEqual({});
      expect(schema.collections.indexColumnEntities).toEqual({});
    });

    it('drops CREATE INDEX statements without a table or without columns', () => {
      const schema = parse(`
        CREATE TABLE posts (id INT);
        CREATE INDEX idx_a ON posts ();
        CREATE INDEX idx_b ON;
      `);

      expect(schema.doc.indexIds).toHaveLength(0);
    });
  });

  describe('prepare hook', () => {
    it('is applied before serialization', () => {
      const schema = parse('CREATE TABLE t (a INT);', schema => {
        schema.settings.databaseName = 'prepared';
        schema.settings.width = 4000;
        return schema;
      });

      expect(schema.settings.databaseName).toBe('prepared');
      expect(schema.settings.width).toBe(4000);
      expect(schema.doc.tableIds).toHaveLength(1);
    });

    it('can swap the schema entirely', () => {
      const replacement = parse('CREATE TABLE replacement (a INT);');
      const schema = parse(
        'CREATE TABLE original (a INT);',
        () => replacement as ERDEditorSchemaV3
      );

      expect(tablesOf(schema).map(table => table.name)).toEqual([
        'replacement',
      ]);
    });
  });

  describe('combined document', () => {
    it('converts tables, relationships and indexes together', () => {
      const schema = parse(`
        CREATE TABLE users (
          id INT NOT NULL AUTO_INCREMENT,
          email VARCHAR(100) NOT NULL,
          PRIMARY KEY (id)
        ) COMMENT 'users';

        CREATE TABLE posts (
          id INT NOT NULL,
          user_id INT NOT NULL,
          title VARCHAR(200),
          PRIMARY KEY (id)
        );

        ALTER TABLE users ADD CONSTRAINT uq_users_email UNIQUE (email);
        ALTER TABLE posts ADD CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users (id);
        CREATE INDEX idx_posts_title ON posts (title);
      `);

      expect(tablesOf(schema).map(table => table.name)).toEqual([
        'users',
        'posts',
      ]);
      expect(Object.keys(schema.collections.tableColumnEntities)).toHaveLength(
        5
      );
      expect(schema.doc.relationshipIds).toHaveLength(1);
      expect(schema.doc.indexIds).toHaveLength(1);
      expect(schema.doc.memoIds).toEqual([]);
      expect(schema.settings.width).toBe(2000);

      const users = tableByName(schema, 'users');
      expect(
        bHas(columnByName(schema, users, 'email').options, ColumnOption.unique)
      ).toBe(true);
    });
  });

  describe('comment round trip', () => {
    function commentedState(): RootState {
      const state = {
        ...schemaV3Parser({}),
        editor: {},
        lww: {},
      } as unknown as RootState;

      state.collections.tableColumnEntities = {
        'col-id': createColumn({
          id: 'col-id',
          tableId: 'tbl-users',
          name: 'id',
          dataType: 'INT',
          comment: 'user id',
          options: ColumnOption.primaryKey | ColumnOption.notNull,
        }),
      };
      state.collections.tableEntities = {
        'tbl-users': createTable({
          id: 'tbl-users',
          name: 'users',
          comment: 'user table',
          columnIds: ['col-id'],
        }),
      };
      state.doc.tableIds = ['tbl-users'];

      return state;
    }

    it.each([
      Database.PostgreSQL,
      Database.Oracle,
      Database.MySQL,
      Database.MSSQL,
    ])(
      'keeps the comments of a %s export when the SQL is imported back',
      database => {
        const schema = parse(createSchemaSQL(commentedState(), database));
        const users = tableByName(schema, 'users');

        expect(users.comment).toBe('user table');
        expect(columnByName(schema, users, 'id').comment).toBe('user id');
      }
    );

    // With no quotes CREATE TABLE sales.users reads back as users, and the
    // comment calls name schema sales and table users; quoted, both keep the
    // whole name, one table in dbo.
    it.each<[string, number, string, string]>([
      [
        'no quotes',
        BracketType.none,
        'users',
        "'schema', 'sales', 'table', 'users'",
      ],
      [
        'double quotes',
        BracketType.doubleQuote,
        'sales.users',
        "'schema', 'dbo', 'table', 'sales.users'",
      ],
    ])(
      'keeps the comments of a MSSQL export of a dotted table name with %s',
      (_, bracketType, name, level) => {
        const state = commentedState();
        state.settings.bracketType = bracketType;
        state.collections.tableEntities['tbl-users'].name = 'sales.users';

        const sql = createSchemaSQL(state, Database.MSSQL);
        const schema = parse(sql);
        const users = tableByName(schema, name);

        expect(sql).toContain(`'user table', ${level}\n`);
        expect(sql).toContain(`'user id', ${level}, 'column', 'id'\n`);
        expect(users.comment).toBe('user table');
        expect(columnByName(schema, users, 'id').comment).toBe('user id');
      }
    );

    // An unquoted name's brackets, quotes and database part are SQL that names
    // the table, which reads back as its last part bare, as the calls name it,
    // a dot inside brackets or quotes included.
    it.each([
      ['[sales].[users]', 'users'],
      ['"sales"."users"', 'users'],
      ['shop.sales.users', 'users'],
      ['[shop].[sales].[users]', 'users'],
      ['[my shop].[sales].[users]', 'users'],
      ['"shop"."sales"."users"', 'users'],
      ['[my.db].sales.users', 'users'],
      ['srv.shop.sales.users', 'users'],
      ['[sales.v2].users', 'users'],
      ['"sales.v2".users', 'users'],
      ['[x.y.z]', 'x.y.z'],
      ['"x""y"', 'x"y'],
      ['[Order]', 'Order'],
    ])(
      'keeps the comments of a MSSQL export of the unquoted table name %s',
      (typed, name) => {
        const state = commentedState();
        state.collections.tableEntities['tbl-users'].name = typed;

        const schema = parse(createSchemaSQL(state, Database.MSSQL));
        const table = tableByName(schema, name);

        expect(table.comment).toBe('user table');
        expect(columnByName(schema, table, 'id').comment).toBe('user id');
      }
    );

    // Older MSSQL exports wrote an unquoted table dbo.users whole at level 1,
    // beside a CREATE TABLE dbo.users that reads back as users: its last part
    // matches, so those saved files keep their comments.
    it('keeps the comments of an older MSSQL export on an unquoted dotted table name', () => {
      const schema = parse(
        'CREATE TABLE dbo.users (id INT)\nGO\n' +
          "EXECUTE sys.sp_addextendedproperty 'MS_Description',\n" +
          "  'user table', 'user', dbo, 'table', 'dbo.users'\nGO\n" +
          "EXECUTE sys.sp_addextendedproperty 'MS_Description',\n" +
          "  'user id', 'user', dbo, 'table', 'dbo.users', 'column', 'id'\nGO\n",
        undefined,
        Database.MSSQL
      );
      const users = tableByName(schema, 'users');

      expect(users.comment).toBe('user table');
      expect(columnByName(schema, users, 'id').comment).toBe('user id');
    });

    it('keeps the columns of a SQLite export, whose comments are plain -- lines', () => {
      const schema = parse(createSchemaSQL(commentedState(), Database.SQLite));
      const users = tableByName(schema, 'users');

      expect(columnsOf(schema, users).map(column => column.name)).toEqual([
        'id',
      ]);
    });

    // A dump doubles the quote inside a comment, or MySQL's escapes it with a
    // backslash, and the import keeps one; the export has to double it again
    // or the comment ends early. Databricks' exporter spec pins its own form.
    it.each<[string, number, string]>([
      [
        'MySQL',
        Database.MySQL,
        "CREATE TABLE t (a INT COMMENT 'it''s', b INT) COMMENT 'o''k';",
      ],
      [
        'backslashed MySQL',
        Database.MySQL,
        "CREATE TABLE t (a INT COMMENT 'it\\'s', b INT) COMMENT 'o\\'k';",
      ],
      [
        'MariaDB',
        Database.MariaDB,
        "CREATE TABLE t (a INT COMMENT 'it''s', b INT) COMMENT 'o''k';",
      ],
      [
        'PostgreSQL',
        Database.PostgreSQL,
        "CREATE TABLE t (a INT, b INT); COMMENT ON TABLE t IS 'o''k'; COMMENT ON COLUMN t.a IS 'it''s';",
      ],
      [
        'Oracle',
        Database.Oracle,
        "CREATE TABLE t (a INT, b INT); COMMENT ON TABLE t IS 'o''k'; COMMENT ON COLUMN t.a IS 'it''s';",
      ],
      [
        'Snowflake',
        Database.Snowflake,
        "CREATE TABLE t (a INT COMMENT 'it''s', b INT) COMMENT = 'o''k';",
      ],
      [
        'MSSQL',
        Database.MSSQL,
        'CREATE TABLE t (a INT, b INT)\nGO\n' +
          "EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'o''k', @level0type=N'SCHEMA', @level0name=N'dbo', @level1type=N'TABLE', @level1name=N't'\nGO\n" +
          "EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'it''s', @level0type=N'SCHEMA', @level0name=N'dbo', @level1type=N'TABLE', @level1name=N't', @level2type=N'COLUMN', @level2name=N'a'\nGO",
      ],
    ])(
      'keeps a quote in a %s comment through its export',
      (_, database, sql) => {
        const imported = parse(sql);
        const exported = createSchemaSQL(stateOf(imported), database);

        expect(commentsOf(imported)).toEqual(["o'k", "it's", '']);
        expect(exported).toContain("'it''s'");
        expect(exported).toContain("'o''k'");
        expect(commentsOf(parse(exported))).toEqual(["o'k", "it's", '']);
      }
    );

    // SQL Server's export writes every comment as an sp_addextendedproperty
    // call after its table's unique key ALTER, and the foreign keys after them.
    it('re-imports a MSSQL export to the comments, keys and defaults it was written from', () => {
      const state = commentedState();
      const columns = state.collections.tableColumnEntities;
      const tables = state.collections.tableEntities;

      columns['col-email'] = createColumn({
        id: 'col-email',
        tableId: 'tbl-users',
        name: 'email',
        dataType: 'VARCHAR(255)',
        default: "'a@b.c'",
        comment: "it's mail",
        options: ColumnOption.unique | ColumnOption.notNull,
      });
      columns['col-user-id'] = createColumn({
        id: 'col-user-id',
        tableId: 'tbl-posts',
        name: 'user_id',
        dataType: 'INT',
        comment: 'author',
      });
      tables['tbl-users'].columnIds.push('col-email');
      tables['tbl-posts'] = createTable({
        id: 'tbl-posts',
        name: 'posts',
        comment: 'post table',
        columnIds: ['col-user-id'],
      });
      state.collections.relationshipEntities = {
        'rel-1': createRelationship({
          id: 'rel-1',
          start: { tableId: 'tbl-users', columnIds: ['col-id'] },
          end: { tableId: 'tbl-posts', columnIds: ['col-user-id'] },
        }),
      };
      state.doc.tableIds.push('tbl-posts');
      state.doc.relationshipIds = ['rel-1'];

      const sql = createSchemaSQL(state, Database.MSSQL);
      const schema = parse(sql, undefined, Database.MSSQL);
      const users = tableByName(schema, 'users');

      expect(sql).toContain(
        "'it''s mail', 'schema', 'dbo', 'table', 'users', 'column', 'email'"
      );
      expect(commentsOf(schema)).toEqual([
        'post table',
        'author',
        'user table',
        'user id',
        "it's mail",
      ]);
      expect(uniqueColumnNamesOf(schema, users)).toEqual(['email']);
      expect(columnByName(schema, users, 'email').default).toBe("'a@b.c'");
      expect(relationshipsOf(schema)).toHaveLength(1);
      expect(createSchemaSQL(stateOf(schema), Database.MSSQL)).toBe(sql);
    });
  });

  describe('referential action round trip', () => {
    function relatedState(): RootState {
      const state = {
        ...schemaV3Parser({}),
        editor: {},
        lww: {},
      } as unknown as RootState;

      state.collections.tableColumnEntities = {
        'col-id': createColumn({
          id: 'col-id',
          tableId: 'tbl-users',
          name: 'id',
          dataType: 'INT',
          options: ColumnOption.primaryKey | ColumnOption.notNull,
        }),
        'col-user-id': createColumn({
          id: 'col-user-id',
          tableId: 'tbl-posts',
          name: 'user_id',
          dataType: 'INT',
        }),
      };
      state.collections.tableEntities = {
        'tbl-users': createTable({
          id: 'tbl-users',
          name: 'users',
          columnIds: ['col-id'],
        }),
        'tbl-posts': createTable({
          id: 'tbl-posts',
          name: 'posts',
          columnIds: ['col-user-id'],
        }),
      };
      state.collections.relationshipEntities = {
        'rel-1': createRelationship({
          id: 'rel-1',
          onDelete: ReferentialAction.cascade,
          onUpdate: ReferentialAction.setNull,
          start: { tableId: 'tbl-users', columnIds: ['col-id'] },
          end: { tableId: 'tbl-posts', columnIds: ['col-user-id'] },
        }),
      };
      state.doc.tableIds = ['tbl-users', 'tbl-posts'];
      state.doc.relationshipIds = ['rel-1'];

      return state;
    }

    it.each([
      Database.PostgreSQL,
      Database.MySQL,
      Database.MariaDB,
      Database.MSSQL,
      Database.SQLite,
    ])(
      'keeps the actions of a %s export when the SQL is imported back',
      database => {
        const [relationship] = relationshipsOf(
          parse(createSchemaSQL(relatedState(), database))
        );

        expect(relationship.onDelete).toBe(ReferentialAction.cascade);
        expect(relationship.onUpdate).toBe(ReferentialAction.setNull);
      }
    );

    it('keeps NO ACTION, the one action a Snowflake export writes, when the SQL is imported back', () => {
      const state = relatedState();
      Object.assign(state.collections.relationshipEntities['rel-1'], {
        onDelete: ReferentialAction.noAction,
        onUpdate: ReferentialAction.noAction,
      });

      const [relationship] = relationshipsOf(
        parse(createSchemaSQL(state, Database.Snowflake))
      );

      expect(relationship.onDelete).toBe(ReferentialAction.noAction);
      expect(relationship.onUpdate).toBe(ReferentialAction.noAction);
    });
  });

  describe('default round trip', () => {
    const defaults = {
      status: "'PENDING'",
      note: "''",
      created_at: "'0000-00-00 00:00:00'",
    };

    function defaultedState(): RootState {
      const state = {
        ...schemaV3Parser({}),
        editor: {},
        lww: {},
      } as unknown as RootState;
      const columns = Object.entries(defaults).map(([name, value]) =>
        createColumn({
          id: `col-${name}`,
          tableId: 'tbl-orders',
          name,
          dataType: name === 'created_at' ? 'DATETIME' : 'VARCHAR(20)',
          default: value,
          options: ColumnOption.notNull,
        })
      );

      state.collections.tableColumnEntities = Object.fromEntries(
        columns.map(column => [column.id, column])
      );
      state.collections.tableEntities = {
        'tbl-orders': createTable({
          id: 'tbl-orders',
          name: 'orders',
          columnIds: columns.map(column => column.id),
        }),
      };
      state.doc.tableIds = ['tbl-orders'];

      return state;
    }

    it.each([
      Database.MySQL,
      Database.MariaDB,
      Database.PostgreSQL,
      Database.MSSQL,
      Database.Oracle,
      Database.SQLite,
      Database.Databricks,
      Database.Snowflake,
    ])(
      'keeps the string literal defaults of a %s export when the SQL is imported back',
      database => {
        const sql = createSchemaSQL(defaultedState(), database);
        const schema = parse(sql);
        const orders = tableByName(schema, 'orders');

        expect(sql).toContain("DEFAULT 'PENDING'");
        expect(sql).toContain("DEFAULT ''");
        expect(sql).toContain("DEFAULT '0000-00-00 00:00:00'");
        expect(
          Object.fromEntries(
            columnsOf(schema, orders).map(column => [
              column.name,
              column.default,
            ])
          )
        ).toEqual(defaults);
      }
    );
  });

  // The importer keeps a whole DEFAULT expression without the parentheses
  // around it, and an export puts them back where its database needs them.
  describe('expression default round trip', () => {
    const defaultsOf = (schema: Schema) =>
      Object.fromEntries(
        tablesOf(schema).flatMap(table =>
          columnsOf(schema, table).map(column => [column.name, column.default])
        )
      );

    it.each<[string, number, string, Record<string, string>, string[]]>([
      [
        'pg_dump',
        Database.PostgreSQL,
        `CREATE TABLE public.orders (
    id integer DEFAULT nextval('public.orders_id_seq'::regclass) NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
    tags text[] DEFAULT ARRAY[]::text[],
    ratio numeric(3,2) DEFAULT 0.5,
    picked boolean DEFAULT ('x'::text = ANY (ARRAY['a'::text, 'x'::text])),
    level integer DEFAULT CASE WHEN (1 >= 0) THEN 1 ELSE 0 END,
    fallback text DEFAULT CASE WHEN (now() IS NULL) THEN 'a'::text ELSE NULL::text END NOT NULL,
    flag bit(1) DEFAULT B'0'::"bit",
    placed_at timestamp with time zone DEFAULT ('now'::text)::timestamp with time zone NOT NULL
);`,
        {
          id: '',
          status: "'draft'",
          created_at: "now() AT TIME ZONE 'utc'::text",
          tags: 'ARRAY[]::text[]',
          ratio: '0.5',
          picked: "'x'::text = ANY(ARRAY['a'::text, 'x'::text])",
          level: 'CASE WHEN(1 >= 0) THEN 1 ELSE 0 END',
          fallback:
            "CASE WHEN(now() IS NULL) THEN 'a'::text ELSE NULL::text END",
          flag: "B'0'",
          placed_at: "('now'::text)::timestamp with time zone",
        },
        [
          'GENERATED ALWAYS AS IDENTITY',
          "DEFAULT (now() AT TIME ZONE 'utc'::text)",
          'DEFAULT ARRAY[]::text[]',
          "DEFAULT ('x'::text = ANY(ARRAY['a'::text, 'x'::text]))",
          'DEFAULT CASE WHEN(1 >= 0) THEN 1 ELSE 0 END',
          "DEFAULT CASE WHEN(now() IS NULL) THEN 'a'::text ELSE NULL::text END",
          "DEFAULT B'0'",
          "DEFAULT ('now'::text)::timestamp with time zone",
        ],
      ],
      [
        'SQL Server',
        Database.MSSQL,
        `CREATE TABLE [dbo].[Users](
	[Id] [uniqueidentifier] NOT NULL DEFAULT (newid()),
	[Active] [bit] NOT NULL DEFAULT ((0)),
	[Created] [datetime2](7) NOT NULL DEFAULT (getdate()),
	[Label] [nvarchar](20) NULL DEFAULT (N'(none)'),
	[Next] [int] NULL DEFAULT (NEXT VALUE FOR [dbo].[seq]),
	[Title] [nvarchar](40) NULL DEFAULT (N'a'+N' (b)')
) ON [PRIMARY]
GO`,
        {
          Id: 'newid()',
          Active: '0',
          Created: 'getdate()',
          Label: "N'(none)'",
          Next: 'NEXT VALUE FOR [dbo].[seq]',
          Title: "N'a' + N' (b)'",
        },
        [
          'DEFAULT newid()',
          'DEFAULT 0',
          'DEFAULT getdate()',
          "DEFAULT N'(none)'",
          'DEFAULT NEXT VALUE FOR [dbo].[seq]',
          "DEFAULT N'a' + N' (b)'",
        ],
      ],
      [
        'mysqldump',
        Database.MySQL,
        `CREATE TABLE \`events\` (
  \`id\` binary(16) NOT NULL DEFAULT (uuid_to_bin(uuid())),
  \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  \`expires_at\` datetime DEFAULT ((now() + interval 1 day)),
  \`price\` decimal(5,2) NOT NULL DEFAULT '4.99',
  \`label\` varchar(20) DEFAULT (concat(_utf8mb4'a',_utf8mb4'b')),
  \`flag\` bit(1) DEFAULT b'0',
  \`notes\` text DEFAULT (_utf8mb4''),
  \`meta\` json DEFAULT (_utf8mb4'{}'),
  \`seen_on\` date DEFAULT (now())
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
        {
          id: 'uuid_to_bin(uuid())',
          updated_at: 'CURRENT_TIMESTAMP',
          expires_at: 'now() + interval 1 day',
          price: "'4.99'",
          label: "concat(_utf8mb4'a', _utf8mb4'b')",
          flag: "b'0'",
          notes: "_utf8mb4''",
          meta: "_utf8mb4'{}'",
          seen_on: 'now()',
        },
        [
          'DEFAULT (uuid_to_bin(uuid()))',
          'DEFAULT CURRENT_TIMESTAMP',
          'DEFAULT (now() + interval 1 day)',
          "DEFAULT (concat(_utf8mb4'a', _utf8mb4'b'))",
          "DEFAULT b'0'",
          "DEFAULT (_utf8mb4'')",
          "DEFAULT (_utf8mb4'{}')",
          'DEFAULT (now())',
        ],
      ],
      [
        'MariaDB',
        Database.MariaDB,
        `CREATE TABLE \`events\` (
  \`id\` uuid NOT NULL DEFAULT uuid(),
  \`expires_at\` datetime DEFAULT (current_timestamp() + interval 1 day),
  \`note\` int(11) DEFAULT NULL WITHOUT SYSTEM VERSIONING
) WITH SYSTEM VERSIONING;`,
        {
          id: 'uuid()',
          expires_at: 'current_timestamp() + interval 1 day',
          note: 'NULL',
        },
        [
          'DEFAULT uuid()',
          'DEFAULT (current_timestamp() + interval 1 day)',
          'DEFAULT NULL',
        ],
      ],
      [
        'SQLite',
        Database.SQLite,
        `CREATE TABLE log (
  id INTEGER PRIMARY KEY,
  created TEXT DEFAULT (datetime('now')),
  stamp INTEGER DEFAULT (strftime('%s', 'now')),
  level INTEGER DEFAULT 0,
  rank INTEGER DEFAULT (CASE WHEN 1 >= 0 THEN 1 END)
);`,
        {
          id: '',
          created: "datetime('now')",
          stamp: "strftime('%s', 'now')",
          level: '0',
          rank: 'CASE WHEN 1 >= 0 THEN 1 END',
        },
        [
          "DEFAULT (datetime('now'))",
          "DEFAULT (strftime('%s', 'now'))",
          'DEFAULT 0',
          'DEFAULT (CASE WHEN 1 >= 0 THEN 1 END)',
        ],
      ],
    ])(
      'keeps the defaults of %s DDL through its export',
      (_, database, sql, defaults, snippets) => {
        const imported = parse(sql, undefined, database);
        const exported = createSchemaSQL(stateOf(imported), database);
        const again = parse(exported, undefined, database);

        expect(defaultsOf(imported)).toEqual(defaults);
        for (const snippet of snippets) {
          expect(exported).toContain(snippet);
        }
        expect(defaultsOf(again)).toEqual(defaults);
        expect(createSchemaSQL(stateOf(again), database)).toBe(exported);
      }
    );

    it('reads GENERATED BY DEFAULT AS IDENTITY as an auto increment column', () => {
      const schema = parse(
        'CREATE TABLE t (id integer GENERATED BY DEFAULT AS IDENTITY NOT NULL, n integer);'
      );
      const [id] = columnsOf(schema, tableByName(schema, 't'));

      expect(id.default).toBe('');
      expect(bHas(id.options, ColumnOption.autoIncrement)).toBe(true);
    });
  });

  describe('unique round trip', () => {
    type IndexSpec = [string, boolean, Array<[string, number]>];

    /**
     * One table with every shape of uniqueness the editor exports: a column
     * flag, a composite unique index, a single-column unique index and a
     * plain index beside them.
     */
    function uniqueState(
      indexes: IndexSpec[] = [
        [
          'uq_code_name',
          true,
          [
            ['code', OrderType.ASC],
            ['name', OrderType.DESC],
          ],
        ],
        ['idx_tenant', false, [['tenant', OrderType.ASC]]],
        ['uq_tenant', true, [['tenant', OrderType.ASC]]],
      ]
    ): RootState {
      const state = {
        ...schemaV3Parser({}),
        editor: {},
        lww: {},
      } as unknown as RootState;
      const columns = [
        ['id', ColumnOption.primaryKey | ColumnOption.notNull],
        ['email', ColumnOption.unique | ColumnOption.notNull],
        ['code', ColumnOption.notNull],
        ['name', ColumnOption.notNull],
        ['tenant', 0],
      ].map(([name, options]) =>
        createColumn({
          id: `col-${name}`,
          tableId: 'tbl-region',
          name: name as string,
          dataType: 'INT',
          options: options as number,
        })
      );
      state.collections.tableColumnEntities = Object.fromEntries(
        columns.map(column => [column.id, column])
      );
      state.collections.tableEntities = {
        'tbl-region': createTable({
          id: 'tbl-region',
          name: 'region',
          columnIds: columns.map(column => column.id),
        }),
      };
      state.doc.tableIds = ['tbl-region'];

      for (const [name, unique, parts] of indexes) {
        const index = createIndex({
          id: `idx-${name}`,
          name,
          tableId: 'tbl-region',
          unique,
        });

        for (const [columnName, orderType] of parts) {
          const indexColumn = createIndexColumn({
            id: `${index.id}-${columnName}`,
            indexId: index.id,
            columnId: `col-${columnName}`,
            orderType,
          });
          index.indexColumnIds.push(indexColumn.id);
          index.seqIndexColumnIds.push(indexColumn.id);
          state.collections.indexColumnEntities[indexColumn.id] = indexColumn;
        }

        state.collections.indexEntities[index.id] = index;
        state.doc.indexIds.push(index.id);
      }

      return state;
    }

    const toState = (schema: Schema) =>
      ({ ...schema, editor: {}, lww: {} }) as unknown as RootState;

    it.each([
      Database.MySQL,
      Database.MariaDB,
      Database.MSSQL,
      Database.Oracle,
      Database.PostgreSQL,
      Database.SQLite,
    ])('re-imports a %s export to the model it was written from', database => {
      const sql = createSchemaSQL(uniqueState(), database);
      const schema = parse(sql);

      expect(
        uniqueColumnNamesOf(schema, tableByName(schema, 'region'))
      ).toEqual(['email']);
      expect(indexShapesOf(schema)).toEqual([
        {
          name: 'uq_code_name',
          unique: true,
          columns: ['code ASC', 'name DESC'],
        },
        { name: 'idx_tenant', unique: false, columns: ['tenant ASC'] },
        { name: 'uq_tenant', unique: true, columns: ['tenant ASC'] },
      ]);
      expect(createSchemaSQL(toState(schema), database)).toBe(sql);
    });

    // The keys the export writes inline carry no name and no USING INDEX, so
    // an index over their columns is no index Oracle exported for them.
    it.each([
      Database.MySQL,
      Database.MariaDB,
      Database.MSSQL,
      Database.Oracle,
      Database.PostgreSQL,
      Database.SQLite,
    ])(
      "keeps a %s export's index over the primary key or a unique column",
      database => {
        const sql = createSchemaSQL(
          uniqueState([
            ['idx_id', false, [['id', OrderType.ASC]]],
            ['uq_email', true, [['email', OrderType.DESC]]],
          ]),
          database
        );
        const schema = parse(sql);

        expect(indexShapesOf(schema)).toEqual([
          { name: 'idx_id', unique: false, columns: ['id ASC'] },
          { name: 'uq_email', unique: true, columns: ['email DESC'] },
        ]);
        expect(createSchemaSQL(toState(schema), database)).toBe(sql);
      }
    );

    it('re-imports the composite UNIQUE a Snowflake export writes as one unique index', () => {
      const sql = createSchemaSQL(uniqueState(), Database.Snowflake);
      const schema = parse(sql);

      expect(sql).toContain('ADD CONSTRAINT uq_code_name UNIQUE (code, name);');
      // Snowflake has no secondary index, so the plain one is a comment, and
      // a unique one over one column is the same constraint as its UQ flag.
      expect(
        uniqueColumnNamesOf(schema, tableByName(schema, 'region'))
      ).toEqual(['email', 'tenant']);
      expect(indexShapesOf(schema)).toEqual([
        {
          name: 'uq_code_name',
          unique: true,
          columns: ['code ASC', 'name ASC'],
        },
      ]);

      const again = parse(createSchemaSQL(toState(schema), Database.Snowflake));

      expect(indexShapesOf(again)).toEqual(indexShapesOf(schema));
      expect(uniqueColumnNamesOf(again, tableByName(again, 'region'))).toEqual([
        'email',
        'tenant',
      ]);
    });

    it('re-imports a Databricks export, which declares no uniqueness, with no index', () => {
      const schema = parse(createSchemaSQL(uniqueState(), Database.Databricks));

      expect(
        uniqueColumnNamesOf(schema, tableByName(schema, 'region'))
      ).toEqual([]);
      expect(indexesOf(schema)).toEqual([]);
    });

    it.each([Database.MySQL, Database.PostgreSQL, Database.Snowflake])(
      'never adds an index over repeated %s round trips',
      database => {
        let schema = parse(createSchemaSQL(uniqueState(), database));
        const count = indexesOf(schema).length;

        for (let cycle = 0; cycle < 3; cycle++) {
          schema = parse(createSchemaSQL(toState(schema), database));
        }

        expect(indexesOf(schema)).toHaveLength(count);
      }
    );
  });

  // Import, export for the same vendor, import again: a type no vendor list
  // carries used to come in empty, and an ENUM without the quotes of its values.
  describe('data type round trip', () => {
    const typesOf = (schema: Schema) =>
      tablesOf(schema).flatMap(table =>
        columnsOf(schema, table).map(column => column.dataType)
      );

    it.each<[string, number, string, string[]]>([
      [
        'PostgreSQL',
        Database.PostgreSQL,
        'CREATE TABLE person (id serial, current_mood public.mood NOT NULL, zip us_postal, email citext, kind "MyType", tags mood[], grid text[][], scores integer ARRAY, flag "char", bits "bit");',
        [
          'serial',
          'public.mood',
          'us_postal',
          'citext',
          '"MyType"',
          'mood[]',
          'text[][]',
          'integer ARRAY',
          '"char"',
          '"bit"',
        ],
      ],
      [
        'MySQL',
        Database.MySQL,
        "CREATE TABLE film (rating ENUM('G','PG-13','it''s') NOT NULL, features SET('Trailers','Deleted Scenes'), mark ENUM('it\\'s','b'));",
        [
          "ENUM('G','PG-13','it''s')",
          "SET('Trailers','Deleted Scenes')",
          "ENUM('it''s','b')",
        ],
      ],
      [
        'MySQL UNSIGNED',
        Database.MySQL,
        'CREATE TABLE t (id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, code SMALLINT(5) UNSIGNED ZEROFILL, price DECIMAL(10,2) UNSIGNED, n bigint unsigned, d INT SIGNED);',
        [
          'INT UNSIGNED',
          'SMALLINT(5) UNSIGNED ZEROFILL',
          'DECIMAL(10,2) UNSIGNED',
          'bigint unsigned',
          'INT',
        ],
      ],
      [
        'MariaDB UNSIGNED',
        Database.MariaDB,
        'CREATE TABLE t (id int(10) unsigned NOT NULL AUTO_INCREMENT, f DOUBLE ZEROFILL UNSIGNED, PRIMARY KEY (id));',
        ['int(10) unsigned', 'DOUBLE ZEROFILL UNSIGNED'],
      ],
      [
        'MariaDB',
        Database.MariaDB,
        "CREATE TABLE film (rating ENUM('G','') DEFAULT 'G');",
        ["ENUM('G','')"],
      ],
      [
        'MSSQL',
        Database.MSSQL,
        'CREATE TABLE customer ([phone] [dbo].[Phone] NULL, [owner] [sysname] NOT NULL, [zip] [zip code], [status] [dbo].[Order]);',
        ['[dbo].[Phone]', '[sysname]', '[zip code]', '[dbo].[Order]'],
      ],
      [
        'Oracle',
        Database.Oracle,
        'CREATE TABLE shape (geom MDSYS.SDO_GEOMETRY, doc SYS.XMLTYPE);',
        ['MDSYS.SDO_GEOMETRY', 'SYS.XMLTYPE'],
      ],
      [
        'SQLite',
        Database.SQLite,
        'CREATE TABLE t (a UNSIGNED INTEGER, b VARYING CHARACTER(255), c UNSIGNED BIG INTEGER, d SIGNED BIG INT NOT NULL);',
        [
          'UNSIGNED INTEGER',
          'VARYING CHARACTER(255)',
          'UNSIGNED BIG INTEGER',
          'SIGNED BIG INT',
        ],
      ],
      [
        'Snowflake',
        Database.Snowflake,
        'CREATE TABLE t (profile OBJECT("city" VARCHAR, zip NUMBER));',
        ['OBJECT("city" VARCHAR,zip NUMBER)'],
      ],
      [
        'Databricks',
        Database.Databricks,
        "CREATE TABLE t (a my_catalog.my_type, b ARRAY<STRING>, c STRUCT<name: STRING COMMENT 'the name', `first name`: STRING>);",
        [
          'my_catalog.my_type',
          'ARRAY<STRING>',
          "STRUCT<name: STRING COMMENT 'the name', `first name`: STRING>",
        ],
      ],
    ])(
      'keeps the data types of a %s import through its export',
      (_, database, sql, expected) => {
        const imported = parse(sql);
        const exported = createSchemaSQL(stateOf(imported), database);

        expect(typesOf(imported)).toEqual(expected);
        expected.forEach(dataType => expect(exported).toContain(dataType));
        expect(typesOf(parse(exported))).toEqual(expected);
      }
    );

    // Trimmed from what pg_dump, mysqldump and Oracle's DBMS_METADATA wrote
    // for one table of such types: the statements around it add no table, and
    // its types and comments come back from its export.
    const pgDump = String.raw`\restrict rHceboc659NUboYi98abcJftPQutfMfMXtYVs6L50FjUjGd4smdAC3en7CNg1ih
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;
COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';
CREATE EXTENSION IF NOT EXISTS hstore WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS ltree WITH SCHEMA public;
CREATE DOMAIN public."Money Amount" AS numeric(12,2);
ALTER DOMAIN public."Money Amount" OWNER TO postgres;
CREATE TYPE public."MyType" AS (
    a integer,
    b text
);
ALTER TYPE public."MyType" OWNER TO postgres;
CREATE TYPE public.mood AS ENUM (
    'sad',
    'ok',
    'happy'
);
CREATE DOMAIN public.us_postal AS text
    CONSTRAINT us_postal_check CHECK ((VALUE ~ '^\d{5}$'::text));
CREATE TABLE public.person (
    id integer NOT NULL,
    current_mood public.mood NOT NULL,
    mood_q public.mood,
    zip public.us_postal,
    email public.citext,
    attrs public.hstore,
    path public.ltree,
    kind public."MyType",
    amount public."Money Amount",
    tags public.mood[],
    grid text[],
    scores integer[],
    fixed integer[],
    label character varying(20) DEFAULT 'it''s'::character varying,
    created timestamp with time zone,
    flag "char",
    bits "bit"
);
ALTER TABLE public.person OWNER TO postgres;
COMMENT ON TABLE public.person IS 'o''k';
COMMENT ON COLUMN public.person.id IS 'it''s the id';
CREATE SEQUENCE public.person_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.person_id_seq OWNED BY public.person.id;
ALTER TABLE ONLY public.person
    ADD CONSTRAINT person_pkey PRIMARY KEY (id);
\unrestrict rHceboc659NUboYi98abcJftPQutfMfMXtYVs6L50FjUjGd4smdAC3en7CNg1ih`;
    const mysqlDump = `/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
DROP TABLE IF EXISTS \`film\`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE \`film\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`rating\` enum('G','PG-13','it''s') NOT NULL DEFAULT 'G' COMMENT 'it''s rated',
  \`features\` set('Trailers','Deleted Scenes') DEFAULT NULL,
  \`blank\` enum('G','') DEFAULT 'G',
  \`price\` decimal(5,2) DEFAULT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='o''k';
/*!40101 SET character_set_client = @saved_cs_client */;`;
    const oracleDdl = `  CREATE TABLE "HR"."SHAPE"
   (    "ID" NUMBER(10,0) NOT NULL ENABLE,
        "DOC" "SYS"."XMLTYPE" ,
        "ADDR" "HR"."ADDRESS_T" ,
        "LABEL" VARCHAR2(20) DEFAULT 'it''s',
         CONSTRAINT "PK_SHAPE" PRIMARY KEY ("ID")
  USING INDEX  ENABLE
   ) ;

   COMMENT ON COLUMN "HR"."SHAPE"."ID" IS 'it''s the id';
   COMMENT ON TABLE "HR"."SHAPE"  IS 'o''k';`;

    it.each<[string, number, string, string[], string[]]>([
      [
        'pg_dump',
        Database.PostgreSQL,
        pgDump,
        [
          'integer',
          'public.mood',
          'public.mood',
          'public.us_postal',
          'public.citext',
          'public.hstore',
          'public.ltree',
          'public."MyType"',
          'public."Money Amount"',
          'public.mood[]',
          'text[]',
          'integer[]',
          'integer[]',
          'character varying(20)',
          'timestamp with time zone',
          '"char"',
          '"bit"',
        ],
        ["o'k", "it's the id", ...Array(16).fill('')],
      ],
      [
        'mysqldump',
        Database.MySQL,
        mysqlDump,
        [
          'int',
          "enum('G','PG-13','it''s')",
          "set('Trailers','Deleted Scenes')",
          "enum('G','')",
          'decimal(5,2)',
        ],
        ["o'k", '', "it's rated", '', '', ''],
      ],
      [
        'DBMS_METADATA',
        Database.Oracle,
        oracleDdl,
        ['NUMBER(10,0)', '"SYS"."XMLTYPE"', '"HR"."ADDRESS_T"', 'VARCHAR2(20)'],
        ["o'k", "it's the id", '', '', ''],
      ],
    ])(
      'keeps the types and comments of what %s wrote through its export',
      (_, database, sql, types, comments) => {
        const imported = parse(sql);
        const exported = parse(createSchemaSQL(stateOf(imported), database));

        expect(tablesOf(imported)).toHaveLength(1);
        expect(typesOf(imported)).toEqual(types);
        expect(commentsOf(imported)).toEqual(comments);
        expect(tablesOf(exported)).toHaveLength(1);
        expect(typesOf(exported)).toEqual(types);
        expect(commentsOf(exported)).toEqual(comments);
      }
    );
  });

  // A Databricks document reads its literals by Spark's escapes and writes a
  // default and a field comment back in them, so its export imports back the
  // same; under the guess a backslash doubled on every pass.
  describe('Databricks literal round trip', () => {
    const sql = String.raw`CREATE TABLE t (
      a STRUCT<y: STRING COMMENT 'it\'s', z: STRING COMMENT 'C:\\x'> COMMENT 'C:\\dir it\'s',
      b STRING DEFAULT 'it\'s' COMMENT 'a\\\'b',
      c STRING DEFAULT 'C:\\'
    ) COMMENT 'o\'k \\';`;
    const struct = String.raw`STRUCT<y: STRING COMMENT 'it\'s', z: STRING COMMENT 'C:\\x'>`;

    const fieldsOf = (schema: Schema) =>
      columnsOf(schema, tablesOf(schema)[0]).map(column => [
        column.name,
        column.dataType,
        column.default,
        column.comment,
      ]);

    it('keeps the quotes and backslashes through each export', () => {
      const first = parse(sql, undefined, Database.Databricks);
      const exported = createSchemaSQL(stateOf(first), Database.Databricks);
      const second = parse(exported, undefined, Database.Databricks);

      expect(tablesOf(first)[0].comment).toBe("o'k \\");
      expect(fieldsOf(first)).toEqual([
        ['a', struct, '', "C:\\dir it's"],
        ['b', 'STRING', String.raw`'it\'s'`, "a\\'b"],
        ['c', 'STRING', String.raw`'C:\\'`, ''],
      ]);
      expect(exported).toContain(struct);
      expect(exported).toContain(String.raw`DEFAULT 'it\'s'`);
      expect(exported).toContain(String.raw`COMMENT 'C:\\dir it\'s'`);
      expect(exported).toContain(String.raw`COMMENT 'o\'k \\';`);
      expect(tablesOf(second)[0].comment).toBe("o'k \\");
      expect(fieldsOf(second)).toEqual(fieldsOf(first));
      expect(createSchemaSQL(stateOf(second), Database.Databricks)).toBe(
        exported
      );
    });

    it('reads the same SQL by the guess in a document of another vendor', () => {
      expect(commentsOf(parse(sql, undefined, Database.MySQL))).toEqual([
        "o'k \\\\",
        "C:\\\\dir it's",
        "a\\\\'b",
        '',
      ]);
      expect(commentsOf(parse(sql))).toEqual(
        commentsOf(parse(sql, undefined, Database.MySQL))
      );
    });
  });
});
