import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  ColumnOption,
  ColumnUIKey,
  NameCase,
  RelationshipType,
  Show,
  StartRelationshipType,
} from '@/constants/schema';
import { RootState } from '@/engine/state';
import {
  Column,
  DeepPartial,
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
import { createCode, formatTable } from '@/utils/generator-code/mermaid';

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

function createColumnState(
  columns: DeepPartial<Column>[],
  table: Partial<Table> = {}
): RootState {
  const created = columns.map((column, index) =>
    createColumn({
      id: `c${index + 1}`,
      tableId: 't1',
      name: 'id',
      dataType: 'int',
      options: ColumnOption.notNull,
      ...column,
    })
  );

  return createState({
    tables: [
      createTable({
        id: 't1',
        name: 'user',
        columnIds: created.map(column => column.id),
        ...table,
      }),
    ],
    columns: created,
  });
}

/** The attribute lines of the one entity a column state holds. */
function attributeLines(state: RootState): string[] {
  const lines = createCode(state).split('\n');

  return lines.slice(lines.indexOf('  "user" {') + 1, lines.indexOf('  }'));
}

function attributeLine(column: DeepPartial<Column>): string {
  return attributeLines(createColumnState([column]))[0];
}

/** Two tables, parent p1 keyed by pk and child c1 holding fk, joined by one relationship. */
function createRelationshipState(
  relationship: DeepPartial<Relationship> = {},
  fkName = 'parent_id'
): RootState {
  return createState({
    tables: [
      createTable({ id: 'p1', name: 'parent', columnIds: ['pk'] }),
      createTable({ id: 'c1', name: 'child', columnIds: ['fk'] }),
    ],
    columns: [
      createColumn({
        id: 'pk',
        tableId: 'p1',
        name: 'id',
        dataType: 'int',
        options: ColumnOption.primaryKey | ColumnOption.notNull,
      }),
      createColumn({
        id: 'fk',
        tableId: 'c1',
        name: fkName,
        dataType: 'int',
        options: ColumnOption.notNull,
        ui: { keys: ColumnUIKey.foreignKey },
      }),
    ],
    relationships: [
      createRelationship({
        id: 'r1',
        start: { tableId: 'p1', columnIds: ['pk'] },
        end: { tableId: 'c1', columnIds: ['fk'] },
        ...relationship,
      }),
    ],
  });
}

function relationshipLines(state: RootState): string[] {
  return createCode(state)
    .split('\n')
    .filter(line => line.includes(' : '));
}

describe('generator-code/mermaid', () => {
  describe('createCode', () => {
    it('returns an empty string when the document has no tables', () => {
      expect(createCode(createState({}))).toBe('');
    });

    it('writes each table as a quoted entity under the erDiagram header', () => {
      expect(createCode(createColumnState([{}])).split('\n')).toEqual([
        '',
        'erDiagram',
        '  "user" {',
        '    int id',
        '  }',
        '',
      ]);
    });

    it('orders the entities by name with a blank line after each', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'orders' }),
          createTable({ id: 't2', name: 'Accounts' }),
        ],
      });

      expect(createCode(state).split('\n')).toEqual([
        '',
        'erDiagram',
        '  "Accounts" {',
        '  }',
        '',
        '  "orders" {',
        '  }',
        '',
      ]);
    });

    it('keeps a table name as written, Hangul, spaces and dots included', () => {
      const state = createState({
        tables: [createTable({ id: 't1', name: 'public.회원 목록' })],
      });

      expect(createCode(state)).toContain('  "public.회원 목록" {');
    });

    it('drops every character a quoted entity name cannot hold', () => {
      const state = createState({
        tables: [
          createTable({
            id: 't1',
            name: 'a"b%c\\d\re\nf\vg\bh',
          }),
        ],
      });

      expect(createCode(state)).toContain('  "abcdefgh" {');
    });

    it('names a table unnamed when nothing of its name is left to show', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: '' }),
          createTable({ id: 't2', name: '  ' }),
          createTable({ id: 't3', name: '"%' }),
        ],
      });

      expect(
        createCode(state)
          .split('\n')
          .filter(line => line.endsWith('{'))
      ).toEqual(['  "unnamed" {', '  "unnamed2" {', '  "unnamed3" {']);
    });

    it('numbers a repeated name, the one a dropped character leaves included', () => {
      const state = createState({
        tables: [
          createTable({ id: 't1', name: 'user' }),
          createTable({ id: 't2', name: 'user' }),
          createTable({ id: 't3', name: 'us"er' }),
          createTable({ id: 't4', name: 'User' }),
        ],
      });

      expect(
        createCode(state)
          .split('\n')
          .filter(line => line.endsWith('{'))
      ).toEqual(['  "user" {', '  "user2" {', '  "user3" {', '  "User" {']);
    });

    it('writes the table comment as a %% line above its entity, on one line', () => {
      const state = createColumnState([{}], {
        comment: 'members\r\nwho "signed up"\nand left',
      });

      expect(createCode(state).split('\n').slice(1, 4)).toEqual([
        'erDiagram',
        '  %% members who "signed up" and left',
        '  "user" {',
      ]);
    });

    it('writes no comment line for a blank table comment', () => {
      expect(createCode(createColumnState([{}], { comment: ' \n ' }))).toBe(
        createCode(createColumnState([{}]))
      );
    });
  });

  describe('attributes', () => {
    it('keeps a name and a type the attribute word pattern holds bare', () => {
      expect(
        attributeLines(
          createColumnState([
            { name: '회원번호', dataType: 'decimal(10,2)' },
            { name: 'user.id', dataType: 'varchar[]' },
            { name: '*star', dataType: 'Ünïcode' },
            { name: 'a-b_c', dataType: 'enum(a,b)' },
            { name: '😀name', dataType: 'µs' },
          ])
        )
      ).toEqual([
        '    decimal(10,2) 회원번호',
        '    varchar[] user.id',
        '    Ünïcode *star',
        '    enum(a,b) a-b_c',
        '    µs 😀name',
      ]);
    });

    it('wraps a name or a type in backticks once it holds a character outside the pattern', () => {
      expect(
        attributeLines(
          createColumnState([
            { name: 'first name', dataType: 'timestamp with time zone' },
            { name: '-lead', dataType: 'Map<int>' },
            { name: '1st', dataType: 'a:b' },
            { name: 'a~b', dataType: 'x?y' },
          ])
        )
      ).toEqual([
        '    `timestamp with time zone` `first name`',
        '    `Map<int>` `-lead`',
        '    `a:b` `1st`',
        '    `x?y` `a~b`',
      ]);
    });

    it('writes every tilde of a line fullwidth where the generic type rule would read across words', () => {
      expect(
        attributeLines(
          createColumnState([
            { comment: '1~5점, 6~10점' },
            { comment: '~deprecated~' },
            { name: 'a~b', comment: 'x~y' },
            { name: 'c~d', dataType: 'a~b' },
            { dataType: 'List~int~' },
          ])
        )
      ).toEqual([
        '    int id "1\uff5e5점, 6\uff5e10점"',
        '    int id "\uff5edeprecated\uff5e"',
        '    int `a\uff5eb` "x\uff5ey"',
        '    `a\uff5eb` `c\uff5ed`',
        '    `List\uff5eint\uff5e` id',
      ]);
    });

    it('keeps the tildes of a line where that rule reads no word', () => {
      expect(
        attributeLines(
          createColumnState([
            { comment: '범위 1~5, 6~10' },
            { comment: '1~5' },
            { name: 'a~b', comment: 'x' },
            { name: 'a b~c', comment: 'x~y' },
          ])
        )
      ).toEqual([
        '    int id "범위 1~5, 6~10"',
        '    int id "1~5"',
        '    int `a~b` "x"',
        '    int `a b~c` "x~y"',
      ]);
    });

    it("writes a backtick inside backticks as '", () => {
      expect(attributeLine({ name: 'it`s', dataType: 'a`b' })).toBe(
        "    `a'b` `it's`"
      );
    });

    it('wraps a name the key rule would take, in any case, in backticks', () => {
      expect(
        attributeLines(
          createColumnState([
            { name: 'pk' },
            { name: 'Fk' },
            { name: 'UK' },
            { name: 'pk-id' },
            { name: 'fk.user' },
            { name: 'uk번호', dataType: 'PK' },
          ])
        )
      ).toEqual([
        '    int `pk`',
        '    int `Fk`',
        '    int `UK`',
        '    int `pk-id`',
        '    int `fk.user`',
        '    `PK` `uk번호`',
      ]);
    });

    it('leaves a name bare where the key rule finds no word boundary', () => {
      expect(
        attributeLines(
          createColumnState([
            { name: 'pk_id' },
            { name: 'pkey' },
            { name: 'id_pk' },
          ])
        )
      ).toEqual(['    int pk_id', '    int pkey', '    int id_pk']);
    });

    it('writes unknown for an empty type and trims the type it writes', () => {
      expect(
        attributeLines(
          createColumnState([
            { dataType: '' },
            { dataType: '   ' },
            { dataType: ' int ' },
          ])
        )
      ).toEqual(['    unknown id', '    unknown id', '    int id']);
    });

    it('names a column unnamed when its name is blank', () => {
      expect(
        attributeLines(createColumnState([{ name: '' }, { name: ' ' }]))
      ).toEqual(['    int unnamed', '    int unnamed']);
    });

    it('marks every column that is not NOT NULL with a question mark on its type', () => {
      expect(
        attributeLines(
          createColumnState([
            { options: 0 },
            { options: ColumnOption.primaryKey },
            { dataType: 'double precision', options: 0 },
            { dataType: '', options: 0 },
          ])
        )
      ).toEqual([
        '    int? id',
        '    int? id PK',
        '    `double precision`? id',
        '    unknown? id',
      ]);
    });

    it('writes the PK, FK and UK keys in that order', () => {
      expect(
        attributeLine({
          options:
            ColumnOption.primaryKey |
            ColumnOption.unique |
            ColumnOption.notNull,
          ui: { keys: ColumnUIKey.primaryKey | ColumnUIKey.foreignKey },
        })
      ).toBe('    int id PK, FK, UK');
    });

    it('reads the foreign key from the column keys the relationships set', () => {
      expect(
        attributeLines(
          createColumnState([
            { ui: { keys: ColumnUIKey.foreignKey } },
            { ui: { keys: ColumnUIKey.primaryKey } },
          ])
        )
      ).toEqual(['    int id FK', '    int id']);
    });

    it('marks UK on the column of a single-column unique index and on no member of a composite one', () => {
      const columns = [
        createColumn({
          id: 'c1',
          tableId: 't1',
          name: 'email',
          dataType: 'text',
          options: ColumnOption.notNull,
        }),
        createColumn({
          id: 'c2',
          tableId: 't1',
          name: 'first',
          dataType: 'text',
          options: ColumnOption.notNull,
        }),
        createColumn({
          id: 'c3',
          tableId: 't1',
          name: 'last',
          dataType: 'text',
          options: ColumnOption.notNull,
        }),
        createColumn({
          id: 'c4',
          tableId: 't1',
          name: 'nick',
          dataType: 'text',
          options: ColumnOption.notNull,
        }),
        createColumn({
          id: 'o1',
          tableId: 't2',
          name: 'other',
          dataType: 'text',
        }),
      ];
      const state = createState({
        tables: [
          createTable({
            id: 't1',
            name: 'user',
            columnIds: ['c1', 'c2', 'c3', 'c4'],
          }),
          createTable({ id: 't2', name: 'zzz', columnIds: ['o1'] }),
        ],
        columns,
        indexes: [
          createIndex({
            id: 'i1',
            tableId: 't1',
            unique: true,
            indexColumnIds: ['ic1'],
          }),
          createIndex({
            id: 'i2',
            tableId: 't1',
            unique: true,
            indexColumnIds: ['ic2', 'ic3'],
          }),
          createIndex({
            id: 'i3',
            tableId: 't1',
            unique: false,
            indexColumnIds: ['ic4'],
          }),
          createIndex({
            id: 'i4',
            tableId: 't1',
            unique: true,
            indexColumnIds: ['ic5', 'ic6'],
          }),
        ],
        indexColumns: [
          createIndexColumn({ id: 'ic1', indexId: 'i1', columnId: 'c1' }),
          createIndexColumn({ id: 'ic2', indexId: 'i2', columnId: 'c2' }),
          createIndexColumn({ id: 'ic3', indexId: 'i2', columnId: 'c3' }),
          createIndexColumn({ id: 'ic4', indexId: 'i3', columnId: 'c3' }),
          createIndexColumn({ id: 'ic5', indexId: 'i4', columnId: 'c4' }),
          createIndexColumn({ id: 'ic6', indexId: 'i4', columnId: 'o1' }),
        ],
      });

      expect(attributeLines(state)).toEqual([
        '    text email UK',
        '    text first',
        '    text last',
        '    text nick UK',
      ]);
    });

    it("quotes a column comment, its double quotes as ' and its line breaks as spaces", () => {
      expect(
        attributeLines(
          createColumnState([
            { comment: 'the "real" id' },
            { comment: 'one\r\ntwo\nthree\rfour' },
            {
              comment: 'keyed',
              options: ColumnOption.primaryKey | ColumnOption.notNull,
            },
            { comment: '  ' },
          ])
        )
      ).toEqual([
        `    int id "the 'real' id"`,
        '    int id "one two three four"',
        '    int id PK "keyed"',
        '    int id',
      ]);
    });

    it('writes every column whatever View Option shows and whatever the name cases are', () => {
      const state = createColumnState([{ name: 'user_id', comment: 'note' }]);
      state.settings.show = Show.tableComment;
      state.settings.tableNameCase = NameCase.pascalCase;
      state.settings.columnNameCase = NameCase.camelCase;

      expect(attributeLines(state)).toEqual(['    int user_id "note"']);
      expect(createCode(state)).toContain('  "user" {');
    });

    it('writes the columns in table order, a repeated name included', () => {
      expect(
        attributeLines(
          createColumnState([{ name: 'b' }, { name: 'a' }, { name: 'b' }])
        )
      ).toEqual(['    int b', '    int a', '    int b']);
    });
  });

  describe('relationships', () => {
    it('writes the relationships after the entities, the child columns as the label', () => {
      expect(createCode(createRelationshipState()).split('\n')).toEqual([
        '',
        'erDiagram',
        '  "child" {',
        '    int parent_id FK',
        '  }',
        '',
        '  "parent" {',
        '    int id PK',
        '  }',
        '',
        '  "parent" ||..o{ "child" : "parent_id"',
        '',
      ]);
    });

    it('writes || for a dash at the parent and |o for a ring', () => {
      expect(
        relationshipLines(
          createRelationshipState({
            startRelationshipType: StartRelationshipType.dash,
          })
        )
      ).toEqual(['  "parent" ||..o{ "child" : "parent_id"']);
      expect(
        relationshipLines(
          createRelationshipState({
            startRelationshipType: StartRelationshipType.ring,
          })
        )
      ).toEqual(['  "parent" |o..o{ "child" : "parent_id"']);
    });

    it.each([
      ['ZeroOne', RelationshipType.ZeroOne, 'o|'],
      ['ZeroN', RelationshipType.ZeroN, 'o{'],
      ['OneOnly', RelationshipType.OneOnly, '||'],
      ['OneN', RelationshipType.OneN, '|{'],
      ['the legacy ZeroOneN', 1, 'o{'],
      ['the legacy One', 32, '||'],
      ['the legacy N', 64, '|{'],
    ])('writes %s at the child as %s', (_name, relationshipType, symbol) => {
      expect(
        relationshipLines(createRelationshipState({ relationshipType }))
      ).toEqual([`  "parent" ||..${symbol} "child" : "parent_id"`]);
    });

    it('draws an identifying relationship solid and any other dotted', () => {
      expect(
        relationshipLines(createRelationshipState({ identification: true }))
      ).toEqual(['  "parent" ||--o{ "child" : "parent_id"']);
      expect(
        relationshipLines(createRelationshipState({ identification: false }))
      ).toEqual(['  "parent" ||..o{ "child" : "parent_id"']);
    });

    it('joins the columns of a composite foreign key with commas', () => {
      const state = createRelationshipState();
      state.collections.tableColumnEntities.fk2 = createColumn({
        id: 'fk2',
        tableId: 'c1',
        name: 'parent_code',
        dataType: 'int',
      });
      state.collections.relationshipEntities.r1.end.columnIds = ['fk', 'fk2'];

      expect(relationshipLines(state)).toEqual([
        '  "parent" ||..o{ "child" : "parent_id, parent_code"',
      ]);
    });

    it('labels a child column with a blank name unnamed, as its entity does', () => {
      const state = createRelationshipState({}, ' ');
      state.collections.tableColumnEntities.fk2 = createColumn({
        id: 'fk2',
        tableId: 'c1',
        name: 'parent_code',
        dataType: 'int',
      });
      state.collections.relationshipEntities.r1.end.columnIds = ['fk', 'fk2'];

      expect(relationshipLines(state)).toEqual([
        '  "parent" ||..o{ "child" : "unnamed, parent_code"',
      ]);
    });

    it('labels a relationship whose child columns are gone with an empty string', () => {
      const state = createRelationshipState();
      state.collections.relationshipEntities.r1.end.columnIds = ['missing'];

      expect(relationshipLines(state)).toEqual([
        '  "parent" ||..o{ "child" : ""',
      ]);
    });

    it("writes a double quote in the label as ' and a line break as a space", () => {
      expect(
        relationshipLines(createRelationshipState({}, 'the "parent"\nid'))
      ).toEqual([`  "parent" ||..o{ "child" : "the 'parent' id"`]);
    });

    it('points at the numbered name of a repeated table', () => {
      const state = createRelationshipState();
      state.collections.tableEntities.c1.name = 'parent';

      expect(relationshipLines(state)).toEqual([
        '  "parent" ||..o{ "parent2" : "parent_id"',
      ]);
    });

    it('relates a table to itself', () => {
      const state = createRelationshipState();
      state.collections.relationshipEntities.r1.start.tableId = 'c1';

      expect(relationshipLines(state)).toEqual([
        '  "child" ||..o{ "child" : "parent_id"',
      ]);
    });

    it('skips a relationship of an unknown type or with an end in no table', () => {
      expect(
        relationshipLines(createRelationshipState({ relationshipType: 0 }))
      ).toEqual([]);

      const dangling = createRelationshipState();
      dangling.collections.relationshipEntities.r1.end.tableId = 'missing';
      expect(relationshipLines(dangling)).toEqual([]);
      expect(createCode(dangling).endsWith('  }\n')).toBe(true);
    });
  });

  describe('formatTable', () => {
    function render(state: RootState, table: Table): string[] {
      const buffer: string[] = [];
      formatTable(state, { buffer, table });
      return buffer;
    }

    it('writes the header and the one entity, leaving the relationships out', () => {
      const state = createRelationshipState({}, 'parent_id');
      state.collections.tableEntities.c1.comment = 'kids';

      expect(render(state, state.collections.tableEntities.c1)).toEqual([
        'erDiagram',
        '  %% kids',
        '  "child" {',
        '    int parent_id FK',
        '  }',
      ]);
    });

    it('names the table as the whole document does', () => {
      const state = createRelationshipState();
      state.collections.tableEntities.c1.name = 'parent';

      expect(render(state, state.collections.tableEntities.c1)[1]).toBe(
        '  "parent2" {'
      );
    });

    it('renders a table the document does not list under its own name', () => {
      const state = createColumnState([{}], { name: 'a%b' });
      const table = state.collections.tableEntities.t1;
      state.doc.tableIds = [];

      expect(render(state, table)).toEqual([
        'erDiagram',
        '  "ab" {',
        '    int id',
        '  }',
      ]);
    });
  });
});
