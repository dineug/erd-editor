import type { ErdEditorElement } from '@dineug/erd-editor';
import type { PeerStore } from '@dineug/erd-editor/peer.js';
import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';

import { createPresence, type Presence, screenOf } from '@/awareness';
import { isLogged } from '@/classify';
import {
  type CompactOptions,
  type Compactor,
  type CompactorHost,
  type CompactResult,
  createCompactor,
} from '@/compact';
import { refusal } from '@/errors';
import { copyJson } from '@/json';
import {
  createLogReader,
  createLogWriter,
  getLog,
  insertedOf,
  type LogEntry,
} from '@/log';
import {
  type CollaborationPort,
  type PortAction,
  portOfEditor,
  portOfPeer,
} from '@/port';
import {
  checkLineage,
  ERD_YJS_FORMAT,
  getSnapshotMap,
  needsRejoin,
  readSnapshot,
  type Snapshot,
  writeSnapshot,
} from '@/snapshot';

/**
 * Why a binding opened the room's document again: a snapshot holding what it
 * had not applied, or of another lineage, or one that won over its own seed.
 */
export type RejoinReason = 'snapshot' | 'seedLost';

export type BindingEvents = {
  rejoin: (reason: RejoinReason) => void;
  error: (error: Error) => void;
};

export type ErdYjsBinding = {
  /**
   * Writes the room's first snapshot from the editor's document, after loading
   * value into it when one is given. False, and nothing written, once the room
   * holds a snapshot.
   */
  seed: (value?: string) => boolean;
  on: <K extends keyof BindingEvents>(
    event: K,
    listener: BindingEvents[K]
  ) => () => void;
  /** Sends what the store still holds, clears the binding's presence and stops; the Y.Doc stays. */
  destroy: () => void;
};

export type ErdYjsPeerBinding = ErdYjsBinding & {
  /**
   * Folds the log into a snapshot of the peer's own state, after following the
   * room's snapshot; only one binding in a room should ever fold.
   */
  compact: () => CompactResult;
};

export type BindOptions = {
  /** Carries cursors, focus and the screen; without it only the document syncs. */
  awareness?: Awareness;
  getNickname?: () => string;
};

export type PeerBindOptions = CompactOptions & {
  /** Carries the binding's presence and, for a compactor, its stand in the election. */
  awareness?: Awareness;
};

/** The stores and documents a live binding holds, so a second one of a pair refuses. */
const boundDocs = new WeakMap<object, WeakSet<Y.Doc>>();

const createId = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let id = '';
  for (const byte of bytes) id += (byte + 0x100).toString(16).slice(1);
  return id;
};

type BindingCore = {
  binding: ErdYjsBinding;
  compact: () => CompactResult;
};

/** The snapshot a refusal names: of another format, or of this one in fields it cannot read. */
const unreadable = (format: unknown) =>
  format === ERD_YJS_FORMAT
    ? `a snapshot of format ${ERD_YJS_FORMAT} in a shape this release cannot read`
    : `a snapshot of format ${String(format)}, not ${ERD_YJS_FORMAT}`;

const notBound = (): CompactResult => ({
  compacted: false,
  reason: 'destroyed',
});

function inertBinding(error: Error): BindingCore {
  const errorListeners = new Set<BindingEvents['error']>();
  // A listener added right after the call still hears why nothing was bound.
  void Promise.resolve().then(() => {
    errorListeners.forEach(listener => listener(error));
  });

  return {
    binding: {
      seed: () => false,
      on: (event, listener) => {
        if (event !== 'error') return () => {};
        const fn = listener as BindingEvents['error'];
        errorListeners.add(fn);
        return () => errorListeners.delete(fn);
      },
      destroy: () => errorListeners.clear(),
    },
    compact: notBound,
  };
}

function createBinding(
  target: object,
  doc: Y.Doc,
  createPort: () => CollaborationPort | null,
  awareness: Awareness | undefined,
  makeCompactor?: (host: CompactorHost) => Compactor
): BindingCore {
  if (boundDocs.get(target)?.has(doc)) {
    return inertBinding(
      refusal('this store is already bound to this Y.Doc, so nothing was bound')
    );
  }

  const port = createPort();
  if (!port) {
    return inertBinding(
      refusal(
        'the store has no getLWW, mergeLWW, getVersion, forgetPeer or reseed, so it was built before this binding; nothing was bound'
      )
    );
  }

  if (port.closed()) {
    port.destroy();
    return inertBinding(
      refusal(
        'the peer store was destroyed before its binding, so nothing was bound'
      )
    );
  }

  const map = getSnapshotMap(doc);
  const log = getLog(doc);
  const initial = readSnapshot(map);
  if (initial.state === 'unsupported') {
    port.destroy();
    return inertBinding(
      refusal(
        `the room holds ${unreadable(initial.format)}, so nothing was bound`
      )
    );
  }

  const docs = boundDocs.get(target) ?? new WeakSet<Y.Doc>();
  docs.add(doc);
  boundDocs.set(target, docs);

  const origin = Symbol('erd-editor-yjs');
  const writer = createLogWriter(doc, origin, createId);
  // The log keeps the entry it hands out, and a reducer may keep a payload's
  // objects, so each entry goes in as a copy.
  const reader = createLogReader((entry: LogEntry) =>
    port.receive(copyJson(entry.actions))
  );
  const listeners = {
    rejoin: new Set<BindingEvents['rejoin']>(),
    error: new Set<BindingEvents['error']>(),
  };

  let lineage: string | null = null;
  let seeded: string | null = null;
  let stopped = false;
  let released = false;
  let destroyed = false;
  let presence: Presence | null = null;
  let compactor: Compactor | null = null;
  let unsubscribePort: (() => void) | null = null;

  const emitRejoin = (reason: RejoinReason) =>
    listeners.rejoin.forEach(listener => listener(reason));
  const emitError = (error: Error) =>
    listeners.error.forEach(listener => listener(error));

  const onOutbound = (actions: PortAction[]) => {
    if (stopped) return;
    presence?.publish(actions);

    const logged = actions.filter(action => isLogged(action.type));
    if (!logged.length || lineage === null) return;

    const entry = writer.write(lineage, logged);
    reader.note(entry.by, entry.seq);
    compactor?.schedule();
  };

  /**
   * Opens the snapshot's value and replays the entries it does not cover, the
   * binding's own among them, those its compactor is to put back at the head first.
   */
  const open = (snapshot: Snapshot, keepScreen: boolean) => {
    port.reseed(snapshot.runtimeValue, {
      lww: copyJson(snapshot.lww),
      version: snapshot.version,
      keepScreen,
    });
    lineage = snapshot.seedId;
    reader.reset(snapshot.covers);
    const putBack = compactor?.putBack() ?? [];
    reader.offer([...putBack, ...log.toArray()], snapshot.seedId);
    if (!keepScreen) presence?.setScreen(screenOf(snapshot.runtimeValue));
  };

  /**
   * Sends what the store holds first, while it still names the lineage it was
   * made in, then opens the snapshot over it. A binding that moves to another
   * lineage writes under a new id, as its old seq counts there for nothing.
   */
  const rejoin = (snapshot: Snapshot, reason: RejoinReason) => {
    const joined = lineage;
    port.flushStreamBuffers();
    // A subscriber handed a held batch may have destroyed the peer store.
    if (!usable()) return;
    if (joined !== null && joined !== snapshot.seedId) writer.restart();
    open(snapshot, joined !== null);
    emitRejoin(reason);
  };

  const detach = () => {
    if (stopped) return;
    stopped = true;
    compactor?.destroy();
    presence?.destroy();
    presence = null;
    unsubscribePort?.();
    unsubscribePort = null;
    log.unobserve(onLog);
    map.unobserve(onSnapshot);
  };

  /** Lets go of what the port made and of the pair, so the store can bind to this Y.Doc again. */
  const release = () => {
    if (released) return;
    released = true;
    port.destroy();
    boundDocs.get(target)?.delete(doc);
  };

  /** Stops as destroy does, the listeners kept to hear why. */
  const stop = (reason: string) => {
    detach();
    release();
    emitError(refusal(reason));
  };

  /** True when the snapshot took over, by a rejoin or by a format this binding cannot read. */
  const followSnapshot = (): boolean => {
    const read = readSnapshot(map);
    if (read.state === 'none') return false;
    if (read.state === 'unsupported') {
      stop(
        `the room now holds ${unreadable(read.format)}, so the binding stopped`
      );
      return true;
    }

    const { snapshot } = read;
    compactor?.reconcile(snapshot);
    const check = checkLineage(snapshot.seedId, lineage, seeded);
    if (check !== 'same') {
      rejoin(snapshot, check);
      return true;
    }
    if (needsRejoin(snapshot.covers, reader.applied)) {
      rejoin(snapshot, 'snapshot');
      return true;
    }
    return false;
  };

  /**
   * False once the binding stopped, as it does on finding its peer store
   * destroyed under it: a reseed would throw out of the provider's handler, and
   * a fold would write what the closed store last held over the room.
   */
  const usable = (): boolean => {
    if (stopped) return false;
    if (!port.closed()) return true;
    stop(
      'the peer store was destroyed before its binding, so the binding stopped'
    );
    return false;
  };

  function onLog(event: Y.YArrayEvent<unknown>) {
    if (event.transaction.origin === origin || !usable()) return;
    if (!followSnapshot() && lineage !== null) {
      reader.offer(insertedOf(event), lineage);
    }
    compactor?.schedule();
  }

  function onSnapshot(event: Y.YMapEvent<unknown>) {
    if (event.transaction.origin === origin || !usable()) return;
    followSnapshot();
    const read = readSnapshot(map);
    if (read.state === 'ready') {
      compactor?.confirm(read.snapshot, event.transaction);
    }
  }

  compactor =
    makeCompactor?.({
      doc,
      origin,
      port,
      awareness,
      lineage: () => lineage,
      applied: () => reader.applied,
      note: (by, seq) => reader.note(by, seq),
      createId,
      bindingId: () => writer.bindingId,
      usable,
      follow: () => {
        if (usable()) followSnapshot();
      },
      withdraw: () => presence?.withdraw(),
      emitError,
    }) ?? null;
  if (initial.state === 'ready') open(initial.snapshot, false);
  unsubscribePort = port.subscribe(onOutbound);
  log.observe(onLog);
  map.observe(onSnapshot);
  if (awareness) {
    presence = createPresence(awareness, port, {
      screen: screenOf(port.runtimeValue()),
      compactor: compactor?.candidate,
    });
  }

  const seed = (value?: string): boolean => {
    if (!usable() || readSnapshot(map).state !== 'none') return false;

    if (value !== undefined) port.setInitialValue(value);
    // Held streams leave now, while no lineage takes them, since the value holds them.
    port.flushStreamBuffers();
    if (writer.seq > 0) writer.restart();

    const seedId = createId();
    const runtimeValue = port.runtimeValue();
    doc.transact(() => {
      writeSnapshot(map, {
        format: ERD_YJS_FORMAT,
        generation: 0,
        seedId,
        compactorId: null,
        runtimeValue,
        lww: port.getLWW(),
        version: port.getVersion(),
        covers: {},
      });
    }, origin);
    lineage = seedId;
    seeded = seedId;
    reader.reset({});
    presence?.setScreen(screenOf(runtimeValue));
    return true;
  };

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;

    if (!stopped) port.flushStreamBuffers();
    detach();
    release();
    listeners.rejoin.clear();
    listeners.error.clear();
  };

  return {
    binding: {
      seed,
      on: (event, listener) => {
        const set = listeners[event] as unknown as Set<typeof listener>;
        set.add(listener);
        return () => set.delete(listener);
      },
      destroy,
    },
    compact: compactor ? compactor.compact : notBound,
  };
}

/**
 * Binds an erd-editor element to a Y.Doc. The element should be bound once
 * the provider has synced, so it joins the room's document rather than seeding
 * an empty room; the provider and the Y.Doc stay the caller's.
 */
export function bindErdEditor(
  editor: ErdEditorElement,
  doc: Y.Doc,
  { awareness, getNickname }: BindOptions = {}
): ErdYjsBinding {
  return createBinding(
    editor,
    doc,
    () => portOfEditor(editor, { getNickname, presence: Boolean(awareness) }),
    awareness
  ).binding;
}

/**
 * Binds a headless peer store to a Y.Doc; the peer store stays the caller's to
 * destroy. It folds the log only when asked, or past compactAfter once synced.
 */
export function bindPeerStore(
  peer: PeerStore,
  doc: Y.Doc,
  { awareness, ...compaction }: PeerBindOptions = {}
): ErdYjsPeerBinding {
  // The compactor is made here alone, so an element's bundle leaves it out.
  const { binding, compact } = createBinding(
    peer,
    doc,
    () => portOfPeer(peer),
    awareness,
    host => createCompactor(host, compaction)
  );
  return { ...binding, compact };
}
