import { schemaV3Parser } from '@dineug/erd-editor-schema';
import mermaid from 'mermaid';
import { beforeAll, describe, expect, it } from 'vite-plus/test';

import {
  ColumnOption,
  ColumnUIKey,
  RelationshipType,
  StartRelationshipType,
} from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Column, DeepPartial, Relationship, Table } from '@/internal-types';
import { createIndex } from '@/utils/collection/index.entity';
import { createIndexColumn } from '@/utils/collection/indexColumn.entity';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createCode, formatTable } from '@/utils/generator-code/mermaid';

type ParsedAttribute = {
  type: string;
  name: string;
  keys: string[];
  comment: string;
};

type ParsedRelationship = {
  entityA: string;
  roleA: string;
  entityB: string;
  relSpec: { cardA: string; cardB: string; relType: string };
};

type ParsedEntity = { id: string; attributes: ParsedAttribute[] };

type ParsedDiagram = {
  entities: Map<string, ParsedEntity>;
  relationships: ParsedRelationship[];
  direction: string;
};

const NOT_NULL = ColumnOption.notNull;

function column(
  id: string,
  tableId: string,
  value: DeepPartial<Column>
): Column {
  return createColumn({ id, tableId, dataType: 'int', ...value });
}

function relationship(
  id: string,
  [parent, parentColumns]: [string, string[]],
  [child, childColumns]: [string, string[]],
  value: DeepPartial<Relationship> = {}
): Relationship {
  return createRelationship({
    id,
    start: { tableId: parent, columnIds: parentColumns },
    end: { tableId: child, columnIds: childColumns },
    ...value,
  });
}

function createState(
  tables: Table[],
  columns: Column[],
  relationships: Relationship[] = []
): RootState {
  const state = schemaV3Parser({}) as unknown as RootState;

  state.doc.tableIds = tables.map(table => table.id);
  state.doc.relationshipIds = relationships.map(({ id }) => id);
  tables.forEach(table => (state.collections.tableEntities[table.id] = table));
  columns.forEach(
    value => (state.collections.tableColumnEntities[value.id] = value)
  );
  relationships.forEach(
    value => (state.collections.relationshipEntities[value.id] = value)
  );

  return state;
}

/**
 * A document holding every spelling the generator writes: names the pattern
 * keeps bare and names it wraps, the three keys, nullable types, comments,
 * tildes, a repeated table and each cardinality at both ends.
 */
function createDocument(): RootState {
  const tables: Table[] = [
    createTable({
      id: 'member',
      name: '회원',
      comment: 'members\nwho "joined"',
      columnIds: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10'],
    }),
    createTable({
      id: 'order',
      name: 'public.order "items"%',
      columnIds: ['o1', 'o2', 'o3', 'o4', 'o5', 'o6'],
    }),
    createTable({ id: 'dup', name: '회원', columnIds: ['d1'] }),
    createTable({ id: 'blank', name: '', columnIds: ['b1', 'b2', 'b3'] }),
    createTable({ id: 'empty', name: 'empty' }),
  ];
  const columns: Column[] = [
    column('m1', 'member', {
      name: '회원번호',
      options: ColumnOption.primaryKey | NOT_NULL,
      ui: { keys: ColumnUIKey.primaryKey },
      comment: 'the "id"\r\nof a member',
    }),
    column('m2', 'member', {
      name: 'email',
      dataType: 'varchar(255)',
      options: ColumnOption.unique | NOT_NULL,
    }),
    column('m3', 'member', { name: 'first name', dataType: 'decimal(10,2)' }),
    column('m4', 'member', { name: 'pk', dataType: 'pk' }),
    column('m5', 'member', { name: 'pk-id', dataType: 'fk.thing' }),
    column('m6', 'member', {
      name: 'it`s',
      dataType: 'timestamp with time zone',
      options: NOT_NULL,
    }),
    column('m7', 'member', { name: 'nick', dataType: '' }),
    column('m8', 'member', { name: 'score', comment: '1~5점, 6~10점' }),
    column('m9', 'member', { name: 'range', comment: '범위 1~5, 6~10' }),
    column('m10', 'member', { name: 'c~d', dataType: 'a~b', comment: 'x~y' }),
    column('o1', 'order', {
      name: 'id',
      options: ColumnOption.primaryKey | NOT_NULL,
    }),
    column('o2', 'order', {
      name: 'member_no',
      options: NOT_NULL,
      ui: { keys: ColumnUIKey.foreignKey },
    }),
    column('o3', 'order', {
      name: 'code',
      dataType: 'char(8)',
      options: ColumnOption.primaryKey | NOT_NULL,
      ui: { keys: ColumnUIKey.foreignKey },
    }),
    column('o4', 'order', { name: 'Ünïcode*', dataType: 'enum(a,b)' }),
    column('o5', 'order', { name: '', dataType: 'json' }),
    column('o6', 'order', { name: 'uk번호', dataType: 'text' }),
    column('d1', 'dup', { name: 'id', options: NOT_NULL }),
    column('b1', 'blank', { name: 'parent', dataType: 'int' }),
    column('b2', 'blank', { name: 'a:b', dataType: 'Map<int>' }),
    column('b3', 'blank', { name: '😀note', dataType: 'µs' }),
  ];
  const relationships: Relationship[] = [
    relationship('r1', ['member', ['m1']], ['order', ['o2']], {
      relationshipType: RelationshipType.ZeroN,
    }),
    relationship('r2', ['member', ['m1']], ['dup', ['d1']], {
      relationshipType: RelationshipType.OneOnly,
      identification: true,
    }),
    relationship('r3', ['order', ['o1', 'o3']], ['blank', ['b1', 'b2']], {
      relationshipType: RelationshipType.ZeroOne,
      startRelationshipType: StartRelationshipType.ring,
    }),
    relationship('r4', ['blank', ['b1']], ['blank', ['b1']], {
      relationshipType: RelationshipType.OneN,
    }),
    relationship('r5', ['empty', []], ['member', []], {
      relationshipType: 1,
    }),
    relationship('r6', ['empty', []], ['dup', ['missing']], {
      relationshipType: 32,
      identification: true,
    }),
    relationship('r7', ['dup', []], ['empty', []], {
      relationshipType: 64,
      startRelationshipType: StartRelationshipType.ring,
    }),
  ];
  const state = createState(tables, columns, relationships);

  state.doc.indexIds = ['i1'];
  state.collections.indexEntities.i1 = createIndex({
    id: 'i1',
    tableId: 'order',
    unique: true,
    indexColumnIds: ['ic1'],
  });
  state.collections.indexColumnEntities.ic1 = createIndexColumn({
    id: 'ic1',
    indexId: 'i1',
    columnId: 'o4',
  });

  return state;
}

/**
 * What mermaid itself reads from the text: its entities by name, its
 * relationships, which name an entity by the id mermaid gave it, and its direction.
 */
async function read(code: string): Promise<ParsedDiagram> {
  const diagram = await mermaid.mermaidAPI.getDiagramFromText(code);
  const db = diagram.db as unknown as {
    getEntities(): Map<string, ParsedEntity>;
    getRelationships(): ParsedRelationship[];
    getDirection(): string;
  };
  const entities = db.getEntities();
  const names = new Map(
    [...entities].map(([name, entity]) => [entity.id, name])
  );

  return {
    entities,
    relationships: db.getRelationships().map(relationship => ({
      ...relationship,
      entityA: names.get(relationship.entityA) ?? relationship.entityA,
      entityB: names.get(relationship.entityB) ?? relationship.entityB,
    })),
    direction: db.getDirection(),
  };
}

function attributesOf(diagram: ParsedDiagram, entityName: string) {
  return diagram.entities
    .get(entityName)
    ?.attributes.map(({ type, name, keys, comment }) => ({
      type,
      name,
      keys,
      comment,
    }));
}

beforeAll(() => {
  mermaid.initialize({ startOnLoad: false });
});

describe('generator-code/mermaid in mermaid 11.17.2', () => {
  it('writes a document mermaid parses as an erDiagram', async () => {
    const code = createCode(createDocument());

    await expect(mermaid.parse(code)).resolves.toMatchObject({
      diagramType: 'er',
    });
  });

  it('writes a single table mermaid parses as an erDiagram', async () => {
    const state = createDocument();
    const buffer: string[] = [];

    formatTable(state, {
      buffer,
      table: state.collections.tableEntities.member,
    });

    await expect(mermaid.parse(buffer.join('\n'))).resolves.toMatchObject({
      diagramType: 'er',
    });
  });

  it('reads back every entity under the name the generator gave it', async () => {
    const diagram = await read(createCode(createDocument()));

    expect([...diagram.entities.keys()].sort()).toEqual(
      ['empty', 'public.order items', 'unnamed', '회원', '회원2'].sort()
    );
  });

  it('reads back each attribute with its type, name, keys and comment', async () => {
    const diagram = await read(createCode(createDocument()));

    expect(attributesOf(diagram, '회원')).toEqual([
      {
        type: 'int',
        name: '회원번호',
        keys: ['PK'],
        comment: "the 'id' of a member",
      },
      { type: 'varchar(255)', name: 'email', keys: ['UK'], comment: '' },
      { type: 'decimal(10,2)?', name: 'first name', keys: [], comment: '' },
      { type: 'pk?', name: 'pk', keys: [], comment: '' },
      { type: 'fk.thing?', name: 'pk-id', keys: [], comment: '' },
      {
        type: 'timestamp with time zone',
        name: "it's",
        keys: [],
        comment: '',
      },
      { type: 'unknown?', name: 'nick', keys: [], comment: '' },
      {
        type: 'int?',
        name: 'score',
        keys: [],
        comment: '1\uff5e5점, 6\uff5e10점',
      },
      { type: 'int?', name: 'range', keys: [], comment: '범위 1~5, 6~10' },
      {
        type: 'a\uff5eb?',
        name: 'c\uff5ed',
        keys: [],
        comment: 'x\uff5ey',
      },
    ]);
    expect(attributesOf(diagram, 'public.order items')).toEqual([
      { type: 'int', name: 'id', keys: ['PK'], comment: '' },
      { type: 'int', name: 'member_no', keys: ['FK'], comment: '' },
      { type: 'char(8)', name: 'code', keys: ['PK', 'FK'], comment: '' },
      { type: 'enum(a,b)?', name: 'Ünïcode*', keys: ['UK'], comment: '' },
      { type: 'json?', name: 'unnamed', keys: [], comment: '' },
      { type: 'text?', name: 'uk번호', keys: [], comment: '' },
    ]);
    expect(attributesOf(diagram, 'unnamed')).toEqual([
      { type: 'int?', name: 'parent', keys: [], comment: '' },
      { type: 'Map<int>?', name: 'a:b', keys: [], comment: '' },
      { type: 'µs?', name: '😀note', keys: [], comment: '' },
    ]);
    expect(attributesOf(diagram, 'empty')).toEqual([]);
  });

  it('reads back each relationship with its cardinalities, line and label', async () => {
    const diagram = await read(createCode(createDocument()));

    expect(
      diagram.relationships.map(({ entityA, roleA, entityB, relSpec }) => [
        entityA,
        relSpec.cardB,
        relSpec.relType,
        relSpec.cardA,
        entityB,
        roleA,
      ])
    ).toEqual([
      [
        '회원',
        'ONLY_ONE',
        'NON_IDENTIFYING',
        'ZERO_OR_MORE',
        'public.order items',
        'member_no',
      ],
      ['회원', 'ONLY_ONE', 'IDENTIFYING', 'ONLY_ONE', '회원2', 'id'],
      [
        'public.order items',
        'ZERO_OR_ONE',
        'NON_IDENTIFYING',
        'ZERO_OR_ONE',
        'unnamed',
        'parent, a:b',
      ],
      [
        'unnamed',
        'ONLY_ONE',
        'NON_IDENTIFYING',
        'ONE_OR_MORE',
        'unnamed',
        'parent',
      ],
      ['empty', 'ONLY_ONE', 'NON_IDENTIFYING', 'ZERO_OR_MORE', '회원', ''],
      ['empty', 'ONLY_ONE', 'IDENTIFYING', 'ONLY_ONE', '회원2', ''],
      ['회원2', 'ZERO_OR_ONE', 'NON_IDENTIFYING', 'ONE_OR_MORE', 'empty', ''],
    ]);
  });

  it('reads back a name starting with a whitespace character as written', async () => {
    const state = createState(
      [createTable({ id: 't', name: 't', columnIds: ['a', 'b', 'c'] })],
      [
        column('a', 't', { name: '\u3000PK', options: NOT_NULL }),
        column('b', 't', { name: '\u3000id', options: NOT_NULL }),
        column('c', 't', { name: '\ufeffuk', options: NOT_NULL }),
      ]
    );
    const diagram = await read(createCode(state));

    expect(attributesOf(diagram, 't')).toEqual([
      { type: 'int', name: '\u3000PK', keys: [], comment: '' },
      { type: 'int', name: '\u3000id', keys: [], comment: '' },
      { type: 'int', name: '\ufeffuk', keys: [], comment: '' },
    ]);
  });

  it('keeps the rest of a line whose comment, label or name holds a line break before %%', async () => {
    const state = createState(
      [
        createTable({ id: 'p', name: 'p', columnIds: ['p1'] }),
        createTable({ id: 'c', name: 'c', columnIds: ['c1', 'c2', 'c3'] }),
      ],
      [
        column('p1', 'p', { name: 'id', options: NOT_NULL }),
        column('c1', 'c', {
          name: 'x\u2029%%y',
          options: NOT_NULL,
          comment: 'a\u2028%% b',
        }),
        column('c2', 'c', { name: 'x\n%% y', options: NOT_NULL }),
        column('c3', 'c', { name: '\u2028PK', options: NOT_NULL }),
      ],
      [
        relationship('r', ['p', ['p1']], ['c', ['c1']], {
          relationshipType: RelationshipType.ZeroN,
        }),
      ]
    );
    const diagram = await read(createCode(state));

    expect(attributesOf(diagram, 'c')).toEqual([
      { type: 'int', name: 'x %%y', keys: [], comment: 'a %% b' },
      { type: 'int', name: 'x %% y', keys: [], comment: '' },
      { type: 'int', name: ' PK', keys: [], comment: '' },
    ]);
    expect(diagram.relationships.map(({ roleA }) => roleA)).toEqual(['x %%y']);
  });

  it('applies no directive and keeps every relationship where a text holds %%{', async () => {
    const state = createState(
      [
        createTable({
          id: 'p',
          name: 'p',
          comment: 'see %%{init: {"theme":"forest"}}%%',
          columnIds: ['p1'],
        }),
        createTable({
          id: 'c',
          name: 'c',
          comment: 'up to 100%%{ off',
          columnIds: ['c1', 'c2'],
        }),
      ],
      [
        column('p1', 'p', {
          name: 'id',
          options: ColumnOption.primaryKey | NOT_NULL,
          comment: '100%%{ off',
        }),
        column('c1', 'c', { name: 'x %%{ y', options: NOT_NULL }),
        column('c2', 'c', {
          name: 'z',
          dataType: '%%{wrap}%%',
          options: NOT_NULL,
        }),
      ],
      [
        relationship('r1', ['p', ['p1']], ['c', ['c1']], {
          relationshipType: RelationshipType.ZeroN,
        }),
        relationship('r2', ['p', ['p1']], ['c', ['c2']], {
          relationshipType: RelationshipType.OneOnly,
        }),
      ]
    );
    const code = createCode(state);

    await expect(mermaid.parse(code)).resolves.toEqual({
      diagramType: 'er',
      config: {},
    });

    const diagram = await read(code);

    expect(attributesOf(diagram, 'p')).toEqual([
      { type: 'int', name: 'id', keys: ['PK'], comment: '100%%\uff5b off' },
    ]);
    expect(attributesOf(diagram, 'c')).toEqual([
      { type: 'int', name: 'x %%\uff5b y', keys: [], comment: '' },
      { type: '%%\uff5bwrap}%%', name: 'z', keys: [], comment: '' },
    ]);
    expect(diagram.relationships.map(({ roleA }) => roleA)).toEqual([
      'x %%\uff5b y',
      'z',
    ]);
  });

  it('keeps every relationship and the default direction where a table name or label holds direction', async () => {
    const state = createState(
      [
        createTable({ id: 'p', name: 'sort direction LR', columnIds: ['p1'] }),
        createTable({
          id: 'c',
          name: 'x DIRECTION\u00a0bt',
          columnIds: ['c1', 'c2'],
        }),
      ],
      [
        column('p1', 'p', { name: 'id', options: NOT_NULL }),
        column('c1', 'c', { name: 'by direction RL', options: NOT_NULL }),
        column('c2', 'c', {
          name: 'directiondirection\ttbl',
          options: NOT_NULL,
        }),
      ],
      [
        relationship('r1', ['p', ['p1']], ['c', ['c1']], {
          relationshipType: RelationshipType.ZeroN,
        }),
        relationship('r2', ['p', ['p1']], ['c', ['c2']], {
          relationshipType: RelationshipType.OneOnly,
        }),
      ]
    );
    const diagram = await read(createCode(state));
    const parent = 'sort direction\u200b LR';
    const child = 'x DIRECTION\u200b\u00a0bt';

    expect([...diagram.entities.keys()].sort()).toEqual([parent, child].sort());
    expect(
      diagram.relationships.map(({ entityA, entityB, roleA }) => [
        entityA,
        entityB,
        roleA,
      ])
    ).toEqual([
      [parent, child, 'by direction\u200b RL'],
      [parent, child, 'directiondirection\u200b\ttbl'],
    ]);
    expect(diagram.direction).toBe('TB');
  });

  it('keeps every relationship and the default direction where a semicolon mermaid drops splits a direction', async () => {
    const named = createState(
      [
        createTable({
          id: 'p',
          name: 'style:#x direction; LR',
          columnIds: ['p1'],
        }),
        createTable({ id: 'c', name: 'c', columnIds: ['c1'] }),
      ],
      [
        column('p1', 'p', { name: 'id', options: NOT_NULL }),
        column('c1', 'c', { name: 'ref', options: NOT_NULL }),
      ],
      [relationship('r1', ['p', ['p1']], ['c', ['c1']])]
    );
    const labelled = createState(
      [
        createTable({ id: 'p', name: 'p', columnIds: ['p1'] }),
        createTable({ id: 'c', name: 'c', columnIds: ['c1', 'c2'] }),
      ],
      [
        column('p1', 'p', { name: 'id', options: NOT_NULL }),
        column('c1', 'c', {
          name: 'style:#y direc;tion RL',
          options: NOT_NULL,
        }),
        column('c2', 'c', {
          name: 'twice direction LR direction BT',
          options: NOT_NULL,
        }),
      ],
      [
        relationship('r1', ['p', ['p1']], ['c', ['c1']], {
          relationshipType: RelationshipType.ZeroN,
        }),
        relationship('r2', ['p', ['p1']], ['c', ['c2']], {
          relationshipType: RelationshipType.OneOnly,
        }),
      ]
    );
    const byName = await read(createCode(named));
    const byLabel = await read(createCode(labelled));
    const parent = 'style:#x direction\u200b LR';

    expect([...byName.entities.keys()].sort()).toEqual(['c', parent].sort());
    expect(
      byName.relationships.map(({ entityA, entityB }) => [entityA, entityB])
    ).toEqual([[parent, 'c']]);
    expect(byName.direction).toBe('TB');
    expect(byLabel.relationships.map(({ roleA }) => roleA)).toEqual([
      'style:#y direction\u200b RL',
      'twice direction\u200b LR direction\u200b BT',
    ]);
    expect(byLabel.direction).toBe('TB');
  });

  it('reads back direction as written in an attribute word, a column comment and a table comment', async () => {
    const state = createState(
      [
        createTable({
          id: 't',
          name: 't',
          comment: 'flows direction RL',
          columnIds: ['a'],
        }),
      ],
      [
        column('a', 't', {
          name: 'sort direction LR',
          dataType: 'direction\u3000TB',
          options: NOT_NULL,
          comment: 'direction BT',
        }),
      ]
    );
    const diagram = await read(createCode(state));

    expect(attributesOf(diagram, 't')).toEqual([
      {
        type: 'direction\u3000TB',
        name: 'sort direction LR',
        keys: [],
        comment: 'direction BT',
      },
    ]);
    expect(diagram.direction).toBe('TB');
  });
});
