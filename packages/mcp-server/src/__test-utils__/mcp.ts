import type { Stdio } from 'effect';
import { Context, Effect, Layer } from 'effect';
import { TestClock } from 'effect/testing';

import type { MemoryHost } from '@/__test-utils__/memoryHost';
import { serveStdio, type StdioServer } from '@/__test-utils__/stdio';
import type { ListedTool } from '@/__test-utils__/toolSurface';
import { makeServerLayer, NodePlatform } from '@/server';
import { SessionManager } from '@/session/manager';

export type CallOutcome = {
  isError: boolean;
  /** The first text block, parsed when it is JSON. */
  json: any;
  text: string;
  /** Every text block, in order. */
  texts: string[];
  /** The structuredContent a 2025-06-18 client receives, if any. */
  structured: unknown;
};

/** A JSON-RPC error response, such as -32602 for arguments a tool refuses. */
export class RpcError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = 'RpcError';
    this.code = code;
  }
}

export type ListedTools = {
  tools: Array<ListedTool & { description?: string; annotations?: any }>;
};

export type McpClient = {
  /** One request, answered by the response line with its id, error or not. */
  request: (method: string, params?: object) => Promise<any>;
  notify: (method: string, params?: object) => void;
};

export type McpHarness = McpClient & {
  initialize: any;
  listTools: () => Promise<ListedTools>;
  /** Fails with an RpcError when the call is answered by a JSON-RPC error. */
  call: (name: string, args?: Record<string, unknown>) => Promise<CallOutcome>;
  /** Like call, but fails the spec on an error result; parsed JSON when it is JSON. */
  ok: (name: string, args?: Record<string, unknown>) => Promise<any>;
  /** The raw first text block of a successful call, such as a read. */
  text: (name: string, args?: Record<string, unknown>) => Promise<string>;
  /** The session manager the server runs on, for the idle and state specs. */
  manager: {
    paths: () => string[];
    sweep: () => Promise<string[]>;
    closeAll: () => Promise<void>;
  };
  /** Moves the test clock the server runs on, once it was asked for one. */
  adjust: (ms: number) => Promise<void>;
  stdio: StdioServer<SessionManager>;
  /** Ends stdin and waits for the server to stop; safe to call twice. */
  close: () => Promise<void>;
};

export type ConnectOptions = {
  /** The machine in memory to serve on; the real one when left out. */
  host?: MemoryHost;
  clientName?: string;
  protocolVersion?: string;
  /** Runs the server on TestClock, which only adjust moves. */
  testClock?: boolean;
};

function parse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** A JSON-RPC line client over a server's stdio, requests matched by id. */
export function rpcClient<A>(stdio: StdioServer<A>): McpClient {
  const waiters = new Map<unknown, (message: any) => void>();
  let nextId = 1;
  stdio.onLine(message => {
    const waiter = waiters.get(message.id);
    if (!('method' in message) && waiter) {
      waiters.delete(message.id);
      waiter(message);
    }
  });

  return {
    request: (method, params) =>
      new Promise(resolve => {
        const id = nextId++;
        waiters.set(id, resolve);
        stdio.send({
          jsonrpc: '2.0',
          id,
          method,
          ...(params ? { params } : {}),
        });
      }),
    notify: (method, params) => {
      stdio.send({ jsonrpc: '2.0', method, ...(params ? { params } : {}) });
    },
  };
}

/** initialize, then notifications/initialized, as a client opens a session. */
export async function initialize(
  client: McpClient,
  clientName = 'claude-code',
  protocolVersion = '2025-06-18'
): Promise<any> {
  const response = await client.request('initialize', {
    protocolVersion,
    capabilities: {},
    clientInfo: { name: clientName, version: '1.0.0' },
  });
  client.notify('notifications/initialized');
  return response;
}

/** Serves any layer that needs Stdio and opens an MCP session on it. */
export async function connectLayer(
  layer: Layer.Layer<SessionManager, unknown, Stdio.Stdio>,
  options: { clientName?: string; protocolVersion?: string } = {}
): Promise<McpHarness> {
  const stdio = serveStdio(layer);
  const client = rpcClient(stdio);
  const context = await stdio.context;
  const service = Context.get(context, SessionManager);
  const init = await initialize(
    client,
    options.clientName,
    options.protocolVersion
  );

  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const response = await client.request('tools/call', {
      name,
      arguments: args,
    });
    if (response.error) {
      throw new RpcError(response.error.code, response.error.message);
    }
    const { result } = response;
    const texts: string[] = result.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text);
    return {
      isError: result.isError === true,
      json: parse(texts[0] ?? ''),
      text: texts[0] ?? '',
      texts,
      structured: result.structuredContent,
    };
  };

  let closing: Promise<void> | null = null;
  return {
    ...client,
    initialize: init,
    listTools: async () => (await client.request('tools/list')).result,
    call,
    ok: async (name, args) => {
      const outcome = await call(name, args);
      if (outcome.isError) {
        throw new Error(`${name} failed: ${outcome.text}`);
      }
      return outcome.json ?? outcome.text;
    },
    text: async (name, args) => {
      const outcome = await call(name, args);
      if (outcome.isError) {
        throw new Error(`${name} failed: ${outcome.text}`);
      }
      return outcome.text;
    },
    manager: {
      paths: () => Effect.runSync(service.paths),
      sweep: () => Effect.runPromise(service.sweep),
      closeAll: () => Effect.runPromise(service.closeAll),
    },
    adjust: ms =>
      Effect.runPromise(
        TestClock.adjust(ms).pipe(
          Effect.provideContext(context as Context.Context<never>)
        )
      ),
    stdio,
    close: () =>
      (closing ??= (async () => {
        stdio.end();
        await stdio.exit;
      })()),
  };
}

/** The server as the host runs it, stdio and clock aside. */
export function serverLayer(
  options: Pick<ConnectOptions, 'host' | 'testClock'>
) {
  const layer = makeServerLayer(options.host?.layer ?? NodePlatform);
  return options.testClock
    ? layer.pipe(Layer.provideMerge(TestClock.layer()))
    : layer;
}

/** The server with every tool, over an in-memory stdio, and an MCP client session on it. */
export function connectMcp(options: ConnectOptions = {}): Promise<McpHarness> {
  const { clientName, protocolVersion } = options;
  return connectLayer(serverLayer(options), { clientName, protocolVersion });
}

/** Lets queued microtasks and socket deliveries run. */
export const settle = (ms = 5) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

/** Document JSON without the per-replica meta stamps, for comparing two sides. */
export function comparable(value: string) {
  const document = JSON.parse(value);
  for (const entities of Object.values<Record<string, any>>(
    document.collections
  )) {
    for (const entity of Object.values<any>(entities)) delete entity.meta;
  }
  return document;
}
