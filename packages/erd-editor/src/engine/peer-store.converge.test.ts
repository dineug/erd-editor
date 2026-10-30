// @vitest-environment node

import { isSettingLocked, query, toJson } from '@dineug/erd-editor-schema';
import {
  type AnyAction,
  type CompositionActions,
  compositionActionsFlat,
} from '@dineug/r-html';
import { cloneDeep, pick } from 'es-toolkit';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  createMesh,
  type Mesh,
  type MeshOptions,
} from '@/__test-utils__/peerMesh';
import {
  addColumn,
  addTable,
  colorTable,
  play,
  renameColumn,
  renameTable,
  SEED_SCENARIOS,
  setColumnPrimaryKey,
  sortTables,
} from '@/__test-utils__/peerScenarios';
import {
  createSeedValue,
  createSession,
  createUserStore,
  SEED,
  type Session,
  settle,
} from '@/__test-utils__/peerSeed';
import { counterOf, versionOf } from '@/__test-utils__/version';
import { mapColumnsAction$ } from '@/components/map-columns/mapColumnsAction';
import {
  ColumnOption,
  ColumnUIKey,
  LockSettingType,
  NameViewMode,
  RelationshipType,
  StartRelationshipType,
} from '@/constants/schema';
import { slotOf } from '@/engine/clock';
import { createEngineContext } from '@/engine/context';
import {
  addDictionaryAction,
  updateDictionaryAction,
} from '@/engine/modules/dictionary/atom.actions';
import { orderedDictionaryRows } from '@/engine/modules/dictionary/dictionaryIndex';
import {
  insertDictionaryEntriesAction$,
  sortDictionaryAction$,
} from '@/engine/modules/dictionary/generator.actions';
import {
  changeViewportAction,
  getLWWAction,
  selectAction,
} from '@/engine/modules/editor/atom.actions';
import {
  initialLoadJsonAction$,
  loadSchemaSQLAction$,
  moveAllAction$,
  type MoveAllGesture,
} from '@/engine/modules/editor/generator.actions';
import { SelectType } from '@/engine/modules/editor/state';
import {
  moveMemoAction,
  resizeMemoAction,
} from '@/engine/modules/memo/atom.actions';
import {
  addRelationshipAction,
  changeRelationshipColumnsAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import {
  changeDDLScriptAction,
  changeZoomLevelAction,
  scrollToAction,
  streamScrollToAction,
  streamZoomLevelAction,
  toNameViewModeAction,
} from '@/engine/modules/settings/atom.actions';
import {
  changeLockSettingsAction$,
  changeZoomLevelAction$,
} from '@/engine/modules/settings/generator.actions';
import {
  changeTableNameAction,
  moveTableAction,
  moveToTableAction,
  sortTableAction,
} from '@/engine/modules/table/atom.actions';
import { removeTableAction$ } from '@/engine/modules/table/generator.actions';
import {
  addColumnAction,
  changeColumnCommentAction,
  changeColumnDomainAction,
  changeColumnLogicalNameAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
  removeColumnAction,
} from '@/engine/modules/table-column/atom.actions';
import {
  changeColumnDataTypeAction$,
  removeColumnAction$,
} from '@/engine/modules/table-column/generator.actions';
import {
  moveTableGroupAction,
  resizeTableGroupAction,
} from '@/engine/modules/table-group/atom.actions';
import { createPeerStore, type PeerStore } from '@/engine/peer-store';
import { createReplicationStore } from '@/engine/replication-store';
import { createRxStore } from '@/engine/rx-store';
import { createSharedStore } from '@/engine/shared-store';
import type { RootState } from '@/engine/state';
import { Tag } from '@/engine/tag';
import { defaultToWidth } from '@/engine/to-width';
import { bHas } from '@/utils/bit';
import { type MapColumnsDraft, toMapColumnsActions } from '@/utils/map-columns';
import { createSchemaSQL } from '@/utils/schema-sql';

const sessions: Session[] = [];

function open(options?: Parameters<typeof createSession>[0]) {
  const session = createSession(options);
  sessions.push(session);
  return session;
}

afterEach(() => {
  sessions.splice(0).forEach(session => session.destroy());
});

/** Both sides' documents as each side holds them, removed entities included. */
const sides = ({ peer, user }: Session) => [
  JSON.parse(peer.runtimeValue),
  JSON.parse(toJson(user.rxStore.state)),
];

/**
 * Both sides hold the same document. A relationship's anchors stand on the
 * tables as each side draws them, and a name view a lock keeps to one side
 * widens that side's tables alone, so then the anchors are left out.
 */
const expectConverged = (session: Session) => {
  const [peer, user] = sides(session);
  const view = ({ state }: HasState) => state.settings.nameViewMode;

  if (view(session.peer) === view(session.user.rxStore)) {
    expect(peer).toEqual(user);
  } else {
    expect(splitAnchors(peer).document).toEqual(splitAnchors(user).document);
  }
};

describe('a peer store and an element’s store converge (AC-E5, AC-M5)', () => {
  it.each(Object.keys(SEED_SCENARIOS))(
    'after %s both sides serialize the same document',
    async name => {
      const session = open();
      await settle();

      const report = play(session.peer, SEED_SCENARIOS[name]());
      await settle();

      expect(report.batches).toBe(1);
      expectConverged(session);
    }
  );

  it('converges on a color the stream compressor sent without a version', async () => {
    const session = open();
    await settle();

    const report = play(session.peer, colorTable(SEED.users, '#00aa55'));
    await settle();

    const sentColor = session.sent
      .flat()
      .find(action => action.type === 'table.changeColor');

    expect(report.batches).toBe(1);
    expect(sentColor?.version).toBeUndefined();
    expect(session.user.rxStore.state.collections.tableEntities).toMatchObject({
      [SEED.users]: { ui: { color: '#00aa55' } },
    });
    expectConverged(session);
  });

  it('converges when the user edits while the peer adds a column', async () => {
    const session = open({ held: true });
    session.deliver();
    await settle();

    session.user.rxStore.dispatchSync(
      changeTableNameAction({ id: SEED.orders, value: 'purchases' })
    );
    const report = play(session.peer, addColumn(SEED.orders));

    expect(session.peer.state.collections.tableEntities[SEED.orders].name).toBe(
      'orders'
    );
    session.deliver();
    await settle();

    const orders = session.peer.state.collections.tableEntities[SEED.orders];
    expect(orders.name).toBe('purchases');
    expect(orders.columnIds).toContain(report.createdIds[0]);
    expectConverged(session);
  });

  it('converges when both sides edit different fields of one column', async () => {
    const session = open({ held: true });
    session.deliver();
    await settle();

    session.user.rxStore.dispatchSync(
      changeColumnCommentAction({
        id: SEED.userName,
        tableId: SEED.users,
        value: 'from the user',
      })
    );
    play(
      session.peer,
      renameColumn(SEED.users, SEED.userName, 'from_the_peer')
    );
    session.deliver();
    await settle();

    expect(
      session.peer.state.collections.tableColumnEntities[SEED.userName]
    ).toMatchObject({ name: 'from_the_peer', comment: 'from the user' });
    expectConverged(session);
  });

  it('converges over a run of edits and the undo of the last one', async () => {
    const session = open();
    await settle();

    const { peer } = session;
    const added = play(peer, addTable());
    const tableId = added.createdIds[0];
    play(peer, renameTable(tableId, 'audit'));
    const column = play(peer, addColumn(tableId));
    play(peer, setColumnPrimaryKey(tableId, column.createdIds[0], true));
    peer.undo();
    await settle();

    expectConverged(session);
  });
});

describe('a group drag converges while a peer changes its members', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** The x of the seed's group and of each table, the one axis the drag moves. */
  const placement = (state: RootState): Record<string, number> => ({
    group: state.collections.tableGroupEntities[SEED.group].ui.x,
    ...Object.fromEntries(
      [SEED.users, SEED.orders, SEED.empty].map(id => [
        id,
        state.collections.tableEntities[id].ui.x,
      ])
    ),
  });

  /** Past the 200 ms quiet period of the history and of both outbound compressors. */
  const quiet = () => vi.advanceTimersByTimeAsync(500);

  /**
   * The drag's buffered steps go out summed per table list, and a list under
   * the history's 20 px floor is dropped there, so a list that changed midway
   * would leave a step applied here and never sent, or never undone.
   */
  it('moves the tables the drag began with on both sides, and one undo puts them all back', async () => {
    const session = open({ held: true });
    await vi.advanceTimersByTimeAsync(30);
    session.deliver();
    const { peer, user } = session;
    const before = placement(user.rxStore.state);
    const gesture: MoveAllGesture = {};

    user.rxStore.dispatchSync(
      selectAction({ [SEED.group]: SelectType.tableGroup })
    );
    user.rxStore.dispatchSync(moveAllAction$(80, 0, 'document', gesture));
    play(peer, SEED_SCENARIOS.setTableGroup());
    session.deliver();
    user.rxStore.dispatchSync(moveAllAction$(15, 0, 'document', gesture));
    await quiet();
    session.deliver();

    const moved = {
      ...before,
      group: before.group + 95,
      [SEED.users]: before[SEED.users] + 95,
    };
    expect(placement(user.rxStore.state)).toEqual(moved);
    expect(placement(peer.state)).toEqual(moved);
    expect(peer.state.collections.tableEntities[SEED.orders].groupId).toBe(
      SEED.group
    );

    user.rxStore.undo();
    await quiet();
    session.deliver();

    expect(placement(user.rxStore.state)).toEqual(before);
    expect(placement(peer.state)).toEqual(before);
  });
});

describe('a layout converges although the two sides measure text apart', () => {
  /** Roughly what a canvas measures at the element's 12 px font. */
  const canvasToWidth = (text: string) => Math.round(text.length * 6.5) + 2;

  const positions = (state: Session['peer']['state']) =>
    state.doc.tableIds.map(id => {
      const { x, y } = state.collections.tableEntities[id].ui;
      return [id, x, y];
    });

  it('places the tables a sort lays out at the same points on both sides', async () => {
    const session = open({ userToWidth: canvasToWidth });
    await settle();
    const { peer, user } = session;

    for (const tableId of [SEED.users, SEED.orders, SEED.empty]) {
      play(
        peer,
        renameTable(tableId, `${tableId}_with_a_name_long_enough_to_set_width`)
      );
    }
    await settle();
    const before = positions(peer.state);

    const report = play(peer, sortTables());
    await settle();

    expect(report.historyEntries).toBe(1);
    expect(positions(peer.state)).not.toEqual(before);
    expect(positions(user.rxStore.state)).toEqual(positions(peer.state));

    peer.undo();
    await settle();

    expect(positions(peer.state)).toEqual(before);
    expect(positions(user.rxStore.state)).toEqual(before);
  });

  it('puts each table where the engine’s own sort puts it on one replica', async () => {
    const session = open({ held: true });
    session.deliver();
    await settle();
    const { peer, user } = session;
    const before = positions(peer.state);

    play(peer, sortTables());
    user.rxStore.dispatchSync(sortTableAction());

    expect(positions(peer.state)).not.toEqual(before);
    expect(positions(peer.state)).toEqual(positions(user.rxStore.state));
  });
});

/** A version above every clock here, so two peers can write at one on purpose. */
const VERSION = versionOf(10_000, 0);

/** A column the seed's orders table lacks, for a third mapping to point at. */
const ORDER_BUYER = 'orders_buyer_id';

/** A column of the seed's empty table, for a link to point at. */
const EMPTY_REF = 'empty_ref';

/** The seed's users.id → orders link pointed at other child columns. */
const remap = (endColumnIds: string[], version?: number): AnyAction => ({
  ...changeRelationshipColumnsAction({
    id: SEED.relationship,
    start: { tableId: SEED.users, columnIds: [SEED.userId] },
    end: { tableId: SEED.orders, columnIds: endColumnIds },
  }),
  ...(version === undefined ? {} : { version }),
});

/** Another relationship from users.id to the orders column given. */
const link = (id: string, endColumnId: string) =>
  addRelationshipAction({
    id,
    relationshipType: RelationshipType.OneN,
    start: { tableId: SEED.users, columnIds: [SEED.userId] },
    end: { tableId: SEED.orders, columnIds: [endColumnId] },
  });

/** Every action of a batch stamped with one version, as a dispatch stamps it. */
const atVersion = (actions: AnyAction[], version: number) =>
  actions.map(action => ({ ...action, version }));

/**
 * What a dispatch makes on the peer's state, every action at the version given,
 * as two editors built before the slot whose clocks stand level stamp it, or
 * two editors of one slot.
 */
const flatAtVersion = (
  { state }: HasState,
  actions: CompositionActions,
  version: number
) =>
  atVersion(
    compositionActionsFlat(
      state,
      createEngineContext({ toWidth: defaultToWidth, routes: false }),
      actions
    ),
    version
  );

/** Hands out the ids given, one per call, where a generator mints its own. */
const idsOf = (...ids: string[]) => {
  const queue = [...ids];
  return () => {
    const id = queue.shift();
    if (!id) throw new Error('more ids were minted than given');
    return id;
  };
};

/** The seed with the edits given made on it and saved, for peers to open. */
function valueWith(actions: AnyAction[]): string {
  const author = createPeerStore({ nickname: 'author', presence: false });
  author.setInitialValue(createSeedValue());
  author.dispatch(actions);
  const value = author.value;
  author.destroy();
  return value;
}

const withBuyerColumn = () =>
  valueWith([
    addColumnAction({ id: ORDER_BUYER, tableId: SEED.orders }),
    changeColumnNameAction({
      id: ORDER_BUYER,
      tableId: SEED.orders,
      value: 'buyer_id',
    }),
  ]);

const withEmptyColumn = () =>
  valueWith([
    addColumnAction({ id: EMPTY_REF, tableId: SEED.empty }),
    changeColumnNameAction({
      id: EMPTY_REF,
      tableId: SEED.empty,
      value: 'ref',
    }),
  ]);

type HasState = { state: RootState };

type HasRuntimeValue = { runtimeValue: string };

const relationshipOf = ({ state }: HasState, id: string = SEED.relationship) =>
  state.collections.relationshipEntities[id];

const endOf = (store: HasState, id: string = SEED.relationship) =>
  relationshipOf(store, id)?.end.columnIds;

const ordersColumnIds = ({ state }: HasState) =>
  state.collections.tableEntities[SEED.orders].columnIds;

const hasForeignKey = ({ state }: HasState, columnId: string) =>
  bHas(
    state.collections.tableColumnEntities[columnId].ui.keys,
    ColumnUIKey.foreignKey
  );

/**
 * What the hooks derive, read for what the document holds alone: each live
 * relationship's lists and flags, and each live column's options and key bit.
 */
function liveDerived({ state: { doc, collections } }: HasState) {
  const columns = query(collections).collection('tableColumnEntities');

  return {
    relationships: query(collections)
      .collection('relationshipEntities')
      .selectByIds(doc.relationshipIds)
      .map(({ id, start, end, identification, startRelationshipType }) => ({
        id,
        start: start.columnIds,
        end: end.columnIds,
        identification,
        startRelationshipType,
      })),
    columns: query(collections)
      .collection('tableEntities')
      .selectByIds(doc.tableIds)
      .flatMap(table =>
        columns.selectByIds(table.columnIds).map(({ id, options, ui }) => ({
          id,
          options,
          foreignKey: bHas(ui.keys, ColumnUIKey.foreignKey),
        }))
      ),
  };
}

/**
 * A document with its relationships' anchors taken out, and those anchors, for
 * a race whose peers agree on everything but where their last sort left them.
 */
function splitAnchors(document: any) {
  const anchors: Record<string, unknown[]> = {};

  for (const [id, relationship] of Object.entries<any>(
    document.collections.relationshipEntities
  )) {
    anchors[id] = [relationship.start, relationship.end].map(side => {
      const { x, y, direction } = side;
      delete side.x;
      delete side.y;
      delete side.direction;
      return { x, y, direction };
    });
  }

  return { document, anchors };
}

/** Each order a list of items can arrive in. */
function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];

  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map(
      rest => [item, ...rest]
    )
  );
}

/** The last batch a peer sent, which is the one its last dispatch made. */
const lastBatch = (sent: AnyAction[][]) => sent[sent.length - 1];

/** Every store holds the same document, removed entities included. */
const expectSameDocuments = (stores: HasRuntimeValue[]) => {
  const [first, ...rest] = stores.map(store => JSON.parse(store.runtimeValue));
  rest.forEach(document => expect(document).toEqual(first));
};

describe('the Schema SQL scripts converge', () => {
  const scriptsOf = ({ state }: HasState) => state.settings.ddlScripts;

  it('keeps both scripts when the two sides set before and after at once', async () => {
    const session = open({ held: true });
    session.deliver();
    await settle();

    session.user.rxStore.dispatchSync(
      changeDDLScriptAction({ position: 'before', value: 'from the user' })
    );
    session.peer.dispatch(
      [changeDDLScriptAction({ position: 'after', value: 'from the peer' })],
      { label: 'setDDLScript' }
    );
    session.deliver();
    await settle();

    for (const side of [session.peer, session.user.rxStore]) {
      expect(scriptsOf(side)).toEqual({
        before: 'from the user',
        after: 'from the peer',
      });
    }
    expectConverged(session);
  });

  it.each([
    ['the user', VERSION + 1, VERSION, 'from the user'],
    ['the peer', VERSION, VERSION + 1, 'from the peer'],
  ])(
    'settles one script both sides set on the later version, %s’s',
    async (_side, userVersion, peerVersion, winner) => {
      const session = open({ held: true });
      session.deliver();
      await settle();

      session.user.rxStore.dispatchSync({
        ...changeDDLScriptAction({
          position: 'before',
          value: 'from the user',
        }),
        version: userVersion,
      });
      session.peer.dispatch(
        [
          {
            ...changeDDLScriptAction({
              position: 'before',
              value: 'from the peer',
            }),
            version: peerVersion,
          },
        ],
        { label: 'setDDLScript' }
      );
      session.deliver();
      await settle();

      for (const side of [session.peer, session.user.rxStore]) {
        expect(scriptsOf(side)).toEqual({ before: winner, after: '' });
      }
      expectConverged(session);
    }
  );
});

describe('the name view converges on every peer and its replica', () => {
  const { unlockNameViewMode } = LockSettingType;
  const meshes: Mesh[] = [];

  /** Lets every hook a batch woke run: the 5 ms windows and the microtasks. */
  const settleHooks = async () => {
    await vi.advanceTimersByTimeAsync(20);
  };

  /** Three peers on one value, each with a replica, past the opening handshake. */
  async function open(value?: string): Promise<Mesh> {
    const mesh = createMesh(3, { value, settle: settleHooks, replicas: true });
    meshes.push(mesh);
    await settleHooks();
    await mesh.deliverAll();
    return mesh;
  }

  /** The seed with the name view unlocked, its bit set as the file saves it. */
  const unlockedSeed = () => {
    const json = JSON.parse(createSeedValue());
    json.settings.lockSettings |= unlockNameViewMode;
    return JSON.stringify(json);
  };

  const isNameViewLocked = (peer: HasState) =>
    isSettingLocked(peer.state.settings.lockSettings, unlockNameViewMode);

  /** Every peer holds the same runtime bytes, and every replica the same file. */
  const expectSameBytes = ({ peers, replicas }: Mesh) => {
    const [runtime, ...runtimes] = peers.map(peer => peer.runtimeValue);
    runtimes.forEach(other => expect(other).toBe(runtime));
    const [file, ...files] = replicas.map(replica => replica.value);
    expect(replicas).toHaveLength(3);
    files.forEach(other => expect(other).toBe(file));
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    meshes.splice(0).forEach(mesh => mesh.destroy());
    vi.useRealTimers();
  });

  it.each([
    ['the switch', [1, 0]],
    ['the unlock', [0, 1]],
  ])(
    'settles a locked switch crossing an unlock on the view the unlock carried, the third peer hearing %s first',
    async (_first, order) => {
      const mesh = await open();
      const [unlocker, switcher] = mesh.peers;

      unlocker.dispatch([
        toNameViewModeAction(unlocker.state, NameViewMode.both, false),
      ]);
      unlocker.dispatch([changeLockSettingsAction$(unlockNameViewMode, false)]);
      switcher.dispatch([
        toNameViewModeAction(switcher.state, NameViewMode.logical, false),
      ]);
      expect(switcher.state.settings.nameViewMode).toBe(NameViewMode.logical);

      await mesh.deliver(2, order);
      await mesh.deliverAll();

      for (const peer of mesh.peers) {
        expect(isNameViewLocked(peer)).toBe(false);
        expect(peer.state.settings.nameViewMode).toBe(NameViewMode.both);
      }
      expectSameBytes(mesh);
      for (const replica of mesh.replicas) {
        expect(JSON.parse(replica.value).settings.nameViewMode).toBe(
          NameViewMode.both
        );
      }
    }
  );

  it.each([
    ['the switch', [0, 2]],
    ['the relock', [2, 0]],
  ])(
    'saves the view the relock holds when a shared switch crosses it, the third peer hearing %s first',
    async (_first, order) => {
      const mesh = await open(unlockedSeed());
      const [switcher, , relocker] = mesh.peers;

      const switched = toNameViewModeAction(
        switcher.state,
        NameViewMode.logical,
        false
      );
      expect(switched.payload.shared).toBe(true);
      switcher.dispatch([switched]);
      relocker.dispatch([changeLockSettingsAction$(unlockNameViewMode, true)]);

      await mesh.deliver(1, order);
      await mesh.deliverAll();

      for (const peer of mesh.peers) {
        expect(isNameViewLocked(peer)).toBe(true);
        expect(peer.state.settings.lockedValues.nameViewMode).toBe(
          NameViewMode.physical
        );
      }
      expectSameBytes(mesh);
      for (const replica of mesh.replicas) {
        expect(JSON.parse(replica.value).settings).not.toHaveProperty(
          'nameViewMode'
        );
      }
    }
  );
});

describe('the dictionaries and the logical names converge on every peer', () => {
  const meshes: Mesh[] = [];

  /** Lets every hook a batch woke run: the 5 ms windows and the microtasks. */
  const settleHooks = async () => {
    await vi.advanceTimersByTimeAsync(20);
  };

  /** Peers on the seed that have heard each other's opening handshake. */
  async function open(
    count: number,
    options: Omit<MeshOptions, 'settle'> = {}
  ): Promise<Mesh> {
    const mesh = createMesh(count, { ...options, settle: settleHooks });
    meshes.push(mesh);
    await settleHooks();
    await mesh.deliverAll();
    return mesh;
  }

  const SEED_WORDS = [SEED.memberWord, SEED.nameWord];

  /** The word sheet's ids in the order it shows them. */
  const sheetIds = ({ state }: HasState) =>
    orderedDictionaryRows(state, 'word').map(({ id }) => id);

  const wordOf = ({ state }: HasState, id: string) =>
    state.collections.wordEntities[id];

  const noteOf = ({ state }: HasState) =>
    state.collections.tableColumnEntities[SEED.orderNote];

  /** A dictionary row of a serialized document, its values read by the header. */
  const rowOf = (text: string, key: string, id: string) => {
    const { fields, rows } = JSON.parse(text).collections[key];
    const row: unknown[] = rows.find((cells: unknown[]) => cells[0] === id);
    return Object.fromEntries(
      fields.map((field: string, index: number) => [field, row[index]])
    );
  };

  /** Every store's document, the runtime value or the file form given. */
  const expectSame = (documents: string[]) => {
    const [first, ...rest] = documents.map(text => JSON.parse(text));
    rest.forEach(document => expect(document).toEqual(first));
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    meshes.splice(0).forEach(mesh => mesh.destroy());
    vi.useRealTimers();
  });

  it.each([
    ['the update', [1, 0]],
    ['the add', [0, 1]],
  ])(
    'keeps the name an add carries and the abbreviation a later update of its row writes, the third peer hearing %s first',
    async (_first, order) => {
      const mesh = await open(3);
      const [adder, updater, third] = mesh.peers;

      adder.dispatch([
        addDictionaryAction({
          kind: 'word',
          id: 'word_order',
          values: { name: 'Order', abbreviation: 'ORD' },
        }),
      ]);
      await mesh.deliver(1, [0]);
      updater.dispatch([
        updateDictionaryAction({
          kind: 'word',
          id: 'word_order',
          values: { abbreviation: 'ODR' },
        }),
      ]);
      await mesh.deliver(2, order);

      expect(wordOf(third, 'word_order')).toMatchObject({
        name: 'Order',
        abbreviation: 'ODR',
      });
      await mesh.deliverAll();

      for (const peer of mesh.peers) {
        expect(peer.state.doc.wordIds).toEqual([...SEED_WORDS, 'word_order']);
        expect(wordOf(peer, 'word_order')).toMatchObject({
          name: 'Order',
          abbreviation: 'ODR',
        });
      }
      expectSame(mesh.peers.map(peer => peer.value));
      expectSame(mesh.peers.map(peer => peer.runtimeValue));
    }
  );

  it('keeps both of two words two peers add at once, each peer listing them in the order it heard them', async () => {
    const mesh = await open(2);
    const [first, second] = mesh.peers;

    first.dispatch([
      addDictionaryAction({
        kind: 'word',
        id: 'word_order',
        values: { name: 'Order', abbreviation: 'ORD' },
      }),
    ]);
    second.dispatch([
      addDictionaryAction({
        kind: 'word',
        id: 'word_date',
        values: { name: 'Date', abbreviation: 'DT' },
      }),
    ]);
    await mesh.deliverAll();

    expect(first.state.doc.wordIds).toEqual([
      ...SEED_WORDS,
      'word_order',
      'word_date',
    ]);
    expect(second.state.doc.wordIds).toEqual([
      ...SEED_WORDS,
      'word_date',
      'word_order',
    ]);
    // The runtime value writes the rows in the order the peer made them.
    const [firstDocument, secondDocument] = mesh.peers.map(peer => {
      const document = JSON.parse(peer.runtimeValue);
      document.doc.wordIds.sort();
      document.collections.wordEntities.rows.sort(
        ([a]: string[], [b]: string[]) => a.localeCompare(b)
      );
      return document;
    });
    expect(firstDocument).toEqual(secondDocument);
    // The sheet and the file show the rows by key, the same on both.
    expect(sheetIds(first)).toEqual(sheetIds(second));
    expectSame(mesh.peers.map(peer => peer.value));
  });

  it('shows the rows two peers insert at one place at once in one order on both', async () => {
    const mesh = await open(2);
    const [first, second] = mesh.peers;

    first.dispatch([
      insertDictionaryEntriesAction$('word', 2, {
        id: SEED.memberWord,
        place: 'after',
      }),
    ]);
    second.dispatch([
      insertDictionaryEntriesAction$('word', 1, {
        id: SEED.memberWord,
        place: 'after',
      }),
      sortDictionaryAction$('word', 'name', 'descending', 'en'),
    ]);
    await mesh.deliverAll();

    expect(sheetIds(first)).toHaveLength(SEED_WORDS.length + 3);
    expect(sheetIds(first)).toEqual(sheetIds(second));
    expectSame(mesh.peers.map(peer => peer.value));
  });

  it.each([
    ['the logical name', [0, 1]],
    ['the domain', [1, 0]],
  ])(
    'keeps a logical name and a domain two peers give one column at once, measured alike, the third peer hearing %s first',
    async (_first, order) => {
      const mesh = await open(3);
      const [namer, linker] = mesh.peers;

      namer.dispatch([
        changeColumnLogicalNameAction({
          tableId: SEED.orders,
          id: SEED.orderNote,
          value: 'Order Note',
        }),
      ]);
      linker.dispatch([
        changeColumnDomainAction({
          tableId: SEED.orders,
          id: SEED.orderNote,
          value: SEED.domain,
        }),
      ]);
      await mesh.deliver(2, order);
      await mesh.deliverAll();

      for (const peer of mesh.peers) {
        const { collections } = peer.state;
        expect(noteOf(peer)).toMatchObject({
          logicalName: 'Order Note',
          domainId: SEED.domain,
        });
        expect(noteOf(peer).ui.widthDomain).toBe(
          collections.tableColumnEntities[SEED.userName].ui.widthDomain
        );
        expect(noteOf(peer).ui.widthDomain).not.toBe(
          collections.tableColumnEntities[SEED.orderId].ui.widthDomain
        );
      }
      expectSame(mesh.peers.map(peer => peer.runtimeValue));
    }
  );

  // The domain's winning write is older than the logical name's, so a register
  // the two fields shared would turn it away on the peer that wrote the name.
  it('settles each field of one column on its own later write when two peers write both at once', async () => {
    const mesh = await open(2);
    const [first, second] = mesh.peers;
    const note = { tableId: SEED.orders, id: SEED.orderNote };

    first.dispatch([
      {
        ...changeColumnLogicalNameAction({ ...note, value: 'Order Note' }),
        version: VERSION,
      },
    ]);
    first.dispatch([
      {
        ...changeColumnDomainAction({ ...note, value: SEED.domain }),
        version: VERSION,
      },
    ]);
    second.dispatch([
      {
        ...changeColumnLogicalNameAction({ ...note, value: 'Remark' }),
        version: VERSION + 1,
      },
    ]);
    second.dispatch([
      {
        ...changeColumnDomainAction({ ...note, value: '' }),
        version: VERSION - 1,
      },
    ]);
    await mesh.deliverAll();

    for (const peer of mesh.peers) {
      expect(noteOf(peer)).toMatchObject({
        logicalName: 'Remark',
        domainId: SEED.domain,
      });
    }
    expectSame(mesh.peers.map(peer => peer.runtimeValue));
  });

  it.each([
    ['the import', [0, 1]],
    ['the edit', [1, 0]],
  ])(
    'keeps a word edit that crosses a SQL import on every peer and replica, the third peer hearing %s first',
    async (_first, order) => {
      const mesh = await open(3, { replicas: true });
      const [importer, editor] = mesh.peers;

      importer.dispatch([
        loadSchemaSQLAction$(
          'CREATE TABLE accounts (id INT NOT NULL PRIMARY KEY, email VARCHAR(255));'
        ),
      ]);
      editor.dispatch([
        updateDictionaryAction({
          kind: 'word',
          id: SEED.memberWord,
          values: { abbreviation: 'MEM' },
        }),
      ]);
      await mesh.deliver(2, order);
      await mesh.deliverAll();

      for (const peer of mesh.peers) {
        const { doc, collections } = peer.state;
        expect(
          doc.tableIds.map(id => collections.tableEntities[id].name)
        ).toEqual(['accounts']);
        expect(doc.wordIds).toEqual(SEED_WORDS);
        expect(doc.termIds).toEqual([SEED.term]);
        expect(doc.domainIds).toEqual([SEED.domain]);
        expect(wordOf(peer, SEED.memberWord)).toMatchObject({
          name: 'Member',
          abbreviation: 'MEM',
        });
      }
      expect(mesh.replicas).toHaveLength(3);
      for (const replica of mesh.replicas) {
        expect(
          rowOf(replica.runtimeValue, 'wordEntities', SEED.memberWord)
        ).toMatchObject({ name: 'Member', abbreviation: 'MEM' });
      }
      expectSame([...mesh.peers, ...mesh.replicas].map(store => store.value));
    }
  );
});

describe('relationship.changeColumns converges', () => {
  const meshes: Mesh[] = [];
  const cleanups: Array<() => void> = [];

  /** Lets every hook a batch woke run: the 5 ms windows and the microtasks. */
  const settleHooks = async () => {
    await vi.advanceTimersByTimeAsync(20);
  };

  /** Peers on one value that have heard each other's opening handshake. */
  async function open(
    count: number,
    options: Omit<MeshOptions, 'settle'> = {}
  ): Promise<Mesh> {
    const mesh = createMesh(count, { ...options, settle: settleHooks });
    meshes.push(mesh);
    await settleHooks();
    await mesh.deliverAll();
    return mesh;
  }

  /** A peer opened on the value that hears the batches given, one by one, in order. */
  async function observe(value: string, batches: AnyAction[][]) {
    const observer = createPeerStore({ nickname: 'observer', presence: false });
    cleanups.push(observer.destroy);
    observer.setInitialValue(value);
    await settleHooks();

    for (const batch of batches) {
      observer.receive(cloneDeep(batch));
      await settleHooks();
    }

    return observer;
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    meshes.splice(0).forEach(mesh => mesh.destroy());
    cleanups.splice(0).forEach(cleanup => cleanup());
    vi.useRealTimers();
  });

  it('moves a mapping in one batch, version and undo entry, its id, place and constraint name kept, on every peer and the replica', async () => {
    const mesh = await open(2);
    const [author, other] = mesh.peers;
    const replica = createReplicationStore({ toWidth: defaultToWidth });
    cleanups.push(replica.destroy);
    replica.setInitialValue(author.value);
    const change = vi.fn();
    replica.on({ change });

    const report = author.dispatch([remap([SEED.orderNote])]);
    await mesh.deliverAll();
    replica.dispatchSync(lastBatch(mesh.sent[0]));
    await vi.advanceTimersByTimeAsync(250);

    expect(report.batches).toBe(1);
    expect(report.historyEntries).toBe(1);
    expect(new Set(report.actions.map(({ version }) => version)).size).toBe(1);
    for (const peer of [author, other]) {
      expect(peer.state.doc.relationshipIds).toEqual([SEED.relationship]);
      expect(endOf(peer)).toEqual([SEED.orderNote]);
      expect(hasForeignKey(peer, SEED.orderNote)).toBe(true);
      expect(hasForeignKey(peer, SEED.orderUser)).toBe(false);
      expect(createSchemaSQL(peer.state)).toContain(
        'CONSTRAINT FK_users_TO_orders'
      );
    }
    expectSameDocuments([author, other]);
    expect(JSON.parse(replica.value)).toEqual(JSON.parse(author.value));
    expect(change.mock.calls).toEqual([
      [{ value: replica.value, changed: true }],
    ]);
  });

  it('settles two edits of one version on the greater mapping, whichever a peer hears first', async () => {
    const mesh = await open(2);
    const [first, second] = mesh.peers;

    first.dispatch([remap([SEED.orderNote], VERSION)]);
    second.dispatch([remap([SEED.orderId], VERSION)]);
    await mesh.deliverAll();

    // [["users_id"],["orders_note"]] sorts after [["users_id"],["orders_id"]].
    for (const peer of mesh.peers) {
      expect(endOf(peer)).toEqual([SEED.orderNote]);
      expect(relationshipOf(peer)).toMatchObject({
        identification: false,
        startRelationshipType: StartRelationshipType.ring,
      });
      expect(hasForeignKey(peer, SEED.orderNote)).toBe(true);
      expect(hasForeignKey(peer, SEED.orderId)).toBe(false);
    }
    expectSameDocuments(mesh.peers);
  });

  it('settles three edits of one version on one mapping in each of the six orders they can arrive in', async () => {
    const value = withBuyerColumn();
    const writers = await open(3, { value });
    const targets = [SEED.orderNote, SEED.orderId, ORDER_BUYER];

    writers.peers.forEach((peer, index) =>
      peer.dispatch([remap([targets[index]], VERSION)])
    );
    const batches = writers.sent.map(lastBatch);
    await writers.deliverAll();

    const observers: PeerStore[] = [];
    for (const order of permutations([0, 1, 2])) {
      observers.push(
        await observe(
          value,
          order.map(index => batches[index])
        )
      );
    }

    for (const store of [...writers.peers, ...observers]) {
      expect(endOf(store)).toEqual([SEED.orderNote]);
    }
    expectSameDocuments([...writers.peers, ...observers]);
  });

  it('settles edits of two versions on the later one, whatever its mapping', async () => {
    const mesh = await open(2);
    const [first, second] = mesh.peers;

    first.dispatch([remap([SEED.orderNote], VERSION)]);
    second.dispatch([remap([SEED.orderId], VERSION + 1)]);
    await mesh.deliverAll();

    for (const peer of mesh.peers) {
      expect(endOf(peer)).toEqual([SEED.orderId]);
      expect(relationshipOf(peer)).toMatchObject({
        identification: true,
        startRelationshipType: StartRelationshipType.dash,
      });
    }
    expectSameDocuments(mesh.peers);
  });

  it('lets a removal win over a mapping edit, and the undo of the removal brings the relationship back with that edit', async () => {
    const mesh = await open(2);
    const [editor, remover] = mesh.peers;

    editor.dispatch([remap([SEED.orderNote])]);
    remover.dispatch([removeRelationshipAction({ id: SEED.relationship })]);
    await mesh.deliverAll();

    for (const peer of mesh.peers) {
      expect(peer.state.doc.relationshipIds).toEqual([]);
      expect(endOf(peer)).toEqual([SEED.orderNote]);
    }
    expectSameDocuments(mesh.peers);

    remover.undo();
    await mesh.deliverAll();

    for (const peer of mesh.peers) {
      expect(peer.state.doc.relationshipIds).toEqual([SEED.relationship]);
      expect(endOf(peer)).toEqual([SEED.orderNote]);
      expect(hasForeignKey(peer, SEED.orderNote)).toBe(true);
    }
    expectSameDocuments(mesh.peers);
  });

  it('gives a relationship one peer removes while another remaps it onto a key the flags of a new one on every peer', async () => {
    const mesh = await open(2);
    const [editor, remover] = mesh.peers;

    editor.dispatch([remap([SEED.orderId])]);
    remover.dispatch([removeRelationshipAction({ id: SEED.relationship })]);
    // Each side's hooks run on its own edit before it hears the other's.
    await settleHooks();
    await mesh.deliverAll();

    expectSameDocuments(mesh.peers);
    for (const peer of mesh.peers) {
      expect(peer.state.doc.relationshipIds).toEqual([]);
      expect(endOf(peer)).toEqual([SEED.orderId]);
      expect(relationshipOf(peer)).toMatchObject({
        identification: false,
        startRelationshipType: StartRelationshipType.dash,
      });
    }
  });

  it('gives a relationship one peer removes while another makes its end column a key the flags of a new one on every peer', async () => {
    const mesh = await open(2);
    const [keyer, remover] = mesh.peers;

    keyer.dispatch([
      changeColumnPrimaryKeyAction({
        id: SEED.orderUser,
        tableId: SEED.orders,
        value: true,
      }),
    ]);
    remover.dispatch([removeRelationshipAction({ id: SEED.relationship })]);
    await settleHooks();
    await mesh.deliverAll();

    expectSameDocuments(mesh.peers);
    for (const peer of mesh.peers) {
      expect(peer.state.doc.relationshipIds).toEqual([]);
      expect(relationshipOf(peer)).toMatchObject({
        identification: false,
        startRelationshipType: StartRelationshipType.dash,
      });
    }
  });

  it('drops a mapping edit with its relationship when another peer removes the old child column', async () => {
    const mesh = await open(2);
    const [editor, remover] = mesh.peers;

    editor.dispatch([remap([SEED.orderNote])]);
    remover.dispatch([removeColumnAction$(SEED.orders, [SEED.orderUser])]);
    await mesh.deliverAll();

    for (const peer of mesh.peers) {
      expect(peer.state.doc.relationshipIds).toEqual([]);
      expect(ordersColumnIds(peer)).not.toContain(SEED.orderUser);
      expect(hasForeignKey(peer, SEED.orderNote)).toBe(false);
    }
    expectSameDocuments(mesh.peers);
  });

  it('clears the key mark of a column one peer removes while another removes the relationship ending on it, the same on every peer', async () => {
    const mesh = await open(2);
    const [unlinker, remover] = mesh.peers;

    unlinker.dispatch([removeRelationshipAction({ id: SEED.relationship })]);
    remover.dispatch([removeColumnAction$(SEED.orders, [SEED.orderUser])]);
    await mesh.deliverAll();

    for (const peer of mesh.peers) {
      expect(peer.state.doc.relationshipIds).toEqual([]);
      expect(ordersColumnIds(peer)).not.toContain(SEED.orderUser);
      expect(hasForeignKey(peer, SEED.orderUser)).toBe(false);
    }
    expectSameDocuments(mesh.peers);
  });

  it('keeps a relationship pointing at a column another peer removed meanwhile, the same on every peer', async () => {
    const mesh = await open(2);
    const [editor, remover] = mesh.peers;

    editor.dispatch([remap([SEED.orderNote])]);
    remover.dispatch([removeColumnAction$(SEED.orders, [SEED.orderNote])]);
    await mesh.deliverAll();

    for (const peer of mesh.peers) {
      expect(peer.state.doc.relationshipIds).toEqual([SEED.relationship]);
      expect(endOf(peer)).toEqual([SEED.orderNote]);
      expect(ordersColumnIds(peer)).not.toContain(SEED.orderNote);
      expect(relationshipOf(peer)).toMatchObject({
        identification: false,
        startRelationshipType: StartRelationshipType.dash,
      });
    }
    expectSameDocuments(mesh.peers);
  });

  it('keeps a link to a table another peer removed meanwhile, every peer agreeing on all but the link’s anchors', async () => {
    // The linker sorts its link before it hears the removal, and the remover
    // never sorts a connector one of whose tables is gone, so the anchors the
    // link keeps differ, drawn nowhere until the table is back.
    const mesh = await open(2, { value: withEmptyColumn() });
    const [linker, remover] = mesh.peers;

    linker.dispatch([
      addRelationshipAction({
        id: 'users_empty',
        relationshipType: RelationshipType.ZeroN,
        start: { tableId: SEED.users, columnIds: [SEED.userId] },
        end: { tableId: SEED.empty, columnIds: [EMPTY_REF] },
      }),
    ]);
    remover.dispatch([removeTableAction$(SEED.empty)]);
    await settleHooks();
    await mesh.deliverAll();

    for (const peer of mesh.peers) {
      expect(peer.state.doc.tableIds).not.toContain(SEED.empty);
      expect(peer.state.doc.relationshipIds).toEqual([
        SEED.relationship,
        'users_empty',
      ]);
      expect(relationshipOf(peer, 'users_empty')).toMatchObject({
        identification: false,
        startRelationshipType: StartRelationshipType.dash,
      });
    }
    const [linkerSide, removerSide] = mesh.peers.map(peer =>
      splitAnchors(JSON.parse(peer.runtimeValue))
    );
    expect(linkerSide.document).toEqual(removerSide.document);
    expect(linkerSide.anchors[SEED.relationship]).toEqual(
      removerSide.anchors[SEED.relationship]
    );
    expect(linkerSide.anchors.users_empty).not.toEqual(
      removerSide.anchors.users_empty
    );
  });

  it('keeps both of two links a person and an agent make at once, each peer listing them in the order it heard them', async () => {
    const mesh = await open(2);
    const [person, agent] = mesh.peers;

    person.dispatch([link('from_person', SEED.orderNote)]);
    agent.dispatch([link('from_agent', SEED.orderNote)]);
    await mesh.deliverAll();

    expect(person.state.doc.relationshipIds).toEqual([
      SEED.relationship,
      'from_person',
      'from_agent',
    ]);
    expect(agent.state.doc.relationshipIds).toEqual([
      SEED.relationship,
      'from_agent',
      'from_person',
    ]);
    const [personDocument, agentDocument] = mesh.peers.map(peer => {
      const document = JSON.parse(peer.runtimeValue);
      document.doc.relationshipIds.sort();
      return document;
    });
    expect(personDocument).toEqual(agentDocument);
  });

  it('derives the same flags from five edits in each of the 120 orders they can arrive in', async () => {
    const value = createSeedValue();
    const writers = await open(5, { value });
    const edits: AnyAction[][] = [
      [remap([SEED.orderNote])],
      [link('users_orders_again', SEED.orderUser)],
      [
        changeColumnPrimaryKeyAction({
          id: SEED.orderNote,
          tableId: SEED.orders,
          value: true,
        }),
      ],
      [
        changeColumnNotNullAction({
          id: SEED.orderNote,
          tableId: SEED.orders,
          value: true,
        }),
      ],
      [removeColumnAction({ id: SEED.orderUser, tableId: SEED.orders })],
    ];

    edits.forEach((actions, index) => writers.peers[index].dispatch(actions));
    const batches = writers.sent.map(lastBatch);

    const derived = new Set<string>();
    for (const order of permutations([0, 1, 2, 3, 4])) {
      const observer = await observe(
        value,
        order.map(index => batches[index])
      );
      const { relationships, columns } = liveDerived(observer);
      // Two links land in the order heard, which is no derived field.
      relationships.sort((a, b) => a.id.localeCompare(b.id));
      derived.add(JSON.stringify({ relationships, columns }));
      observer.destroy();
    }

    expect(derived.size).toBe(1);
    const [settled] = [...derived].map(text => JSON.parse(text));
    const keyNotNull = ColumnOption.primaryKey | ColumnOption.notNull;
    expect(settled.relationships).toEqual([
      {
        id: SEED.relationship,
        start: [SEED.userId],
        end: [SEED.orderNote],
        identification: true,
        startRelationshipType: StartRelationshipType.dash,
      },
      {
        id: 'users_orders_again',
        start: [SEED.userId],
        end: [SEED.orderUser],
        identification: false,
        startRelationshipType: StartRelationshipType.dash,
      },
    ]);
    expect(
      settled.columns.filter(({ id }: { id: string }) =>
        [SEED.orderId, SEED.orderNote].includes(id as any)
      )
    ).toEqual([
      { id: SEED.orderId, options: keyNotNull, foreignKey: false },
      { id: SEED.orderNote, options: keyNotNull, foreignKey: true },
    ]);
  });

  it('a peer that joined through the register handshake keeps the mapping it opened on when an edit of the version that handshake gave it arrives after, until it opens the document again', async () => {
    const value = createSeedValue();
    const mesh = await open(2, { value });
    const [author, relay] = mesh.peers;

    author.dispatch([remap([SEED.orderId])]);
    await mesh.deliver(1, [0]);
    // The joiner opens a copy saved before the edit, and the relay answers
    // its handshake with registers that already hold the edit's version.
    const joinerIndex = mesh.join(value);
    const joiner = mesh.peers[joinerIndex];
    await settleHooks();
    await mesh.deliver(1, [joinerIndex]);
    await mesh.deliver(joinerIndex, [1]);
    await mesh.deliver(joinerIndex, [0]);

    expect(endOf(author)).toEqual([SEED.orderId]);
    expect(endOf(relay)).toEqual([SEED.orderId]);
    expect(endOf(joiner)).toEqual([SEED.orderUser]);

    joiner.setInitialValue(author.value);
    expect(endOf(joiner)).toEqual([SEED.orderId]);
  });

  it('a peer that hears a mapping edit before the link it edits keeps the link as made, while the others agree on the edit', async () => {
    const mesh = await open(3);
    const [author, inOrder, outOfOrder] = mesh.peers;
    const linkId = 'users_orders_note';

    author.dispatch([link(linkId, SEED.orderNote)]);
    const added = lastBatch(mesh.sent[0]);
    author.dispatch([
      changeRelationshipColumnsAction({
        id: linkId,
        start: { tableId: SEED.users, columnIds: [SEED.userId] },
        end: { tableId: SEED.orders, columnIds: [SEED.orderId] },
      }),
    ]);
    const edited = lastBatch(mesh.sent[0]);
    await mesh.deliver(1, [0]);
    outOfOrder.receive(cloneDeep(edited));
    await settleHooks();
    outOfOrder.receive(cloneDeep(added));
    await settleHooks();

    expect(endOf(author, linkId)).toEqual([SEED.orderId]);
    expect(endOf(inOrder, linkId)).toEqual([SEED.orderId]);
    expect(endOf(outOfOrder, linkId)).toEqual([SEED.orderNote]);
    expectSameDocuments([author, inOrder]);
  });

  it('a readonly editor takes a mapping edit from a peer and drops its own', async () => {
    const value = createSeedValue();
    let readonly = false;
    const reader = createRxStore(
      createEngineContext({ toWidth: defaultToWidth }),
      { observable: false, getReadonly: () => readonly }
    );
    reader.dispatchSync(
      changeViewportAction({ width: 0, height: 0 }),
      initialLoadJsonAction$(value)
    );
    const readerShared = createSharedStore(reader, {
      getNickname: () => 'reader',
    });
    cleanups.push(() => {
      readerShared.destroy();
      reader.destroy();
    });
    readonly = true;
    const mesh = await open(1, { value });
    const [author] = mesh.peers;

    author.dispatch([remap([SEED.orderNote])]);
    mesh.sent[0].forEach(batch => readerShared.dispatchSync(cloneDeep(batch)));
    await settleHooks();

    expect(endOf(reader)).toEqual([SEED.orderNote]);
    expect(JSON.parse(toJson(reader.state))).toEqual(
      JSON.parse(author.runtimeValue)
    );

    reader.dispatchSync(remap([SEED.orderId]));
    await settleHooks();

    expect(endOf(reader)).toEqual([SEED.orderNote]);
  });

  describe('an editor that predates the mapping edit', () => {
    const outdated = { unknownTypes: ['relationship.changeColumns'] };

    it('keeps the mapping it had while the others move on', async () => {
      const mesh = await open(3, { peers: [{}, {}, outdated] });
      const [author, current, old] = mesh.peers;

      author.dispatch([remap([SEED.orderNote])]);
      await mesh.deliverAll();

      expect(endOf(author)).toEqual([SEED.orderNote]);
      expect(endOf(current)).toEqual([SEED.orderNote]);
      expect(endOf(old)).toEqual([SEED.orderUser]);
      expectSameDocuments([author, current]);
    });

    it('takes the remapped relationship away from every peer when it removes the column it still maps', async () => {
      const mesh = await open(3, { peers: [{}, {}, outdated] });
      const [author, , old] = mesh.peers;

      author.dispatch([remap([SEED.orderNote])]);
      await mesh.deliverAll();
      old.dispatch([removeColumnAction$(SEED.orders, [SEED.orderUser])]);
      await mesh.deliverAll();

      for (const peer of mesh.peers) {
        expect(peer.state.doc.relationshipIds).toEqual([]);
      }
    });
  });

  describe('a change racing a mapping made in Map Columns', () => {
    /** Map Columns confirming users.id onto the orders column note, which it already has. */
    const mapOntoNote = (onRefuse: () => void) =>
      mapColumnsAction$(
        {
          mode: 'create',
          startTableId: SEED.users,
          endTableId: SEED.orders,
          relationshipType: RelationshipType.ZeroN,
          keyId: `primaryKey:${SEED.users}`,
          rows: [
            {
              parentColumnId: SEED.userId,
              pick: { kind: 'existing', columnId: SEED.orderNote },
            },
          ],
        },
        { onRefuse }
      );

    /** The two writers, at one version when one is given, then a peer hearing each order of them. */
    async function race(
      change: AnyAction[] | ReturnType<typeof mapOntoNote>,
      version?: number
    ) {
      const mesh = await open(4);
      const [mapper, changer] = mesh.peers;
      const onRefuse = vi.fn();
      const stamped = (peer: HasState, actions: CompositionActions) =>
        version === undefined ? actions : flatAtVersion(peer, actions, version);

      mapper.dispatch(stamped(mapper, [mapOntoNote(onRefuse)]));
      changer.dispatch(stamped(changer, [change].flat()));
      await mesh.deliver(2, [0, 1]);
      await mesh.deliver(3, [1, 0]);
      await mesh.deliverAll();

      expect(onRefuse).not.toHaveBeenCalled();
      expectSameDocuments(mesh.peers);
      return mesh.peers.map(peer => {
        const [mapped] = query(peer.state.collections)
          .collection('relationshipEntities')
          .selectByIds(peer.state.doc.relationshipIds)
          .filter(({ end }) => end.columnIds.includes(SEED.orderNote));
        return { peer, mapped };
      });
    }

    it('a remote key change racing a mapping converges but can leave the mapping off the key the parent now has', async () => {
      const sides = await race([
        changeColumnPrimaryKeyAction({
          id: SEED.userName,
          tableId: SEED.users,
          value: true,
        }),
      ]);

      for (const { peer, mapped } of sides) {
        expect(mapped.start.columnIds).toEqual([SEED.userId]);
        expect(
          bHas(
            peer.state.collections.tableColumnEntities[SEED.userName].options,
            ColumnOption.primaryKey
          )
        ).toBe(true);
      }
    });

    it('a type typed into the child racing a mapping onto it settles on the greater of the two types written at one version', async () => {
      const sides = await race(
        changeColumnDataTypeAction$({
          tableId: SEED.orders,
          id: SEED.orderNote,
          value: 'VARCHAR(10)',
        }),
        VERSION
      );

      for (const { peer, mapped } of sides) {
        expect(mapped.start.columnIds).toEqual([SEED.userId]);
        expect(
          peer.state.collections.tableColumnEntities[SEED.orderNote].dataType
        ).toBe('VARCHAR(10)');
      }
    });

    it('the undo of one mapping and another peer’s mapping onto the same child at one version settle on the greater type', async () => {
      const mesh = await open(2);
      const [undoer, mapper] = mesh.peers;
      const onRefuse = vi.fn();

      undoer.dispatch([
        mapColumnsAction$(
          {
            mode: 'edit',
            relationshipId: SEED.relationship,
            keyId: `primaryKey:${SEED.users}`,
            rows: [
              {
                parentColumnId: SEED.userId,
                pick: { kind: 'existing', columnId: SEED.orderNote },
              },
            ],
          },
          { onRefuse }
        ),
      ]);
      await settleHooks();
      undoer.undo();
      await settleHooks();
      // The mapping writes the child's type at the version the undo did, as
      // two editors built before the slot whose clocks stand level, or two
      // editors of one slot, write it.
      const [{ version }] = lastBatch(mesh.sent[0]).filter(
        ({ type }) => type === 'column.changeDataType'
      );
      mapper.dispatch(flatAtVersion(mapper, [mapOntoNote(onRefuse)], version!));
      await settleHooks();
      const typeVersions = mesh.sent.map(sent =>
        lastBatch(sent)
          .filter(({ type }) => type === 'column.changeDataType')
          .map(({ version, payload }) => [version, payload.value])
      );
      await mesh.deliverAll();

      expect(onRefuse).not.toHaveBeenCalled();
      expect(typeVersions).toEqual([
        [[typeVersions[0][0][0], 'TEXT']],
        [[typeVersions[0][0][0], 'INT']],
      ]);
      for (const peer of mesh.peers) {
        expect(
          peer.state.collections.tableColumnEntities[SEED.orderNote].dataType
        ).toBe('TEXT');
      }
      expectSameDocuments(mesh.peers);
    });

    it('a mapping onto a table another peer removed meanwhile stays, every peer agreeing on all but the anchors of the connectors that table ended', async () => {
      // Each peer sorts its own edit before it hears the other's, and never a
      // connector one of whose tables is gone, so the ones the removed table
      // ended keep anchors that differ, drawn nowhere until the table is back.
      const mesh = await open(2);
      const [mapper, remover] = mesh.peers;
      const onRefuse = vi.fn();

      mapper.dispatch([mapOntoNote(onRefuse)]);
      remover.dispatch([removeTableAction$(SEED.orders)]);
      await settleHooks();
      await mesh.deliverAll();

      expect(onRefuse).not.toHaveBeenCalled();
      const [mappedId] = mapper.state.doc.relationshipIds;
      for (const peer of mesh.peers) {
        expect(peer.state.doc.tableIds).not.toContain(SEED.orders);
        expect(peer.state.doc.relationshipIds).toEqual([mappedId]);
        expect(endOf(peer, mappedId)).toEqual([SEED.orderNote]);
        expect(hasForeignKey(peer, SEED.orderNote)).toBe(false);
        expect(relationshipOf(peer, mappedId)).toMatchObject({
          identification: false,
          startRelationshipType: StartRelationshipType.dash,
        });
      }
      const [mapperSide, removerSide] = mesh.peers.map(peer =>
        splitAnchors(JSON.parse(peer.runtimeValue))
      );
      expect(mapperSide.document).toEqual(removerSide.document);
      expect(mapperSide.anchors).not.toEqual(removerSide.anchors);
    });

    it('a remote type change racing a mapping converges but can leave the child on the type the mapping read', async () => {
      const sides = await race(
        changeColumnDataTypeAction$({
          tableId: SEED.users,
          id: SEED.userId,
          value: 'BIGINT',
        })
      );

      for (const { peer } of sides) {
        const columns = peer.state.collections.tableColumnEntities;
        expect(columns[SEED.userId].dataType).toBe('BIGINT');
        expect(columns[SEED.orderUser].dataType).toBe('BIGINT');
        expect(columns[SEED.orderNote].dataType).toBe('INT');
      }
    });
  });

  describe('concurrent column adds keep arrival order, so the column order differs between peers', () => {
    const editWithNewColumn: MapColumnsDraft = {
      mode: 'edit',
      relationshipId: SEED.relationship,
      keyId: `primaryKey:${SEED.users}`,
      rows: [{ parentColumnId: SEED.userId, pick: { kind: 'new' } }],
    };

    /** Each peer's document with the orders column lists put in one order. */
    const withSortedOrders = (peer: HasRuntimeValue) => {
      const document = JSON.parse(peer.runtimeValue);
      const orders = document.collections.tableEntities[SEED.orders];
      orders.columnIds.sort();
      orders.seqColumnIds.sort();
      return document;
    };

    it('two edits that each add a new column settle on one mapping and leave the other column unmapped, each peer listing its own column first', async () => {
      const mesh = await open(2);
      const [first, second] = mesh.peers;

      first.dispatch(
        atVersion(
          toMapColumnsActions(
            first.state,
            editWithNewColumn,
            idsOf('orders_new_a')
          ),
          VERSION
        )
      );
      second.dispatch(
        atVersion(
          toMapColumnsActions(
            second.state,
            editWithNewColumn,
            idsOf('orders_new_b')
          ),
          VERSION
        )
      );
      await mesh.deliverAll();

      const seeded = [SEED.orderId, SEED.orderUser, SEED.orderNote];
      expect(ordersColumnIds(first)).toEqual([
        ...seeded,
        'orders_new_a',
        'orders_new_b',
      ]);
      expect(ordersColumnIds(second)).toEqual([
        ...seeded,
        'orders_new_b',
        'orders_new_a',
      ]);
      for (const peer of mesh.peers) {
        const orders = peer.state.collections.tableEntities[SEED.orders];
        expect(orders.seqColumnIds).toEqual(orders.columnIds);
        expect(endOf(peer)).toEqual(['orders_new_b']);
        expect(hasForeignKey(peer, 'orders_new_b')).toBe(true);
        expect(hasForeignKey(peer, 'orders_new_a')).toBe(false);
      }
      expect(withSortedOrders(first)).toEqual(withSortedOrders(second));
    });

    it('a mapping that adds a new column and a plain column added beside it land in the order each peer heard them', async () => {
      const mesh = await open(2);
      const [mapper, adder] = mesh.peers;

      mapper.dispatch(
        toMapColumnsActions(
          mapper.state,
          {
            mode: 'create',
            startTableId: SEED.users,
            endTableId: SEED.orders,
            relationshipType: RelationshipType.ZeroN,
            keyId: `primaryKey:${SEED.users}`,
            rows: [{ parentColumnId: SEED.userId, pick: { kind: 'new' } }],
          },
          idsOf('orders_mapped', 'users_orders_mapped')
        )
      );
      adder.dispatch([
        addColumnAction({ id: 'orders_plain', tableId: SEED.orders }),
      ]);
      await mesh.deliverAll();

      const seeded = [SEED.orderId, SEED.orderUser, SEED.orderNote];
      expect(ordersColumnIds(mapper)).toEqual([
        ...seeded,
        'orders_mapped',
        'orders_plain',
      ]);
      expect(ordersColumnIds(adder)).toEqual([
        ...seeded,
        'orders_plain',
        'orders_mapped',
      ]);
      for (const peer of mesh.peers) {
        expect(endOf(peer, 'users_orders_mapped')).toEqual(['orders_mapped']);
      }
      expect(withSortedOrders(mapper)).toEqual(withSortedOrders(adder));
    });
  });
});

describe('writes at one counter converge on the greater slot', () => {
  const meshes: Mesh[] = [];

  /** Lets every hook a batch woke run: the 5 ms windows and the microtasks. */
  const settleHooks = async () => {
    await vi.advanceTimersByTimeAsync(20);
  };

  /** Peers on the seed, each with a replica, past the opening handshake. */
  async function open(peers: MeshOptions['peers'] = [{}, {}, {}, {}]) {
    const mesh = createMesh(peers.length, {
      settle: settleHooks,
      replicas: true,
      peers,
    });
    meshes.push(mesh);
    await settleHooks();
    await mesh.deliverAll();
    return mesh;
  }

  /**
   * The two writers' batches to the third peer in their order and to the fourth
   * in the other, then everything to everyone, so each order of them is met.
   */
  async function deliverBothOrders(mesh: Mesh) {
    await mesh.deliver(2, [0, 1]);
    await mesh.deliver(3, [1, 0]);
    await mesh.deliverAll();
  }

  /** The version of the last action of the type given that the peer sent. */
  const sentVersion = (mesh: Mesh, index: number, type: string) =>
    lastBatch(mesh.sent[index])
      .filter(action => action.type === type)
      .pop()!.version!;

  const nameOf = ({ state }: HasState) =>
    state.collections.tableEntities[SEED.users].name;

  const renameUsers = (value: string) =>
    changeTableNameAction({ id: SEED.users, value });

  /** Every replica saves the file its peer holds. */
  const expectReplicasWithPeers = ({ peers, replicas }: Mesh) => {
    expect(replicas).toHaveLength(peers.length);
    replicas.forEach((replica, index) =>
      expect(JSON.parse(replica.value)).toEqual(JSON.parse(peers[index].value))
    );
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    meshes.splice(0).forEach(mesh => mesh.destroy());
    vi.useRealTimers();
  });

  it('ends two renames of one table from one clock on the greater version, in every order and on every replica (AC-T2)', async () => {
    const mesh = await open();
    const [a, b] = mesh.peers;

    a.dispatch([renameUsers('products_A')]);
    b.dispatch([renameUsers('products_B')]);
    const versionA = sentVersion(mesh, 0, 'table.changeName');
    const versionB = sentVersion(mesh, 1, 'table.changeName');
    await deliverBothOrders(mesh);

    expect(counterOf(versionA)).toBe(counterOf(versionB));
    expect(versionA).not.toBe(versionB);
    const winner = versionA > versionB ? 'products_A' : 'products_B';
    for (const peer of mesh.peers) {
      expect(nameOf(peer)).toBe(winner);
      expect(peer.state.lww[SEED.users][3].name).toBe(
        Math.max(versionA, versionB)
      );
    }
    expectSameDocuments(mesh.peers);
    expectReplicasWithPeers(mesh);
  });

  it.each([
    ['the add', true],
    ['the remove', false],
  ])(
    'ends an add and a remove of one table at one counter on the greater of the two, %s, in every order and on every replica (AC-T2)',
    async (_greater, addWins) => {
      const mesh = await open();
      // Of one counter the greater slot writes the greater version, so the
      // writers take their parts by slot and each side wins on every run.
      const [lower, upper] = [0, 1].sort(
        (a, b) =>
          slotOf(mesh.peers[a].editorId) - slotOf(mesh.peers[b].editorId)
      );
      const [adderIndex, removerIndex] = addWins
        ? [upper, lower]
        : [lower, upper];
      const adder = mesh.peers[adderIndex];
      const remover = mesh.peers[removerIndex];

      // The adder takes the table out and back, the remover renames another
      // first, so the add and the remove both stand at the second counter.
      adder.dispatch([removeTableAction$(SEED.empty)]);
      adder.undo();
      remover.dispatch([
        changeTableNameAction({ id: SEED.orders, value: 'purchases' }),
      ]);
      remover.dispatch([removeTableAction$(SEED.empty)]);
      const added = sentVersion(mesh, adderIndex, 'table.add');
      const removed = sentVersion(mesh, removerIndex, 'table.remove');
      await deliverBothOrders(mesh);

      expect(counterOf(added)).toBe(counterOf(removed));
      expect(added > removed).toBe(addWins);
      for (const peer of mesh.peers) {
        expect(peer.state.doc.tableIds.includes(SEED.empty)).toBe(addWins);
      }
      expectSameDocuments(mesh.peers);
      expectReplicasWithPeers(mesh);
    }
  );

  describe('in a session with editors built before the slot (AC-T3)', () => {
    const mixed = [
      {},
      {},
      { legacy: true as const },
      { legacy: true as const },
    ];

    it('ends a race of two peer stores on the greater version on the editors built before the slot too, whichever order they hear it in', async () => {
      const mesh = await open(mixed);
      const [a, b, older] = mesh.peers;

      a.dispatch([renameUsers('products_A')]);
      b.dispatch([renameUsers('products_B')]);
      const versionA = sentVersion(mesh, 0, 'table.changeName');
      const versionB = sentVersion(mesh, 1, 'table.changeName');
      await deliverBothOrders(mesh);
      older.dispatch([
        changeTableNameAction({ id: SEED.orders, value: 'purchases' }),
      ]);
      await mesh.deliverAll();

      const winner = versionA > versionB ? 'products_A' : 'products_B';
      for (const peer of mesh.peers) {
        expect(nameOf(peer)).toBe(winner);
        expect(peer.state.collections.tableEntities[SEED.orders].name).toBe(
          'purchases'
        );
        expect(peer.state.lww[SEED.users]).toEqual(a.state.lww[SEED.users]);
        expect(peer.state.lww[SEED.orders]).toEqual(a.state.lww[SEED.orders]);
      }
    });

    it('lets a peer store’s write win over one an editor built before the slot made at once, on every peer and replica', async () => {
      const mesh = await open(mixed);
      const [a, , older] = mesh.peers;

      a.dispatch([renameUsers('products_A')]);
      older.dispatch([renameUsers('products_old')]);
      await mesh.deliverAll();

      expect(sentVersion(mesh, 0, 'table.changeName')).toBeGreaterThan(
        sentVersion(mesh, 2, 'table.changeName')
      );
      for (const peer of mesh.peers) {
        expect(nameOf(peer)).toBe('products_A');
      }
      for (const replica of mesh.replicas) {
        expect(
          JSON.parse(replica.value).collections.tableEntities[SEED.users].name
        ).toBe('products_A');
      }
    });
  });
});

describe('geometry converges through its registers', () => {
  const meshes: Mesh[] = [];
  const closers: Array<() => void> = [];

  /** Lets every hook a batch woke run: the 5 ms windows and the microtasks. */
  const settleHooks = async () => {
    await vi.advanceTimersByTimeAsync(20);
  };

  /**
   * Peers on the seed, each with a replica, past the opening handshake, the
   * viewport unlocked so a replica's file shows the viewport it holds.
   */
  async function open(peers: MeshOptions['peers'] = [{}, {}, {}, {}]) {
    const mesh = createMesh(peers.length, {
      settle: settleHooks,
      replicas: true,
      peers,
    });
    meshes.push(mesh);
    await settleHooks();
    await mesh.deliverAll();
    mesh.peers[0].dispatch([
      changeLockSettingsAction$(LockSettingType.viewport, false),
    ]);
    await mesh.deliverAll();
    return mesh;
  }

  /** The two writers' batches to the third peer in their order and to the fourth in the other. */
  async function deliverBothOrders(mesh: Mesh) {
    await mesh.deliver(2, [0, 1]);
    await mesh.deliver(3, [1, 0]);
    await mesh.deliverAll();
  }

  type Geometry = { x: number; y: number; width?: number; height?: number };

  const COLLECTION = {
    table: 'tableEntities',
    memo: 'memoEntities',
    group: 'tableGroupEntities',
  } as const;

  /** An entity's point, and its size when it has one, as the store's document holds it. */
  const geometryOf = (
    store: HasRuntimeValue,
    kind: keyof typeof COLLECTION,
    id: string
  ): Geometry => {
    const { ui } = JSON.parse(store.runtimeValue).collections[COLLECTION[kind]][
      id
    ];
    return kind === 'table'
      ? { x: ui.x, y: ui.y }
      : { x: ui.x, y: ui.y, width: ui.width, height: ui.height };
  };

  /** Every peer and every replica of the mesh holds the entity where the first peer does. */
  const expectEverywhere = (
    mesh: Mesh,
    kind: keyof typeof COLLECTION,
    id: string,
    expected = geometryOf(mesh.peers[0], kind, id)
  ) => {
    for (const store of [...mesh.peers, ...mesh.replicas]) {
      expect(geometryOf(store, kind, id)).toEqual(expected);
    }
    return expected;
  };

  /** The viewport a replica saves. */
  const viewportOf = (store: HasRuntimeValue) =>
    pick(JSON.parse(store.runtimeValue).settings, [
      'originX',
      'originY',
      'zoomLevel',
    ]);

  /** The version of the last action of the type given that the peer sent. */
  const sentVersion = (mesh: Mesh, index: number, type: string) =>
    mesh.sent[index]
      .flat()
      .filter(action => action.type === type)
      .pop()!.version!;

  const step = (ids: string[], movementX: number, movementY = 0) =>
    moveTableAction({ ids, movementX, movementY });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    meshes.splice(0).forEach(mesh => mesh.destroy());
    closers.splice(0).forEach(close => close());
    vi.useRealTimers();
  });

  it('lands each absolute write of a drag, a resize, a pan and a zoom once, though every batch arrives twice (AC-M1)', async () => {
    const mesh = await open([{}, {}]);
    const [mover] = mesh.peers;

    mover.dispatch([step([SEED.users], 40, 25)]);
    mover.dispatch([
      resizeMemoAction({ id: SEED.memo, x: 0, y: 0, width: 260, height: 180 }),
    ]);
    mover.dispatch([
      moveMemoAction({ ids: [SEED.memo], movementX: -30, movementY: 0 }),
    ]);
    mover.dispatch([
      resizeTableGroupAction({
        id: SEED.group,
        x: 10,
        y: 10,
        width: 500,
        height: 300,
      }),
    ]);
    mover.dispatch([
      moveTableGroupAction({ ids: [SEED.group], movementX: 0, movementY: 30 }),
    ]);
    mover.dispatch([streamScrollToAction({ movementX: 70, movementY: -20 })]);
    mover.dispatch([streamZoomLevelAction({ value: -0.25 })]);
    await mesh.deliver(1, [0], { duplicate: true });

    const sentTypes = mesh.sent[0].flat().map(({ type }) => type);
    for (const relative of [
      'table.move',
      'memo.move',
      'tableGroup.move',
      'settings.streamScrollTo',
      'settings.streamZoomLevel',
    ]) {
      expect(sentTypes).not.toContain(relative);
    }
    expectEverywhere(mesh, 'table', SEED.users);
    expectEverywhere(mesh, 'memo', SEED.memo, {
      x: -30,
      y: 0,
      width: 260,
      height: 180,
    });
    expectEverywhere(mesh, 'group', SEED.group, {
      x: 10,
      y: 40,
      width: 500,
      height: 300,
    });
    const viewport = pick(mover.state.settings, [
      'originX',
      'originY',
      'zoomLevel',
    ]);
    expect(viewport.zoomLevel).toBe(0.75);
    mesh.replicas.forEach(replica =>
      expect(viewportOf(replica)).toEqual(viewport)
    );
  });

  it('ends two moves of one table made at once on the greater version’s point, in every order, on every peer and replica (AC-M2)', async () => {
    const mesh = await open();
    const [a, b] = mesh.peers;

    a.dispatch([step([SEED.users], 120)]);
    b.dispatch([step([SEED.users], 0, -80)]);
    const versionA = sentVersion(mesh, 0, 'table.moveTo');
    const versionB = sentVersion(mesh, 1, 'table.moveTo');
    const pointA = geometryOf(a, 'table', SEED.users);
    const pointB = geometryOf(b, 'table', SEED.users);
    await deliverBothOrders(mesh);

    expect(counterOf(versionA)).toBe(counterOf(versionB));
    expectEverywhere(
      mesh,
      'table',
      SEED.users,
      versionA > versionB ? pointA : pointB
    );
    for (const peer of mesh.peers) {
      expect(peer.state.lww[SEED.users][3]['ui.position']).toBe(
        Math.max(versionA, versionB)
      );
    }
  });

  it.each([1, 2, 3])(
    'ends a move and a resize of one memo and one group made at once on one rect, delivered in the order seed %i picks, on every peer and replica (AC-P5)',
    async seed => {
      const mesh = await open();
      const [mover, resizer] = mesh.peers;

      mover.dispatch([
        moveMemoAction({ ids: [SEED.memo], movementX: 50, movementY: 50 }),
        moveTableGroupAction({
          ids: [SEED.group],
          movementX: -40,
          movementY: 0,
        }),
      ]);
      resizer.dispatch([
        resizeMemoAction({
          id: SEED.memo,
          x: 880,
          y: 90,
          width: 300,
          height: 240,
        }),
        resizeTableGroupAction({
          id: SEED.group,
          x: 50,
          y: 50,
          width: 520,
          height: 260,
        }),
      ]);
      const moved = sentVersion(mesh, 0, 'memo.moveTo');
      const resized = sentVersion(mesh, 1, 'memo.resize');
      const pointOf = (kind: 'memo' | 'group', id: string) => {
        const { x, y } = geometryOf(
          moved > resized ? mover : resizer,
          kind,
          id
        );
        const { width, height } = geometryOf(resizer, kind, id);
        return { x, y, width, height };
      };
      const memo = pointOf('memo', SEED.memo);
      const group = pointOf('group', SEED.group);
      for (let to = 0; to < mesh.peers.length; to++) {
        await mesh.deliver(to, undefined, { shuffle: seed + to });
      }
      await mesh.deliverAll();

      expectEverywhere(mesh, 'memo', SEED.memo, memo);
      expectEverywhere(mesh, 'group', SEED.group, group);
      expectSameDocuments(mesh.peers);
    }
  );

  /**
   * A user store, which holds a drag for its 200 ms window as an element does,
   * beside an observer with a replica and a writer, on the seed and past the
   * opening handshake; take hands the batches given to the stores named.
   */
  async function openWindow() {
    const value = createSeedValue();
    const user = createUserStore(value);
    const [observer, writer] = ['observer', 'writer'].map(nickname => {
      const peer = createPeerStore({ nickname, presence: false });
      peer.setInitialValue(value);
      return peer;
    });
    const replica = createReplicationStore({ toWidth: defaultToWidth });
    replica.setInitialValue(value);
    const fromUser: AnyAction[][] = [];
    const fromWriter: AnyAction[][] = [];
    const fromObserver: AnyAction[][] = [];
    closers.push(
      user.sharedStore.subscribe(actions => fromUser.push(cloneDeep(actions))),
      writer.subscribe(actions => fromWriter.push(cloneDeep(actions))),
      observer.subscribe(actions => fromObserver.push(cloneDeep(actions))),
      user.destroy,
      () => [observer, writer, replica].forEach(store => store.destroy())
    );
    const take = (
      batches: AnyAction[][],
      ...stores: Array<'user' | 'observer' | 'writer'>
    ) => {
      for (const actions of batches.splice(0)) {
        for (const store of stores) {
          if (store === 'user') {
            user.sharedStore.dispatchSync(cloneDeep(actions));
          } else if (store === 'observer') {
            observer.receive(cloneDeep(actions));
            replica.dispatchSync(cloneDeep(actions));
          } else {
            writer.receive(cloneDeep(actions));
          }
        }
      }
    };
    /** Has the writer rename the empty table until its counter reaches the version's. */
    const writeUpTo = (version: number) => {
      let written = 0;
      while (counterOf(written) < counterOf(version)) {
        writer.dispatch([
          changeTableNameAction({ id: SEED.empty, value: `empty_${written}` }),
        ]);
        written = lastBatch(fromWriter)[0].version!;
      }
    };
    await vi.advanceTimersByTimeAsync(400);
    take(fromUser, 'observer', 'writer');
    take(fromWriter, 'observer', 'user');
    await vi.advanceTimersByTimeAsync(400);
    take(fromUser, 'observer', 'writer');

    fromObserver.length = 0;

    return {
      user,
      observer,
      writer,
      replica,
      fromUser,
      fromWriter,
      fromObserver,
      take,
      writeUpTo,
    };
  }

  it('ends two tables a window drags in one burst apart, each at its own steps’ version, when a third peer’s write of one arrives late (AC-P6)', async () => {
    const {
      user,
      observer,
      writer,
      replica,
      fromUser,
      fromWriter,
      take,
      writeUpTo,
    } = await openWindow();

    // Two steps of users, then two of orders, within one 200 ms burst.
    for (const id of [SEED.users, SEED.users, SEED.orders, SEED.orders]) {
      user.rxStore.dispatchSync(step([id], 30));
    }
    await vi.advanceTimersByTimeAsync(400);
    const burst = fromUser.flat();
    const versionOfMove = (id: string) =>
      burst.find(
        ({ type, payload }) => type === 'table.moveTo' && payload.id === id
      )!.version!;
    // The writer, which has heard none of the burst, writes users one counter
    // past the version users stands at in the window, below the burst's last.
    writeUpTo(versionOfMove(SEED.users));
    writer.dispatch([moveToTableAction({ id: SEED.users, x: -500, y: -400 })]);
    const versionOfWrite = lastBatch(fromWriter)[0].version!;
    expect(versionOfWrite).toBeGreaterThan(versionOfMove(SEED.users));
    expect(versionOfWrite).toBeLessThan(versionOfMove(SEED.orders));

    take(fromUser, 'observer', 'writer');
    take(fromWriter, 'observer', 'user');
    await vi.advanceTimersByTimeAsync(400);

    const orders = user.rxStore.state.collections.tableEntities[SEED.orders].ui;
    for (const store of [
      observer,
      writer,
      replica,
      { runtimeValue: toJson(user.rxStore.state) },
    ]) {
      expect(geometryOf(store, 'table', SEED.users)).toEqual({
        x: -500,
        y: -400,
      });
      expect(geometryOf(store, 'table', SEED.orders)).toEqual({
        x: orders.x,
        y: orders.y,
      });
    }
  });

  it('ends a lone scroll and a zoom made at once on one viewport on every replica, in every order (AC-P7)', async () => {
    const mesh = await open();
    const [scroller, zoomer] = mesh.peers;

    scroller.dispatch([scrollToAction({ originX: 300, originY: -120 })]);
    zoomer.dispatch([changeZoomLevelAction$(0.5)]);
    await deliverBothOrders(mesh);

    const scrolled = sentVersion(mesh, 0, 'settings.scrollTo');
    const zoomed = sentVersion(mesh, 1, 'settings.scrollTo');
    const [first, ...rest] = mesh.replicas.map(viewportOf);
    expect(first.zoomLevel).toBe(0.5);
    expect(pick(first, ['originX', 'originY'])).toEqual(
      pick((scrolled > zoomed ? scroller : zoomer).state.settings, [
        'originX',
        'originY',
      ])
    );
    rest.forEach(viewport => expect(viewport).toEqual(first));
  });

  it('ends a removed table one peer moves where the other’s undo of the removal brings it back, the same on every peer and replica (AC-P8)', async () => {
    const mesh = await open([{}, {}, {}]);
    const [mover, remover] = mesh.peers;
    const seed = geometryOf(mover, 'table', SEED.empty);

    remover.dispatch([removeTableAction$(SEED.empty)]);
    await mesh.deliverAll();
    mover.dispatch([step([SEED.empty], 150, 75)]);
    await mesh.deliverAll();
    remover.undo();
    await mesh.deliverAll();

    for (const peer of mesh.peers) {
      expect(peer.state.doc.tableIds).toContain(SEED.empty);
    }
    expectEverywhere(mesh, 'table', SEED.empty, {
      x: seed.x + 150,
      y: seed.y + 75,
    });
    expectSameDocuments([...mesh.peers, ...mesh.replicas]);
  });

  it('lets the absolute point a drag ends at stand everywhere, over a peer’s newer write that came in while its window stood open (AC-P16)', async () => {
    const {
      user,
      observer,
      writer,
      replica,
      fromUser,
      fromWriter,
      take,
      writeUpTo,
    } = await openWindow();
    const userView = () => ({ runtimeValue: toJson(user.rxStore.state) });

    user.rxStore.dispatchSync(step([SEED.users], 30));
    const stepped = user.rxStore.state.lww[SEED.users][3]['ui.position'];
    writeUpTo(stepped);
    writer.dispatch([moveToTableAction({ id: SEED.users, x: -300, y: -300 })]);
    const written = lastBatch(fromWriter)[0].version!;
    expect(written).toBeGreaterThan(stepped);
    take(fromWriter, 'observer', 'user');

    expect(fromUser).toEqual([]);
    expect(geometryOf(userView(), 'table', SEED.users)).toEqual({
      x: -300,
      y: -300,
    });

    user.rxStore.dispatchSync(step([SEED.users], 30));
    await vi.advanceTimersByTimeAsync(400);
    const moves = fromUser.flat().filter(({ type }) => type === 'table.moveTo');
    expect(moves).toHaveLength(1);
    expect(moves[0].version).toBeGreaterThan(written);
    take(fromUser, 'observer', 'writer');

    for (const store of [observer, writer, replica, userView()]) {
      expect(geometryOf(store, 'table', SEED.users)).toEqual({
        x: -270,
        y: -300,
      });
    }
  });

  it('lets a peer’s write stand everywhere over a window’s drag, though a third peer’s answer to a join raised the window’s register to it before the write arrived (AC-P1)', async () => {
    const {
      user,
      observer,
      writer,
      replica,
      fromUser,
      fromWriter,
      fromObserver,
      take,
      writeUpTo,
    } = await openWindow();
    const userView = () => ({ runtimeValue: toJson(user.rxStore.state) });

    user.rxStore.dispatchSync(step([SEED.users], 30));
    const stepped = user.rxStore.state.lww[SEED.users][3]['ui.position'];
    writeUpTo(stepped);
    writer.dispatch([moveToTableAction({ id: SEED.users, x: -300, y: -300 })]);
    const written = lastBatch(fromWriter)[0].version!;
    expect(written).toBeGreaterThan(stepped);
    // The observer hears the write and answers a joiner, and the answer
    // reaches the window ahead of the write, which brings no point.
    take([...fromWriter], 'observer');
    observer.receive({
      ...getLWWAction(),
      version: 1,
      tags: Tag.shared,
      meta: { editorId: 'joiner' },
    });
    take(fromObserver, 'user');
    expect(user.rxStore.state.lww[SEED.users][3]['ui.position']).toBe(written);
    expect(geometryOf(userView(), 'table', SEED.users)).not.toEqual({
      x: -300,
      y: -300,
    });

    await vi.advanceTimersByTimeAsync(400);
    const moves = fromUser.flat().filter(({ type }) => type === 'table.moveTo');
    expect(moves).toHaveLength(1);
    expect(moves[0].version).toBe(stepped);
    take(fromUser, 'observer', 'writer');
    take(fromWriter, 'user');

    for (const store of [observer, writer, replica, userView()]) {
      expect(geometryOf(store, 'table', SEED.users)).toEqual({
        x: -300,
        y: -300,
      });
    }
  });

  it('ends a window’s drag on every replica, though another window that answered a join closed with its own drag of the table still held', async () => {
    const value = createSeedValue();
    const windows = [createUserStore(value), createUserStore(value)];
    const replicas = windows.map(() => {
      const replica = createReplicationStore({ toWidth: defaultToWidth });
      replica.setInitialValue(value);
      return replica;
    });
    const outboxes: AnyAction[][][] = [[], []];
    const unsubscribes = windows.map(({ sharedStore }, index) =>
      sharedStore.subscribe(actions => outboxes[index].push(cloneDeep(actions)))
    );
    const open = [true, true];
    closers.push(
      () => unsubscribes.forEach(unsubscribe => unsubscribe()),
      () => windows.forEach(({ destroy }, index) => open[index] && destroy()),
      () => replicas.forEach(replica => replica.destroy())
    );
    /** Each open window's sends to the other, and to both replicas, the first hearing the first window first. */
    const exchange = () => {
      const [fromFirst, fromSecond] = outboxes.map(outbox => outbox.splice(0));
      const hand = (
        batches: AnyAction[][],
        take: (actions: AnyAction[]) => void
      ) => batches.forEach(actions => take(cloneDeep(actions)));
      if (open[1]) {
        hand(fromFirst, actions =>
          windows[1].sharedStore.dispatchSync(actions)
        );
      }
      hand(fromSecond, actions => windows[0].sharedStore.dispatchSync(actions));
      hand([...fromFirst, ...fromSecond], replicas[0].dispatchSync);
      hand([...fromSecond, ...fromFirst], replicas[1].dispatchSync);
    };
    for (let round = 0; round < 2; round++) {
      await vi.advanceTimersByTimeAsync(400);
      exchange();
    }

    const seed = geometryOf(replicas[0], 'table', SEED.users);
    windows[0].rxStore.dispatchSync(step([SEED.users], 100));
    windows[1].rxStore.dispatchSync(step([SEED.users], 0, 40));
    windows[1].rxStore.dispatchSync(step([SEED.users], 0, 40));
    const [first, second] = windows.map(
      ({ rxStore }) => rxStore.state.lww[SEED.users][3]['ui.position']
    );
    expect(counterOf(second)).toBe(counterOf(first) + 1);
    // A joiner asks both, and the second closes before its drag's window ends.
    for (const { sharedStore } of windows) {
      sharedStore.dispatchSync({
        ...getLWWAction(),
        version: 1,
        tags: Tag.shared,
        meta: { editorId: 'joiner' },
      });
    }
    exchange();
    unsubscribes[1]();
    windows[1].destroy();
    open[1] = false;
    await vi.advanceTimersByTimeAsync(400);
    exchange();

    // The closed window's drag left before its answer, and its later step wins.
    const point = { x: seed.x, y: seed.y + 80 };
    for (const store of [
      { runtimeValue: toJson(windows[0].rxStore.state) },
      ...replicas,
    ]) {
      expect(geometryOf(store, 'table', SEED.users)).toEqual(point);
    }
  });

  describe('in a session with editors built before the registers', () => {
    const mixed = [{}, { legacy: true as const }, {}];

    it('adds their relative move outside every register, while a peer store sends none (AC-M3)', async () => {
      const mesh = await open(mixed);
      const [peer, older, other] = mesh.peers;
      const before = geometryOf(peer, 'table', SEED.users);

      older.dispatch([step([SEED.users], 40, 10)]);
      await mesh.deliverAll();

      expect(mesh.sent[1].flat().map(({ type }) => type)).toContain(
        'table.move'
      );
      for (const store of [peer, other, ...mesh.replicas]) {
        expect(geometryOf(store, 'table', SEED.users)).toEqual({
          x: before.x + 40,
          y: before.y + 10,
        });
      }
      for (const store of [peer, other]) {
        expect(store.state.lww[SEED.users]?.[3]['ui.position']).toBeUndefined();
      }
      // A write at the lowest version still lands on each replica, as one
      // would on a register no write has reached.
      mesh.replicas.forEach(replica =>
        replica.dispatchSync([
          { ...moveToTableAction({ id: SEED.users, x: 1, y: 2 }), version: 0 },
        ])
      );
      mesh.replicas.forEach(replica =>
        expect(geometryOf(replica, 'table', SEED.users)).toEqual({ x: 1, y: 2 })
      );

      peer.dispatch([step([SEED.users], 5)]);
      expect(lastBatch(mesh.sent[0]).map(({ type }) => type)).toEqual([
        'table.moveTo',
      ]);
    });

    it('adds their zoom and pan steps outside each replica’s registers (AC-P14)', async () => {
      const mesh = await open(mixed);
      const [, older] = mesh.peers;

      older.dispatch([streamZoomLevelAction({ value: -0.25 })]);
      older.dispatch([streamScrollToAction({ movementX: 60, movementY: 0 })]);
      await mesh.deliverAll();

      expect(mesh.sent[1].flat().map(({ type }) => type)).toEqual(
        expect.arrayContaining([
          'settings.streamZoomLevel',
          'settings.streamScrollTo',
        ])
      );
      // Neither register took a version from those steps, so writes at the
      // lowest version still land.
      for (const replica of mesh.replicas) {
        expect(viewportOf(replica).zoomLevel).toBe(0.75);
        replica.dispatchSync([
          { ...changeZoomLevelAction({ value: 0.5 }), version: 0 },
          { ...scrollToAction({ originX: 7, originY: 8 }), version: 0 },
        ]);
        expect(viewportOf(replica)).toEqual({
          originX: 7,
          originY: 8,
          zoomLevel: 0.5,
        });
      }
    });
  });
});
