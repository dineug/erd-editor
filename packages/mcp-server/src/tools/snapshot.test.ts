import {
  BracketType,
  CanvasType,
  createPeerStore,
  Language,
  LockSettingType,
  MEMO_MIN_HEIGHT,
  MEMO_MIN_WIDTH,
  NameCase,
  type PeerStore,
  settingsActions,
  settingsActions$,
  tableActions,
  tableGroupActions,
} from '@dineug/erd-editor/peer.js';
import { afterAll, describe, expect, it } from 'vite-plus/test';

import {
  createCrossedRemovalPeer,
  createSeededPeer,
  SEED,
} from '@/__test-utils__/seed';
import { runTool } from '@/tools/run';
import { toAgentSnapshot } from '@/tools/snapshot';

const peer = createSeededPeer();

afterAll(() => peer.destroy());

const keysDeep = (value: unknown): string[] =>
  value && typeof value === 'object'
    ? Object.entries(value).flatMap(([key, child]) => [key, ...keysDeep(child)])
    : [];

describe('the agent snapshot', () => {
  const snapshot = toAgentSnapshot(peer.state);

  it('lists the live entities under their ids, in document order', () => {
    expect(snapshot.tables.map(({ id }) => id)).toEqual([
      SEED.users,
      SEED.orders,
      SEED.empty,
    ]);
    expect(snapshot.tables[1]).toEqual({
      id: SEED.orders,
      name: 'orders',
      logicalName: '',
      comment: '',
      color: '',
      groupId: '',
      nameDerived: false,
      x: 500,
      y: 100,
      columns: [
        {
          id: SEED.orderId,
          name: 'id',
          logicalName: '',
          dataType: 'INT',
          domainId: '',
          default: '',
          comment: '',
          primaryKey: true,
          notNull: true,
          unique: false,
          autoIncrement: false,
          nameDerived: false,
        },
        expect.objectContaining({ id: SEED.orderUser, primaryKey: false }),
        expect.objectContaining({ id: SEED.orderNote, dataType: 'TEXT' }),
      ],
    });
    expect(snapshot.relationships).toEqual([
      {
        id: SEED.relationship,
        relationshipType: 'OneN',
        onDelete: 'none',
        onUpdate: 'none',
        start: { tableId: SEED.users, columnIds: [SEED.userId] },
        end: { tableId: SEED.orders, columnIds: [SEED.orderUser] },
      },
    ]);
    expect(snapshot.indexes).toEqual([
      {
        id: SEED.index,
        tableId: SEED.orders,
        name: '',
        unique: false,
        columns: [
          { id: SEED.indexColumn, columnId: SEED.orderNote, orderType: 'ASC' },
          {
            id: SEED.userIndexColumn,
            columnId: SEED.orderUser,
            orderType: 'ASC',
          },
        ],
      },
    ]);
    expect(snapshot.memos).toEqual([
      {
        id: SEED.memo,
        value: '',
        color: '',
        x: 900,
        y: 100,
        width: MEMO_MIN_WIDTH,
        height: MEMO_MIN_HEIGHT,
      },
    ]);
  });

  it('gives each table and column its logical name, its domain and whether the dictionaries named it', () => {
    const users = snapshot.tables[0];

    expect(users).toMatchObject({ logicalName: 'Member', nameDerived: true });
    expect(
      users.columns.map(({ id, logicalName, domainId, nameDerived }) => ({
        id,
        logicalName,
        domainId,
        nameDerived,
      }))
    ).toEqual([
      {
        id: SEED.userId,
        logicalName: '',
        domainId: SEED.domain,
        nameDerived: false,
      },
      {
        id: SEED.userName,
        logicalName: 'Member Name',
        domainId: '',
        nameDerived: true,
      },
    ]);
  });

  it('gives the rows of the three dictionaries in full, in document order', () => {
    expect(snapshot.words).toEqual([
      {
        id: SEED.memberWord,
        name: 'Member',
        abbreviation: 'MBR',
        englishName: 'Member',
        description: '',
        synonyms: '',
        forbiddenWords: '',
      },
      {
        id: SEED.numberWord,
        name: 'Number',
        abbreviation: 'NO',
        englishName: 'Number',
        description: '',
        synonyms: '',
        forbiddenWords: '',
      },
    ]);
    expect(snapshot.terms).toEqual([
      {
        id: SEED.term,
        name: 'Member Number',
        physicalName: 'MBR_NO',
        domainId: SEED.domain,
        description: '',
        synonyms: '',
      },
    ]);
    expect(snapshot.domains).toEqual([
      {
        id: SEED.domain,
        name: 'Identifier',
        category: 'Number',
        dataType: 'INT',
        description: '',
      },
    ]);
  });

  it('reads a link to a removed domain as none, as the file form does, the link kept for an undo', () => {
    const other = createSeededPeer();
    runTool(other, 'erd_remove_domain', { domainId: SEED.domain });
    const { tables, terms, domains } = toAgentSnapshot(other.state);
    const file = JSON.parse(other.value);

    expect(domains).toEqual([]);
    expect(tables[0].columns[0]).toMatchObject({
      id: SEED.userId,
      domainId: '',
      dataType: 'INT',
    });
    expect(terms[0].domainId).toBe('');
    expect(
      file.collections.tableColumnEntities[SEED.userId]
    ).not.toHaveProperty('domainId');
    expect(
      other.state.collections.tableColumnEntities[SEED.userId].domainId
    ).toBe(SEED.domain);

    other.undo();
    expect(toAgentSnapshot(other.state).tables[0].columns[0].domainId).toBe(
      SEED.domain
    );
    other.destroy();
  });

  it('names each setting by its enum name, the tab left out', () => {
    expect(snapshot.settings).toEqual({
      databaseName: '',
      database: 'MySQL',
      language: 'GraphQL',
      tableNameCase: 'pascalCase',
      columnNameCase: 'camelCase',
      bracketType: 'none',
      relationshipDataTypeSync: true,
      columnOrder: [
        'columnLogicalName',
        'columnName',
        'columnDataType',
        'columnDomain',
        'columnNotNull',
        'columnUnique',
        'columnAutoIncrement',
        'columnDefault',
        'columnComment',
      ],
      show: {
        tableComment: true,
        columnComment: true,
        columnDataType: true,
        columnDefault: true,
        columnAutoIncrement: false,
        columnPrimaryKey: true,
        columnUnique: false,
        columnNotNull: true,
        relationship: true,
        columnAlternateKey: false,
        hideReferentialAction: false,
        hideTableGroup: false,
        hideMemo: false,
        columnDomain: false,
      },
      maxWidthComment: -1,
      // The seed starts as a new document, every setting locked; the name
      // view's flag is clear, since its bit is set while it is unlocked.
      lockSettings: {
        viewport: true,
        canvasType: true,
        language: true,
        tableNameCase: true,
        columnNameCase: true,
        bracketType: true,
        unlockNameViewMode: false,
      },
      ddlScripts: { before: '', after: '' },
    });
  });

  it('leaves out what a replica derives and the view it looks through', () => {
    const keys = new Set(keysDeep(snapshot));
    const settings = Object.keys(snapshot.settings);

    for (const derived of [
      'widthName',
      'widthLogicalName',
      'widthComment',
      'widthDataType',
      'widthDomain',
      'widthDefault',
      'meta',
      'seqColumnIds',
      'seqIndexColumnIds',
      'zIndex',
    ]) {
      expect(keys.has(derived), derived).toBe(false);
    }
    for (const view of [
      'width',
      'height',
      'originX',
      'originY',
      'scrollTop',
      'scrollLeft',
      'zoomLevel',
      'canvasType',
      'nameViewMode',
      'lockedValues',
    ]) {
      expect(settings, view).not.toContain(view);
    }
  });

  it('reads the same whichever tab its reader stands on', () => {
    for (const canvasType of [CanvasType.schemaSQL, CanvasType.settings]) {
      const tabbed = toAgentSnapshot({
        ...peer.state,
        settings: { ...peer.state.settings, canvasType },
      });

      expect(tabbed, canvasType).toEqual(snapshot);
    }
  });

  it('drops a removed entity although its record stays behind', () => {
    const other = createSeededPeer();
    runTool(other, 'erd_remove_memo', { memoId: SEED.memo });

    expect(other.state.collections.memoEntities[SEED.memo]).toBeDefined();
    expect(toAgentSnapshot(other.state).memos).toEqual([]);

    other.destroy();
  });

  it('keeps only the relationships, indexes and index columns the file form keeps', () => {
    const { peer: crossed, orphans, kept } = createCrossedRemovalPeer();
    const { doc, collections } = crossed.state;
    expect(doc.relationshipIds).toContain(orphans.relationship);
    expect(doc.indexIds).toContain(orphans.ordersIndex);
    expect(collections.indexEntities[kept.usersIndex].indexColumnIds).toContain(
      orphans.nameColumn
    );

    const snapshot = toAgentSnapshot(crossed.state);
    const file = JSON.parse(crossed.value);

    expect(snapshot.tables.map(({ id }) => id)).toEqual([
      SEED.users,
      SEED.empty,
    ]);
    expect(snapshot.relationships.map(({ id }) => id)).toEqual(
      file.doc.relationshipIds ?? []
    );
    expect(snapshot.indexes.map(({ id }) => id)).toEqual(file.doc.indexIds);
    expect(
      snapshot.indexes.map(({ id, columns }) => [
        id,
        columns.map(({ id }) => id),
      ])
    ).toEqual([[kept.usersIndex, [kept.idColumn]]]);
    expect(
      file.collections.indexEntities[kept.usersIndex].indexColumnIds
    ).toEqual([kept.idColumn]);

    crossed.destroy();
  });

  it('gives the Schema SQL scripts as the document holds them', () => {
    const other = createSeededPeer();
    runTool(other, 'erd_set_ddl_script', {
      position: 'after',
      sql: 'GRANT SELECT ON users TO app;',
    });

    expect(toAgentSnapshot(other.state).settings.ddlScripts).toEqual({
      before: '',
      after: 'GRANT SELECT ON users TO app;',
    });

    other.destroy();
  });

  it('gives empty scripts for settings that carry none', () => {
    const { settings } = toAgentSnapshot({
      ...peer.state,
      settings: { ...peer.state.settings, ddlScripts: undefined as any },
    });

    expect(settings.ddlScripts).toEqual({ before: '', after: '' });
  });

  it('shows a stored value no enum names as the value itself', () => {
    const { settings } = toAgentSnapshot({
      ...peer.state,
      settings: { ...peer.state.settings, database: 1024 },
    });

    expect(settings.database).toBe('1024');
  });

  it('hands out copies, so a reader cannot reach into the live state', () => {
    const copy = toAgentSnapshot(peer.state);
    copy.relationships[0].start.columnIds.push('intruder');

    expect(
      peer.state.collections.relationshipEntities[SEED.relationship].start
        .columnIds
    ).toEqual([SEED.userId]);
  });

  it('holds nothing for a document with no entity', () => {
    const empty = createPeerStore({ nickname: 'agent', presence: false });
    expect(toAgentSnapshot(empty.state)).toEqual({
      settings: expect.any(Object),
      tables: [],
      relationships: [],
      indexes: [],
      memos: [],
      tableGroups: [],
      words: [],
      terms: [],
      domains: [],
    });
    empty.destroy();
  });
});

describe('the table groups a snapshot lists', () => {
  it('gives each group its stored rect and its tables, and each table its group', () => {
    const snapshot = toAgentSnapshot(peer.state);

    expect(snapshot.tableGroups).toEqual([
      {
        id: SEED.group,
        name: 'accounts',
        color: '',
        x: 40,
        y: 20,
        width: 560,
        height: 300,
        tableIds: [SEED.users],
      },
    ]);
    expect(snapshot.tables.map(({ id, groupId }) => [id, groupId])).toEqual([
      [SEED.users, SEED.group],
      [SEED.orders, ''],
      [SEED.empty, ''],
    ]);
  });

  it('reads a groupId naming no live group as none, a removed group dropped', () => {
    const other = createSeededPeer();
    other.dispatch([
      tableActions.changeTableGroupAction({ id: SEED.orders, value: 'ghost' }),
      tableGroupActions.removeTableGroupAction({ id: SEED.group }),
    ]);
    const snapshot = toAgentSnapshot(other.state);

    expect(
      other.state.collections.tableGroupEntities[SEED.group]
    ).toBeDefined();
    expect(snapshot.tableGroups).toEqual([]);
    expect(snapshot.tables.map(({ groupId }) => groupId)).toEqual(['', '', '']);

    other.destroy();
  });

  it('hands out a copy of the tables a group holds', () => {
    const copy = toAgentSnapshot(peer.state);
    copy.tableGroups[0].tableIds.push('intruder');

    expect(toAgentSnapshot(peer.state).tableGroups[0].tableIds).toEqual([
      SEED.users,
    ]);
  });
});

describe('the code settings a snapshot reads', () => {
  const code = (peer: PeerStore) => {
    const { language, tableNameCase, columnNameCase, bracketType } =
      toAgentSnapshot(peer.state).settings;
    return { language, tableNameCase, columnNameCase, bracketType };
  };

  /** What a reader that opens the file the peer saves reads of the four. */
  const opened = (peer: PeerStore) => {
    const reader = createPeerStore({ nickname: 'reader', presence: false });
    try {
      reader.setInitialValue(peer.value);
      return code(reader);
    } finally {
      reader.destroy();
    }
  };

  it('reads a locked one at the value the file saves, not the one on screen', () => {
    const other = createSeededPeer();
    other.dispatch([
      settingsActions.changeLanguageAction({ value: Language.TypeScript }),
      settingsActions.changeTableNameCaseAction({ value: NameCase.snakeCase }),
      settingsActions.changeColumnNameCaseAction({ value: NameCase.snakeCase }),
      settingsActions.changeBracketTypeAction({ value: BracketType.backtick }),
    ]);

    expect(other.state.settings.language).toBe(Language.TypeScript);
    expect(code(other)).toEqual({
      language: 'GraphQL',
      tableNameCase: 'pascalCase',
      columnNameCase: 'camelCase',
      bracketType: 'none',
    });
    expect(code(other)).toEqual(opened(other));

    other.destroy();
  });

  it('reads an unlocked one as it stands, the value it was locked at aside', () => {
    const other = createSeededPeer();
    other.dispatch([
      settingsActions.changeLanguageAction({ value: Language.TypeScript }),
      settingsActions.changeBracketTypeAction({ value: BracketType.backtick }),
    ]);
    // A generator reads the state its dispatch starts from, so it goes after.
    other.dispatch([
      settingsActions$.changeLockSettingsAction$(
        LockSettingType.language | LockSettingType.bracketType,
        false
      ),
    ]);

    expect(other.state.settings.lockedValues.language).toBe(Language.GraphQL);
    expect(code(other)).toEqual({
      language: 'TypeScript',
      tableNameCase: 'pascalCase',
      columnNameCase: 'camelCase',
      bracketType: 'backtick',
    });
    expect(code(other)).toEqual(opened(other));
    expect(toAgentSnapshot(other.state).settings.lockSettings).toMatchObject({
      language: false,
      tableNameCase: true,
      columnNameCase: true,
      bracketType: false,
    });

    other.destroy();
  });
});
