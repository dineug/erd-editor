import { posix, win32 } from 'node:path';

import {
  HubErrorCode,
  HubRequestError,
  isSamePath,
  type JoinResult,
  type Platform,
} from '@dineug/erd-editor-agent-hub';
import {
  Bridge,
  webviewReplicationCommand,
} from '@dineug/erd-editor-webview-bridge';
import type * as vscode from 'vscode';

import { type ErdDocument } from '@/erd-document';
import { realpathOrSelf } from '@/hub/authz';
import { type HubIo, nodeHubIo } from '@/hub/io';
import {
  type ActionSource,
  createQuietState,
  filterJoinQueue,
  hasChangeAction,
  maxVersion,
  noteChange,
  noteSave,
  type QueuedBatch,
  type QuietState,
  waitForQuiet,
} from '@/hub/joinWindow';
import { warn } from '@/hub/log';
import { isReadonlyUri } from '@/hub/readonlyUri';
import { type HubConnection } from '@/hub/server';
import { textDecoder } from '@/utils';

/** The three calls ErdEditor makes from its bridge handlers. */
export type WebviewRelay = Pick<
  DocumentRegistry,
  'onWebviewReady' | 'onWebviewActions' | 'onValueSaved'
>;

/** Receives the real paths of the open file documents, which the lock lists. */
export type DocumentPublisher = (documents: string[]) => Promise<void>;

type Peer = {
  connection: HubConnection;
  /** Deliveries wait here while the peer is inside its join window; null after it. */
  queue: QueuedBatch[] | null;
};

type Entry = {
  document: ErdDocument;
  /** The real path, which the hub hands handlers and peers address the document by. */
  path: string;
  webviews: Set<vscode.Webview>;
  panels: Map<vscode.Webview, vscode.WebviewPanel>;
  ready: Set<vscode.Webview>;
  peers: Map<HubConnection, Peer>;
  observedVersion: number;
  quiet: QuietState;
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
  readonly platform: Platform;

  private readonly entries = new Map<ErdDocument, Entry>();
  private readonly readyWaiters = new Set<ReadyWaiter>();
  private publisher: DocumentPublisher | null = null;
  private activeDocument: ErdDocument | null = null;

  constructor(private readonly io: HubIo = nodeHubIo) {
    this.platform = io.platform();
  }

  /** Publishes the documents already open, then every change to them. */
  setPublisher(publisher: DocumentPublisher): Promise<void> {
    this.publisher = publisher;
    return this.publish();
  }

  /**
   * Tracks a document opened in an ERD editor. Resolves once the lock lists
   * it and never rejects, so openCustomDocument can await it; the same
   * instance opened again keeps its webviews.
   */
  async register(document: ErdDocument): Promise<void> {
    if (this.entries.has(document)) return;

    const webviews = new Set<vscode.Webview>();
    const entry: Entry = {
      document,
      path: document.uri.fsPath,
      webviews,
      panels: new Map(),
      ready: new Set(),
      peers: new Map(),
      observedVersion: 0,
      quiet: createQuietState(),
    };
    this.entries.set(document, entry);
    this.docToWebviewMap.set(document, webviews);

    entry.path = await this.realPathOf(document.uri.fsPath);
    await this.publish();
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
    return this.publish();
  }

  addWebview(document: ErdDocument, panel: vscode.WebviewPanel): void {
    const entry = this.entries.get(document);
    if (!entry) return;

    entry.webviews.add(panel.webview);
    entry.panels.set(panel.webview, panel);
    if (panel.active) this.setActive(document);
  }

  removeWebview(document: ErdDocument, panel: vscode.WebviewPanel): void {
    const entry = this.entries.get(document);
    if (!entry) return;

    entry.webviews.delete(panel.webview);
    entry.panels.delete(panel.webview);
    entry.ready.delete(panel.webview);
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
   * Resolves with the document once a writable webview of path reports ready,
   * or with null after timeoutMs or on cancel. Never rejects, so nothing is
   * left unhandled while the caller still awaits the editor opening.
   */
  waitForReady(
    path: string,
    timeoutMs: number
  ): { ready: Promise<ErdDocument | null>; cancel: () => void } {
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

    return { ready, cancel: () => waiter.resolve(null) };
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

  /** A replica saved, so document.content is current for what it had seen. */
  onValueSaved(document: ErdDocument): void {
    const entry = this.entries.get(document);
    if (entry) noteSave(entry.quiet, entry.ready.size, performance.now());
  }

  /** True once no replica save is outstanding, false if one still is at capMs. */
  whenQuiet(document: ErdDocument, capMs: number): Promise<boolean> {
    const entry = this.entries.get(document);
    return entry ? waitForQuiet(entry.quiet, capMs) : Promise.resolve(true);
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
  async join(
    document: ErdDocument,
    connection: HubConnection
  ): Promise<JoinResult> {
    const entry = this.entries.get(document);
    if (!entry) throw this.closedDuringJoin(document.uri.fsPath);

    const queue: QueuedBatch[] = [];
    const peer: Peer = { connection, queue };
    entry.peers.set(connection, peer);

    await waitForQuiet(entry.quiet);
    if (
      this.entries.get(document) !== entry ||
      entry.peers.get(connection) !== peer
    ) {
      throw this.closedDuringJoin(entry.path);
    }

    const result: JoinResult = {
      initialValue: textDecoder.decode(document.content),
      snapshotVersion: entry.observedVersion,
      readonly: isReadonlyUri(document.uri),
    };
    const captured = queue.length;
    setTimeout(() =>
      this.endJoinWindow(entry, peer, queue, captured, result.snapshotVersion)
    );
    return result;
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
      noteChange(entry.quiet, source, performance.now());
    }
  }

  /**
   * Only the first captured batches predate the snapshot and go through the
   * filters; a batch queued between the capture and this timer is not in the
   * snapshot, so it goes out whole, in order.
   */
  private endJoinWindow(
    entry: Entry,
    peer: Peer,
    queue: QueuedBatch[],
    captured: number,
    snapshotVersion: number
  ): void {
    if (entry.peers.get(peer.connection) !== peer) return;

    peer.queue = null;
    const { batches, dropped, droppedCount } = filterJoinQueue(
      queue.slice(0, captured),
      snapshotVersion
    );
    if (droppedCount) {
      warn(
        `dropped ${droppedCount} queued actions joining ${entry.path}: versioned at most ${snapshotVersion}, or unversioned`,
        dropped
      );
    }
    for (const { source, actions } of [...batches, ...queue.slice(captured)]) {
      this.deliverToPeer(entry.document, peer.connection, actions, source);
    }
  }

  private closedDuringJoin(path: string): HubRequestError {
    return new HubRequestError(
      HubErrorCode.notOpen,
      `${path} closed, or the peer left it, before the join finished`
    );
  }

  private realPathOf(fsPath: string): Promise<string> {
    const paths = this.platform === 'win32' ? win32 : posix;
    return paths.isAbsolute(fsPath)
      ? realpathOrSelf(this.io, fsPath)
      : Promise.resolve(fsPath);
  }

  /** Lists file documents only: a git or merge view guards no path on disk. */
  private async publish(): Promise<void> {
    if (!this.publisher) return;

    const documents: string[] = [];
    for (const { document, path } of this.entries.values()) {
      if (document.uri.scheme === 'file' && !documents.includes(path)) {
        documents.push(path);
      }
    }
    try {
      await this.publisher(documents);
    } catch (error) {
      warn('could not list the open documents in the lock', error);
    }
  }
}
