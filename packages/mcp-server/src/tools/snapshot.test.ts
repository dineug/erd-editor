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
} from '@dineug/erd-editor/peer.js';
import { afterAll, describe, expect, it } from 'vite-plus/test';

import { createSeededPeer, SEED } from '@/__test-utils__/seed';
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
      comment: '',
      color: '',
      x: 500,
      y: 100,
      zIndex: 3,
      columns: [
        {
          id: SEED.orderId,
          name: 'id',
          dataType: 'INT',
          default: '',
          comment: '',
          primaryKey: true,
          notNull: true,
          unique: false,
          autoIncrement: false,
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
        zIndex: 5,
      },
    ]);
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
      relationshipOptimization: false,
      columnOrder: [
        'columnName',
        'columnDataType',
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
      },
      maxWidthComment: -1,
      // The seed starts as a new document, every setting locked.
      lockSettings: {
        viewport: true,
        canvasType: true,
        language: true,
        tableNameCase: true,
        columnNameCase: true,
        bracketType: true,
      },
    });
  });

  it('leaves out what a replica derives and the view it looks through', () => {
    const keys = new Set(keysDeep(snapshot));
    const settings = Object.keys(snapshot.settings);

    for (const derived of [
      'widthName',
      'widthComment',
      'widthDataType',
      'widthDefault',
      'meta',
      'seqColumnIds',
      'seqIndexColumnIds',
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
    const { tables, relationships, indexes, memos } = toAgentSnapshot(
      empty.state
    );

    expect([tables, relationships, indexes, memos]).toEqual([[], [], [], []]);
    empty.destroy();
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
