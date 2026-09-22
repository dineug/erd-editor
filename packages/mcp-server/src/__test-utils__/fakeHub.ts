import { createPeerStore, type PeerStore } from '@dineug/erd-editor/peer.js';
import {
  createFrameDecoder,
  encodeFrame,
  HUB_PROTOCOL_VERSION,
  type HubErrorCode,
  type HubNotification,
  isAuthorized,
  type LockRecord,
  pipePath,
  protocolMismatchMessage,
} from '@dineug/erd-editor-agent-hub';

import { type MemoryIo, type ServerSocket } from '@/__test-utils__/memoryIo';

type Connection = {
  id: number;
  client: string;
  notify: (notification: HubNotification) => void;
  socket: ServerSocket;
};

/** The editor side of one open document: a real store standing in for the webview and its replica. */
export type FakeDocument = {
  path: string;
  webview: PeerStore;
  peers: Set<Connection>;
  observedVersion: number;
  dirty: boolean;
  readonly: boolean;
};

export type FakeHubOptions = {
  pid: number;
  workspaceFolders: string[];
  token?: string;
  /** Writes a hub false lock and serves nothing, as an untrusted window does. */
  hub?: boolean;
  /** The protocol the hub answers hello with, to exercise a mismatch. */
  helloProtocolVersion?: number;
  /** The protocol the lock advertises. */
  lockProtocolVersion?: number;
};

type Failure = { code: HubErrorCode; message: string };

export type FakeHub = {
  readonly pid: number;
  readonly pipe: string;
  readonly documents: Map<string, FakeDocument>;
  /** Every request by method and path, in arrival order. */
  readonly requests: Array<{ method: string; path?: string }>;
  readonly connections: Set<Connection>;
  /** openDocument answers with this refusal instead of opening. */
  openFailure: Failure | null;
  /** Runs as an applyActions arrives, before it is answered. */
  beforeApply: (() => void) | null;
  saveResult: boolean;
  readonlyPaths: Set<string>;
  lock: () => LockRecord;
  writeLock: () => void;
  /** The user opens the document in an ERD editor. */
  open: (path: string) => FakeDocument;
  /** The user closes the editor; joined peers hear documentClosed. */
  close: (path: string) => void;
  webview: (path: string) => PeerStore;
  /** Drops every connection, as a window reload does. */
  disconnectAll: () => void;
  methods: () => string[];
  destroy: () => void;
};

function versionOf(action: unknown): number | undefined {
  const version = (action as { version?: unknown } | null)?.version;
  return typeof version === 'number' ? version : undefined;
}

function isErdPath(path: string) {
  return /\.(erd|vuerd)(\.json)?$/i.test(path);
}

/**
 * The hub as vscode-extension serves it, over memory pipes: openDocument quick
 * for an open file, join from disk without registering for a closed one,
 * applyActions only after a join, and a relay both ways.
 */
export function createFakeHub(io: MemoryIo, options: FakeHubOptions): FakeHub {
  const { pid, workspaceFolders } = options;
  const token = options.token ?? `token-${pid}`;
  const serving = options.hub ?? true;
  const pipe = serving ? pipePath(io.homedir(), pid, io.platform()) : '';
  const documents = new Map<string, FakeDocument>();
  const requests: FakeHub['requests'] = [];
  const connections = new Set<Connection>();
  let nextId = 1;

  const observe = (document: FakeDocument, actions: unknown[]) => {
    for (const action of actions) {
      const version = versionOf(action);
      if (version !== undefined && version > document.observedVersion) {
        document.observedVersion = version;
      }
    }
  };

  const open = (path: string): FakeDocument => {
    const current = documents.get(path);
    if (current) return current;

    const webview = createPeerStore({ nickname: 'user', presence: false });
    webview.setInitialValue(io.read(path));
    const document: FakeDocument = {
      path,
      webview,
      peers: new Set(),
      observedVersion: 0,
      dirty: false,
      readonly: hub.readonlyPaths.has(path),
    };
    documents.set(path, document);
    // The webview's own edits, relayed to every joined peer.
    webview.subscribe(actions => {
      observe(document, actions);
      for (const peer of document.peers) {
        peer.notify({ method: 'actions', params: { path, actions } });
      }
    });
    return document;
  };

  const close = (path: string) => {
    const document = documents.get(path);
    if (!document) return;
    documents.delete(path);
    for (const peer of document.peers) {
      peer.notify({ method: 'documentClosed', params: { path } });
    }
    document.webview.destroy();
  };

  const lock = (): LockRecord => ({
    pipe,
    workspaceFolders,
    documents: Array.from(documents.keys()),
    ide: 'vscode',
    version: '2.9.0',
    protocolVersion: options.lockProtocolVersion ?? HUB_PROTOCOL_VERSION,
    token: serving ? token : '',
    hub: serving,
  });

  const fail = (code: HubErrorCode, message: string): Failure => ({
    code,
    message,
  });

  const authorize = (path: string) => {
    if (
      !isAuthorized(
        workspaceFolders,
        [...documents.keys()],
        path,
        io.platform()
      )
    ) {
      throw fail('outsideWorkspace', `${path} is outside the workspace`);
    }
    if (!isErdPath(path))
      throw fail('badRequest', `${path} is not an ERD file`);
  };

  const handle = (
    connection: Connection,
    method: string,
    params: Record<string, any>
  ): unknown => {
    const path: string | undefined = params.path;
    requests.push({ method, path });
    if (method === 'listDocuments') {
      const listed = Array.from(documents.values(), document => ({
        path: document.path,
        open: true,
        active: false,
        dirty: document.dirty,
        readonly: document.readonly,
      }));
      for (const file of io.files.keys()) {
        if (isErdPath(file) && !documents.has(file)) {
          listed.push({
            path: file,
            open: false,
            active: false,
            dirty: false,
            readonly: false,
          });
        }
      }
      return { documents: listed };
    }
    if (typeof path !== 'string') throw fail('badRequest', 'path is missing');
    authorize(path);
    const document = documents.get(path);

    switch (method) {
      case 'openDocument': {
        if (hub.openFailure) throw hub.openFailure;
        if (document) return { path, opened: false, webviews: 1 };
        if (!io.files.has(path)) {
          if (!params.create) throw fail('notFound', `${path} does not exist`);
          io.put(path, params.initialValue);
        }
        hub.open(path);
        return { path, opened: true, webviews: 1 };
      }
      case 'join': {
        if (!document) {
          if (!io.files.has(path))
            throw fail('notFound', `${path} does not exist`);
          return {
            initialValue: io.read(path),
            snapshotVersion: 0,
            readonly: false,
          };
        }
        document.peers.add(connection);
        return {
          initialValue: document.webview.value,
          snapshotVersion: document.observedVersion,
          readonly: document.readonly,
        };
      }
      case 'applyActions': {
        hub.beforeApply?.();
        if (document?.readonly) throw fail('readonly', `${path} is read-only`);
        if (!document) throw fail('notOpen', `${path} is not open`);
        if (!document.peers.has(connection)) {
          throw fail('notOpen', `Join ${path} before applying actions to it`);
        }
        const actions: unknown[] = params.actions;
        observe(document, actions);
        document.webview.receive(actions as any[]);
        document.dirty = true;
        for (const peer of document.peers) {
          if (peer !== connection) {
            peer.notify({ method: 'actions', params: { path, actions } });
          }
        }
        return { webviews: 1 };
      }
      case 'leave':
        document?.peers.delete(connection);
        return {};
      case 'save': {
        if (!document) throw fail('notOpen', `${path} is not open`);
        if (!hub.saveResult) return { saved: false };
        io.put(path, document.webview.value);
        document.dirty = false;
        return { saved: true };
      }
      default:
        throw fail('badRequest', `no method ${method}`);
    }
  };

  const accept = (socket: ServerSocket) => {
    const decoder = createFrameDecoder();
    let connection: Connection | null = null;
    const send = (message: unknown) => socket.write(encodeFrame(message));

    socket.onClose(() => {
      if (!connection) return;
      connections.delete(connection);
      for (const document of documents.values())
        document.peers.delete(connection);
    });
    socket.onData(chunk => {
      for (const message of decoder.push(chunk) as Array<Record<string, any>>) {
        const { id, method, params } = message;
        if (!connection) {
          const version = options.helloProtocolVersion ?? HUB_PROTOCOL_VERSION;
          if (params?.token !== token) {
            send({
              id,
              ok: false,
              method,
              error: { code: 'unauthorized', message: 'bad token' },
            });
            socket.end();
            return;
          }
          if (params?.protocolVersion !== version) {
            send({
              id,
              ok: false,
              method,
              error: {
                code: 'protocolMismatch',
                message: protocolMismatchMessage(
                  version,
                  params?.protocolVersion
                ),
              },
            });
            socket.end();
            return;
          }
          connection = {
            id: nextId++,
            client: params.client,
            socket,
            notify: notification => send(notification),
          };
          connections.add(connection);
          send({
            id,
            ok: true,
            method,
            result: {
              protocolVersion: version,
              ide: 'vscode',
              version: '2.9.0',
            },
          });
          continue;
        }
        try {
          const result = handle(connection, method, params ?? {});
          send({ id, ok: true, method, result });
        } catch (error) {
          send({ id, ok: false, method, error });
        }
      }
    });
  };

  const hub: FakeHub = {
    pid,
    pipe,
    documents,
    requests,
    connections,
    openFailure: null,
    beforeApply: null,
    saveResult: true,
    readonlyPaths: new Set(),
    lock,
    writeLock: () => io.writeLock(pid, lock()),
    open: path => {
      const document = open(path);
      hub.writeLock();
      return document;
    },
    close: path => {
      close(path);
      hub.writeLock();
    },
    webview: path => {
      const document = documents.get(path);
      if (!document) throw new Error(`${path} is not open in the fake hub`);
      return document.webview;
    },
    disconnectAll: () => {
      for (const connection of Array.from(connections))
        connection.socket.destroy();
    },
    methods: () => requests.map(({ method }) => method),
    destroy: () => {
      hub.disconnectAll();
      for (const path of Array.from(documents.keys())) close(path);
      io.servers.delete(pipe);
    },
  };

  io.alive.add(pid);
  if (serving) io.servers.set(pipe, accept);
  hub.writeLock();
  return hub;
}
