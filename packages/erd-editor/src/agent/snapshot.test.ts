// @vitest-environment node

import { afterAll, describe, expect, it } from 'vite-plus/test';

import { createSeedValue, SEED } from '@/__test-utils__/agentSeed';
import { createAgentPeer } from '@/agent/peer';
import { toAgentSnapshot } from '@/agent/snapshot';
import { MEMO_MIN_HEIGHT, MEMO_MIN_WIDTH } from '@/constants/layout';

const peer = createAgentPeer({ nickname: 'agent', presence: false });
peer.setInitialValue(createSeedValue());

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

  it('names each setting as the tools take it', () => {
    expect(snapshot.settings).toEqual({
      databaseName: '',
      database: 'MySQL',
      canvasType: 'ERD',
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
      },
      maxWidthComment: -1,
      ignoreSaveSettings: { scroll: false, zoomLevel: false },
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
    ]) {
      expect(settings, view).not.toContain(view);
    }
  });

  it('drops a removed entity although its record stays behind', async () => {
    const other = createAgentPeer({ nickname: 'agent', presence: false });
    other.setInitialValue(createSeedValue());
    await other.runTool('erd_remove_memo', { memoId: SEED.memo });

    expect(other.state.collections.memoEntities[SEED.memo]).toBeDefined();
    expect(toAgentSnapshot(other.state).memos).toEqual([]);

    other.destroy();
  });

  it('shows a stored value no enum names as the value itself', () => {
    const { settings } = toAgentSnapshot({
      ...peer.state,
      settings: { ...peer.state.settings, database: 1024, canvasType: 'x' },
    });

    expect(settings.database).toBe('1024');
    expect(settings.canvasType).toBe('x');
  });

  it('hands out copies, so a reader cannot reach into the live state', () => {
    const copy = toAgentSnapshot(peer.state);
    copy.relationships[0].start.columnIds.push('intruder');

    expect(
      peer.state.collections.relationshipEntities[SEED.relationship].start
        .columnIds
    ).toEqual([SEED.userId]);
  });
});
