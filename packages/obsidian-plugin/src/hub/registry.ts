import {
  type HubRequestError,
  isSamePath,
  type JoinResult,
  type Platform,
} from '@dineug/erd-editor-agent-hub';
import {
  type ActionSource,
  closedDuringJoin,
  createQuietState,
  type DocumentPublisher,
  drainJoinQueue,
  dropRecipient,
  hasChangeAction,
  type HubConnection,
  JOIN_QUIET_CAP_MS,
  type JoinPeer,
  maxVersion,
  noteChange,
  noteSave,
  type QueuedBatch,
  type QuietState,
  stripBom,
  waitForQuiet,
  warnUnsafe,
} from '@dineug/erd-editor-agent-hub-host';
import { Effect } from 'effect';

import { type HubTab, type VaultFile } from '@/hub/types';

/** One diagram file with the tabs showing it and the agent peers that joined it. */
export type HubDocument<T extends HubTab = HubTab> = {
  readonly file: VaultFile;
  /** The real path, which the hub hands handlers and peers address the document by. */
  path: string;
  /** Set once the realpath step ran for the current path; only then is it listed and ready. */
  resolved: boolean;
  /** Bumped by a rename, so a realpath step of the old path lands nowhere. */
  generation: number;
  /** Every tab of the file in the order it opened; the first alone writes the file. */
  tabs: T[];
  /** Tabs that loaded the file, opened their shared store and can read it. */
  live: Set<T>;
  unreadable: Set<T>;
  peers: Map<HubConnection, JoinPeer>;
  observedVersion: number;
  quiet: QuietState<T>;
  /** The document as the file loaded or a replica last saved it, which a join hands a peer. */
  content: string | null;
};

type ReadyWaiter<T extends HubTab> = {
  path: string;
  resolve: (document: HubDocument<T> | null) => void;
};

export type RegistryOptions = {
  readonly platform: Platform;
  /** The absolute path of a vault file, as the vault's adapter spells it. */
  readonly fullPath: (file: VaultFile) => string;
  /** The native real path of an absolute path, or the path itself when it has none; never rejects. */
  readonly realpath: (path: string) => Promise<string>;
};

/** A tab's part in the hub: live once loaded with its shared store open, unreadable for the read-only fallback. */
export type TabState = { live: boolean; unreadable: boolean };

/**
 * Waits for the document to go quiet, JOIN_QUIET_CAP_MS at most in all. The
 * wait may resume a turn after the save that settled it, and a change landing
 * in that turn would be dropped by the queue filter for good, so it waits again.
 */
const waitUntilQuiet = <T>(quiet: QuietState<T>): Effect.Effect<void> =>
  Effect.gen(function* () {
    const deadline = performance.now() + JOIN_QUIET_CAP_MS;
    let settled = yield* waitForQuiet(quiet, JOIN_QUIET_CAP_MS);
    while (settled && quiet.pending) {
      const left = deadline - performance.now();
      if (left <= 0) return;
      settled = yield* waitForQuiet(quiet, left);
    }
  });

/**
 * Every diagram file open in an ERD tab, its tabs and the agent peers that
 * joined it, from plugin load on, whether or not the hub listens. There is one
 * way to a peer, deliverToPeer, and one way into tabs, injectToTabs.
 */
export class DocumentRegistry<T extends HubTab = HubTab> {
  readonly platform: Platform;

  private readonly entries = new Map<VaultFile, HubDocument<T>>();
  private readonly entryOfTab = new Map<T, HubDocument<T>>();
  private readonly readyWaiters = new Set<ReadyWaiter<T>>();
  /** The paths each peer joined, registered or read from disk, which a shutdown closes. */
  private readonly joinedPaths = new Map<HubConnection, string[]>();
  private publisher: DocumentPublisher | null = null;
  private activeDocument: HubDocument<T> | null = null;
  private shutDown = false;

  constructor(private readonly options: RegistryOptions) {
    this.platform = options.platform;
  }

  /** True once shutdown ran: nothing registers a peer after it. */
  get closed(): boolean {
    return this.shutDown;
  }

  /** Publishes the documents already open, then every change to them. */
  setPublisher(publisher: DocumentPublisher): Promise<void> {
    this.publisher = publisher;
    return this.publish();
  }

  /** The tabs of a file in the order they opened, or undefined when none shows it. */
  tabsOf(file: VaultFile): readonly T[] | undefined {
    return this.entries.get(file)?.tabs;
  }

  /** A tab joins its file, which registers the document when it is the first; the path resolves after. */
  addTab(file: VaultFile, tab: T): void {
    this.removeTab(tab);
    let entry = this.entries.get(file);
    if (!entry) {
      entry = {
        file,
        path: this.options.fullPath(file),
        resolved: false,
        generation: 0,
        tabs: [],
        live: new Set(),
        unreadable: new Set(),
        peers: new Map(),
        observedVersion: 0,
        quiet: createQuietState(),
        content: null,
      };
      this.entries.set(file, entry);
      void this.resolve(entry);
    }
    entry.tabs.push(tab);
    this.entryOfTab.set(tab, entry);
  }

  /** A tab leaves its file; the last to leave takes the document with it and tells the peers. */
  removeTab(tab: T): void {
    const entry = this.entryOfTab.get(tab);
    if (!entry) return;

    this.entryOfTab.delete(tab);
    entry.tabs = entry.tabs.filter(other => other !== tab);
    entry.live.delete(tab);
    entry.unreadable.delete(tab);
    dropRecipient(entry.quiet, tab);
    if (!entry.tabs.length) this.unregister(entry);
  }

  /** Where the tab stands after a load, a reload or a shared store opening or closing. */
  setTabState(tab: T, { live, unreadable }: TabState): void {
    const entry = this.entryOfTab.get(tab);
    if (!entry) return;

    if (unreadable) entry.unreadable.add(tab);
    else entry.unreadable.delete(tab);
    if (live && !unreadable) {
      entry.live.add(tab);
    } else {
      entry.live.delete(tab);
      dropRecipient(entry.quiet, tab);
    }
    this.wake(entry);
  }

  /**
   * The text a tab loaded. The first load of a document is what a join hands
   * a peer until a replica saves. A reload, an outside change, makes it a new
   * document: its peers hear documentClosed, and no save of the old one is owed.
   */
  loaded(tab: T, text: string, reload: boolean): void {
    const entry = this.entryOfTab.get(tab);
    if (!entry) return;

    if (reload) {
      this.closeForPeers(entry);
      entry.content = text;
      // A wait already on the old state runs out its cap and saves nothing.
      entry.quiet = createQuietState();
    } else {
      entry.content ??= text;
    }
  }

  /** A tab's shared store emitted: every joined peer gets it, once. */
  relay(tab: T, actions: unknown): void {
    const entry = this.entryOfTab.get(tab);
    if (!entry || !Array.isArray(actions)) return;

    this.observe(entry, actions, 'webview');
    for (const connection of Array.from(entry.peers.keys())) {
      this.deliverToPeer(entry, connection, actions, 'webview');
    }
  }

  /**
   * A replica saved, so the content is current for what its tab had seen. The
   * tab is the one whose replica saved, since only the saves of those a change
   * reached say the content holds that change.
   */
  valueSaved(tab: T, value: string): void {
    const entry = this.entryOfTab.get(tab);
    if (!entry) return;

    entry.content = value;
    noteSave(entry.quiet, tab, performance.now());
  }

  /** The file of the ERD tab that took focus last; a blur leaves it in place. */
  setActive(tab: T): void {
    const entry = this.entryOfTab.get(tab);
    if (entry) this.activeDocument = entry;
  }

  /**
   * Returns what puts the active document back to the one now, for a tab the
   * hub opens in the background: Obsidian focuses a new tab for a moment,
   * which would leave it active once focus goes back to a note.
   */
  keepActive(): () => void {
    const kept = this.activeDocument;
    return () => {
      this.activeDocument =
        kept && this.entries.get(kept.file) === kept ? kept : null;
    };
  }

  /** A renamed or moved file: its peers hear documentClosed for the old path, and the lock the new one. */
  renamed(file: VaultFile): void {
    const entry = this.entries.get(file);
    if (!entry) return;

    this.closeForPeers(entry);
    entry.path = this.options.fullPath(file);
    entry.resolved = false;
    entry.generation++;
    void this.resolve(entry);
  }

  isActive(document: HubDocument<T>): boolean {
    return this.activeDocument === document;
  }

  /** Only a file no tab can read is a read-only view; its tabs never count as ready. */
  isReadonly(document: HubDocument<T>): boolean {
    return (
      document.tabs.length > 0 &&
      document.tabs.every(tab => document.unreadable.has(tab))
    );
  }

  /** The content differs from what the writer last saved, or a replica still owes a save. */
  isDirty(document: HubDocument<T>): boolean {
    const saved = this.writer(document).lastSaved();
    return (
      document.quiet.pending ||
      (saved !== null &&
        document.content !== null &&
        saved !== document.content)
    );
  }

  /** The tab that writes the file; a document the registry holds has at least one, since its last tab takes it along. */
  writer(document: HubDocument<T>): T {
    return document.tabs[0];
  }

  /** Only tabs that are live on a resolved document count; with none, agent edits are refused. */
  readyTabCount(document: HubDocument<T>): number {
    return this.readyTabs(document).size;
  }

  /**
   * Gives the document once a tab of path is ready, or once every tab of it
   * turned out unreadable, or null after timeoutMs or on cancel. Never fails,
   * so nothing is left unhandled while the caller still awaits the tab.
   */
  waitForReady(
    path: string,
    timeoutMs: number
  ): {
    ready: Effect.Effect<HubDocument<T> | null>;
    cancel: () => void;
  } {
    let waiter!: ReadyWaiter<T>;
    const ready = new Promise<HubDocument<T> | null>(resolve => {
      waiter = {
        path,
        resolve: document => {
          clearTimeout(timer);
          this.readyWaiters.delete(waiter);
          resolve(document);
        },
      };
      const timer = setTimeout(() => waiter.resolve(null), timeoutMs);
      this.readyWaiters.add(waiter);
    });

    return {
      ready: Effect.promise(() => ready),
      cancel: () => waiter.resolve(null),
    };
  }

  /** True once no replica save is outstanding, false if one still is at capMs. */
  whenQuiet(document: HubDocument<T>, capMs: number): Effect.Effect<boolean> {
    return waitForQuiet(document.quiet, capMs);
  }

  /**
   * Runs seed once the tab's document is quiet, JOIN_QUIET_CAP_MS at most, as
   * a join waits: a tab opened beside others then starts from a replica value
   * that holds their edits. Returns the cancel; a tab that left never seeds.
   */
  seedWhenQuiet(tab: T, seed: () => void): () => void {
    const entry = this.entryOfTab.get(tab);
    const deadline = performance.now() + JOIN_QUIET_CAP_MS;
    let done = false;

    const attempt = (): void => {
      if (done || this.entryOfTab.get(tab) !== entry) return;
      const left = deadline - performance.now();
      // Checked again on every turn: a change can land between the settle and this one.
      if (entry?.quiet.pending && left > 0) {
        void Effect.runPromise(waitForQuiet(entry.quiet, left)).then(attempt);
        return;
      }
      done = true;
      seed();
    };

    attempt();
    return () => {
      done = true;
    };
  }

  /**
   * A joined peer's batch, for every ready tab and every other peer. A tab
   * never relays it back, since it arrives tagged shared, so the other peers
   * hear of it only from here. Returns the ready tab count.
   */
  applyPeerActions(
    document: HubDocument<T>,
    from: HubConnection,
    actions: unknown[]
  ): number {
    if (this.entries.get(document.file) !== document) return 0;

    this.observe(document, actions, 'peer');
    this.injectToPeers(document, from, actions);
    return this.injectToTabs(document, actions);
  }

  isJoined(document: HubDocument<T>, connection: HubConnection): boolean {
    return document.peers.has(connection);
  }

  /**
   * Seeds a peer. It queues deliveries from the start, waits for the document
   * to go quiet, then captures content and observedVersion in one step. The
   * queue empties on a timer, after the response is written, not ahead of it.
   */
  join(
    document: HubDocument<T>,
    connection: HubConnection
  ): Effect.Effect<JoinResult, HubRequestError> {
    const holds = (peer?: JoinPeer) =>
      this.entries.get(document.file) === document &&
      (!peer || document.peers.get(connection) === peer);
    const closed = () => closedDuringJoin(document.path);

    const register = (): JoinPeer | null => {
      if (this.shutDown || !holds()) return null;
      const peer: JoinPeer = { connection, queue: [] };
      document.peers.set(connection, peer);
      this.track(connection, document.path);
      return peer;
    };

    const capture = (peer: JoinPeer, queue: QueuedBatch[]): JoinResult => {
      const result: JoinResult = {
        initialValue: stripBom(document.content ?? ''),
        snapshotVersion: document.observedVersion,
        readonly: this.isReadonly(document),
      };
      const captured = queue.length;
      setTimeout(() =>
        this.endJoinWindow(
          document,
          peer,
          queue,
          captured,
          result.snapshotVersion
        )
      );
      return result;
    };

    return Effect.gen(function* () {
      const peer = register();
      if (!peer?.queue) return yield* Effect.fail(closed());
      const queue = peer.queue;

      yield* waitUntilQuiet(document.quiet);
      if (!holds(peer)) return yield* Effect.fail(closed());
      return capture(peer, queue);
    });
  }

  /** Remembers a path a peer joined or read from disk, so a shutdown tells it the editor let go. */
  track(connection: HubConnection, path: string): void {
    const paths = this.joinedPaths.get(connection) ?? [];
    if (paths.some(known => isSamePath(known, path, this.platform))) return;
    paths.push(path);
    this.joinedPaths.set(connection, paths);
  }

  /**
   * Drops the peer from every document at path, its queue with it. The path
   * stays tracked: a peer that left may still hold the document, and only a
   * documentClosed tells it the editor let go.
   */
  leave(path: string, connection: HubConnection): void {
    for (const entry of this.entries.values()) {
      if (isSamePath(entry.path, path, this.platform)) {
        entry.peers.delete(connection);
      }
    }
  }

  disconnect(connection: HubConnection): void {
    for (const entry of this.entries.values()) entry.peers.delete(connection);
    this.joinedPaths.delete(connection);
  }

  /** The document at a real path, a writable one ahead of a file no tab can read. */
  find(path: string): HubDocument<T> | undefined {
    let readonlyMatch: HubDocument<T> | undefined;
    for (const entry of this.entries.values()) {
      if (!isSamePath(entry.path, path, this.platform)) continue;
      if (!this.isReadonly(entry)) return entry;
      readonlyMatch ??= entry;
    }
    return readonlyMatch;
  }

  /** The document at a real path that a tab can edit; a read-only view never stands in. */
  findWritable(path: string): HubDocument<T> | undefined {
    const document = this.find(path);
    return document && !this.isReadonly(document) ? document : undefined;
  }

  /** Every open document with its real path, the writable ones first. */
  documents(): Array<{ document: HubDocument<T>; path: string }> {
    const all = Array.from(this.entries.values(), document => ({
      document,
      path: document.path,
    }));
    return [
      ...all.filter(({ document }) => !this.isReadonly(document)),
      ...all.filter(({ document }) => this.isReadonly(document)),
    ];
  }

  /**
   * The plugin is going away: every peer hears documentClosed for every path
   * it joined or read, and no peer registers after this. Returns the peers
   * told, whose frames the caller lets out before the hub closes.
   */
  shutdown(): HubConnection[] {
    this.shutDown = true;
    this.publisher = null;
    for (const entry of this.entries.values()) entry.peers.clear();

    const told = Array.from(this.joinedPaths.keys());
    for (const [connection, paths] of this.joinedPaths) {
      for (const path of paths) {
        connection.notify({ method: 'documentClosed', params: { path } });
      }
    }
    this.joinedPaths.clear();
    return told;
  }

  private readyTabs(document: HubDocument<T>): Set<T> {
    return document.resolved ? document.live : new Set();
  }

  /** The one way into tabs: ready ones only, none left out, the one the user looks at included. */
  private injectToTabs(document: HubDocument<T>, actions: unknown[]): number {
    const ready = this.readyTabs(document);
    for (const tab of ready) tab.receive(actions);
    return ready.size;
  }

  /** Every other peer joined to the document; the sender already holds its actions. */
  private injectToPeers(
    document: HubDocument<T>,
    from: HubConnection,
    actions: unknown[]
  ): void {
    for (const connection of Array.from(document.peers.keys())) {
      if (connection !== from) {
        this.deliverToPeer(document, connection, actions, 'peer');
      }
    }
  }

  /**
   * The one way to a peer. Inside its join window a delivery waits in the
   * queue, which the join empties through the snapshot filters; after it, the
   * actions go straight out as an actions notification.
   */
  private deliverToPeer(
    document: HubDocument<T>,
    connection: HubConnection,
    actions: unknown[],
    source: ActionSource
  ): void {
    const peer = document.peers.get(connection);
    if (!peer) return;

    if (peer.queue) {
      peer.queue.push({ source, actions });
      return;
    }
    connection.notify({
      method: 'actions',
      params: { path: document.path, actions },
    });
  }

  private observe(
    document: HubDocument<T>,
    actions: unknown[],
    source: ActionSource
  ): void {
    document.observedVersion = maxVersion(document.observedVersion, actions);
    // Every live tab replicates the change and owes its save, resolved or not.
    if (hasChangeAction(actions)) {
      noteChange(document.quiet, source, performance.now(), document.live);
    }
  }

  /** Ends the peer's join window, unless it left or joined again since. */
  private endJoinWindow(
    document: HubDocument<T>,
    peer: JoinPeer,
    queue: QueuedBatch[],
    captured: number,
    snapshotVersion: number
  ): void {
    if (document.peers.get(peer.connection) !== peer) return;

    peer.queue = null;
    for (const { source, actions } of drainJoinQueue(
      queue,
      captured,
      snapshotVersion,
      document.path
    )) {
      this.deliverToPeer(document, peer.connection, actions, source);
    }
  }

  /** Tells the joined peers the document they hold is gone, even inside a join window. */
  private closeForPeers(document: HubDocument<T>): void {
    for (const { connection } of document.peers.values()) {
      connection.notify({
        method: 'documentClosed',
        params: { path: document.path },
      });
      this.untrack(connection, document.path);
    }
    document.peers.clear();
  }

  private untrack(connection: HubConnection, path: string): void {
    const paths = this.joinedPaths.get(connection);
    if (!paths) return;
    const kept = paths.filter(known => !isSamePath(known, path, this.platform));
    if (kept.length) this.joinedPaths.set(connection, kept);
    else this.joinedPaths.delete(connection);
  }

  private unregister(document: HubDocument<T>): void {
    this.entries.delete(document.file);
    if (this.activeDocument === document) this.activeDocument = null;
    this.closeForPeers(document);
    void this.publish();
  }

  /**
   * Keys the document by its path on disk. A step whose document closed or was
   * renamed by the time it lands is dropped; the lock lists it once resolved.
   */
  private async resolve(document: HubDocument<T>): Promise<void> {
    const { generation, path } = document;
    const real = await this.options.realpath(path).catch(() => path);
    if (
      this.entries.get(document.file) !== document ||
      document.generation !== generation
    ) {
      return;
    }
    document.path = real;
    document.resolved = true;
    this.wake(document);
    await this.publish();
  }

  /** Resolves every waiter of the document's path once a tab of it is ready or it can only be read. */
  private wake(document: HubDocument<T>): void {
    if (!document.resolved) return;
    if (!this.readyTabCount(document) && !this.isReadonly(document)) return;

    for (const waiter of Array.from(this.readyWaiters)) {
      if (isSamePath(waiter.path, document.path, this.platform)) {
        waiter.resolve(document);
      }
    }
  }

  /** Lists every resolved document by its real path, each once. */
  private async publish(): Promise<void> {
    if (!this.publisher) return;

    const documents: string[] = [];
    for (const { path, resolved } of this.entries.values()) {
      if (resolved && !documents.includes(path)) documents.push(path);
    }
    try {
      await this.publisher(documents);
    } catch (error) {
      warnUnsafe('could not list the open documents in the lock', error);
    }
  }
}
