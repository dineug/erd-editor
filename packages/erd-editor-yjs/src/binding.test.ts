// @vitest-environment node
import {
  CanvasType,
  type PeerStore,
  settingsActions,
  tableActions,
} from '@dineug/erd-editor/peer.js';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type * as Y from 'yjs';

import {
  addTable,
  entriesOf,
  expectConverged,
  rename,
  tableNames,
} from '@/__test-utils__/edits';
import { createHarness, type Harness } from '@/__test-utils__/harness';
import { instrumentPeer } from '@/__test-utils__/instrumentPeer';
import { MODULE_SCENARIOS } from '@/__test-utils__/scenarios';
import { isFollowing, isLogged } from '@/classify';
import { getLog } from '@/log';
import type { PortAction } from '@/port';
import { getSnapshotMap, readSnapshot } from '@/snapshot';

let harness: Harness;

afterEach(() => harness?.cleanup());

const setup = () => (harness = createHarness());

/** A seeded room of two clients and a replica on the server's Y.Doc. */
const seededRoom = () => {
  const { room, peer, bind } = setup();
  const a = peer('a');
  const b = peer('b');
  const server = peer('server');
  const clientA = room.join();
  const clientB = room.join();
  const bindingA = bind(a, clientA.doc);
  expect(bindingA.seed()).toBe(true);
  const bindingB = bind(b, clientB.doc);
  const replica = bind(server, room.server);
  return { a, b, server, clientA, clientB, bindingA, bindingB, replica };
};

describe('join and live edits', () => {
  it('AC-A1 an offline client and an online one both edit, and every client, the server replica and a late joiner end alike', () => {
    const { a, b, server, clientB } = seededRoom();
    const shared = addTable(a, 'shared');

    clientB.disconnect();
    addTable(b, 'offline');
    rename(b, shared, 'renamed offline');
    addTable(a, 'online');
    expect(tableNames(a)).toEqual(['online', 'shared']);

    clientB.connect();
    expectConverged([a, b, server]);
    expect(tableNames(a)).toEqual(['offline', 'online', 'renamed offline']);

    const late = harness.peer('late');
    harness.bind(late, harness.room.join().doc);
    expectConverged([a, late]);
  });

  it('AC-A1 the same holds when the server compacts while the client is offline', () => {
    const { a, b, server, clientB, bindingB, replica } = seededRoom();
    const shared = addTable(a, 'shared');
    const rejoins = vi.fn();
    bindingB.on('rejoin', rejoins);

    clientB.disconnect();
    addTable(b, 'offline');
    rename(a, shared, 'renamed online');
    expect(replica.compact()).toEqual({ compacted: true, generation: 1 });

    clientB.connect();
    expect(rejoins).toHaveBeenCalledWith('snapshot');
    expectConverged([a, b, server]);
    expect(tableNames(b)).toEqual(['offline', 'renamed online']);

    const late = harness.peer('late');
    harness.bind(late, harness.room.join().doc);
    expectConverged([a, late]);
  });

  it('AC-A2 a binding never applies its own entries, and none is applied twice across a snapshot', () => {
    const { room, peer, bind } = setup();
    const a = instrumentPeer(peer('a'));
    const b = instrumentPeer(peer('b'));
    const bindingA = bind(a.store, room.join().doc);
    bindingA.seed();
    bind(b.store, room.join().doc);
    const replica = bind(peer('server'), room.server);

    const first = addTable(a.store, 'first');
    rename(b.store, first, 'second');
    addTable(a.store, 'third');
    // A's two adds and two renames, then B's rename: one batch each.
    expect(a.received).toHaveLength(1);
    expect(b.received).toHaveLength(4);

    replica.compact();
    const late = instrumentPeer(peer('late'));
    bind(late.store, room.join().doc);
    expect(late.received).toHaveLength(0);
    expect(late.store.value).toBe(a.store.value);

    rename(b.store, first, 'fourth');
    expect(a.received).toHaveLength(2);
    expect(late.received).toHaveLength(1);
    expect(b.received).toHaveLength(4);
    expectConverged([a.store, b.store, late.store]);
  });

  it('AC-A3 a peer cut off before a compaction reopens from the snapshot, its offline batches kept and its undo history gone', () => {
    const { a, b, server, clientB, bindingB, replica } = seededRoom();
    const shared = addTable(a, 'shared');
    const rejoins = vi.fn();
    bindingB.on('rejoin', rejoins);

    clientB.disconnect();
    addTable(b, 'kept offline');
    rename(a, shared, 'compacted');
    replica.compact();

    const late = harness.peer('late');
    harness.bind(late, harness.room.join().doc);
    expectConverged([a, late]);

    clientB.connect();
    expect(rejoins).toHaveBeenCalledTimes(1);
    expect(tableNames(b)).toEqual(['compacted', 'kept offline']);
    expectConverged([a, b, server, late]);
    expect(b.undo().entries).toBe(0);
  });

  it('AC-A6 entries carry the batches as the store sent them, the five viewport and tab types left out and the name view kept', () => {
    const { room, peer, bind } = setup();
    const a = instrumentPeer(peer('a'));
    const b = peer('b');
    const clientA = room.join();
    bind(a.store, clientA.doc).seed();
    bind(b, room.join().doc);
    const sentBefore = a.sent.length;

    a.store.dispatch([
      settingsActions.scrollToAction({ originX: 40, originY: 50 }),
    ]);
    a.store.dispatch([
      settingsActions.streamScrollToAction({ movementX: 5, movementY: 5 }),
    ]);
    a.store.dispatch([settingsActions.changeZoomLevelAction({ value: 0.8 })]);
    a.store.dispatch([settingsActions.streamZoomLevelAction({ value: 0.1 })]);
    a.store.dispatch([
      settingsActions.changeCanvasTypeAction({ value: CanvasType.schemaSQL }),
    ]);
    a.store.dispatch([
      settingsActions.changeNameViewModeAction({
        value: 'logical',
        shared: true,
        editorId: a.store.editorId,
      }),
    ]);
    addTable(a.store, 'logged');

    const sent = a.sent.slice(sentBefore);
    const expected = sent
      .map(batch => batch.filter(action => isLogged(action.type)))
      .filter(batch => batch.length > 0);
    const entries = entriesOf(clientA.doc);

    expect(sent.flat().some(action => isFollowing(action.type))).toBe(true);
    expect(entries.map(entry => entry.actions)).toEqual(
      JSON.parse(JSON.stringify(expected))
    );
    expect(
      entries.flatMap(entry => entry.actions).map(action => action.type)
    ).toContain('settings.changeNameViewMode');
    expect(
      entries
        .flatMap(entry => entry.actions)
        .some(action => !isLogged(action.type))
    ).toBe(false);
    expect(b.value).toBe(a.store.value);
  });
});

describe('seeds', () => {
  it('AC-A7 a room with no snapshot takes no entry, and a seed writes the document as it stands', () => {
    const { room, peer, bind } = setup();
    const a = peer('a');
    const clientA = room.join();
    const binding = bind(a, clientA.doc);

    addTable(a, 'before the seed');
    expect(getLog(clientA.doc).length).toBe(0);

    expect(binding.seed()).toBe(true);
    const read = readSnapshot(getSnapshotMap(clientA.doc));
    expect(read.state === 'ready' && read.snapshot.runtimeValue).toBe(
      a.runtimeValue
    );
    expect(read.state === 'ready' && read.snapshot.version).toBe(
      a.getVersion()
    );
    expect(binding.seed()).toBe(false);

    const b = peer('b');
    const bindingB = bind(b, room.join().doc);
    expect(bindingB.seed()).toBe(false);
    expect(tableNames(b)).toEqual(['before the seed']);
  });

  it('AC-A7 seed opens the value given before it writes the snapshot', () => {
    const { room, peer, bind } = setup();
    const source = peer('source');
    addTable(source, 'from a file');
    const a = peer('a');
    bind(a, room.join().doc).seed(source.value);
    expect(tableNames(a)).toEqual(['from a file']);

    const b = peer('b');
    bind(b, room.join().doc);
    expect(b.value).toBe(a.value);
  });

  it('AC-A7 AC-P15 the loser of two seeds rejoins with seedLost, a client of its lineage with snapshot, and the losing entries reach nobody', () => {
    const { room, peer, bind } = setup();
    const a = instrumentPeer(peer('a'));
    const b = peer('b');
    const c = peer('c');
    const server = peer('server');
    // The higher Yjs client id wins a key two clients set at once.
    const clientA = room.join({ clientID: 200, online: false });
    const clientB = room.join({ clientID: 100 });
    const clientC = room.join({ clientID: 150 });
    const bindingA = bind(a.store, clientA.doc);
    const bindingB = bind(b, clientB.doc);
    const bindingC = bind(c, clientC.doc);
    const replica = bind(server, room.server);
    const events = { a: vi.fn(), b: vi.fn(), c: vi.fn(), server: vi.fn() };
    bindingA.on('rejoin', events.a);
    bindingB.on('rejoin', events.b);
    bindingC.on('rejoin', events.c);
    replica.on('rejoin', events.server);

    expect(bindingA.seed()).toBe(true);
    addTable(a.store, 'winner');
    expect(bindingB.seed()).toBe(true);
    expect(events.c).toHaveBeenLastCalledWith('snapshot');
    addTable(b, 'lost by b');
    addTable(c, 'lost by c');
    expect(tableNames(c)).toEqual(['lost by b', 'lost by c']);

    clientA.connect();
    expect(events.a).not.toHaveBeenCalled();
    expect(events.b).toHaveBeenCalledWith('seedLost');
    expect(events.c).toHaveBeenLastCalledWith('snapshot');
    expect(events.server).toHaveBeenLastCalledWith('snapshot');
    expect(a.received).toHaveLength(0);
    expect(tableNames(b)).toEqual(['winner']);
    expectConverged([a.store, b, c, server]);

    addTable(b, 'b after');
    addTable(c, 'c after');
    const read = readSnapshot(getSnapshotMap(room.server));
    const winner = read.state === 'ready' ? read.snapshot.seedId : null;
    const lineages = () =>
      new Set(entriesOf(room.server).map(entry => entry.lineage));
    expect(lineages().size).toBe(2);
    replica.compact();
    expect([...lineages()].filter(lineage => lineage !== winner)).toEqual([]);

    const late = peer('late');
    bind(late, room.join().doc);
    expect(tableNames(late)).toEqual(['b after', 'c after', 'winner']);
    expectConverged([a.store, b, c, server, late]);
  });

  it('AC-A7 a seed after the snapshot was cleared starts a lineage under a new binding id', () => {
    const { room, peer, bind } = setup();
    const a = peer('a');
    const clientA = room.join();
    const binding = bind(a, clientA.doc);
    binding.seed();
    addTable(a, 'first');
    const [first] = entriesOf(clientA.doc);

    getSnapshotMap(clientA.doc).clear();
    expect(binding.seed()).toBe(true);
    addTable(a, 'second');
    const later = entriesOf(clientA.doc).filter(entry => entry.by !== first.by);
    expect(later.map(entry => entry.seq)).toEqual([1, 2]);
  });
});

describe('refusals', () => {
  it('AC-A7 a snapshot of another format raises error, and the binding writes nothing', async () => {
    const { room, peer, bind } = setup();
    const client = room.join();
    getSnapshotMap(client.doc).set('format', 99);
    const a = peer('a');
    const binding = bind(a, client.doc);
    const errors = vi.fn();
    binding.on('error', errors);
    binding.on('rejoin', vi.fn());

    await Promise.resolve();
    expect(errors).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/format 99/) })
    );
    expect(binding.seed()).toBe(false);
    addTable(a, 'unsent');
    expect(getLog(client.doc).length).toBe(0);
    binding.destroy();
  });

  it('AC-A7 a snapshot that turns to another format later stops every binding with error', () => {
    const { a, b, clientB, bindingA, bindingB } = seededRoom();
    addTable(a, 'applied');
    const errors = { a: vi.fn(), b: vi.fn() };
    bindingA.on('error', errors.a);
    bindingB.on('error', errors.b);

    getSnapshotMap(clientB.doc).set('format', 2);
    for (const listener of [errors.a, errors.b]) {
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringMatching(/stopped/) })
      );
    }
    const before = getLog(clientB.doc).length;
    addTable(a, 'not sent');
    expect(getLog(clientB.doc).length).toBe(before);
    expect(tableNames(b)).toEqual(['applied']);
    expect(bindingB.seed()).toBe(false);
    expect(bindingB.compact()).toEqual({
      compacted: false,
      reason: 'destroyed',
    });
  });

  it('AC-P17 a store without the five port methods raises error and nothing is bound', async () => {
    const { room, peer } = setup();
    const a = peer('a');
    const older = {
      ...instrumentPeer(a).store,
      reseed: undefined,
    } as unknown as PeerStore;
    const { bindPeerStore } = await import('@/binding');
    const binding = bindPeerStore(older, room.join().doc);
    const errors = vi.fn();
    binding.on('error', errors);

    await Promise.resolve();
    expect(errors).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/reseed/) })
    );
    expect(binding.seed()).toBe(false);
    expect(binding.compact()).toEqual({
      compacted: false,
      reason: 'destroyed',
    });
    binding.destroy();
  });

  it('AC-P2 a second binding of the same store and Y.Doc raises error and writes nothing', async () => {
    const { room, peer, bind } = setup();
    const a = peer('a');
    const client = room.join();
    const first = bind(a, client.doc);
    first.seed();
    const second = bind(a, client.doc);
    const errors = vi.fn();
    const unsubscribe = second.on('error', errors);

    await Promise.resolve();
    expect(errors).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/already bound/),
      })
    );
    unsubscribe();
    addTable(a, 'once');
    expect(entriesOf(client.doc)).toHaveLength(2);

    bind(a, room.join().doc);
    first.destroy();
    const third = bind(a, client.doc);
    const thirdErrors = vi.fn();
    third.on('error', thirdErrors);
    await Promise.resolve();
    expect(thirdErrors).not.toHaveBeenCalled();
  });
});

describe('a peer store destroyed before its binding', () => {
  const closedError = expect.objectContaining({
    message: expect.stringMatching(
      /peer store was destroyed before its binding/
    ),
  });

  it('stops the binding with error once a snapshot calling for a rejoin arrives, so nothing throws out of the provider', () => {
    const { a, b, clientB, bindingB, replica } = seededRoom();
    const errors = vi.fn();
    const rejoins = vi.fn();
    bindingB.on('error', errors);
    bindingB.on('rejoin', rejoins);

    clientB.disconnect();
    addTable(a, 'while b was away');
    expect(replica.compact()).toEqual({ compacted: true, generation: 1 });
    b.destroy();
    expect(() => clientB.connect()).not.toThrow();
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors).toHaveBeenCalledWith(closedError);
    expect(rejoins).not.toHaveBeenCalled();

    addTable(a, 'after b stopped');
    expect(errors).toHaveBeenCalledTimes(1);
    expect(bindingB.seed()).toBe(false);
    expect(bindingB.compact()).toEqual({
      compacted: false,
      reason: 'destroyed',
    });
  });

  it('stops the binding with error when a subscriber destroys the peer store as a rejoin flushes a held drag, so nothing throws out of the provider', () => {
    const { room, peer, bind } = setup();
    const a = peer('a');
    const store = peer('b');
    const b = instrumentPeer(store);
    const clientB = room.join();
    bind(a, room.join().doc).seed();
    const bindingB = bind(b.store, clientB.doc);
    const replica = bind(peer('server'), room.server);
    const errors = vi.fn();
    const rejoins = vi.fn();
    bindingB.on('error', errors);
    bindingB.on('rejoin', rejoins);
    const table = addTable(a, 'one');

    clientB.disconnect();
    addTable(a, 'while b was away');
    expect(replica.compact()).toEqual({ compacted: true, generation: 1 });
    b.holdBack(['table.moveTo']);
    b.store.subscribe(actions => {
      if (actions.some(action => action.type === 'table.moveTo')) {
        store.destroy();
      }
    });
    b.store.dispatch([
      tableActions.moveTableAction({
        movementX: 30,
        movementY: 40,
        ids: [table],
      }),
    ]);

    expect(() => clientB.connect()).not.toThrow();
    expect(store.isDestroyed).toBe(true);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors).toHaveBeenCalledWith(closedError);
    expect(rejoins).not.toHaveBeenCalled();
    // The drag left before the store closed, so the room still holds it.
    expect(
      entriesOf(room.server).some(({ actions }) =>
        actions.some(action => action.type === 'table.moveTo')
      )
    ).toBe(true);
  });

  it("folds nothing when asked, so the room never takes the closed store's value", () => {
    const { a, server, replica } = seededRoom();
    const errors = vi.fn();
    replica.on('error', errors);
    addTable(a, 'one');

    server.destroy();
    expect(replica.compact()).toEqual({
      compacted: false,
      reason: 'destroyed',
    });
    expect(errors).toHaveBeenCalledWith(closedError);
    const read = readSnapshot(getSnapshotMap(harness.room.server));
    expect(read.state === 'ready' && read.snapshot.generation).toBe(0);
    expect(getLog(harness.room.server).length).toBeGreaterThan(0);
  });

  it('refuses a seed with error', () => {
    const { room, peer, bind } = setup();
    const a = peer('a');
    const binding = bind(a, room.join().doc);
    const errors = vi.fn();
    binding.on('error', errors);

    a.destroy();
    expect(binding.seed()).toBe(false);
    expect(errors).toHaveBeenCalledWith(closedError);
    expect(getSnapshotMap(room.server).size).toBe(0);
  });

  it('refuses with error to bind a peer store already destroyed, and adds nothing to a Y.Doc, seeded or not', async () => {
    const { room, peer, bind } = setup();
    const closed = peer('closed');
    closed.destroy();
    const attempt = (doc: Y.Doc) => {
      const on = vi.spyOn(doc, 'on');
      const binding = bind(closed, doc, {
        compactAfter: 1,
        synced: Promise.resolve(),
      });
      const errors = vi.fn();
      binding.on('error', errors);
      return { on, binding, errors };
    };

    const empty = attempt(room.join().doc);
    expect(bind(peer('a'), room.join().doc).seed()).toBe(true);
    const seeded = attempt(room.join().doc);
    await Promise.resolve();
    for (const { on, binding, errors } of [empty, seeded]) {
      expect(errors).toHaveBeenCalledTimes(1);
      expect(errors).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/nothing was bound/),
        })
      );
      expect(on).not.toHaveBeenCalled();
      expect(binding.seed()).toBe(false);
    }
  });

  it('answers destroyed with error when asked to fold before synced', () => {
    const { room, peer, bind } = setup();
    const a = peer('a');
    const binding = bind(a, room.join().doc, {
      synced: new Promise<void>(() => {}),
    });
    const errors = vi.fn();
    binding.on('error', errors);

    a.destroy();
    expect(binding.compact()).toEqual({
      compacted: false,
      reason: 'destroyed',
    });
    expect(errors).toHaveBeenCalledWith(closedError);
  });

  it('folds nothing when a rejoin listener destroys the peer store while the fold follows the room', () => {
    const { a, b, clientB, bindingB, replica } = seededRoom();
    const errors = vi.fn();
    bindingB.on('error', errors);
    bindingB.on('rejoin', () => b.destroy());

    clientB.disconnect();
    addTable(a, 'while b was away');
    expect(replica.compact()).toEqual({ compacted: true, generation: 1 });
    // Inside one transaction, the binding meets the new snapshot only as the fold follows it.
    let result: ReturnType<typeof bindingB.compact> | undefined;
    clientB.doc.transact(() => {
      clientB.connect();
      expect(b.isDestroyed).toBe(false);
      result = bindingB.compact();
    });

    expect(result).toEqual({ compacted: false, reason: 'destroyed' });
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors).toHaveBeenCalledWith(closedError);
    const read = readSnapshot(getSnapshotMap(clientB.doc));
    expect(read.state === 'ready' && read.snapshot.generation).toBe(1);
  });
});

describe('rejoins and rebinding', () => {
  it('AC-P12 a colour stroke and a drag held as a rejoin arrives reach every client, the rejoining one too', () => {
    const { room, peer, bind } = setup();
    const a = peer('a');
    const b = instrumentPeer(peer('b'));
    const server = peer('server');
    bind(a, room.join().doc).seed();
    const clientB = room.join();
    const bindingB = bind(b.store, clientB.doc);
    const replica = bind(server, room.server);
    const table = addTable(a, 'dragged');
    const rejoins = vi.fn();
    bindingB.on('rejoin', rejoins);

    clientB.disconnect();
    rename(a, table, 'renamed');
    replica.compact();

    b.holdBack(['table.moveTo', 'table.changeColor']);
    b.store.dispatch([
      tableActions.moveTableAction({
        movementX: 30,
        movementY: 40,
        ids: [table],
      }),
    ]);
    b.store.dispatch([
      tableActions.changeTableColorAction({
        id: table,
        color: '#12a594',
        prevColor: '',
      }),
    ]);
    expect(b.heldBatches()).toBe(2);

    clientB.connect();
    expect(rejoins).toHaveBeenCalledWith('snapshot');
    expect(b.heldBatches()).toBe(0);
    expectConverged([a, b.store, server]);

    const { collections } = JSON.parse(a.value);
    expect(collections.tableEntities[table].name).toBe('renamed');
    expect(collections.tableEntities[table].ui.color).toBe('#12a594');
    const { ui } = JSON.parse(b.store.value).collections.tableEntities[table];
    expect(collections.tableEntities[table].ui).toEqual(ui);
  });

  it('AC-P13 a store bound, destroyed and bound again writes under a new id, and a client offline through a compaction loses nothing', () => {
    const { room, peer, bind } = setup();
    const a = peer('a');
    const c = peer('c');
    const server = peer('server');
    const clientA = room.join();
    const clientC = room.join();
    const firstBinding = bind(a, clientA.doc);
    firstBinding.seed();
    bind(c, clientC.doc);
    const replica = bind(server, room.server);
    const kept = addTable(a, 'before rebinding');

    firstBinding.destroy();
    bind(a, clientA.doc);
    clientC.disconnect();
    addTable(a, 'after rebinding');
    rename(a, kept, 'renamed after rebinding');
    addTable(c, 'offline in c');
    const writers = new Set(entriesOf(clientA.doc).map(entry => entry.by));
    expect(writers.size).toBe(2);
    replica.compact();

    clientC.connect();
    expectConverged([a, c, server]);
    expect(tableNames(c)).toEqual([
      'after rebinding',
      'offline in c',
      'renamed after rebinding',
    ]);
    const late = peer('late');
    bind(late, room.join().doc);
    expectConverged([a, late]);
  });

  it('destroy sends what the store holds and leaves the Y.Doc to its owner', () => {
    const { room, peer, bind } = setup();
    const a = instrumentPeer(peer('a'));
    const b = peer('b');
    const clientA = room.join();
    const binding = bind(a.store, clientA.doc);
    binding.seed();
    bind(b, room.join().doc);
    const table = addTable(a.store, 'held');
    const rejoins = vi.fn();
    binding.on('rejoin', rejoins)();

    a.holdBack(['table.moveTo']);
    a.store.dispatch([
      tableActions.moveTableAction({
        movementX: 10,
        movementY: 10,
        ids: [table],
      }),
    ]);
    binding.destroy();
    binding.destroy();
    expect(a.heldBatches()).toBe(0);
    expect(b.value).toBe(a.store.value);

    addTable(a.store, 'after destroy');
    expect(tableNames(b)).toEqual(['held']);
    expect(clientA.doc.isDestroyed).toBe(false);
    expect(rejoins).not.toHaveBeenCalled();
  });

  it('compact folds nothing without a snapshot or after destroy', () => {
    const { room, peer, bind } = setup();
    const binding = bind(peer('a'), room.join().doc);
    expect(binding.compact()).toEqual({
      compacted: false,
      reason: 'no-snapshot',
    });
    binding.destroy();
    expect(binding.compact()).toEqual({
      compacted: false,
      reason: 'destroyed',
    });
  });
});

describe('AC-A9 module scenarios', () => {
  it.each(MODULE_SCENARIOS)(
    'AC-A9 the $module scenario converges through the binding, a compaction and a late joiner',
    ({ steps }) => {
      const { a, b, server, replica } = seededRoom();
      const ids = {};
      const authors = [a, b];

      steps.forEach((step, index) => {
        step.run(authors[step.author], ids);
        expect(b.value).toBe(a.value);
        expect(server.value).toBe(a.value);
        if (index === 0) replica.compact();
      });
      expect(a.value).not.toBe(harness.peer('empty').value);

      const late = harness.peer('late');
      harness.bind(late, harness.room.join().doc);
      expect(late.value).toBe(a.value);
    }
  );
});

describe('own entries', () => {
  it('a rejoin replays the entries the binding wrote that the snapshot does not cover', () => {
    const { room, peer, bind } = setup();
    const a = peer('a');
    const b = peer('b');
    const server = peer('server');
    const clientA = room.join();
    bind(a, clientA.doc).seed();
    const clientB = room.join();
    bind(b, clientB.doc);
    const replica = bind(server, room.server);

    clientB.disconnect();
    const ownEntries: PortAction[][] = [];
    addTable(b, 'own one');
    addTable(b, 'own two');
    for (const entry of entriesOf(clientB.doc)) ownEntries.push(entry.actions);
    addTable(a, 'other');
    replica.compact();

    clientB.connect();
    expect(ownEntries.length).toBeGreaterThan(0);
    expect(tableNames(b)).toEqual(['other', 'own one', 'own two']);
    expectConverged([a, b, server]);
  });
});
