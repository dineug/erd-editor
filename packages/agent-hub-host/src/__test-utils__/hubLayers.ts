import {
  encodeFrame,
  HUB_PROTOCOL_VERSION,
  lockFilePath,
  type LockRecord,
  type Platform,
} from '@dineug/erd-editor-agent-hub';
import type { Array as Arr } from 'effect';
import {
  Effect,
  Exit,
  FileSystem,
  Layer,
  ManagedRuntime,
  Option,
  PlatformError,
  Queue,
  Scope,
  Stream,
} from 'effect';
import { Socket } from 'effect/unstable/socket';
import { type Mock, vi } from 'vite-plus/test';

import * as LockFile from '@/lockFile';
import { type HubHandler, serveConnection, type ServeOptions } from '@/server';
import {
  DocumentHub,
  type DocumentHubShape,
  layer as documentHubLayer,
} from '@/services/DocumentHub';
import {
  HubEnvError,
  HubEnvironment,
  type HubEnvironmentShape,
} from '@/services/HubEnvironment';
import {
  type DocumentPublisher,
  HubDocuments,
  HubHandlerService,
  HubHost,
  type Unsubscribe,
} from '@/services/HubHost';
import { HubListener, HubListenError } from '@/services/HubListener';
import * as HubLogger from '@/services/HubLogger';

/** A handler double whose every member is a vi.fn answering a plausible result. */
export function createHubHandler() {
  return {
    listDocuments: vi.fn<HubHandler['listDocuments']>(() =>
      Effect.succeed({ documents: [] })
    ),
    openDocument: vi.fn<HubHandler['openDocument']>(({ path }) =>
      Effect.succeed({ path, opened: true, webviews: 1 })
    ),
    join: vi.fn<HubHandler['join']>(() =>
      Effect.succeed({
        initialValue: '{}',
        snapshotVersion: 0,
        readonly: false,
      })
    ),
    applyActions: vi.fn<HubHandler['applyActions']>(() =>
      Effect.succeed({ webviews: 1 })
    ),
    leave: vi.fn<HubHandler['leave']>(() => Effect.succeed({})),
    save: vi.fn<HubHandler['save']>(() => Effect.succeed({ saved: true })),
    disconnect: vi.fn<HubHandler['disconnect']>(),
  } satisfies HubHandler;
}

export type MockHubHandler = ReturnType<typeof createHubHandler>;

/** The hello frame a current client sends, with overrides for the failure cases. */
export function helloFrame(
  token: string,
  params: Record<string, unknown> = {},
  id = 1
) {
  return {
    id,
    method: 'hello',
    params: {
      token,
      protocolVersion: HUB_PROTOCOL_VERSION,
      client: 'spec',
      ...params,
    },
  };
}

/**
 * Lets the memory doubles finish: they never wait on I/O, but the socket
 * channel hands a frame on through a few turns of the effect scheduler.
 */
export async function flush(): Promise<void> {
  for (let turn = 0; turn < 10; turn++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

/** The peer's end of a memory connection. */
export type MemoryClient = {
  /** Encodes message as one frame and hands it to the hub. */
  send: (message: unknown) => void;
  /** Hands the hub raw text, for split or malformed frames. */
  sendRaw: (chunk: string) => void;
  /** Every frame the hub wrote, parsed, in order. */
  readonly received: unknown[];
  /** Every chunk the hub wrote, as text, in order. */
  readonly writes: string[];
  readonly closed: boolean;
  /** Hangs up from the peer's side. */
  close: () => void;
};

const textDecoder = new TextDecoder();

type Waiter = (
  effect: Effect.Effect<Arr.NonEmptyReadonlyArray<string>, Socket.SocketError>
) => void;

/** A connected pair, with the spies a spec makes the transport fail through. */
export type MemorySocketPair = {
  socket: Socket.Socket;
  client: MemoryClient;
  /** Every chunk the hub writes; make it throw to model a broken pipe. */
  write: Mock<(chunk: string) => void>;
  /** The CloseEvent the hub writes when it hangs up on a peer. */
  destroy: Mock<() => void>;
  /** Holds every write from now on until the function it returns is called, as a full socket does. */
  hold: () => () => void;
};

/**
 * The peer decodes what the hub writes with the shipping frame decoder, so a
 * spec sees the same frames a real client would. The transport carries text,
 * as the node adapter does under setEncoding.
 */
export function createMemorySocketPair(): MemorySocketPair {
  const inbox: string[] = [];
  const received: unknown[] = [];
  const writes: string[] = [];
  let waiter: Waiter | undefined;
  let error: Socket.SocketError | undefined;
  let closed = false;
  let pending = '';

  const wake = () => {
    const resume = waiter;
    if (!resume) return;
    if (inbox.length) {
      waiter = undefined;
      const batch = inbox.splice(0, inbox.length);
      resume(
        Effect.succeed(batch as unknown as Arr.NonEmptyReadonlyArray<string>)
      );
      return;
    }
    if (error) {
      waiter = undefined;
      resume(Effect.fail(error));
    }
  };
  const hangUp = () => {
    if (closed) return;
    closed = true;
    error ??= new Socket.SocketError({
      reason: new Socket.SocketCloseError({ code: 1000 }),
    });
    wake();
  };
  const receive = (text: string) => {
    pending += text;
    let end = pending.indexOf('\n');
    while (end !== -1) {
      const line = pending.slice(0, end);
      pending = pending.slice(end + 1);
      if (line.trim() !== '') received.push(JSON.parse(line));
      end = pending.indexOf('\n');
    }
  };

  const write = vi.fn((chunk: string) => {
    if (closed) return;
    writes.push(chunk);
    receive(chunk);
  });
  const destroy = vi.fn(hangUp);
  let held: Promise<void> | null = null;
  const writeNow = (chunk: Uint8Array | string) =>
    Effect.try({
      try: () =>
        write(typeof chunk === 'string' ? chunk : textDecoder.decode(chunk)),
      catch: cause =>
        new Socket.SocketError({
          reason: new Socket.SocketWriteError({ cause: cause as Error }),
        }),
    });
  const writeOne = (chunk: Uint8Array | string) =>
    Effect.suspend(() => {
      const gate = held;
      return gate
        ? Effect.promise(() => gate).pipe(Effect.andThen(writeNow(chunk)))
        : writeNow(chunk);
    });
  const hold = () => {
    let release!: () => void;
    held = new Promise(resolve => (release = resolve));
    return () => {
      held = null;
      release();
    };
  };

  const socket = Socket.make({
    reader: Effect.succeed({
      pull: Effect.suspend(() => {
        if (inbox.length) {
          const batch = inbox.splice(0, inbox.length);
          return Effect.succeed(
            batch as unknown as Arr.NonEmptyReadonlyArray<string>
          );
        }
        if (error) return Effect.fail(error);
        return Effect.callback<
          Arr.NonEmptyReadonlyArray<string>,
          Socket.SocketError
        >(resume => {
          waiter = resume;
          return Effect.sync(() => {
            if (waiter === resume) waiter = undefined;
          });
        });
      }),
      upgrade: Socket.SocketUpgradeError.unsupported,
    }),
    writer: Effect.acquireRelease(
      Effect.succeed<Socket.Writer>({
        write: chunk =>
          Socket.isCloseEvent(chunk)
            ? Effect.sync(() => void destroy())
            : writeOne(chunk),
        writeAll: chunks => Effect.forEach(chunks, writeOne, { discard: true }),
      }),
      () => Effect.sync(hangUp)
    ),
  });

  const client: MemoryClient = {
    send: message => client.sendRaw(encodeFrame(message)),
    sendRaw: chunk => {
      if (closed) return;
      inbox.push(chunk);
      wake();
    },
    received,
    writes,
    get closed() {
      return closed;
    },
    close: hangUp,
  };

  return { socket, client, write, destroy, hold };
}

type MemoryFile = { data: string; mode: number; socket: boolean };

/** The failure a memory fs call answers with, for a spec that makes one fail. */
export function fsError(
  tag: 'NotFound' | 'AlreadyExists' | 'PermissionDenied' | 'Busy',
  method: string,
  path: string
): PlatformError.PlatformError {
  return PlatformError.systemError({
    _tag: tag,
    module: 'FileSystem',
    method,
    pathOrDescriptor: path,
  });
}

function parentOf(path: string): string {
  const index = path.lastIndexOf('/');
  return index <= 0 ? '/' : path.slice(0, index);
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

export type MemoryHubOptions = {
  homedir?: string;
  tmpdir?: string;
  platform?: string;
  pid?: number;
  version?: string;
};

/**
 * The layers the hub specs run on, over maps and POSIX-style paths only. Every
 * member is a vi.fn, so a spec can make one call fail. Modes follow fs: a mode
 * applies only to what the call creates.
 */
export function createMemoryHub(options: MemoryHubOptions = {}) {
  const files = new Map<string, MemoryFile>();
  const dirs = new Map<string, number>([['/', 0o755]]);
  /** Symlinks: a path starting with a key resolves under its value. */
  const links = new Map<string, string>();
  const alive = new Set<number>();
  const servers = new Map<string, Queue.Queue<Socket.Socket, never>>();
  const homedir = options.homedir ?? '/home/user';
  const tmpdir = options.tmpdir ?? '/tmp';
  const platform = (options.platform ?? 'linux') as Platform;
  const pid = options.pid ?? 4242;
  let tokens = 0;

  alive.add(pid);

  const addDir = (path: string, mode = 0o755) => {
    if (dirs.has(path)) return;
    if (path !== '/') addDir(parentOf(path), mode);
    dirs.set(path, mode);
  };

  const resolveLinks = (path: string) => {
    for (const [from, to] of links) {
      if (path === from || path.startsWith(`${from}/`)) {
        return to + path.slice(from.length);
      }
    }
    return path;
  };

  const info = (size: number): FileSystem.File.Info => ({
    type: 'File',
    mtime: Option.some(new Date(1)),
    atime: Option.none(),
    birthtime: Option.none(),
    dev: 0,
    ino: Option.none(),
    mode: 0o644,
    nlink: Option.none(),
    uid: Option.none(),
    gid: Option.none(),
    rdev: Option.none(),
    size: size as unknown as FileSystem.File.Info['size'],
    blksize: Option.none(),
    blocks: Option.none(),
  });

  const fsMock = {
    makeDirectory: vi.fn(
      (
        path: string,
        opts?: { readonly mode?: number | undefined }
      ): Effect.Effect<void, PlatformError.PlatformError> =>
        Effect.sync(() => addDir(path, opts?.mode ?? 0o755))
    ),
    writeFileString: vi.fn(
      (
        path: string,
        data: string,
        opts?: {
          readonly flag?: FileSystem.OpenFlag | undefined;
          readonly mode?: number | undefined;
        }
      ) =>
        Effect.suspend(() => {
          if (!dirs.has(parentOf(path))) {
            return Effect.fail(fsError('NotFound', 'writeFileString', path));
          }
          if (opts?.flag === 'wx') {
            if (files.has(path) || dirs.has(path)) {
              return Effect.fail(
                fsError('AlreadyExists', 'writeFileString', path)
              );
            }
            files.set(path, { data, mode: 0o644, socket: false });
            return Effect.void;
          }
          const existing = files.get(path);
          files.set(path, {
            data,
            mode: existing?.mode ?? opts?.mode ?? 0o644,
            socket: false,
          });
          return Effect.void;
        })
    ),
    readFileString: vi.fn((path: string) =>
      Effect.suspend(() => {
        const file = files.get(path);
        return file
          ? Effect.succeed(file.data)
          : Effect.fail(fsError('NotFound', 'readFileString', path));
      })
    ),
    readDirectory: vi.fn((path: string) =>
      Effect.suspend(() =>
        dirs.has(path)
          ? Effect.succeed(
              [...files.keys()]
                .filter(file => parentOf(file) === path)
                .map(baseName)
            )
          : Effect.fail(fsError('NotFound', 'readDirectory', path))
      )
    ),
    stat: vi.fn((path: string) =>
      Effect.suspend(() => {
        const file = files.get(path);
        return file
          ? Effect.succeed(info(file.data.length))
          : Effect.fail(fsError('NotFound', 'stat', path));
      })
    ),
    remove: vi.fn((path: string) =>
      Effect.suspend(() =>
        files.delete(path)
          ? Effect.void
          : Effect.fail(fsError('NotFound', 'remove', path))
      )
    ),
    rename: vi.fn((from: string, to: string) =>
      Effect.suspend(() => {
        const file = files.get(from);
        if (!file) return Effect.fail(fsError('NotFound', 'rename', from));
        files.delete(from);
        files.set(to, file);
        return Effect.void;
      })
    ),
    realPath: vi.fn((path: string) =>
      Effect.suspend(() => {
        const resolved = resolveLinks(path);
        return files.has(resolved) || dirs.has(resolved)
          ? Effect.succeed(resolved)
          : Effect.fail(fsError('NotFound', 'realPath', path));
      })
    ),
  };

  const env: HubEnvironmentShape = {
    homeDir: homedir,
    tmpDir: tmpdir,
    platform,
    pid,
    version: options.version ?? '0.0.0-mock',
    randomToken: Effect.sync(() => `token-${++tokens}`),
    isAlive: vi.fn((target: number) => alive.has(target)),
    /** A link key is an entry even when its target is missing, as a dangling symlink is. */
    lstat: vi.fn((path: string) =>
      Effect.suspend(() => {
        if (links.has(path)) return Effect.void;
        const resolved = resolveLinks(path);
        return files.has(resolved) || dirs.has(resolved)
          ? Effect.void
          : Effect.fail(
              new HubEnvError({
                reason: 'NotFound',
                path,
                message: `no entry at ${path}`,
              })
            );
      })
    ),
    removeFileSync: vi.fn((path: string) => void files.delete(path)),
  };

  /** Every peer of a pipe, hung up with its listener as the real one destroys them. */
  const peers = new Map<string, MemoryClient[]>();

  /** Records when each listener stopped, for the order the lock is rewritten in. */
  const closeListener = vi.fn((pipe: string) => {
    servers.delete(pipe);
    for (const peer of peers.get(pipe) ?? []) peer.close();
    peers.delete(pipe);
  });

  const listen = vi.fn((pipe: string) =>
    Effect.gen(function* () {
      if (servers.has(pipe) || files.has(pipe)) {
        return yield* Effect.fail(
          new HubListenError({ pipe, message: `EADDRINUSE: ${pipe}` })
        );
      }
      const queue = yield* Queue.unbounded<Socket.Socket>();
      if (!pipe.startsWith('\\\\.\\pipe\\')) {
        if (!dirs.has(parentOf(pipe))) {
          return yield* Effect.fail(
            new HubListenError({ pipe, message: `ENOENT: ${pipe}` })
          );
        }
        files.set(pipe, { data: '', mode: 0o755, socket: true });
      }
      servers.set(pipe, queue);
      yield* Effect.addFinalizer(() => Effect.sync(() => closeListener(pipe)));
      return Stream.fromQueue(queue);
    })
  );

  const layer = Layer.mergeAll(
    FileSystem.layerNoop(fsMock as unknown as Partial<FileSystem.FileSystem>),
    Layer.succeed(HubEnvironment, env),
    Layer.succeed(HubListener, {
      listen: listen as unknown as (typeof HubListener)['Service']['listen'],
    })
  ).pipe(Layer.provideMerge(HubLogger.layer));

  return {
    files,
    dirs,
    links,
    alive,
    servers,
    fs: fsMock,
    env,
    listen,
    closeListener,
    layer,
    /** Adds a file and every missing parent directory. */
    addFile: (path: string, data = '') => {
      addDir(parentOf(path));
      files.set(path, { data, mode: 0o644, socket: false });
    },
    addDir,
    /** Makes the next listen fail, as binding a pipe already bound does. */
    failListenOnce: (message = 'EADDRINUSE') => {
      listen.mockImplementationOnce((pipe: string) =>
        Effect.fail(new HubListenError({ pipe, message }))
      );
    },
    /** Parses the JSON file at path, or undefined when there is none. */
    readJson: (path: string): any => {
      const file = files.get(path);
      return file ? JSON.parse(file.data) : undefined;
    },
    /** The path of this window's lock file. */
    lockPath: () => lockFilePath(homedir, pid),
    /** This window's lock record, or undefined when it has none. */
    lock: (): LockRecord | undefined => {
      const file = files.get(lockFilePath(homedir, pid));
      return file ? JSON.parse(file.data) : undefined;
    },
    /** Opens a connection to the server listening on pipe. */
    connect: (pipe: string): MemoryClient => {
      const queue = servers.get(pipe);
      if (!queue) throw new Error(`ECONNREFUSED: ${pipe}`);
      const { socket, client } = createMemorySocketPair();
      const open = peers.get(pipe) ?? [];
      open.push(client);
      peers.set(pipe, open);
      Queue.offerUnsafe(queue, socket);
      return client;
    },
  };
}

export type MemoryHub = ReturnType<typeof createMemoryHub>;

/**
 * Connects to the pipe this window's lock names and sends a hello with its
 * token. The hello response is the first frame of client.received.
 */
export function connectToLock(hub: MemoryHub): MemoryClient {
  const lock = hub.lock();
  if (!lock?.hub) throw new Error('this window serves no hub');

  const client = hub.connect(lock.pipe);
  client.send(helloFrame(lock.token));
  return client;
}

/** Runs one of the hub's effects under its logger, as the hub's own runtime does. */
export const runHub = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
  Effect.runPromise(Effect.provide(effect, HubLogger.layer));

/** What a spec accepts connections through, in place of the hub's listener. */
export type MemoryHubServer = {
  /** Accepts one connection and hands back both its ends. */
  accept: () => MemorySocketPair;
  /** Stops serving, hanging up every connection, as closing the pipe does. */
  close: () => Promise<void>;
};

/**
 * Serves connections the way the hub does: each on its own scope, all forked
 * into one the spec closes. Ids count authenticated peers, as the hub's do.
 */
export function createMemoryHubServer(options: ServeOptions): MemoryHubServer {
  const scope = Effect.runSync(Scope.make());
  let connections = 0;

  return {
    accept: () => {
      const pair = createMemorySocketPair();
      void runHub(
        serveConnection(pair.socket, options, () => ++connections).pipe(
          Effect.scoped,
          Effect.forkIn(scope)
        )
      );
      return pair;
    },
    close: () => runHub(Scope.close(scope, Exit.void)),
  };
}

/** Runs an effect of the hub's over the memory machine, as the hub's runtime does. */
export const runMemory = <A, E>(
  io: MemoryHub,
  effect: Effect.Effect<A, E, FileSystem.FileSystem | HubEnvironment>
): Promise<A> => Effect.runPromise(Effect.provide(effect, io.layer));

/** The lock file service over the memory layers, for the specs that call it directly. */
export function memoryLockFile(io: MemoryHub): Promise<LockFile.LockFileShape> {
  return Effect.runPromise(
    Effect.service(LockFile.LockFile).pipe(
      Effect.provide(LockFile.layer),
      Effect.provide(io.layer)
    )
  );
}

/** What a spec makes the host answer at the start. */
export type MemoryHostOptions = {
  ide?: string;
  enabled?: boolean;
  folders?: string[];
};

/**
 * A host double: set enabled or roots, then fire the matching event, as a
 * host does once its own state changed. isEnabled and folders are vi.fn, so a
 * spec can make either throw.
 */
export function createMemoryHost(options: MemoryHostOptions = {}) {
  const enabledListeners = new Set<() => void>();
  const folderListeners = new Set<() => void>();
  const subscribe =
    (listeners: Set<() => void>) =>
    (listener: () => void): Unsubscribe => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    };

  const host = {
    ide: options.ide ?? 'memory-ide',
    /** What isEnabled answers. */
    enabled: options.enabled ?? true,
    /** What folders answers. */
    roots: options.folders ?? [],
    isEnabled: vi.fn((): boolean => host.enabled),
    folders: vi.fn((): readonly string[] => host.roots),
    onEnabledChange: vi.fn(subscribe(enabledListeners)),
    onFoldersChange: vi.fn(subscribe(folderListeners)),
    fireEnabledChange: () => {
      for (const listener of [...enabledListeners]) listener();
    },
    fireFoldersChange: () => {
      for (const listener of [...folderListeners]) listener();
    },
    /** The listeners the hub still holds. */
    subscriptions: () => enabledListeners.size + folderListeners.size,
  };

  return host;
}

export type MemoryHost = ReturnType<typeof createMemoryHost>;

/**
 * A documents double. Like a host's registry, it publishes what it holds the
 * moment the hub hands it the publisher; publish is a later change.
 */
export function createMemoryDocuments(open: string[] = []) {
  let publisher: DocumentPublisher | null = null;

  return {
    setPublisher: vi.fn((next: DocumentPublisher) => {
      publisher = next;
      return next(open);
    }),
    /** Publishes through the hub's publisher, as the host does on a change. */
    publish: (documents: string[]): Promise<void> => {
      if (!publisher) throw new Error('the hub has handed over no publisher');
      return publisher(documents);
    },
  };
}

export type MemoryDocuments = ReturnType<typeof createMemoryDocuments>;

/** The doubles a spec may hand startMemoryHub in place of the default ones. */
export type MemoryHubParts = {
  handler?: HubHandler;
  host?: MemoryHost;
  documents?: MemoryDocuments;
};

/** What a spec drives instead of the runtime a host builds. */
export type MemoryHubHandle = {
  readonly host: MemoryHost;
  readonly documents: MemoryDocuments;
  /** Settles once the hub layer has built, with what the host holds. */
  readonly ready: Promise<DocumentHubShape>;
  readonly setDocuments: (documents: string[]) => Promise<void>;
  /** Disposes the runtime, which is what a host does on its way out. */
  readonly close: () => Promise<void>;
};

/**
 * Builds the hub over the memory layers, the way a host builds it over the
 * node ones. The runtime starts building at once, so a spec awaits flush for
 * the first lock.
 */
export function startMemoryHub(
  io: MemoryHub,
  parts: MemoryHubParts = {}
): MemoryHubHandle {
  const host = parts.host ?? createMemoryHost();
  const documents = parts.documents ?? createMemoryDocuments();
  const runtime = ManagedRuntime.make(
    documentHubLayer.pipe(
      Layer.provide(
        Layer.succeed(HubHandlerService, parts.handler ?? createHubHandler())
      ),
      Layer.provide(Layer.succeed(HubHost, host)),
      Layer.provide(Layer.succeed(HubDocuments, documents)),
      Layer.provide(LockFile.layer),
      Layer.provideMerge(io.layer)
    )
  );
  const ready = runtime.runPromise(Effect.service(DocumentHub));
  // A spec may dispose before the build finishes, which interrupts it; nothing
  // else awaits this, so the rejection would be unhandled.
  const settled = ready.catch(() => null);

  return {
    host,
    documents,
    ready,
    setDocuments: paths => settled.then(hub => hub?.setDocuments(paths)),
    close: () => Effect.runPromise(runtime.disposeEffect),
  };
}
