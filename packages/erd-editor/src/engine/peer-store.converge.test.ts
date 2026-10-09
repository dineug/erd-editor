// @vitest-environment node

import { query, toJson } from '@dineug/erd-editor-schema';
import type { AnyAction } from '@dineug/r-html';
import { cloneDeep } from 'es-toolkit';
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
  comparable,
  createSeedValue,
  createSession,
  SEED,
  type Session,
  settle,
} from '@/__test-utils__/peerSeed';
import { mapColumnsAction$ } from '@/components/map-columns/mapColumnsAction';
import {
  ColumnOption,
  ColumnUIKey,
  RelationshipType,
  StartRelationshipType,
} from '@/constants/schema';
import { createEngineContext } from '@/engine/context';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { initialLoadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import {
  addRelationshipAction,
  changeRelationshipColumnsAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import { changeDDLScriptAction } from '@/engine/modules/settings/atom.actions';
import {
  changeTableNameAction,
  sortTableAction,
} from '@/engine/modules/table/atom.actions';
import { removeTableAction$ } from '@/engine/modules/table/generator.actions';
import {
  addColumnAction,
  changeColumnCommentAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
  removeColumnAction,
} from '@/engine/modules/table-column/atom.actions';
import {
  changeColumnDataTypeAction$,
  removeColumnAction$,
} from '@/engine/modules/table-column/generator.actions';
import { createPeerStore, type PeerStore } from '@/engine/peer-store';
import { createReplicationStore } from '@/engine/replication-store';
import { createRxStore } from '@/engine/rx-store';
import { createSharedStore } from '@/engine/shared-store';
import type { RootState } from '@/engine/state';
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

/** Both sides' documents, meta aside, since each replica stamps its own. */
const sides = ({ peer, user }: Session) => [
  comparable(peer.value),
  comparable(toJson(user.rxStore.state)),
];

const expectConverged = (session: Session) => {
  const [peer, user] = sides(session);
  expect(peer).toEqual(user);
};

describe('a peer store and an element’s store converge (AC-E5)', () => {
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
const VERSION = 10_000;

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

  const expectSameDocuments = (stores: PeerStore[]) => {
    const [first, ...rest] = stores.map(store => comparable(store.value));
    rest.forEach(document => expect(document).toEqual(first));
  };

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
    expect(comparable(replica.value)).toEqual(comparable(author.value));
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
      splitAnchors(comparable(peer.value))
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
      const document = comparable(peer.value);
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
    expect(comparable(toJson(reader.state))).toEqual(comparable(author.value));

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

    /** The two writers, then a peer hearing each order of them. */
    async function race(change: AnyAction[] | ReturnType<typeof mapOntoNote>) {
      const mesh = await open(4);
      const [mapper, changer] = mesh.peers;
      const onRefuse = vi.fn();

      mapper.dispatch([mapOntoNote(onRefuse)]);
      changer.dispatch([change].flat());
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
        })
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
      // One edit of its own brings the mapper's clock level with the undo's,
      // so its mapping writes the child's type at the version the undo did.
      mapper.dispatch([
        changeTableNameAction({ id: SEED.empty, value: 'void' }),
      ]);
      mapper.dispatch([mapOntoNote(onRefuse)]);
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
        splitAnchors(comparable(peer.value))
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
    const withSortedOrders = (peer: PeerStore) => {
      const document = comparable(peer.value);
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
