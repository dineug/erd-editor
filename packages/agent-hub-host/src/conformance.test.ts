/// <reference types="vite/types/importMeta.d.ts" />
import {
  type HubErrorCode,
  HubRequestError,
  type Platform,
} from '@dineug/erd-editor-agent-hub';
import { Effect } from 'effect';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vite-plus/test';

import {
  createHubHandler,
  createMemoryHub,
  createMemoryHubServer,
  flush,
  fsError,
  runMemory,
} from '@/__test-utils__/hubLayers';
import { authorizePath, resolveRealPath } from '@/authz';
import {
  closedBeforeSave,
  closedDuringJoin,
  createNeedsInitialValue,
  editorCouldNotOpen,
  ERD_FILE_EXTENSIONS,
  erdFileProblem,
  fileMissing,
  folderMissing,
  notJoined,
  notOpenInEditor,
  notReadyForActions,
  OPEN_READY_TIMEOUT_MS,
  openTimedOut,
  SAVE_QUIET_CAP_MS,
  stripBom,
  unsettledSave,
} from '@/documentRules';
import {
  actionType,
  actionVersion,
  drainJoinQueue,
  type DropCounts,
  filterJoinQueue,
  hasChangeAction,
  JOIN_QUIET_CAP_MS,
  maxVersion,
  type QueuedBatch,
  REPLICA_DEBOUNCE_MS,
} from '@/joinWindow';
import { choosePipePath, socketFilePaths, tmpPipePath } from '@/pipePath';
import { type HubConnection, type HubRoutedMethod } from '@/server';
import { HubEnvError } from '@/services/HubEnvironment';

// Read through the bundler, as imports.test.ts reads the sources.
const [raw] = Object.values(
  import.meta.glob<string>('./__fixtures__/conformance.json', {
    query: '?raw',
    import: 'default',
    eager: true,
  })
);

type Refusal = { code: string; message: string };

/** A handler call as the corpus writes it, whatever shape the params came in. */
type Call = {
  method: HubRoutedMethod;
  path: string | null;
  create: boolean | null;
  initialValue: string | null;
  actions: unknown[] | null;
  client: string;
};

type Scenario = {
  name: string;
  handlerRefuses?: Partial<Record<HubRoutedMethod, Refusal>>;
  send: string[];
  expect: string[];
  then: 'open' | 'end' | 'hangUp';
  authorized: string[];
  calls: Call[];
  logs: string[];
};

/** The file system of one authz vector; the corpus's authz $comment says how it answers. */
type Machine = {
  platform: Platform;
  links: Record<string, string>;
  existing: string[];
  failing: string[];
};

/** The corpus as it is written; its $comment fields say what each table means. */
type HostCorpus = {
  server: {
    token: string;
    ide: string;
    version: string;
    authorizePrefix: string;
    authorizeRefuses: Record<string, Refusal>;
    answers: Record<HubRoutedMethod, Record<string, unknown>>;
    scenarios: Scenario[];
  };
  documentRules: {
    extensions: string[];
    openReadyTimeoutMs: number;
    saveQuietCapMs: number;
    erdFile: Array<{ path: string; problem: string | null }>;
    refusals: Array<Refusal & { name: string; args: string[] }>;
    logs: Array<{ name: string; args: string[]; text: string }>;
    stripBom: Array<{ input: string; output: string }>;
  };
  joinWindow: {
    replicaDebounceMs: number;
    joinQuietCapMs: number;
    nonChangeTypes: string[];
    actionVersion: Array<{ action: unknown; version: number | null }>;
    actionType: Array<{ action: unknown; type: string }>;
    hasChangeAction: Array<{ actions: unknown[]; result: boolean }>;
    maxVersion: Array<{ current: number; actions: unknown[]; result: number }>;
    filterJoinQueue: Array<{
      queue: QueuedBatch[];
      snapshotVersion: number;
      batches: QueuedBatch[];
      dropped: DropCounts;
      droppedCount: number;
    }>;
    drainJoinQueue: Array<{
      queue: QueuedBatch[];
      captured: number;
      snapshotVersion: number;
      path: string;
      batches: QueuedBatch[];
      warning: { text: string; dropped: DropCounts } | null;
    }>;
  };
  pipePath: {
    tmpPipePath: Array<{ tmp: string; pid: number; pipe: string }>;
    choosePipePath: Array<{
      home: string;
      tmp: string;
      pid: number;
      platform: Platform;
      pipe: string | null;
    }>;
    socketFilePaths: Array<{
      home: string;
      tmp: string;
      pid: number;
      platform: Platform;
      paths: string[];
    }>;
  };
  authz: {
    resolve: Array<Machine & { target: string; real: string | null }>;
    authorize: Array<
      Machine & {
        folders: string[];
        documents: string[];
        target: string;
        real: string | null;
        error: Refusal | null;
      }
    >;
  };
};

const corpus: HostCorpus = JSON.parse(raw);

const ROUTED: readonly HubRoutedMethod[] = [
  'listDocuments',
  'openDocument',
  'join',
  'applyActions',
  'leave',
  'save',
];

const refusalOf = (refusal: Refusal) =>
  new HubRequestError({
    code: refusal.code as HubErrorCode,
    message: refusal.message,
  });

type AnyHandler = Mock<
  (
    params: Record<string, unknown>,
    connection: HubConnection
  ) => Effect.Effect<unknown, HubRequestError>
>;

function normalize(
  method: HubRoutedMethod,
  params: Record<string, unknown>,
  connection: HubConnection
): Call {
  return {
    method,
    path:
      method !== 'listDocuments' && typeof params.path === 'string'
        ? params.path
        : null,
    create: method === 'openDocument' ? Boolean(params.create) : null,
    initialValue:
      method === 'openDocument' && typeof params.initialValue === 'string'
        ? params.initialValue
        : null,
    actions: method === 'applyActions' ? (params.actions as unknown[]) : null,
    client: connection.client,
  };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('server', () => {
  const { server } = corpus;

  it.each(server.scenarios)('$name', async scenario => {
    const handler = createHubHandler();
    const mocks = ROUTED.map(
      method => [method, handler[method] as unknown as AnyHandler] as const
    );
    for (const [method, mock] of mocks) {
      const refusal = scenario.handlerRefuses?.[method];
      mock.mockImplementation(params =>
        refusal
          ? Effect.fail(refusalOf(refusal))
          : Effect.succeed(
              method === 'openDocument'
                ? { path: params.path, ...server.answers.openDocument }
                : server.answers[method]
            )
      );
    }
    const authorized: string[] = [];
    const hub = createMemoryHubServer({
      token: server.token,
      ide: server.ide,
      version: server.version,
      handler,
      authorize: path => {
        authorized.push(path);
        return Object.hasOwn(server.authorizeRefuses, path)
          ? Effect.fail(refusalOf(server.authorizeRefuses[path]))
          : Effect.succeed(`${server.authorizePrefix}${path}`);
      },
    });
    const { client, destroy } = hub.accept();

    for (const piece of scenario.send) {
      client.sendRaw(piece);
      await flush();
    }
    const calls = mocks
      .flatMap(([method, mock]) =>
        mock.mock.calls.map(([params, connection], index) => ({
          order: mock.mock.invocationCallOrder[index],
          call: normalize(method, params, connection),
        }))
      )
      .sort((a, b) => a.order - b.order)
      .map(({ call }) => call);
    const logs = vi
      .mocked(console.warn)
      .mock.calls.filter(([prefix]) => prefix === '[erd-editor hub]')
      .map(([, text]) => text);
    const then =
      destroy.mock.calls.length > 0 ? 'hangUp' : client.closed ? 'end' : 'open';
    await hub.close();

    expect(client.writes).toEqual(scenario.expect.map(frame => `${frame}\n`));
    expect(then).toBe(scenario.then);
    expect(authorized).toEqual(scenario.authorized);
    expect(calls).toEqual(scenario.calls);
    expect(logs).toEqual(scenario.logs);
  });
});

describe('documentRules', () => {
  const { documentRules } = corpus;
  const refusals: Record<string, (...args: string[]) => HubRequestError> = {
    fileMissing,
    folderMissing,
    createNeedsInitialValue,
    editorCouldNotOpen,
    openTimedOut,
    notReadyForActions,
    notJoined,
    notOpenInEditor,
    closedBeforeSave,
    closedDuringJoin,
  };
  const logs: Record<string, (...args: string[]) => string> = {
    unsettledSave,
  };

  it('holds the extensions and the two waits', () => {
    expect(ERD_FILE_EXTENSIONS).toEqual(documentRules.extensions);
    expect(OPEN_READY_TIMEOUT_MS).toBe(documentRules.openReadyTimeoutMs);
    expect(SAVE_QUIET_CAP_MS).toBe(documentRules.saveQuietCapMs);
  });

  it.each(documentRules.erdFile)(
    'answers $path with $problem',
    ({ path, problem }) => {
      const refusal = erdFileProblem(path);

      expect(refusal?.message ?? null).toBe(problem);
      if (refusal) expect(refusal.code).toBe('badRequest');
    }
  );

  it.each(documentRules.refusals)(
    'words $name as $message',
    ({ name, args, code, message }) => {
      const refusal = refusals[name](...args);

      expect(refusal).toBeInstanceOf(HubRequestError);
      expect(refusal).toMatchObject({ code, message });
    }
  );

  it.each(documentRules.logs)('logs $name as $text', ({ name, args, text }) => {
    expect(logs[name](...args)).toBe(text);
  });

  it.each(documentRules.stripBom)(
    'strips $input to $output',
    ({ input, output }) => {
      expect(stripBom(input)).toBe(output);
    }
  );
});

describe('joinWindow', () => {
  const { joinWindow } = corpus;

  it('holds the replica debounce, the join cap and the action types that change nothing', () => {
    expect(REPLICA_DEBOUNCE_MS).toBe(joinWindow.replicaDebounceMs);
    expect(JOIN_QUIET_CAP_MS).toBe(joinWindow.joinQuietCapMs);
    for (const type of joinWindow.nonChangeTypes) {
      expect(hasChangeAction([{ type }])).toBe(false);
    }
  });

  it.each(joinWindow.actionVersion)(
    'reads the version of $action as $version',
    ({ action, version }) => {
      expect(actionVersion(action) ?? null).toBe(version);
    }
  );

  it.each(joinWindow.actionType)(
    'reads the type of $action as $type',
    ({ action, type }) => {
      expect(actionType(action)).toBe(type);
    }
  );

  it.each(joinWindow.hasChangeAction)(
    'counts $actions as a change: $result',
    ({ actions, result }) => {
      expect(hasChangeAction(actions)).toBe(result);
    }
  );

  it.each(joinWindow.maxVersion)(
    'raises $current to $result',
    ({ current, actions, result }) => {
      expect(maxVersion(current, actions)).toBe(result);
    }
  );

  it.each(joinWindow.filterJoinQueue)(
    'filters a queue at snapshot $snapshotVersion',
    ({ queue, snapshotVersion, batches, dropped, droppedCount }) => {
      expect(filterJoinQueue(queue, snapshotVersion)).toEqual({
        batches,
        dropped,
        droppedCount,
      });
    }
  );

  it.each(joinWindow.drainJoinQueue)(
    'drains $captured captured batches of $path at snapshot $snapshotVersion',
    ({ queue, captured, snapshotVersion, path, batches, warning }) => {
      expect(drainJoinQueue(queue, captured, snapshotVersion, path)).toEqual(
        batches
      );
      expect(vi.mocked(console.warn).mock.calls).toEqual(
        warning ? [['[erd-editor hub]', warning.text, warning.dropped]] : []
      );
    }
  );
});

describe('pipePath', () => {
  const { pipePath } = corpus;

  it.each(pipePath.tmpPipePath)(
    'binds pid $pid under $tmp at $pipe',
    ({ tmp, pid, pipe }) => {
      expect(tmpPipePath(tmp, pid)).toBe(pipe);
    }
  );

  it.each(pipePath.choosePipePath)(
    'chooses $pipe for pid $pid on $platform',
    ({ home, tmp, pid, platform, pipe }) => {
      expect(choosePipePath(home, tmp, pid, platform)).toBe(pipe);
    }
  );

  it.each(pipePath.socketFilePaths)(
    'lists the socket files of pid $pid on $platform',
    ({ home, tmp, pid, platform, paths }) => {
      expect(socketFilePaths(home, tmp, pid, platform)).toEqual(paths);
    }
  );
});

/** The memory machine of one vector, answering realPath and lstat as the corpus says. */
function machine({ platform, links, existing, failing }: Machine) {
  const io = createMemoryHub({ platform });
  const separator = platform === 'win32' ? '\\' : '/';
  const follow = (path: string) => {
    for (const [from, to] of Object.entries(links)) {
      if (path === from || path.startsWith(`${from}${separator}`)) {
        return to + path.slice(from.length);
      }
    }
    return path;
  };
  const exists = (path: string) =>
    existing.some(
      entry =>
        entry === path ||
        entry.startsWith(
          path.endsWith(separator) ? path : `${path}${separator}`
        )
    );

  io.fs.realPath.mockImplementation((path: string) =>
    Effect.suspend(() => {
      if (failing.includes(path)) {
        return Effect.fail(fsError('Busy', 'realPath', path));
      }
      const real = follow(path);
      return exists(real)
        ? Effect.succeed(real)
        : Effect.fail(fsError('NotFound', 'realPath', path));
    })
  );
  vi.mocked(io.env.lstat).mockImplementation((path: string) =>
    Effect.suspend(() =>
      Object.hasOwn(links, path) || exists(follow(path))
        ? Effect.void
        : Effect.fail(
            new HubEnvError({
              reason: 'NotFound',
              path,
              message: `no entry at ${path}`,
            })
          )
    )
  );
  return io;
}

describe('authz', () => {
  const { authz } = corpus;

  it.each(authz.resolve)(
    'resolves $target on $platform to $real',
    async vector => {
      const io = machine(vector);

      expect(
        await runMemory(io, resolveRealPath(vector.target, vector.platform))
      ).toBe(vector.real);
    }
  );

  it.each(authz.authorize)(
    'authorizes $target in $folders or $documents on $platform',
    async vector => {
      const io = machine(vector);
      const { folders, documents, target, platform } = vector;
      const outcome = await runMemory(
        io,
        authorizePath(platform, { folders, documents }, target).pipe(
          Effect.map(real => ({ real, error: null })),
          Effect.catchTag('HubRequestError', refusal =>
            Effect.succeed({
              real: null,
              error: { code: refusal.code, message: refusal.message },
            })
          )
        )
      );

      expect(outcome).toEqual({ real: vector.real, error: vector.error });
    }
  );
});
