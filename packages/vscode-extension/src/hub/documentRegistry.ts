import { posix, win32 } from 'node:path';

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
  type JoinPeer,
  maxVersion,
  noteChange,
  noteSave,
  type QueuedBatch,
  type QuietState,
  realpathOrSelf,
  waitForQuiet,
  warnUnsafe,
} from '@dineug/erd-editor-agent-hub-host';
import {
  Bridge,
  webviewReplicationCommand,
} from '@dineug/erd-editor-webview-bridge';
import { Context, Effect, FiberSet, FileSystem, Layer } from 'effect';
import type * as vscode from 'vscode';

import { type ErdDocument } from '@/erd-document';
import { isReadonlyUri } from '@/hub/readonlyUri';
import { textDecoder } from '@/utils';

/** The three calls ErdEditor makes from its bridge handlers. */
export type WebviewRelay = Pick<
  DocumentRegistry,
  'onWebviewReady' | 'onWebviewActions' | 'onValueSaved'
>;

/** Runs the IO half of a register under the runtime that built the registry's layer. */
type IoRunner = (
  io: Effect.Effect<void, never, FileSystem.FileSystem>
) => Promise<void>;

type Entry = {
  document: ErdDocument;
  /** The real path, which the hub hands handlers and peers address the document by. */
  path: string;
  /** Set once its IO step resolved path; only then does the lock list it. */
  resolved: boolean;
  webviews: Set<vscode.Webview>;
  panels: Map<vscode.Webview, vscode.WebviewPanel>;
  ready: Set<vscode.Webview>;
  peers: Map<HubConnection, JoinPeer>;
  observedVersion: number;
  quiet: QuietState<vscode.Webview>;
};

type ReadyWaiter = {
  path: string;
  resolve: (document: ErdDocument | null) => void;
};

/**
 * Every document open in an ERD editor, its webviews and the agent peers that
 * joined it. There is one way to a peer, deliverToPeer, and one way into
 * webviews, injectToWebviews; a new path must go through one of them.
 */
export class DocumentRegistry {
  /** The webviews of each document, the sets ErdEditor broadcasts over. */
  readonly docToWebviewMap = new Map<ErdDocument, Set<vscode.Webview>>();

  private readonly entries = new Map<ErdDocument, Entry>();
  private readonly readyWaiters = new Set<ReadyWaiter>();
  private publisher: DocumentPublisher | null = null;
  private activeDocument: ErdDocument | null = null;
  /** Null until the registry's layer attaches it, and again once closed. */
  private runIo: IoRunner | null = null;
  private closed = false;
  private readonly opened: Promise<void>;
  private open!: () => void;
  /** The last IO step queued before the layer attached; the next such one runs after it. */
  private backlog: Promise<void> = Promise.resolve();

  private constructor(readonly platform: Platform) {
    this.opened = new Promise(resolve => (this.open = resolve));
  }

  /**
   * Built before the provider is registered, so the Disposable it returns is
   * still handed to context.subscriptions inside activate. Its IO comes later,
   * from the runtime that builds its layer; until then its IO steps queue.
   */
  static makeUnsafe(platform: Platform): DocumentRegistry {
    return new DocumentRegistry(platform);
  }

  /**
   * Serves registry and runs its IO on the file system it is given, the steps
   * queued before it built one at a time in arrival order. It builds without IO
   * and never fails; closing it interrupts what is in flight and settles the rest.
   */
  static layer(
    registry: DocumentRegistry
  ): Layer.Layer<DocumentRegistryService, never, FileSystem.FileSystem> {
    return Layer.effect(
      DocumentRegistryService,
      Effect.gen(function* () {
        const run = yield* FiberSet.makeRuntimePromise<FileSystem.FileSystem>();
        yield* Effect.acquireRelease(
          Effect.sync(() => registry.attach(run)),
          () => Effect.sync(() => registry.close())
        );
        return registry;
      })
    );
  }

  /**
   * Stops the IO and the publishing for good: what is still queued settles
   * without IO, and a later register keys its document by the path given.
   * Idempotent, since deactivate calls it after the layer's own release.
   */
  close(): void {
    this.closed = true;
    this.runIo = null;
    this.publisher = null;
    this.open();
  }

  /** Publishes the documents already open, then every change to them. */
  setPublisher(publisher: DocumentPublisher): Promise<void> {
    this.publisher = publisher;
    return this.publish();
  }

  /**
   * Tracks a document at once, or keeps one already tracked, so its webviews
   * work before the hub does. Never rejects: it resolves after the realpath and
   * a publish, which a hub that is up holds for the lock, a second at most.
   */
  register(document: ErdDocument): Promise<void> {
    if (this.entries.has(document)) return Promise.resolve();

    const webviews = new Set<vscode.Webview>();
    const entry: Entry = {
      document,
      path: document.uri.fsPath,
      resolved: false,
      webviews,
      panels: new Map(),
      ready: new Set(),
      peers: new Map(),
      observedVersion: 0,
      quiet: createQuietState(),
    };
    this.entries.set(document, entry);
    this.docToWebviewMap.set(document, webviews);

    return this.enqueue(this.resolvePath(entry));
  }

  /** Tells the joined peers the editor went away, then forgets the document. */
  unregister(document: ErdDocument): Promise<void> {
    const entry = this.entries.get(document);
    if (!entry) return Promise.resolve();

    this.entries.delete(document);
    this.docToWebviewMap.delete(document);
    if (this.activeDocument === document) this.activeDocument = null;
    for (const { connection } of entry.peers.values()) {
      connection.notify({
        method: 'documentClosed',
        params: { path: entry.path },
      });
    }
    entry.peers.clear();
    return this.enqueue(null);
  }

  addWebview(document: ErdDocument, panel: vscode.WebviewPanel): void {
    const entry = this.entries.get(document);
    if (!entry) return;

    entry.webviews.add(panel.webview);
    entry.panels.set(panel.webview, panel);
    if (panel.active) this.setActive(document);
  }

  /**
   * Called from the panel's onDidDispose, where VS Code already throws on
   * panel.webview, so the webview is found by its panel. A pending change
   * stops awaiting it, which the replicas left may already have covered.
   */
  removeWebview(document: ErdDocument, panel: vscode.WebviewPanel): void {
    const entry = this.entries.get(document);
    if (!entry) return;

    for (const [webview, owner] of Array.from(entry.panels)) {
      if (owner !== panel) continue;
      entry.webviews.delete(webview);
      entry.panels.delete(webview);
      entry.ready.delete(webview);
      dropRecipient(entry.quiet, webview);
    }
  }

  /** The document of the ERD panel that took focus last; a blur leaves it in place. */
  setActive(document: ErdDocument): void {
    if (this.entries.has(document)) this.activeDocument = document;
  }

  isActive(document: ErdDocument): boolean {
    return this.activeDocument === document;
  }

  panelOf(document: ErdDocument): vscode.WebviewPanel | undefined {
    return this.entries.get(document)?.panels.values().next().value;
  }

  /**
   * hostInitialCommand arrived: the webview holds the initial value and
   * listens to its shared store. Keyed by webview, so a reload is not counted
   * twice; removeWebview takes it out again.
   */
  onWebviewReady(document: ErdDocument, webview: vscode.Webview): void {
    const entry = this.entries.get(document);
    if (!entry || !entry.webviews.has(webview)) return;

    entry.ready.add(webview);
    if (isReadonlyUri(document.uri)) return;
    for (const waiter of Array.from(this.readyWaiters)) {
      if (isSamePath(waiter.path, entry.path, this.platform)) {
        waiter.resolve(document);
      }
    }
  }

  /** Only webviews that reported ready count; with none, agent edits are refused. */
  readyWebviewCount(document: ErdDocument): number {
    return this.entries.get(document)?.ready.size ?? 0;
  }

  /**
   * Gives the document once a writable webview of path reports ready, or null
   * after timeoutMs or on cancel. Never fails, so nothing is left unhandled
   * while the caller still awaits the editor opening.
   */
  waitForReady(
    path: string,
    timeoutMs: number
  ): { ready: Effect.Effect<ErdDocument | null>; cancel: () => void } {
    let waiter!: ReadyWaiter;
    const ready = new Promise<ErdDocument | null>(resolve => {
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

  /** A webview's own actions, from its hostSaveReplicationCommand, for every joined peer. */
  onWebviewActions(document: ErdDocument, actions: unknown): void {
    const entry = this.entries.get(document);
    if (!entry || !Array.isArray(actions)) return;

    this.observe(entry, actions, 'webview');
    for (const connection of Array.from(entry.peers.keys())) {
      this.deliverToPeer(document, connection, actions, 'webview');
    }
  }

  /**
   * A replica saved, so document.content is current for what its webview had
   * seen. The webview comes from the editor that relayed it, since only the
   * saves of those a change reached say the content holds that change.
   */
  onValueSaved(document: ErdDocument, webview: vscode.Webview): void {
    const entry = this.entries.get(document);
    if (entry) noteSave(entry.quiet, webview, performance.now());
  }

  /** True once no replica save is outstanding, false if one still is at capMs. */
  whenQuiet(document: ErdDocument, capMs: number): Effect.Effect<boolean> {
    const entry = this.entries.get(document);
    return entry ? waitForQuiet(entry.quiet, capMs) : Effect.succeed(true);
  }

  /**
   * A joined peer's batch, for every ready webview and every other peer. A
   * webview never relays it back, since it arrives tagged shared, so the
   * other peers hear of it only from here. Returns the webview count.
   */
  applyPeerActions(
    document: ErdDocument,
    from: HubConnection,
    actions: unknown[]
  ): number {
    const entry = this.entries.get(document);
    if (!entry) return 0;

    this.observe(entry, actions, 'peer');
    this.injectToPeers(document, from, actions);
    return this.injectToWebviews(document, actions);
  }

  /**
   * The one way into webviews: ready ones only, none left out. A webview that
   * has not reported ready would wipe the actions with its initial value.
   */
  injectToWebviews(document: ErdDocument, actions: unknown[]): number {
    const entry = this.entries.get(document);
    if (!entry) return 0;

    const message = Bridge.executeCommand(webviewReplicationCommand, {
      actions,
    });
    for (const webview of entry.ready) webview.postMessage(message);
    return entry.ready.size;
  }

  /** Every other peer joined to the document; the sender already holds its actions. */
  injectToPeers(
    document: ErdDocument,
    from: HubConnection,
    actions: unknown[]
  ): void {
    const entry = this.entries.get(document);
    if (!entry) return;

    for (const connection of Array.from(entry.peers.keys())) {
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
  deliverToPeer(
    document: ErdDocument,
    connection: HubConnection,
    actions: unknown[],
    source: ActionSource
  ): void {
    const entry = this.entries.get(document);
    const peer = entry?.peers.get(connection);
    if (!entry || !peer) return;

    if (peer.queue) {
      peer.queue.push({ source, actions });
      return;
    }
    connection.notify({
      method: 'actions',
      params: { path: entry.path, actions },
    });
  }

  /** The highest action version seen from webviews and peers alike. */
  observedVersion(document: ErdDocument): number {
    return this.entries.get(document)?.observedVersion ?? 0;
  }

  isJoined(document: ErdDocument, connection: HubConnection): boolean {
    return this.entries.get(document)?.peers.has(connection) ?? false;
  }

  /**
   * Seeds a peer. It queues deliveries from the start, waits for the document
   * to go quiet, then captures content and observedVersion in one tick. The
   * queue empties on a timer, after the response is written, not ahead of it.
   */
  join(
    document: ErdDocument,
    connection: HubConnection
  ): Effect.Effect<JoinResult, HubRequestError> {
    const entries = this.entries;
    const endJoinWindow = (
      entry: Entry,
      peer: JoinPeer,
      queue: QueuedBatch[],
      captured: number,
      snapshotVersion: number
    ) => this.endJoinWindow(entry, peer, queue, captured, snapshotVersion);

    return Effect.gen(function* () {
      const entry = entries.get(document);
      if (!entry) {
        return yield* Effect.fail(closedDuringJoin(document.uri.fsPath));
      }

      const queue: QueuedBatch[] = [];
      const peer: JoinPeer = { connection, queue };
      entry.peers.set(connection, peer);

      yield* waitForQuiet(entry.quiet);
      if (
        entries.get(document) !== entry ||
        entry.peers.get(connection) !== peer
      ) {
        return yield* Effect.fail(closedDuringJoin(entry.path));
      }

      const result: JoinResult = {
        initialValue: textDecoder.decode(document.content),
        snapshotVersion: entry.observedVersion,
        readonly: isReadonlyUri(document.uri),
      };
      const captured = queue.length;
      setTimeout(() =>
        endJoinWindow(entry, peer, queue, captured, result.snapshotVersion)
      );
      return result;
    });
  }

  /** Drops the peer from every document at path, its queue with it. */
  leave(path: string, connection: HubConnection): void {
    for (const entry of this.entries.values()) {
      if (isSamePath(entry.path, path, this.platform)) {
        entry.peers.delete(connection);
      }
    }
  }

  disconnect(connection: HubConnection): void {
    for (const entry of this.entries.values()) entry.peers.delete(connection);
  }

  /** The document at a real path, a writable one ahead of a git or merge view of it. */
  find(path: string): ErdDocument | undefined {
    let readonlyMatch: ErdDocument | undefined;
    for (const { document, path: entryPath } of this.entries.values()) {
      if (!isSamePath(entryPath, path, this.platform)) continue;
      if (!isReadonlyUri(document.uri)) return document;
      readonlyMatch ??= document;
    }
    return readonlyMatch;
  }

  /** The file document at a real path; a git or merge view of it never stands in. */
  findWritable(path: string): ErdDocument | undefined {
    const document = this.find(path);
    return document && !isReadonlyUri(document.uri) ? document : undefined;
  }

  /** Every registered document with its real path, the writable ones first. */
  documents(): Array<{ document: ErdDocument; path: string }> {
    const all = Array.from(this.entries.values(), ({ document, path }) => ({
      document,
      path,
    }));
    return [
      ...all.filter(({ document }) => !isReadonlyUri(document.uri)),
      ...all.filter(({ document }) => isReadonlyUri(document.uri)),
    ];
  }

  private observe(
    entry: Entry,
    actions: unknown[],
    source: ActionSource
  ): void {
    entry.observedVersion = maxVersion(entry.observedVersion, actions);
    if (hasChangeAction(actions)) {
      noteChange(entry.quiet, source, performance.now(), entry.ready);
    }
  }

  /** Ends the peer's join window, unless it left or joined again since. */
  private endJoinWindow(
    entry: Entry,
    peer: JoinPeer,
    queue: QueuedBatch[],
    captured: number,
    snapshotVersion: number
  ): void {
    if (entry.peers.get(peer.connection) !== peer) return;

    peer.queue = null;
    for (const { source, actions } of drainJoinQueue(
      queue,
      captured,
      snapshotVersion,
      entry.path
    )) {
      this.deliverToPeer(entry.document, peer.connection, actions, source);
    }
  }

  private attach(run: IoRunner): void {
    if (this.closed) return;
    this.runIo = run;
    this.open();
  }

  /**
   * Runs io, then publishes. A step queued before the layer attached runs after
   * the IO of each earlier one, not its publish, so the lock takes the backlog
   * in arrival order; a step after that runs at once, holding up no other path.
   */
  private enqueue(
    io: Effect.Effect<void, never, FileSystem.FileSystem> | null
  ): Promise<void> {
    const applied =
      this.runIo || this.closed
        ? this.apply(io)
        : (this.backlog = this.backlog.then(() => this.apply(io)));
    return applied.then(() => this.publish());
  }

  /** Waits for the layer, or for close, which skips the IO. Never rejects. */
  private async apply(
    io: Effect.Effect<void, never, FileSystem.FileSystem> | null
  ): Promise<void> {
    await this.opened;
    const run = this.runIo;
    // Closing interrupts the steps in flight, the one way run can reject.
    if (io && run) await run(io).catch(() => undefined);
  }

  /**
   * Keys the entry by its path on disk, or by the path given where that cannot
   * be resolved, as an untitled document's cannot. An entry already
   * unregistered by the time its step runs is left alone.
   */
  private resolvePath(
    entry: Entry
  ): Effect.Effect<void, never, FileSystem.FileSystem> {
    const paths = this.platform === 'win32' ? win32 : posix;

    return Effect.suspend(() => {
      if (this.entries.get(entry.document) !== entry) return Effect.void;
      const given = entry.path;
      const resolve = paths.isAbsolute(given)
        ? realpathOrSelf(given).pipe(
            Effect.catchDefect(() => Effect.succeed(given))
          )
        : Effect.succeed(given);

      return resolve.pipe(
        Effect.map(path => {
          entry.path = path;
          entry.resolved = true;
        })
      );
    });
  }

  /** Lists resolved file documents only: a git or merge view guards no path on disk. */
  private async publish(): Promise<void> {
    if (!this.publisher) return;

    const documents: string[] = [];
    for (const { document, path, resolved } of this.entries.values()) {
      if (
        resolved &&
        document.uri.scheme === 'file' &&
        !documents.includes(path)
      ) {
        documents.push(path);
      }
    }
    try {
      await this.publisher(documents);
    } catch (error) {
      warnUnsafe('could not list the open documents in the lock', error);
    }
  }
}

/** The instance activate builds before the provider is registered, once its layer serves it. */
export class DocumentRegistryService extends Context.Service<
  DocumentRegistryService,
  DocumentRegistry
>()('vuerd-vscode/hub/DocumentRegistry') {}
