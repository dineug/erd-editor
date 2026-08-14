import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vitest';

import {
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

/**
 * users (1) ── (N) user_post (N) ── (1) posts
 *
 * `user_post` has a three-column composite primary key, two of whose columns
 * are also foreign keys.
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
        'public class Users {',
        '  @Id',
        '  @GeneratedValue',
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
        'public class Child {',
        '  @JoinColumn(name = "parent_id")',
        '  private Parent parent;',
        '}',
      ]);
    });
  });

  describe('formatTable — column annotations', () => {
    it('renders comments, @Column(nullable = false) and @Lob', () => {
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
        'public class Article {',
        '  // the title',
        '  @Column(nullable = false)',
        '  private String title;',
        '  @Lob',
        '  private String body;',
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
        '  private String user_name;',
        '}',
      ]);
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
