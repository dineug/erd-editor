// @vitest-environment node
import { type PeerStore, tableActions } from '@dineug/erd-editor/peer.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vite-plus/test';
import * as Y from 'yjs';

import {
  addTable,
  entriesOf,
  expectConverged,
  namesIn,
  rename,
  tableNames,
} from '@/__test-utils__/edits';
import { createHarness, type Harness } from '@/__test-utils__/harness';
import { instrumentPeer } from '@/__test-utils__/instrumentPeer';
import { isLogged } from '@/classify';
import {
  type CompactResult,
  DEFAULT_ELECTION_GRACE_MS,
  DEFAULT_RETAIN_MS,
  foldLog,
  RETAIN_LIMIT,
} from '@/compact';
import { getLog, type LogEntry } from '@/log';
import type { PortAction, Registers } from '@/port';
import {
  ERD_YJS_FORMAT,
  getSnapshotMap,
  readSnapshot,
  type Snapshot,
  writeSnapshot,
} from '@/snapshot';

let harness: Harness | undefined;

// Installed before any Awareness exists, so its clock is the fake one too.
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  harness?.cleanup();
  harness = undefined;
  vi.useRealTimers();
});

const setup = () => (harness = createHarness());

/** Runs every promise callback and timer due now, as the event loop would. */
const turn = () => vi.advanceTimersByTimeAsync(0);

const snapshotOf = (doc: Y.Doc): Snapshot => {
  const read = readSnapshot(getSnapshotMap(doc));
  if (read.state !== 'ready') throw new Error('the Y.Doc holds no snapshot');
  return read.snapshot;
};

const deferred = () => {
  let resolve: () => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};

const lateJoiner = (): PeerStore => {
  const late = harness!.peer('late');
  harness!.bind(late, harness!.room.join().doc);
  return late;
};

const entry = (
  by: string,
  seq: number,
  lineage: string,
  actions: PortAction[] = []
): LogEntry => ({ by, seq, lineage, actions });

const seqsOf = (doc: Y.Doc) => entriesOf(doc).map(({ by, seq }) => by + seq);

/** A replica alone on its own Y.Doc, seeded, so a spec can write the log and the snapshot by hand. */
const loneCompactor = (options = {}) => {
  const { peer, bind } = setup();
  const doc = new Y.Doc();
  doc.clientID = 1_000;
  const store = peer('server');
  const binding = bind(store, doc, options);
  binding.seed();
  const lineage = snapshotOf(doc).seedId;
  const push = (from: number, to: number) => {
    const entries: LogEntry[] = [];
    for (let seq = from; seq <= to; seq++)
      entries.push(entry('x', seq, lineage));
    getLog(doc).push(entries);
  };
  return { doc, store, binding, lineage, push };
};

/** The room's next update, which carries nothing but shows the room is there. */
const ping = (doc: Y.Doc) =>
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(new Y.Doc()));

/**
 * Writes a snapshot over the one doc holds from another Y.Doc that has seen
 * it, as another compactor's later fold arrives. Returns how many entries
 * the log gained, which are the ones the binding put back.
 */
const writeOver = (doc: Y.Doc, fields: Partial<Snapshot> = {}): number => {
  const before = getLog(doc).length;
  const other = new Y.Doc();
  Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));
  writeSnapshot(getSnapshotMap(other), {
    ...snapshotOf(doc),
    compactorId: 'other',
    generation: 99,
    covers: {},
    ...fields,
  });
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(other, Y.encodeStateVector(doc)));
  other.destroy();
  return getLog(doc).length - before;
};

describe('foldLog', () => {
  it('writes the covers and deletes what they hold and every other lineage in one transaction, an entry past a gap kept', () => {
    const doc = new Y.Doc();
    const origin = Symbol('fold');
    const origins: unknown[] = [];
    doc.on('afterTransaction', transaction => origins.push(transaction.origin));
    getLog(doc).push([
      entry('a', 1, 'seed'),
      entry('b', 1, 'seed'),
      entry('a', 2, 'seed'),
      entry('a', 4, 'seed'),
      entry('c', 1, 'lost'),
      { malformed: true },
    ]);
    origins.length = 0;

    const removed = foldLog(doc, {
      generation: 3,
      lineage: 'seed',
      applied: { a: 2, b: 1 },
      compactorId: 'compactor',
      runtimeValue: '{"folded":true}',
      lww: { r: 1 } as unknown as Registers,
      version: 9,
      origin,
    });

    expect(getLog(doc).toArray()).toEqual([entry('a', 4, 'seed')]);
    expect(removed).toHaveLength(5);
    expect(origins).toEqual([origin]);
    expect(readSnapshot(getSnapshotMap(doc))).toEqual({
      state: 'ready',
      snapshot: {
        format: ERD_YJS_FORMAT,
        generation: 3,
        seedId: 'seed',
        compactorId: 'compactor',
        runtimeValue: '{"folded":true}',
        lww: { r: 1 },
        version: 9,
        covers: { a: 2, b: 1 },
      },
    });
    doc.destroy();
  });
});

describe('folding on its own', () => {
  it('AC-A3 a compactor folds past compactAfter once synced; a late joiner matches the live peers, and one cut off before it reopens with its offline batches and no undo', async () => {
    const { room, peer, bind } = setup();
    const a = peer('a');
    const b = peer('b');
    const server = peer('server');
    bind(a, room.join().doc).seed();
    const clientB = room.join();
    const bindingB = bind(b, clientB.doc);
    bind(server, room.server, { compactAfter: 4, synced: Promise.resolve() });
    const rejoins = vi.fn();
    bindingB.on('rejoin', rejoins);
    await turn();

    clientB.disconnect();
    addTable(b, 'kept offline');
    addTable(a, 'first');
    await turn();
    expect(snapshotOf(room.server).generation).toBe(0);
    addTable(a, 'second');
    await turn();
    expect(snapshotOf(room.server).generation).toBe(1);
    expect(getLog(room.server).length).toBe(0);
    const late = lateJoiner();
    expectConverged([a, server, late]);

    clientB.connect();
    expect(rejoins).toHaveBeenCalledWith('snapshot');
    expect(tableNames(b)).toEqual(['first', 'kept offline', 'second']);
    expectConverged([a, b, server, late]);
    expect(b.undo().entries).toBe(0);
  });

  it('AC-A1 a client away through two folds comes back to the value every replica and a late joiner hold', async () => {
    const { room, peer, bind } = setup();
    const a = peer('a');
    const b = peer('b');
    const server = peer('server');
    bind(a, room.join().doc).seed();
    const clientB = room.join();
    bind(b, clientB.doc);
    bind(server, room.server, { compactAfter: 2, synced: Promise.resolve() });
    const shared = addTable(a, 'shared');
    await turn();
    expect(snapshotOf(room.server).generation).toBe(1);

    clientB.disconnect();
    rename(b, shared, 'renamed offline');
    addTable(b, 'offline');
    addTable(a, 'online one');
    await turn();
    addTable(a, 'online two');
    await turn();
    expect(snapshotOf(room.server).generation).toBe(3);

    clientB.connect();
    await turn();
    expect(tableNames(a)).toEqual([
      'offline',
      'online one',
      'online two',
      'renamed offline',
    ]);
    expectConverged([a, b, server, lateJoiner()]);
  });

  it("folds the replica's own state, its registers and version, under the seed's lineage", () => {
    const { room, peer, bind } = setup();
    const a = peer('a');
    const server = peer('server');
    bind(a, room.join().doc).seed();
    const replica = bind(server, room.server);
    const seed = snapshotOf(room.server);
    addTable(a, 'folded');

    expect(replica.compact()).toEqual({ compacted: true, generation: 1 });
    const first = snapshotOf(room.server);
    expect(first).toMatchObject({
      seedId: seed.seedId,
      runtimeValue: server.runtimeValue,
      lww: server.getLWW(),
      version: server.getVersion(),
    });
    expect(first.compactorId).toEqual(expect.any(String));
    expect(namesIn(first.runtimeValue)).toEqual(['folded']);

    expect(replica.compact()).toEqual({ compacted: true, generation: 2 });
    expect(snapshotOf(room.server).compactorId).toBe(first.compactorId);
  });
});

describe('start conditions', () => {
  it('AC-P9 before synced a call says not-synced and nothing folds on its own; once it resolves the log folds', async () => {
    const { room, peer, bind } = setup();
    const a = peer('a');
    bind(a, room.join().doc).seed();
    const synced = deferred();
    const replica = bind(peer('server'), room.server, {
      compactAfter: 1,
      synced: synced.promise,
    });
    addTable(a, 'waiting');
    await turn();

    expect(replica.compact()).toEqual({
      compacted: false,
      reason: 'not-synced',
    });
    expect(snapshotOf(room.server).generation).toBe(0);

    synced.resolve();
    await turn();
    expect(snapshotOf(room.server).generation).toBe(1);
    expect(getLog(room.server).length).toBe(0);
  });

  it('with synced and no compactAfter only a call folds, and only once synced', async () => {
    const { room, peer, bind } = setup();
    const a = peer('a');
    bind(a, room.join().doc).seed();
    const synced = deferred();
    const replica = bind(peer('server'), room.server, {
      synced: synced.promise,
    });
    addTable(a, 'waiting');
    expect(replica.compact().compacted).toBe(false);

    synced.resolve();
    await turn();
    addTable(a, 'more');
    await turn();
    expect(snapshotOf(room.server).generation).toBe(0);
    expect(replica.compact()).toEqual({ compacted: true, generation: 1 });
  });

  it('without synced nothing folds on its own, whatever compactAfter says, and a call folds at once', async () => {
    const { room, peer, bind } = setup();
    const a = peer('a');
    bind(a, room.join().doc).seed();
    const replica = bind(peer('server'), room.server, { compactAfter: 1 });
    addTable(a, 'one');
    addTable(a, 'two');
    await vi.advanceTimersByTimeAsync(DEFAULT_ELECTION_GRACE_MS);

    expect(snapshotOf(room.server).generation).toBe(0);
    expect(replica.compact()).toEqual({ compacted: true, generation: 1 });
  });

  it('AC-P9 a compactor in a room with no snapshot folds nothing, then folds on its own once a seed arrives', async () => {
    const { room, peer, bind } = setup();
    const server = peer('server');
    const replica = bind(server, room.server, {
      compactAfter: 2,
      synced: Promise.resolve(),
    });
    const a = peer('a');
    const bindingA = bind(a, room.join().doc);
    await turn();

    expect(replica.compact()).toEqual({
      compacted: false,
      reason: 'no-snapshot',
    });
    addTable(a, 'before the seed');
    await turn();
    expect(getSnapshotMap(room.server).size).toBe(0);

    bindingA.seed();
    addTable(a, 'after the seed');
    await turn();
    expect(snapshotOf(room.server).generation).toBe(1);
    expect(tableNames(server)).toEqual(['after the seed', 'before the seed']);
  });

  it('a compactor that seeded the room folds what came after its seed', async () => {
    const { room, peer, bind } = setup();
    const server = peer('server');
    const replica = bind(server, room.server, {
      compactAfter: 2,
      synced: Promise.resolve(),
    });
    expect(replica.seed()).toBe(true);
    const a = peer('a');
    bind(a, room.join().doc);
    addTable(a, 'after the seed');
    await turn();

    expect(snapshotOf(room.server).generation).toBe(1);
    expect(namesIn(snapshotOf(room.server).runtimeValue)).toEqual([
      'after the seed',
    ]);
  });

  it('a compactor whose snapshot was cleared folds nothing and says no-snapshot', () => {
    const { room, peer, bind } = setup();
    const replica = bind(peer('server'), room.server);
    replica.seed();
    getSnapshotMap(room.server).clear();

    expect(replica.compact()).toEqual({
      compacted: false,
      reason: 'no-snapshot',
    });
  });

  it.each([0, -1, 1.5, Number.NaN])(
    'compactAfter %s raises error and leaves folding to a call',
    async compactAfter => {
      const { room, peer, bind } = setup();
      const a = peer('a');
      bind(a, room.join().doc).seed();
      const client = room.join({ clientID: 1 });
      const replica = bind(peer('server'), client.doc, {
        compactAfter,
        synced: Promise.resolve(),
        awareness: client.awareness,
      });
      const errors = vi.fn();
      replica.on('error', errors);
      await turn();

      expect(errors).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(
            /compactAfter must be a positive integer/
          ),
        })
      );
      expect(client.awareness.getLocalState()?.erd?.compactor).toBeUndefined();
      addTable(a, 'one');
      addTable(a, 'two');
      await vi.advanceTimersByTimeAsync(DEFAULT_ELECTION_GRACE_MS);
      expect(snapshotOf(room.server).generation).toBe(0);
      expect(replica.compact().compacted).toBe(true);
    }
  );

  it('a synced that rejects raises error and no fold follows', async () => {
    const { room, peer, bind } = setup();
    bind(peer('a'), room.join().doc).seed();
    const synced = deferred();
    const replica = bind(peer('server'), room.server, {
      compactAfter: 1,
      synced: synced.promise,
    });
    const errors = vi.fn();
    replica.on('error', errors);

    synced.reject(new Error('the provider closed'));
    await turn();
    expect(errors).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/synced rejected/),
      })
    );
    expect(replica.compact()).toEqual({
      compacted: false,
      reason: 'not-synced',
    });
  });

  it('a call stops when a rejoin listener destroys the binding as it follows the room, writing nothing', () => {
    const { room, peer, bind } = setup();
    const a = peer('a');
    bind(a, room.join().doc).seed();
    const replica = bind(peer('server'), room.server);
    const client = room.join();
    const binding = bind(peer('b'), client.doc);
    const rejoins = vi.fn(() => binding.destroy());
    binding.on('rejoin', rejoins);

    client.disconnect();
    addTable(a, 'away');
    expect(replica.compact()).toEqual({ compacted: true, generation: 1 });
    const folded = snapshotOf(room.server);
    // The fold arrives inside a transaction of the caller's, so the call
    // follows it before the binding's own observers do.
    let result: CompactResult | undefined;
    client.doc.transact(() => {
      client.connect();
      result = binding.compact();
    });
    expect(rejoins).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ compacted: false, reason: 'destroyed' });
    expect(snapshotOf(room.server)).toEqual(folded);
    expect(snapshotOf(client.doc)).toEqual(folded);
  });

  it('a binding destroyed before synced settles neither folds nor raises error when it does', async () => {
    const { room, peer, bind } = setup();
    const a = peer('a');
    bind(a, room.join().doc).seed();
    const resolved = deferred();
    const rejected = deferred();
    const first = bind(peer('first'), room.server, {
      compactAfter: 1,
      synced: resolved.promise,
    });
    const second = bind(peer('second'), room.server, {
      compactAfter: 1,
      synced: rejected.promise,
    });
    const errors = vi.fn();
    first.on('error', errors);
    second.on('error', errors);
    addTable(a, 'unfolded');

    first.destroy();
    second.destroy();
    resolved.resolve();
    rejected.reject(new Error('closed'));
    await turn();
    expect(errors).not.toHaveBeenCalled();
    expect(snapshotOf(room.server).generation).toBe(0);
    expect(first.compact()).toEqual({ compacted: false, reason: 'destroyed' });
  });

  it('compactAfter counts what a fold would take: an entry of another lineage counts, one past a gap does not', async () => {
    const { room, peer, bind } = setup();
    bind(peer('a'), room.join().doc).seed();
    bind(peer('server'), room.server, {
      compactAfter: 3,
      synced: Promise.resolve(),
    });
    const { seedId } = snapshotOf(room.server);
    const log = getLog(room.server);

    log.push([entry('x', 2, seedId), entry('x', 3, seedId)]);
    log.push([entry('y', 1, 'another lineage')]);
    log.push([entry('z', 1, seedId)]);
    await turn();
    expect(snapshotOf(room.server).generation).toBe(0);

    log.push([entry('z', 2, seedId)]);
    await turn();
    expect(snapshotOf(room.server).generation).toBe(1);
    expect(seqsOf(room.server)).toEqual(['x2', 'x3']);
  });
});

describe('gaps', () => {
  it("AC-P9 a writer's entries past a gap stay in the log, the covers stop at the gap, and the gap filling brings them in everywhere", () => {
    const { room, peer, bind } = setup();
    const a = peer('a');
    const server = peer('server');
    bind(a, room.join().doc).seed();
    const replica = bind(server, room.server);
    // An author no binding carries, whose batches go in by hand, one held back.
    const author = instrumentPeer(peer('x'));
    author.store.subscribe(() => {});
    addTable(author.store, 'one');
    addTable(author.store, 'two');
    addTable(author.store, 'three');
    const batches = author.sent
      .map(batch => batch.filter(action => isLogged(action.type)))
      .filter(batch => batch.length > 0);
    expect(batches).toHaveLength(6);
    const { seedId } = snapshotOf(room.server);
    const nth = (seq: number) => entry('x', seq, seedId, batches[seq - 1]);
    const client = room.join();

    getLog(client.doc).push([1, 2, 4, 5, 6].map(nth));
    expect(tableNames(server)).toEqual(['one']);
    replica.compact();
    expect(snapshotOf(room.server).covers).toMatchObject({ x: 2 });
    expect(seqsOf(room.server)).toEqual(['x4', 'x5', 'x6']);
    const late = lateJoiner();
    expectConverged([a, server, late]);

    getLog(client.doc).push([nth(3)]);
    for (const replicaPeer of [a, server, late]) {
      expect(tableNames(replicaPeer)).toEqual(['one', 'three', 'two']);
    }
    replica.compact();
    expect(snapshotOf(room.server).covers).toMatchObject({ x: 6 });
    expect(getLog(room.server).length).toBe(0);
    expectConverged([a, server, late, author.store]);
  });
});

describe('election', () => {
  /** A seeded room and two compactors in Awareness, client ids 5 and 9, each store's register reads counted. */
  const electionRoom = ({
    smallAfter = 2,
    largeAfter = 2,
    electionGraceMs = DEFAULT_ELECTION_GRACE_MS,
    smallSynced = Promise.resolve(),
  } = {}) => {
    const { room, peer, bind } = setup();
    const a = peer('a');
    bind(a, room.join().doc).seed();
    const small = instrumentPeer(peer('small'));
    const large = instrumentPeer(peer('large'));
    const folds = {
      small: vi.spyOn(small.store, 'getLWW'),
      large: vi.spyOn(large.store, 'getLWW'),
    };
    const clientSmall = room.join({ clientID: 5 });
    const clientLarge = room.join({ clientID: 9 });
    const config = { synced: Promise.resolve(), electionGraceMs };
    const bindingLarge = bind(large.store, clientLarge.doc, {
      ...config,
      compactAfter: largeAfter,
      awareness: clientLarge.awareness,
    });
    const bindingSmall = bind(small.store, clientSmall.doc, {
      ...config,
      synced: smallSynced,
      compactAfter: smallAfter,
      awareness: clientSmall.awareness,
    });
    return {
      room,
      a,
      folds,
      bindingSmall,
      bindingLarge,
      clientSmall,
      clientLarge,
    };
  };

  it('AC-P9 of two compactors in Awareness only the smaller client id folds, and only once the grace after synced is through', async () => {
    const { room, a, folds, clientSmall } = electionRoom();
    expect(clientSmall.awareness.getLocalState()?.erd?.compactor).toBe(true);
    addTable(a, 'one');

    await vi.advanceTimersByTimeAsync(DEFAULT_ELECTION_GRACE_MS - 1);
    expect(snapshotOf(room.server).generation).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(snapshotOf(room.server).generation).toBe(1);

    addTable(a, 'two');
    await turn();
    expect(snapshotOf(room.server).generation).toBe(2);
    expect(folds.small).toHaveBeenCalledTimes(2);
    expect(folds.large).not.toHaveBeenCalled();
  });

  it('the other compactor folds once the elected one leaves, the log already past its threshold', async () => {
    const { room, a, folds, bindingSmall } = electionRoom({
      smallAfter: 100,
      largeAfter: 4,
      electionGraceMs: 10,
    });
    await vi.advanceTimersByTimeAsync(10);
    addTable(a, 'one');
    addTable(a, 'two');
    await turn();
    expect(snapshotOf(room.server).generation).toBe(0);

    bindingSmall.destroy();
    await turn();
    expect(snapshotOf(room.server).generation).toBe(1);
    expect(folds.large).toHaveBeenCalledTimes(1);
    expect(folds.small).not.toHaveBeenCalled();
  });

  it('a compactor whose synced rejects leaves the election, so the other folds on its own though its client id is the larger', async () => {
    const synced = deferred();
    const { room, a, folds, bindingSmall, clientSmall, clientLarge } =
      electionRoom({ electionGraceMs: 10, smallSynced: synced.promise });
    const errors = vi.fn();
    bindingSmall.on('error', errors);
    const candidateOf = (clientId: number) =>
      clientLarge.awareness.getStates().get(clientId)?.erd?.compactor;
    expect(candidateOf(5)).toBe(true);

    synced.reject(new Error('the provider closed'));
    await vi.advanceTimersByTimeAsync(10);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(candidateOf(5)).toBeUndefined();
    expect(clientSmall.awareness.getLocalState()?.erd?.editorId).toBeTypeOf(
      'string'
    );

    addTable(a, 'one');
    await turn();
    expect(snapshotOf(room.server).generation).toBe(1);
    expect(folds.large).toHaveBeenCalledTimes(1);
    expect(folds.small).not.toHaveBeenCalled();
  });

  it('a compactor whose own socket closes, which drops every other state at once, folds nothing on its own until it has watched the room again for the grace', async () => {
    const { room, a, folds, bindingSmall, clientLarge } = electionRoom({
      smallAfter: 100,
      largeAfter: 4,
      electionGraceMs: 10,
    });
    await vi.advanceTimersByTimeAsync(10);
    addTable(a, 'one');
    addTable(a, 'two');
    await turn();

    clientLarge.disconnect();
    await vi.advanceTimersByTimeAsync(DEFAULT_ELECTION_GRACE_MS);
    expect(snapshotOf(clientLarge.doc).generation).toBe(0);
    expect(folds.large).not.toHaveBeenCalled();

    clientLarge.connect();
    bindingSmall.destroy();
    await vi.advanceTimersByTimeAsync(9);
    expect(folds.large).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(snapshotOf(room.server).generation).toBe(1);
    expect(folds.large).toHaveBeenCalledTimes(1);
    expect(folds.small).not.toHaveBeenCalled();
  });
});

describe('AC-P9 two compactors cut off from each other', () => {
  /** A seeded room with its first table, compactors p and q on clients of their own; the higher id wins two snapshots written at once. */
  const splitRoom = (ids: { p: number; q: number }) => {
    const { room, peer, bind } = setup();
    const a = peer('a');
    const b = peer('b');
    const p = peer('p');
    const q = peer('q');
    bind(a, room.join().doc).seed();
    bind(b, room.join().doc);
    const clientP = room.join({ clientID: ids.p });
    const clientQ = room.join({ clientID: ids.q });
    const bindingP = bind(p, clientP.doc);
    const bindingQ = bind(q, clientQ.doc);
    addTable(a, 'base');
    return { room, peer, bind, a, b, p, q, clientP, bindingP, bindingQ };
  };

  it('AC-P9 the side that reconnects loses and puts back what it folded, however long it was away, and no batch is lost', async () => {
    const { room, peer, bind, a, b, p, q, clientP, bindingP, bindingQ } =
      splitRoom({ p: 10, q: 20 });
    // A writer on the cut-off side, whose entries only p holds.
    const side = peer('side');
    bind(side, clientP.doc);

    clientP.disconnect();
    addTable(side, 'side');
    expect(bindingP.compact()).toEqual({ compacted: true, generation: 1 });
    addTable(a, 'room');
    expect(bindingQ.compact()).toEqual({ compacted: true, generation: 1 });
    await vi.advanceTimersByTimeAsync(DEFAULT_RETAIN_MS * 2);

    clientP.connect();
    expect(namesIn(snapshotOf(room.server).runtimeValue)).toEqual([
      'base',
      'room',
    ]);
    for (const replica of [a, b, p, q, side]) {
      expect(tableNames(replica)).toEqual(['base', 'room', 'side']);
    }
    expectConverged([a, b, p, q, side, lateJoiner()]);
  });

  it('AC-P9 the other way, the compactor that stayed puts back what it folded while it holds it, and a late joiner replays it before a later edit of another writer', () => {
    const { room, a, b, p, q, clientP, bindingP, bindingQ } = splitRoom({
      p: 30,
      q: 20,
    });

    clientP.disconnect();
    expect(bindingP.compact()).toEqual({ compacted: true, generation: 1 });
    const table = addTable(a, 'room');
    expect(bindingQ.compact()).toEqual({ compacted: true, generation: 1 });
    rename(b, table, 'renamed by b');

    clientP.connect();
    expect(namesIn(snapshotOf(room.server).runtimeValue)).toEqual(['base']);
    for (const replica of [a, b, p, q]) {
      expect(tableNames(replica)).toEqual(['base', 'renamed by b']);
    }
    expectConverged([a, b, p, q, lateJoiner()]);
  });

  it("AC-P9 the other way, once the compactor that stayed has let its fold go, the winner's snapshot lacks it and the writer's later entries stay held until that compactor folds again", async () => {
    const { room, a, b, p, q, clientP, bindingP, bindingQ } = splitRoom({
      p: 30,
      q: 20,
    });

    clientP.disconnect();
    bindingP.compact();
    addTable(a, 'room');
    bindingQ.compact();
    // The room is heard from after the fold, so its clock starts.
    addTable(a, 'after');
    await vi.advanceTimersByTimeAsync(DEFAULT_RETAIN_MS);

    clientP.connect();
    for (const replica of [a, b, q]) {
      expect(tableNames(replica)).toEqual(['after', 'base', 'room']);
    }
    expect(tableNames(p)).toEqual(['base']);
    const late = lateJoiner();
    expect(tableNames(late)).toEqual(['base']);
    expect(entriesOf(room.server)).toHaveLength(2);

    // It never reopened on the older snapshot, so its next fold holds them all.
    expect(bindingQ.compact()).toEqual({ compacted: true, generation: 2 });
    for (const replica of [p, late, lateJoiner()]) {
      expect(tableNames(replica)).toEqual(['after', 'base', 'room']);
    }
    expectConverged([a, b, p, q, late]);
  });
});

describe('AC-P9 an author that reopens on the winning snapshot before the loser puts back', () => {
  /** Hands the second Y.Doc what the first holds and it lacks, as a link between two replicas does. */
  const sync = (from: Y.Doc, to: Y.Doc) =>
    Y.applyUpdate(to, Y.encodeStateAsUpdate(from, Y.encodeStateVector(to)));
  const link = (...docs: Y.Doc[]) => {
    for (const from of docs)
      for (const to of docs) if (from !== to) sync(from, to);
  };

  it('AC-P9 keeps its own folded edits and the drag it held once they are put back, though it wrote again in between', () => {
    const { peer, bind } = setup();
    // The author and the compactor that loses share one side, the server and
    // the compactor that wins the other; the higher client id wins.
    const docs = [900, 500, 100].map(clientID => {
      const doc = new Y.Doc();
      doc.clientID = clientID;
      return doc;
    });
    onTestFinished(() => docs.forEach(doc => doc.destroy()));
    const [server, authorDoc, loserDoc] = docs;
    const author = instrumentPeer(peer('author'));
    const winner = peer('winner');
    const loser = peer('loser');
    bind(author.store, authorDoc).seed();
    link(authorDoc, server, loserDoc);
    const bindingWinner = bind(winner, server);
    const bindingLoser = bind(loser, loserDoc);
    const base = addTable(author.store, 'base');
    link(authorDoc, server, loserDoc);
    const uiOf = (store: PeerStore) =>
      JSON.parse(store.value).collections.tableEntities[base].ui;
    const start = uiOf(winner);

    addTable(author.store, 'c1');
    addTable(author.store, 'c2');
    link(authorDoc, loserDoc);
    expect(bindingLoser.compact()).toEqual({ compacted: true, generation: 1 });
    link(authorDoc, loserDoc);
    author.holdBack(['table.moveTo']);
    author.store.dispatch([
      tableActions.moveTableAction({
        movementX: 30,
        movementY: 40,
        ids: [base],
      }),
    ]);
    addTable(winner, 'w1');
    expect(bindingWinner.compact()).toEqual({ compacted: true, generation: 1 });

    link(authorDoc, server);
    expect(tableNames(author.store)).toEqual(['base', 'w1']);
    addTable(author.store, 'c3');
    link(authorDoc, server);
    link(loserDoc, server);
    link(authorDoc, server, loserDoc);

    const late = peer('late');
    const lateDoc = new Y.Doc();
    docs.push(lateDoc);
    sync(server, lateDoc);
    bind(late, lateDoc);
    for (const replica of [author.store, winner, loser, late]) {
      expect(tableNames(replica)).toEqual(['base', 'c1', 'c2', 'c3', 'w1']);
    }
    expectConverged([winner, author.store, loser, late]);
    expect(uiOf(author.store)).toMatchObject({
      x: start.x + 30,
      y: start.y + 40,
    });
  });
});

describe('holding and putting back', () => {
  it(`holds at most the latest ${RETAIN_LIMIT} entries of its folds and puts back at the head those a snapshot written over them leaves out`, () => {
    const { doc, binding, push } = loneCompactor();
    push(1, 100);
    binding.compact();
    ping(doc);
    push(101, 1_100);
    binding.compact();
    push(1_101, 1_105);
    binding.compact();
    expect(getLog(doc).length).toBe(0);
    push(1_106, 1_106);

    expect(writeOver(doc, { covers: { x: 200 } })).toBe(905);
    const seqs = seqsOf(doc);
    expect(seqs.slice(0, 2)).toEqual(['x201', 'x202']);
    expect(seqs.slice(-2)).toEqual(['x1105', 'x1106']);
  });

  it('puts back nothing a snapshot written over its fold covers', () => {
    const { doc, binding, push } = loneCompactor();
    push(1, 3);
    binding.compact();

    expect(writeOver(doc, { covers: { x: 3 } })).toBe(0);
    expect(writeOver(doc, { covers: {}, generation: 100 })).toBe(0);
  });

  it('lets its fold go once a write to the snapshot made alongside it leaves its own in place', () => {
    const { doc, binding, push } = loneCompactor();
    push(1, 3);
    const before = Y.encodeStateAsUpdate(doc);
    binding.compact();
    const mine = snapshotOf(doc);

    // A smaller client id loses the key both set at once.
    const rival = new Y.Doc();
    rival.clientID = 1;
    Y.applyUpdate(rival, before);
    writeSnapshot(getSnapshotMap(rival), {
      ...mine,
      compactorId: 'rival',
      covers: {},
    });
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(rival, Y.encodeStateVector(doc)));
    rival.destroy();
    expect(snapshotOf(doc)).toEqual(mine);

    expect(writeOver(doc)).toBe(0);
  });

  it("keeps its hold on a fold called inside the caller's own transaction, and puts back what a snapshot written over it leaves out", () => {
    const { doc, binding, push } = loneCompactor();
    push(1, 3);
    let result: CompactResult | undefined;
    doc.transact(() => {
      result = binding.compact();
    }, 'caller');
    expect(result).toEqual({ compacted: true, generation: 1 });
    expect(getLog(doc).length).toBe(0);

    expect(writeOver(doc)).toBe(3);
    expect(seqsOf(doc)).toEqual(['x1', 'x2', 'x3']);
  });

  it("lets a fold made inside the caller's own transaction go once a later write to the snapshot leaves it in place", () => {
    const { doc, binding, push } = loneCompactor();
    push(1, 3);
    const before = Y.encodeStateAsUpdate(doc);
    doc.transact(() => binding.compact(), 'caller');
    const mine = snapshotOf(doc);

    const rival = new Y.Doc();
    rival.clientID = 1;
    Y.applyUpdate(rival, before);
    writeSnapshot(getSnapshotMap(rival), {
      ...mine,
      compactorId: 'rival',
      covers: {},
    });
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(rival, Y.encodeStateVector(doc)));
    rival.destroy();
    expect(snapshotOf(doc)).toEqual(mine);

    expect(writeOver(doc)).toBe(0);
  });

  it('holds a fold however long the room stays silent after it', async () => {
    const { doc, binding, push } = loneCompactor();
    push(1, 2);
    binding.compact();
    await vi.advanceTimersByTimeAsync(DEFAULT_RETAIN_MS * 10);

    expect(writeOver(doc)).toBe(2);
  });

  it('lets a fold go retainMs after the first update the room sends after it', async () => {
    const { doc, binding, push } = loneCompactor({ retainMs: 1_000 });
    push(1, 2);
    binding.compact();
    ping(doc);
    await vi.advanceTimersByTimeAsync(999);
    push(3, 3);
    binding.compact();
    ping(doc);
    await vi.advanceTimersByTimeAsync(1);

    expect(writeOver(doc)).toBe(1);
    expect(seqsOf(doc)).toEqual(['x3']);
  });

  it('drops what it holds when a snapshot of another lineage takes over, putting nothing back', () => {
    const { doc, binding, push } = loneCompactor();
    const rejoins = vi.fn();
    binding.on('rejoin', rejoins);
    push(1, 2);
    binding.compact();

    expect(writeOver(doc, { seedId: 'another lineage' })).toBe(0);
    expect(rejoins).toHaveBeenCalledWith('seedLost');
  });

  it('destroy ends the grace and the clocks, so nothing folds or expires after it and no timer of its own is left', async () => {
    const { room, peer, bind } = setup();
    const a = peer('a');
    bind(a, room.join().doc).seed();
    const client = room.join();
    const server = peer('server');
    const timers = vi.getTimerCount();
    const replica = bind(server, client.doc, {
      compactAfter: 1,
      synced: Promise.resolve(),
      awareness: client.awareness,
    });
    await turn();
    addTable(a, 'one');
    expect(replica.compact().compacted).toBe(true);
    addTable(a, 'two');
    await vi.advanceTimersByTimeAsync(DEFAULT_ELECTION_GRACE_MS - 1);
    // The grace still to run, and the hold's clock the second table started.
    expect(vi.getTimerCount()).toBe(timers + 2);

    replica.destroy();
    expect(vi.getTimerCount()).toBe(timers);
    addTable(a, 'three');
    await vi.advanceTimersByTimeAsync(DEFAULT_RETAIN_MS);
    expect(vi.getTimerCount()).toBe(timers);
    expect(snapshotOf(room.server).generation).toBe(1);
    expect(client.awareness.getLocalState()?.erd).toBeNull();
  });
});
