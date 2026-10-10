import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  BracketType,
  ColumnOption,
  ColumnUIKey,
  Database,
  NameCase,
  RelationshipType,
} from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Column, Relationship, Table } from '@/internal-types';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createCode, formatTable } from '@/utils/generator-code/jpa';

type StateInput = {
  tables?: Table[];
  columns?: Column[];
  relationships?: Relationship[];
  settings?: Partial<RootState['settings']>;
};

function createState({
  tables = [],
  columns = [],
  relationships = [],
  settings,
}: StateInput): RootState {
  const state = schemaV3Parser({}) as unknown as RootState;
  state.doc.tableIds = tables.map(table => table.id);
  state.doc.relationshipIds = relationships.map(
    relationship => relationship.id
  );
  tables.forEach(table => {
    state.collections.tableEntities[table.id] = table;
  });
  columns.forEach(column => {
    state.collections.tableColumnEntities[column.id] = column;
  });
  relationships.forEach(relationship => {
    state.collections.relationshipEntities[relationship.id] = relationship;
  });
  Object.assign(state.settings, settings);
  return state;
}

function render(state: RootState, table: Table): string[] {
  const buffer: string[] = [];
  formatTable(state, { buffer, table });
  return buffer;
}

/** The lines one column writes on a database, as a NOT NULL or a nullable column. */
function renderField(
  database: number,
  dataType: string,
  options: number = ColumnOption.notNull
): string[] {
  const table = createTable({ id: 't', name: 'T', columnIds: ['c'] });
  const state = createState({
    tables: [table],
    columns: [
      createColumn({ id: 'c', tableId: 't', name: 'v', dataType, options }),
    ],
    settings: { database },
  });

  return render(state, table).slice(3, -1);
}

/**
 * users (1) to (N) user_post (N) to (1) posts, where user_post has a
 * three-column composite primary key, two of whose columns are also foreign
 * keys.
 */
function createJoinFixture() {
  const users = createTable({
    id: 't_users',
    name: 'users',
    comment: 'user table',
    columnIds: ['users_id'],
  });
  const posts = createTable({
    id: 't_posts',
    name: 'posts',
    columnIds: ['posts_id'],
  });
  const userPost = createTable({
    id: 't_up',
    name: 'user_post',
    comment: 'join table',
    columnIds: ['up_user_id', 'up_post_id', 'up_seq'],
  });

  const columns = [
    createColumn({
      id: 'users_id',
      tableId: 't_users',
      name: 'id',
      dataType: 'INT',
      options: ColumnOption.primaryKey | ColumnOption.autoIncrement,
      ui: { keys: ColumnUIKey.primaryKey },
    }),
    createColumn({
      id: 'posts_id',
      tableId: 't_posts',
      name: 'id',
      dataType: 'INT',
      options: ColumnOption.primaryKey,
      ui: { keys: ColumnUIKey.primaryKey },
    }),
    createColumn({
      id: 'up_user_id',
      tableId: 't_up',
      name: 'user_id',
      dataType: 'INT',
      options: ColumnOption.primaryKey,
      ui: { keys: ColumnUIKey.primaryKey | ColumnUIKey.foreignKey },
    }),
    createColumn({
      id: 'up_post_id',
      tableId: 't_up',
      name: 'post_id',
      dataType: 'INT',
      options: ColumnOption.primaryKey,
      ui: { keys: ColumnUIKey.primaryKey | ColumnUIKey.foreignKey },
    }),
    createColumn({
      id: 'up_seq',
      tableId: 't_up',
      name: 'seq',
      dataType: 'INT',
      options: ColumnOption.primaryKey,
      ui: { keys: ColumnUIKey.primaryKey },
    }),
  ];

  const relationships = [
    createRelationship({
      id: 'r1',
      relationshipType: RelationshipType.ZeroN,
      start: { tableId: 't_users', columnIds: ['users_id'] },
      end: { tableId: 't_up', columnIds: ['up_user_id'] },
    }),
    createRelationship({
      id: 'r2',
      relationshipType: RelationshipType.ZeroOne,
      start: { tableId: 't_posts', columnIds: ['posts_id'] },
      end: { tableId: 't_up', columnIds: ['up_post_id'] },
    }),
  ];

  const state = createState({
    tables: [users, posts, userPost],
    columns,
    relationships,
  });

  return { state, users, posts, userPost };
}

describe('generator-code/jpa', () => {
  describe('formatTable — composite primary key', () => {
    it('emits an @IdClass holder plus the owning-side associations', () => {
      const { state, userPost } = createJoinFixture();

      expect(render(state, userPost)).toEqual([
        '@Data',
        'public class UserPostId implements Serializable {',
        '  private Integer seq;',
        '  private Users users;',
        '  private Posts posts;',
        '}',
        '// join table',
        '@Data',
        '@Entity',
        '@Table(name = "user_post")',
        '@IdClass(UserPostId.class)',
        'public class UserPost {',
        '  @Id',
        '  private Integer seq;',
        '  // user table',
        '  @Id',
        '  @ManyToOne',
        '  @JoinColumn(name = "user_id")',
        '  private Users users;',
        '  @Id',
        '  @OneToOne',
        '  @JoinColumn(name = "post_id")',
        '  private Posts posts;',
        '}',
      ]);
    });

    it('deduplicates parent tables, ignores unmatched foreign keys and groups multi-column joins', () => {
      const src = createTable({
        id: 't_src',
        name: 'src',
        columnIds: ['s1'],
      });
      const multi = createTable({
        id: 't_multi',
        name: 'multi',
        columnIds: ['m1', 'm2', 'm3', 'm4'],
      });
      const pkFk = ColumnUIKey.primaryKey | ColumnUIKey.foreignKey;
      const state = createState({
        tables: [src, multi],
        columns: [
          createColumn({
            id: 's1',
            tableId: 't_src',
            name: 'id',
            dataType: 'INT',
            options: ColumnOption.primaryKey,
            ui: { keys: ColumnUIKey.primaryKey },
          }),
          createColumn({
            id: 'm1',
            tableId: 't_multi',
            name: 'a',
            dataType: 'INT',
            options: ColumnOption.primaryKey,
            ui: { keys: pkFk },
          }),
          createColumn({
            id: 'm2',
            tableId: 't_multi',
            name: 'b',
            dataType: 'INT',
            options: ColumnOption.primaryKey,
            ui: { keys: pkFk },
          }),
          createColumn({
            id: 'm3',
            tableId: 't_multi',
            name: 'c',
            dataType: 'INT',
            options: ColumnOption.primaryKey,
            ui: { keys: ColumnUIKey.primaryKey },
          }),
          // primary + foreign key, but no relationship references it
          createColumn({
            id: 'm4',
            tableId: 't_multi',
            name: 'd',
            dataType: 'INT',
            options: ColumnOption.primaryKey,
            ui: { keys: pkFk },
          }),
        ],
        relationships: [
          createRelationship({
            id: 'rx',
            relationshipType: RelationshipType.OneOnly,
            start: { tableId: 't_src', columnIds: ['s1'] },
            end: { tableId: 't_multi', columnIds: ['m1', 'm2'] },
          }),
        ],
      });

      expect(render(state, multi)).toEqual([
        '@Data',
        'public class MultiId implements Serializable {',
        '  private Integer c;',
        '  private Src src;',
        '}',
        '@Data',
        '@Entity',
        '@Table(name = "multi")',
        '@IdClass(MultiId.class)',
        'public class Multi {',
        '  @Id',
        '  private Integer c;',
        '  @Id',
        '  @OneToOne',
        '  @JoinColumns(value = {',
        '    @JoinColumn(name = "a"),',
        '    @JoinColumn(name = "b")',
        '  })',
        '  private Src src;',
        '}',
      ]);
    });
  });

  describe('formatTable — inverse side', () => {
    it('emits @OneToMany with a List for an N relationship', () => {
      const { state, users } = createJoinFixture();

      expect(render(state, users)).toEqual([
        '// user table',
        '@Data',
        '@Entity',
        '@Table(name = "users")',
        'public class Users {',
        '  @Id',
        '  @GeneratedValue(strategy = GenerationType.IDENTITY)',
        '  private Integer id;',
        '  // join table',
        '  @OneToMany(mappedBy = "users")',
        '  private List<UserPost> userPostList = new ArrayList<>();',
        '}',
      ]);
    });

    it('emits @OneToOne with mappedBy for a one relationship', () => {
      const { state, posts } = createJoinFixture();

      expect(render(state, posts)).toEqual([
        '@Data',
        '@Entity',
        '@Table(name = "posts")',
        'public class Posts {',
        '  @Id',
        '  private Integer id;',
        '  // join table',
        '  @OneToOne(mappedBy = "posts")',
        '  private UserPost userPost;',
        '}',
      ]);
    });

    it('emits nothing for the inverse side when the relationship type is neither one nor N', () => {
      const parent = createTable({ id: 'p', name: 'parent' });
      const child = createTable({ id: 'c', name: 'child' });
      const state = createState({
        tables: [parent, child],
        relationships: [
          createRelationship({
            id: 'r',
            relationshipType: 0,
            start: { tableId: 'p', columnIds: [] },
            end: { tableId: 'c', columnIds: [] },
          }),
        ],
      });

      expect(render(state, parent)).toEqual([
        '@Data',
        '@Entity',
        '@Table(name = "parent")',
        'public class Parent {',
        '}',
      ]);
    });

    it('skips the inverse side when the end table is missing', () => {
      const parent = createTable({ id: 'p', name: 'parent' });
      const state = createState({
        tables: [parent],
        relationships: [
          createRelationship({
            id: 'r',
            relationshipType: RelationshipType.OneN,
            start: { tableId: 'p', columnIds: [] },
            end: { tableId: 'gone', columnIds: [] },
          }),
        ],
      });

      expect(render(state, parent)).toEqual([
        '@Data',
        '@Entity',
        '@Table(name = "parent")',
        'public class Parent {',
        '}',
      ]);
    });
  });

  describe('formatTable — owning side edge cases', () => {
    it('skips the association when the start table or the end columns cannot be resolved', () => {
      const child = createTable({ id: 'c', name: 'child' });
      const orphan = createTable({ id: 'o', name: 'orphan' });
      const state = createState({
        tables: [child, orphan],
        relationships: [
          createRelationship({
            id: 'r_no_table',
            relationshipType: RelationshipType.OneN,
            start: { tableId: 'gone', columnIds: [] },
            end: { tableId: 'c', columnIds: ['x'] },
          }),
          createRelationship({
            id: 'r_no_columns',
            relationshipType: RelationshipType.OneN,
            start: { tableId: 'o', columnIds: [] },
            end: { tableId: 'c', columnIds: ['missing'] },
          }),
        ],
      });

      expect(render(state, child)).toEqual([
        '@Data',
        '@Entity',
        '@Table(name = "child")',
        'public class Child {',
        '}',
      ]);
    });

    it('omits @Id and the cardinality annotation for a non-primary-key foreign key of unknown type', () => {
      const parent = createTable({ id: 'p', name: 'parent' });
      const child = createTable({ id: 'c', name: 'child', columnIds: ['fk'] });
      const state = createState({
        tables: [parent, child],
        columns: [
          createColumn({
            id: 'fk',
            tableId: 'c',
            name: 'parentId',
            dataType: 'INT',
            options: 0,
            ui: { keys: ColumnUIKey.foreignKey },
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r',
            relationshipType: 0,
            start: { tableId: 'p', columnIds: [] },
            end: { tableId: 'c', columnIds: ['fk'] },
          }),
        ],
      });

      expect(render(state, child)).toEqual([
        '@Data',
        '@Entity',
        '@Table(name = "child")',
        'public class Child {',
        '  @JoinColumn(name = "parentId")',
        '  private Parent parent;',
        '}',
      ]);
    });
  });

  describe('formatTable — column annotations', () => {
    it('renders comments and @Column(nullable = false), and no @Lob on a MySQL TEXT', () => {
      const table = createTable({
        id: 't1',
        name: 'article',
        columnIds: ['c1', 'c2', 'c3'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'title',
            dataType: 'VARCHAR(200)',
            comment: 'the title',
            options: ColumnOption.notNull,
          }),
          createColumn({
            id: 'c2',
            tableId: 't1',
            name: 'body',
            dataType: 'TEXT',
          }),
          createColumn({
            id: 'c3',
            tableId: 't1',
            name: 'view_count',
            dataType: 'BIGINT',
            comment: '   ',
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table)).toEqual([
        '@Data',
        '@Entity',
        '@Table(name = "article")',
        'public class Article {',
        '  // the title',
        '  @Column(nullable = false)',
        '  private String title;',
        '  private String body;',
        '  @Column(name = "view_count")',
        '  private Long viewCount;',
        '}',
      ]);
    });

    it('honours the configured name cases', () => {
      const table = createTable({
        id: 't1',
        name: 'user_table',
        columnIds: ['c1'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't1',
            name: 'userName',
            dataType: 'VARCHAR',
          }),
        ],
        settings: {
          tableNameCase: NameCase.none,
          columnNameCase: NameCase.snakeCase,
        },
      });

      expect(render(state, table)).toEqual([
        '@Data',
        '@Entity',
        'public class user_table {',
        '  @Column(name = "userName")',
        '  private String user_name;',
        '}',
      ]);
    });
  });

  describe('formatTable — column types', () => {
    const NN = '  @Column(nullable = false)';
    const cases: [string, number, string, string[]][] = [
      [
        'PostgreSQL uuid',
        Database.PostgreSQL,
        'uuid',
        [NN, '  private UUID v;'],
      ],
      [
        'PostgreSQL bytea',
        Database.PostgreSQL,
        'bytea',
        [NN, '  private byte[] v;'],
      ],
      [
        'PostgreSQL jsonb without @Lob',
        Database.PostgreSQL,
        'jsonb',
        [NN, '  private String v;'],
      ],
      [
        'PostgreSQL timestamptz',
        Database.PostgreSQL,
        'timestamptz(3)',
        [NN, '  private OffsetDateTime v;'],
      ],
      [
        'PostgreSQL timetz as a LocalTime',
        Database.PostgreSQL,
        'timetz',
        [NN, '  private LocalTime v;'],
      ],
      [
        'PostgreSQL interval',
        Database.PostgreSQL,
        'interval',
        [NN, '  private Duration v;'],
      ],
      [
        'PostgreSQL interval day to second',
        Database.PostgreSQL,
        'interval day to second(3)',
        [NN, '  private Duration v;'],
      ],
      [
        'PostgreSQL interval year to month',
        Database.PostgreSQL,
        'interval year to month',
        [NN, '  private String v;'],
      ],
      [
        'PostgreSQL money',
        Database.PostgreSQL,
        'money',
        [
          '  @Column(nullable = false, columnDefinition = "money")',
          '  private BigDecimal v;',
        ],
      ],
      [
        'PostgreSQL smallint',
        Database.PostgreSQL,
        'smallint',
        [NN, '  private Short v;'],
      ],
      [
        'PostgreSQL smallserial',
        Database.PostgreSQL,
        'smallserial',
        [NN, '  private Short v;'],
      ],
      ['PostgreSQL oid', Database.PostgreSQL, 'oid', [NN, '  private Long v;']],
      [
        'PostgreSQL float(24)',
        Database.PostgreSQL,
        'float(24)',
        [NN, '  private Float v;'],
      ],
      [
        'PostgreSQL int[]',
        Database.PostgreSQL,
        'int[]',
        [NN, '  private Integer[] v;'],
      ],
      [
        'PostgreSQL text[][]',
        Database.PostgreSQL,
        'text[][]',
        [NN, '  private String[][] v;'],
      ],
      [
        'PostgreSQL bytea[]',
        Database.PostgreSQL,
        'bytea[]',
        [NN, '  private byte[][] v;'],
      ],
      [
        'PostgreSQL bit(8)',
        Database.PostgreSQL,
        'bit(8)',
        [NN, '  private String v;'],
      ],
      ['MySQL TINYINT', Database.MySQL, 'TINYINT', [NN, '  private Byte v;']],
      [
        'MySQL TINYINT UNSIGNED',
        Database.MySQL,
        'TINYINT(3) UNSIGNED',
        [
          '  @Column(nullable = false, columnDefinition = "TINYINT UNSIGNED")',
          '  private Short v;',
        ],
      ],
      [
        'MySQL SMALLINT UNSIGNED',
        Database.MySQL,
        'SMALLINT(5) UNSIGNED ZEROFILL',
        [
          '  @Column(nullable = false, columnDefinition = "SMALLINT UNSIGNED")',
          '  private Integer v;',
        ],
      ],
      [
        'MySQL MEDIUMINT UNSIGNED',
        Database.MySQL,
        'MEDIUMINT UNSIGNED',
        [NN, '  private Integer v;'],
      ],
      [
        'MySQL INT UNSIGNED',
        Database.MySQL,
        'INT(10) UNSIGNED',
        [
          '  @Column(nullable = false, columnDefinition = "INT UNSIGNED")',
          '  private Long v;',
        ],
      ],
      [
        'MySQL INT ZEROFILL',
        Database.MySQL,
        'INT(11) ZEROFILL',
        [
          '  @Column(nullable = false, columnDefinition = "INT UNSIGNED")',
          '  private Long v;',
        ],
      ],
      [
        'MariaDB INT ZEROFILL',
        Database.MariaDB,
        'INT(11) ZEROFILL',
        [
          '  @Column(nullable = false, columnDefinition = "INT UNSIGNED ZEROFILL")',
          '  private Long v;',
        ],
      ],
      [
        'MariaDB TINYINT UNSIGNED',
        Database.MariaDB,
        'TINYINT UNSIGNED',
        [
          '  @Column(nullable = false, columnDefinition = "TINYINT UNSIGNED")',
          '  private Short v;',
        ],
      ],
      [
        'MySQL BIGINT UNSIGNED',
        Database.MySQL,
        'BIGINT UNSIGNED',
        [NN, '  private Long v;'],
      ],
      ['MySQL SERIAL', Database.MySQL, 'SERIAL', [NN, '  private Long v;']],
      ['MySQL BIT(1)', Database.MySQL, 'BIT(1)', [NN, '  private Boolean v;']],
      ['MySQL BIT(8)', Database.MySQL, 'BIT(8)', [NN, '  private Long v;']],
      [
        'MySQL FLOAT(53)',
        Database.MySQL,
        'FLOAT(53)',
        [NN, '  private Double v;'],
      ],
      [
        'MySQL BINARY(16)',
        Database.MySQL,
        'binary(16)',
        [
          '  @Column(nullable = false, columnDefinition = "BINARY(16)")',
          '  private byte[] v;',
        ],
      ],
      [
        'MySQL BINARY',
        Database.MySQL,
        'BINARY',
        [
          '  @Column(nullable = false, columnDefinition = "BINARY")',
          '  private byte[] v;',
        ],
      ],
      [
        'MariaDB CHAR(n) BYTE',
        Database.MariaDB,
        'CHAR(16) BYTE',
        [
          '  @Column(nullable = false, columnDefinition = "BINARY(16)")',
          '  private byte[] v;',
        ],
      ],
      [
        'MySQL VARBINARY',
        Database.MySQL,
        'VARBINARY(16)',
        [NN, '  private byte[] v;'],
      ],
      [
        'MySQL BLOB without @Lob',
        Database.MySQL,
        'BLOB',
        [NN, '  private byte[] v;'],
      ],
      [
        'MySQL JSON without @Lob',
        Database.MySQL,
        'JSON',
        [NN, '  private String v;'],
      ],
      ['MySQL YEAR', Database.MySQL, 'YEAR', [NN, '  private Integer v;']],
      [
        'MySQL YEAR UNSIGNED without an integer definition',
        Database.MySQL,
        'YEAR UNSIGNED',
        [NN, '  private Integer v;'],
      ],
      [
        'MariaDB YEAR(4) ZEROFILL without an integer definition',
        Database.MariaDB,
        'YEAR(4) ZEROFILL',
        [NN, '  private Integer v;'],
      ],
      [
        'MariaDB SQL_TSI_YEAR UNSIGNED without an integer definition',
        Database.MariaDB,
        'SQL_TSI_YEAR UNSIGNED',
        [NN, '  private Integer v;'],
      ],
      ['MariaDB UUID', Database.MariaDB, 'UUID', [NN, '  private UUID v;']],
      [
        'SQL Server tinyint',
        Database.MSSQL,
        'tinyint',
        [NN, '  private Short v;'],
      ],
      ['SQL Server bit', Database.MSSQL, 'bit', [NN, '  private Boolean v;']],
      [
        'SQL Server numeric',
        Database.MSSQL,
        'numeric(10,2)',
        [NN, '  private BigDecimal v;'],
      ],
      [
        'SQL Server money',
        Database.MSSQL,
        'money',
        [NN, '  private BigDecimal v;'],
      ],
      [
        'SQL Server uniqueidentifier',
        Database.MSSQL,
        'uniqueidentifier',
        [NN, '  private UUID v;'],
      ],
      [
        'SQL Server datetimeoffset',
        Database.MSSQL,
        'datetimeoffset(7)',
        [NN, '  private OffsetDateTime v;'],
      ],
      [
        'SQL Server float(24)',
        Database.MSSQL,
        'float(24)',
        [NN, '  private Float v;'],
      ],
      [
        'SQL Server binary(16)',
        Database.MSSQL,
        'binary(16)',
        [
          '  @Column(nullable = false, columnDefinition = "BINARY(16)")',
          '  private byte[] v;',
        ],
      ],
      [
        'SQL Server varbinary(max)',
        Database.MSSQL,
        'varbinary(max)',
        [NN, '  private byte[] v;'],
      ],
      [
        'SQL Server rowversion',
        Database.MSSQL,
        'rowversion',
        [
          '  @Column(nullable = false, insertable = false, updatable = false)',
          '  private byte[] v;',
        ],
      ],
      ['Oracle NUMBER', Database.Oracle, 'NUMBER', [NN, '  private Long v;']],
      [
        'Oracle NUMBER(10,2)',
        Database.Oracle,
        'NUMBER(10,2)',
        [NN, '  private BigDecimal v;'],
      ],
      ['Oracle INTEGER', Database.Oracle, 'INTEGER', [NN, '  private Long v;']],
      ['Oracle REAL', Database.Oracle, 'REAL', [NN, '  private Double v;']],
      [
        'Oracle DATE',
        Database.Oracle,
        'DATE',
        [NN, '  private LocalDateTime v;'],
      ],
      [
        'Oracle TIMESTAMP WITH TIME ZONE',
        Database.Oracle,
        'TIMESTAMP(6) WITH TIME ZONE',
        [NN, '  private OffsetDateTime v;'],
      ],
      [
        'Oracle TIMESTAMP WITH LOCAL TIME ZONE',
        Database.Oracle,
        'TIMESTAMP(6) WITH LOCAL TIME ZONE',
        [NN, '  private LocalDateTime v;'],
      ],
      [
        'Oracle INTERVAL DAY TO SECOND',
        Database.Oracle,
        'INTERVAL DAY(2) TO SECOND(6)',
        [NN, '  private String v;'],
      ],
      ['Oracle RAW', Database.Oracle, 'RAW(16)', [NN, '  private byte[] v;']],
      [
        'Oracle BLOB with @Lob',
        Database.Oracle,
        'BLOB',
        [NN, '  @Lob', '  private byte[] v;'],
      ],
      [
        'Oracle CLOB with @Lob',
        Database.Oracle,
        'CLOB',
        [NN, '  @Lob', '  private String v;'],
      ],
      [
        'Oracle NCLOB with @Lob',
        Database.Oracle,
        'NCLOB',
        [NN, '  @Lob', '  private String v;'],
      ],
      [
        'Oracle JSON without @Lob',
        Database.Oracle,
        'JSON',
        [NN, '  private String v;'],
      ],
      ['SQLite INTEGER', Database.SQLite, 'INTEGER', [NN, '  private Long v;']],
      [
        'SQLite BLOB without @Lob',
        Database.SQLite,
        'BLOB',
        [NN, '  private byte[] v;'],
      ],
      [
        'Snowflake NUMBER(38,2)',
        Database.Snowflake,
        'NUMBER(38,2)',
        [NN, '  private BigDecimal v;'],
      ],
      [
        'Snowflake TIMESTAMP_TZ',
        Database.Snowflake,
        'TIMESTAMP_TZ',
        [NN, '  private OffsetDateTime v;'],
      ],
      [
        'Snowflake VARIANT',
        Database.Snowflake,
        'VARIANT',
        [NN, '  private String v;'],
      ],
      [
        'Databricks INTERVAL DAY TO SECOND',
        Database.Databricks,
        'INTERVAL DAY TO SECOND',
        [NN, '  private Duration v;'],
      ],
      [
        'Databricks INTERVAL YEAR TO MONTH',
        Database.Databricks,
        'INTERVAL YEAR TO MONTH',
        [NN, '  private String v;'],
      ],
      [
        'Databricks TIMESTAMP',
        Database.Databricks,
        'TIMESTAMP',
        [NN, '  private LocalDateTime v;'],
      ],
    ];

    it.each(cases)('maps %s', (_, database, dataType, expected) => {
      expect(renderField(database, dataType)).toEqual(expected);
    });

    it('writes only the definition or the generated flags on a nullable column', () => {
      expect(renderField(Database.MySQL, 'INT UNSIGNED', 0)).toEqual([
        '  @Column(columnDefinition = "INT UNSIGNED")',
        '  private Long v;',
      ]);
      expect(renderField(Database.MSSQL, 'timestamp', 0)).toEqual([
        '  @Column(insertable = false, updatable = false)',
        '  private byte[] v;',
      ]);
      expect(renderField(Database.Oracle, 'BLOB', 0)).toEqual([
        '  @Lob',
        '  private byte[] v;',
      ]);
      expect(renderField(Database.PostgreSQL, 'money[]', 0)).toEqual([
        '  @Column(columnDefinition = "money[]")',
        '  private BigDecimal[] v;',
      ]);
    });
  });

  describe('formatTable — keys', () => {
    it('writes IDENTITY on an auto-increment key and no nullable on a key without the flag', () => {
      const table = createTable({
        id: 't',
        name: 'orders',
        columnIds: ['c1', 'c2'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't',
            name: 'order_id',
            dataType: 'INT UNSIGNED',
            options: ColumnOption.primaryKey | ColumnOption.autoIncrement,
            ui: { keys: ColumnUIKey.primaryKey },
          }),
          createColumn({
            id: 'c2',
            tableId: 't',
            name: 'code',
            dataType: 'CHAR(36)',
            options: ColumnOption.primaryKey,
            ui: { keys: ColumnUIKey.primaryKey },
          }),
        ],
        settings: { database: Database.MySQL },
      });

      expect(render(state, table).slice(7, 16)).toEqual([
        '@Table(name = "orders")',
        '@IdClass(OrdersId.class)',
        'public class Orders {',
        '  @Id',
        '  @GeneratedValue(strategy = GenerationType.IDENTITY)',
        '  @Column(name = "order_id", columnDefinition = "INT UNSIGNED")',
        '  private Long orderId;',
        '  @Id',
        '  private String code;',
      ]);
      expect(render(state, table).slice(0, 4)).toEqual([
        '@Data',
        'public class OrdersId implements Serializable {',
        '  private Long orderId;',
        '  private String code;',
      ]);
    });
  });

  describe('formatTable — names', () => {
    function renderTable(
      name: string,
      settings: Partial<RootState['settings']> = {}
    ) {
      const table = createTable({ id: 't', name });
      return render(createState({ tables: [table], settings }), table);
    }

    it('quotes a table named after a reserved word where the DDL quotes it', () => {
      expect(
        renderTable('user', { bracketType: BracketType.doubleQuote })
      ).toEqual([
        '@Data',
        '@Entity',
        '@Table(name = "\\"user\\"")',
        'public class User {',
        '}',
      ]);
      expect(
        renderTable('ORDER', {
          bracketType: BracketType.backtick,
          database: Database.MySQL,
          tableNameCase: NameCase.none,
        })[2]
      ).toBe('@Table(name = "\\"ORDER\\"")');
    });

    it('writes a reserved table name plain where the DDL leaves it unquoted', () => {
      expect(
        renderTable('Member', {
          bracketType: BracketType.none,
          database: Database.PostgreSQL,
        })
      ).toEqual(['@Data', '@Entity', 'public class Member {', '}']);
      expect(
        renderTable('key', {
          bracketType: BracketType.none,
          database: Database.Oracle,
        }).slice(2, 4)
      ).toEqual(['@Table(name = "key")', 'public class Key {']);
    });

    it('writes no @Table where the class keeps the table name', () => {
      expect(renderTable('Members')).toEqual([
        '@Data',
        '@Entity',
        'public class Members {',
        '}',
      ]);
    });

    it('puts an underscore after a Java keyword or a name no class may take', () => {
      expect(
        renderTable('package', { tableNameCase: NameCase.none }).slice(2, 4)
      ).toEqual(['@Table(name = "package")', 'public class package_ {']);
      expect(
        renderTable('record', { tableNameCase: NameCase.none }).slice(2, 4)
      ).toEqual(['@Table(name = "record")', 'public class record_ {']);
    });

    it('renames a field named after a Java keyword and names its column', () => {
      const table = createTable({
        id: 't',
        name: 'Item',
        columnIds: ['c1', 'c2', 'c3'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c1',
            tableId: 't',
            name: 'class',
            dataType: 'VARCHAR(10)',
          }),
          createColumn({
            id: 'c2',
            tableId: 't',
            name: 'record',
            dataType: 'VARCHAR(10)',
          }),
          createColumn({
            id: 'c3',
            tableId: 't',
            name: 'say "hi" \\ there',
            dataType: 'VARCHAR(10)',
          }),
        ],
      });

      expect(render(state, table)).toEqual([
        '@Data',
        '@Entity',
        'public class Item {',
        '  @Column(name = "class")',
        '  private String class_;',
        '  private String record;',
        '  @Column(name = "say \\"hi\\" \\\\ there")',
        '  private String sayHiThere;',
        '}',
      ]);
    });

    it('writes a field Class as Class_, whose Lombok getter would be the final getClass, as java.ts does', () => {
      const table = createTable({
        id: 't',
        name: 'course',
        columnIds: ['c1', 'c2'],
      });
      const columns = [
        createColumn({
          id: 'c1',
          tableId: 't',
          name: 'id',
          dataType: 'BIGINT',
          options: ColumnOption.primaryKey,
          ui: { keys: ColumnUIKey.primaryKey },
        }),
        createColumn({
          id: 'c2',
          tableId: 't',
          name: 'class',
          dataType: 'VARCHAR(20)',
          options: ColumnOption.notNull,
        }),
      ];

      expect(
        render(
          createState({
            tables: [table],
            columns,
            settings: { columnNameCase: NameCase.pascalCase },
          }),
          table
        )
      ).toEqual([
        '@Data',
        '@Entity',
        '@Table(name = "course")',
        'public class Course {',
        '  @Id',
        '  @Column(name = "id")',
        '  private Long Id;',
        '  @Column(name = "class", nullable = false)',
        '  private String Class_;',
        '}',
      ]);

      columns[1].name = 'Class';
      expect(
        render(
          createState({
            tables: [table],
            columns,
            settings: { columnNameCase: NameCase.none },
          }),
          table
        ).slice(-3)
      ).toEqual([
        '  @Column(name = "Class", nullable = false)',
        '  private String Class_;',
        '}',
      ]);
    });

    it('names a relation field, its mappedBy and an @IdClass field Class_ alike', () => {
      const parent = createTable({
        id: 'p',
        name: 'class',
        columnIds: ['p1'],
      });
      const child = createTable({
        id: 'c',
        name: 'enrollment',
        columnIds: ['c1', 'c2'],
      });
      const state = createState({
        tables: [parent, child],
        columns: [
          createColumn({
            id: 'p1',
            tableId: 'p',
            name: 'id',
            dataType: 'INT',
            options: ColumnOption.primaryKey,
            ui: { keys: ColumnUIKey.primaryKey },
          }),
          createColumn({
            id: 'c1',
            tableId: 'c',
            name: 'class_id',
            dataType: 'INT',
            options: ColumnOption.primaryKey,
            ui: { keys: ColumnUIKey.primaryKey | ColumnUIKey.foreignKey },
          }),
          createColumn({
            id: 'c2',
            tableId: 'c',
            name: 'seq',
            dataType: 'INT',
            options: ColumnOption.primaryKey,
            ui: { keys: ColumnUIKey.primaryKey },
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 'p', columnIds: ['p1'] },
            end: { tableId: 'c', columnIds: ['c1'] },
          }),
        ],
        settings: { columnNameCase: NameCase.pascalCase },
      });

      expect(render(state, child)).toEqual([
        '@Data',
        'public class EnrollmentId implements Serializable {',
        '  private Integer Seq;',
        '  private Class Class_;',
        '}',
        '@Data',
        '@Entity',
        '@Table(name = "enrollment")',
        '@IdClass(EnrollmentId.class)',
        'public class Enrollment {',
        '  @Id',
        '  @Column(name = "seq")',
        '  private Integer Seq;',
        '  @Id',
        '  @ManyToOne',
        '  @JoinColumn(name = "class_id")',
        '  private Class Class_;',
        '}',
      ]);
      expect(render(state, parent).slice(-3)).toEqual([
        '  @OneToMany(mappedBy = "Class_")',
        '  private List<Enrollment> EnrollmentList = new ArrayList<>();',
        '}',
      ]);
    });

    it('keeps a renamed parent field and its mappedBy in step', () => {
      const parent = createTable({
        id: 'p',
        name: 'new',
        columnIds: ['p1'],
      });
      const child = createTable({
        id: 'c',
        name: 'item',
        columnIds: ['c1'],
      });
      const state = createState({
        tables: [parent, child],
        columns: [
          createColumn({
            id: 'p1',
            tableId: 'p',
            name: 'id',
            dataType: 'INT',
            options: ColumnOption.primaryKey,
            ui: { keys: ColumnUIKey.primaryKey },
          }),
          createColumn({
            id: 'c1',
            tableId: 'c',
            name: 'newId',
            dataType: 'INT',
            ui: { keys: ColumnUIKey.foreignKey },
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r',
            relationshipType: RelationshipType.ZeroN,
            start: { tableId: 'p', columnIds: ['p1'] },
            end: { tableId: 'c', columnIds: ['c1'] },
          }),
        ],
      });

      expect(render(state, child).slice(-4)).toEqual([
        '  @ManyToOne',
        '  @JoinColumn(name = "newId")',
        '  private New new_;',
        '}',
      ]);
      expect(render(state, parent).slice(-3)).toEqual([
        '  @OneToMany(mappedBy = "new_")',
        '  private List<Item> itemList = new ArrayList<>();',
        '}',
      ]);
    });
  });

  describe('formatTable — comments', () => {
    it('writes a line comment per line of a table, column or related table comment', () => {
      const parent = createTable({
        id: 'p',
        name: 'Parent',
        comment: 'first\r\nsecond',
        columnIds: ['p1'],
      });
      const child = createTable({
        id: 'c',
        name: 'Child',
        comment: 'one\u2028two',
        columnIds: ['c1', 'c2'],
      });
      const state = createState({
        tables: [parent, child],
        columns: [
          createColumn({
            id: 'p1',
            tableId: 'p',
            name: 'id',
            dataType: 'INT',
            options: ColumnOption.primaryKey,
            ui: { keys: ColumnUIKey.primaryKey },
          }),
          createColumn({
            id: 'c1',
            tableId: 'c',
            name: 'parent_id',
            dataType: 'INT',
            ui: { keys: ColumnUIKey.foreignKey },
          }),
          createColumn({
            id: 'c2',
            tableId: 'c',
            name: 'note',
            dataType: 'VARCHAR(10)',
            comment: 'a\nb\rc',
          }),
        ],
        relationships: [
          createRelationship({
            id: 'r',
            relationshipType: RelationshipType.OneOnly,
            start: { tableId: 'p', columnIds: ['p1'] },
            end: { tableId: 'c', columnIds: ['c1'] },
          }),
        ],
      });

      expect(render(state, child)).toEqual([
        '// one',
        '// two',
        '@Data',
        '@Entity',
        'public class Child {',
        '  // a',
        '  // b',
        '  // c',
        '  private String note;',
        '  // first',
        '  // second',
        '  @OneToOne',
        '  @JoinColumn(name = "parent_id")',
        '  private Parent parent;',
        '}',
      ]);
      expect(render(state, parent).slice(-5, -1)).toEqual([
        '  // one',
        '  // two',
        '  @OneToOne(mappedBy = "parent")',
        '  private Child child;',
      ]);
    });

    it('drops blank first and last lines and writes a blank inner line as a bare //, as java.ts does', () => {
      const table = createTable({
        id: 't',
        name: 'T',
        comment: '\nfirst\n\nlast\n',
        columnIds: ['c'],
      });
      const state = createState({
        tables: [table],
        columns: [
          createColumn({
            id: 'c',
            tableId: 't',
            name: 'note',
            dataType: 'VARCHAR(10)',
            comment: ' \r\na\n \nb\n\t',
          }),
        ],
      });

      expect(render(state, table)).toEqual([
        '// first',
        '//',
        '// last',
        '@Data',
        '@Entity',
        'public class T {',
        '  // a',
        '  //',
        '  // b',
        '  private String note;',
        '}',
      ]);
    });

    it('doubles a lone backslash before u, which javac would read as a Unicode escape', () => {
      const table = createTable({
        id: 't',
        name: 'T',
        comment: 'C:\\users and \\\\u0041 and \\\\\\u000a',
      });

      expect(render(createState({ tables: [table] }), table)[0]).toBe(
        '// C:\\\\users and \\\\u0041 and \\\\\\\\u000a'
      );
    });
  });

  describe('createCode', () => {
    it('renders all tables sorted by name with a trailing blank line each', () => {
      const { state } = createJoinFixture();
      const lines = createCode(state).split('\n');

      expect(lines[0]).toBe('');
      expect(lines.at(-1)).toBe('');
      expect(
        lines.filter(
          line => line.startsWith('public class') && !line.includes('Id ')
        )
      ).toEqual([
        'public class Posts {',
        'public class UserPost {',
        'public class Users {',
      ]);
    });

    it('returns an empty string when the document has no tables', () => {
      expect(createCode(createState({}))).toBe('');
    });
  });
});
