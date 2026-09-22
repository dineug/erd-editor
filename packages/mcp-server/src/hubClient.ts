import {
  createFrameDecoder,
  encodeFrame,
  HUB_PROTOCOL_VERSION,
  HubErrorCode,
  type HubMethod,
  type HubNotification,
  type HubRequestParams,
  type HubResultMap,
  type LockCandidate,
  protocolMismatchMessage,
} from '@dineug/erd-editor-agent-hub';

import { messageOf, SessionError, SessionErrorCode } from '@/errors';
import { type McpIo, type McpSocket } from '@/io';
import { log } from '@/log';

/** How long a request may go unanswered; the hub's own waits all end well inside it. */
export const REQUEST_TIMEOUT_MS = 30_000;

export type HubClient = {
  /** The pid of the window whose lock named this hub. */
  readonly pid: number;
  readonly closed: boolean;
  request: <M extends HubMethod>(
    method: M,
    params: HubRequestParams[M]
  ) => Promise<HubResultMap[M]>;
  close: () => void;
};

export type HubClientOptions = {
  /** The MCP client's name, which hello carries to the hub. */
  client: string;
  onNotification?: (notification: HubNotification) => void;
  /** Called once, when the connection closes from either side. */
  onClose?: () => void;
  requestTimeoutMs?: number;
};

type Pending = {
  method: string;
  resolve: (result: any) => void;
  reject: (error: SessionError) => void;
  timer: ReturnType<typeof setTimeout>;
};

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A Node timer holds a finished process open unless released. */
function release(timer: ReturnType<typeof setTimeout>) {
  (timer as { unref?: () => void }).unref?.();
}

/**
 * JSON lines over one socket: requests matched to responses by id,
 * notifications handed to onNotification. A frame out of step closes it.
 */
export function createHubClient(
  socket: McpSocket,
  pid: number,
  options: HubClientOptions
): HubClient {
  const decoder = createFrameDecoder();
  const pending = new Map<number, Pending>();
  const timeoutMs = options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
  let nextId = 1;
  let closed = false;

  const teardown = () => {
    if (closed) return;
    closed = true;
    for (const { method, reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(
        new SessionError(
          SessionErrorCode.disconnected,
          `The connection to the VS Code window (pid ${pid}) closed before it answered ${method}`
        )
      );
    }
    pending.clear();
    options.onClose?.();
  };

  const receive = (message: unknown) => {
    if (!isRecord(message)) return;

    if (typeof message.id === 'number') {
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      clearTimeout(entry.timer);
      if (message.ok === true) {
        entry.resolve(message.result);
        return;
      }
      const error = isRecord(message.error) ? message.error : {};
      entry.reject(
        new SessionError(
          error.code ?? HubErrorCode.internal,
          typeof error.message === 'string'
            ? error.message
            : `The hub refused ${entry.method}`
        )
      );
      return;
    }
    if (typeof message.method === 'string' && isRecord(message.params)) {
      const notification = message as HubNotification;
      // A response resolved above queued its awaiting code already, so a join
      // seeds the peer before the actions the hub sent after the snapshot land.
      queueMicrotask(() => options.onNotification?.(notification));
    }
  };

  socket.onData(chunk => {
    if (closed) return;
    let messages: unknown[];
    try {
      messages = decoder.push(chunk);
    } catch (error) {
      log(`closed the hub connection of pid ${pid} on a bad frame`, error);
      socket.end();
      teardown();
      return;
    }
    messages.forEach(receive);
  });
  socket.onClose(teardown);

  return {
    pid,
    get closed() {
      return closed;
    },
    request: (method, params) =>
      new Promise((resolve, reject) => {
        if (closed) {
          reject(
            new SessionError(
              SessionErrorCode.disconnected,
              `The connection to the VS Code window (pid ${pid}) is closed`
            )
          );
          return;
        }
        const id = nextId++;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(
            new SessionError(
              SessionErrorCode.timeout,
              `The VS Code window (pid ${pid}) did not answer ${method} within ${timeoutMs} ms`
            )
          );
        }, timeoutMs);
        release(timer);
        pending.set(id, { method, resolve, reject, timer });
        socket.write(encodeFrame({ id, method, params }));
      }),
    close: () => {
      if (closed) return;
      socket.end();
      teardown();
    },
  };
}

/**
 * Connects to the hub a lock advertises and says hello with its token. A lock
 * or hello from another protocol version fails with the side to update.
 */
export async function connectHub(
  io: McpIo,
  candidate: LockCandidate,
  options: HubClientOptions
): Promise<HubClient> {
  const { pid, record } = candidate;
  if (record.protocolVersion !== HUB_PROTOCOL_VERSION) {
    throw new SessionError(
      HubErrorCode.protocolMismatch,
      protocolMismatchMessage(record.protocolVersion, HUB_PROTOCOL_VERSION)
    );
  }

  let socket: McpSocket;
  try {
    socket = await io.connect(record.pipe);
  } catch (error) {
    throw new SessionError(
      SessionErrorCode.hubUnreachable,
      `The VS Code window with pid ${pid} advertises an ERD Editor hub at ${record.pipe}, but it did not accept a connection (${messageOf(error)}). Nothing was written; reload that window or check the ERD Editor extension.`
    );
  }

  const client = createHubClient(socket, pid, options);
  try {
    const hello = await client.request('hello', {
      token: record.token,
      protocolVersion: HUB_PROTOCOL_VERSION,
      client: options.client,
    });
    if (hello.protocolVersion !== HUB_PROTOCOL_VERSION) {
      throw new SessionError(
        HubErrorCode.protocolMismatch,
        protocolMismatchMessage(hello.protocolVersion, HUB_PROTOCOL_VERSION)
      );
    }
  } catch (error) {
    client.close();
    throw error;
  }
  return client;
}
