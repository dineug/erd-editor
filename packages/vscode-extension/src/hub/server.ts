import {
  createFrameDecoder,
  encodeFrame,
  HUB_PROTOCOL_VERSION,
  type HubError,
  HubErrorCode,
  type HubMethod,
  type HubNotification,
  HubRequestError,
  type HubRequestParams,
  type HubResultMap,
  protocolMismatchMessage,
} from '@dineug/erd-editor-agent-hub';

import { type HubSocket } from '@/hub/io';
import { warn } from '@/hub/log';

export type HubRoutedMethod = Exclude<HubMethod, 'hello'>;

/** A peer whose hello passed. */
export type HubConnection = {
  readonly id: number;
  /** The client name its hello carried. */
  readonly client: string;
  /** Sends a notification to the peer; dropped once the connection has closed. */
  notify: (notification: HubNotification) => void;
};

/**
 * Everything the hub serves after hello. A path in params is already the
 * authorized real path; a thrown HubRequestError answers with its code and
 * anything else with internal.
 */
export type HubHandler = {
  [M in HubRoutedMethod]: (
    params: HubRequestParams[M],
    connection: HubConnection
  ) => Promise<HubResultMap[M]>;
} & {
  disconnect: (connection: HubConnection) => void;
};

export type HubServerOptions = {
  token: string;
  ide: string;
  version: string;
  handler: HubHandler;
  /** The real path to hand the handler, or a thrown HubRequestError. */
  authorize: (path: string) => Promise<string>;
};

export type HubServer = {
  accept: (socket: HubSocket) => void;
  /** Destroys every open connection; the listener is closed by its owner. */
  close: () => void;
};

type Outcome = { result: unknown } | { error: HubError };

/**
 * Which routed methods name a document. The type forces the value from the
 * params shape, so a new method fails to compile until it is listed here.
 */
const CARRIES_PATH: {
  [M in HubRoutedMethod]: HubRequestParams[M] extends { path: string }
    ? true
    : false;
} = {
  listDocuments: false,
  openDocument: true,
  join: true,
  applyActions: true,
  leave: true,
  save: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRequestId(value: unknown): value is number {
  return Number.isInteger(value);
}

function isRoutedMethod(method: string): method is HubRoutedMethod {
  return Object.hasOwn(CARRIES_PATH, method);
}

/** Why params cannot reach the handler, or null when they can. */
function paramsProblem(
  method: HubRoutedMethod,
  params: Record<string, unknown>
): string | null {
  if (CARRIES_PATH[method] && typeof params.path !== 'string') {
    return `${method} needs a string params.path`;
  }
  if (method === 'applyActions' && !Array.isArray(params.actions)) {
    return 'applyActions needs an array params.actions';
  }
  return null;
}

/** Compares every character whatever the first difference, so timing leaks no prefix. */
function tokensMatch(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;

  let difference = 0;
  for (let index = 0; index < expected.length; index++) {
    difference |= given.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

function toHubError(error: unknown): HubError {
  if (error instanceof HubRequestError) {
    return { code: error.code, message: error.message };
  }
  warn('request failed', error);
  return { code: HubErrorCode.internal, message: String(error) };
}

export function createHubServer(options: HubServerOptions): HubServer {
  const { token, ide, version, handler, authorize } = options;
  const hangUps = new Set<() => void>();
  let nextConnectionId = 1;

  function accept(socket: HubSocket): void {
    const decoder = createFrameDecoder();
    let open = true;
    let connection: HubConnection | null = null;
    let queue = Promise.resolve();

    const send = (message: unknown) => {
      if (open) socket.write(encodeFrame(message));
    };
    const hangUp = () => {
      open = false;
      socket.destroy();
    };
    const endWith = (message: unknown) => {
      send(message);
      open = false;
      socket.end();
    };
    const respond = (id: number, method: string, outcome: Outcome) => {
      if ('error' in outcome) {
        warn(`answered ${method} with ${outcome.error.code}`, outcome.error);
      }
      const response =
        'error' in outcome
          ? { id, ok: false, method, error: outcome.error }
          : { id, ok: true, method, result: outcome.result };
      try {
        send(response);
      } catch (error) {
        send({ id, ok: false, method, error: toHubError(error) });
      }
    };

    /** The first frame must be a hello with this window's token and protocol. */
    function authenticate(message: unknown): HubConnection | null {
      if (
        !isRecord(message) ||
        message.method !== 'hello' ||
        !isRequestId(message.id)
      ) {
        warn('hung up on a peer whose first frame was not a hello');
        hangUp();
        return null;
      }

      const { id } = message;
      const params = isRecord(message.params) ? message.params : {};
      if (
        typeof params.token !== 'string' ||
        !tokensMatch(params.token, token)
      ) {
        warn('refused a hello with a token that is not in the lock file');
        endWith({
          id,
          ok: false,
          method: 'hello',
          error: {
            code: HubErrorCode.unauthorized,
            message:
              'The hello token does not match the lock file of this window',
          },
        });
        return null;
      }

      const clientVersion =
        typeof params.protocolVersion === 'number' ? params.protocolVersion : 0;
      if (clientVersion !== HUB_PROTOCOL_VERSION) {
        warn(`refused a hello speaking protocol ${clientVersion}`);
        endWith({
          id,
          ok: false,
          method: 'hello',
          error: {
            code: HubErrorCode.protocolMismatch,
            message: protocolMismatchMessage(
              HUB_PROTOCOL_VERSION,
              clientVersion
            ),
            hubProtocolVersion: HUB_PROTOCOL_VERSION,
            clientProtocolVersion: clientVersion,
          },
        });
        return null;
      }

      send({
        id,
        ok: true,
        method: 'hello',
        result: { protocolVersion: HUB_PROTOCOL_VERSION, ide, version },
      });
      return {
        id: nextConnectionId++,
        client: typeof params.client === 'string' ? params.client : '',
        notify: notification => send(notification),
      };
    }

    async function request(
      id: number,
      method: string,
      params: Record<string, unknown>,
      peer: HubConnection
    ): Promise<void> {
      if (!isRoutedMethod(method)) {
        respond(id, method, {
          error: {
            code: HubErrorCode.badRequest,
            message: `The hub has no method ${JSON.stringify(method)}`,
          },
        });
        return;
      }
      const problem = paramsProblem(method, params);
      if (problem) {
        respond(id, method, {
          error: { code: HubErrorCode.badRequest, message: problem },
        });
        return;
      }

      let routed = params;
      if (CARRIES_PATH[method]) {
        try {
          routed = { ...params, path: await authorize(String(params.path)) };
        } catch (error) {
          respond(id, method, { error: toHubError(error) });
          return;
        }
      }
      if (!open) return;

      let pending: Promise<unknown>;
      try {
        pending = Promise.resolve(
          Reflect.apply(handler[method], handler, [routed, peer])
        );
      } catch (error) {
        pending = Promise.reject(error);
      }
      const answered = pending
        .then(
          result => respond(id, method, { result }),
          error => respond(id, method, { error: toHubError(error) })
        )
        .catch(warn);
      // Batches of one peer land in the order it sent them. Any other request
      // is left running, so a slow one does not hold back the frames behind
      // it; calling its handler here still keeps handlers in arrival order.
      if (method === 'applyActions') await answered;
    }

    /** Frames of one connection pass authorization in arrival order. */
    function route(message: unknown, peer: HubConnection): Promise<void> {
      const frame = isRecord(message) ? message : {};
      const method = typeof frame.method === 'string' ? frame.method : '';
      const params = isRecord(frame.params) ? frame.params : {};

      if (!isRequestId(frame.id)) {
        warn(
          `ignored a ${JSON.stringify(method)} frame without an id: a peer sends requests only`
        );
        return Promise.resolve();
      }
      return request(frame.id, method, params, peer);
    }

    hangUps.add(hangUp);
    socket.onClose(() => {
      open = false;
      hangUps.delete(hangUp);
      if (connection) handler.disconnect(connection);
    });
    socket.onData(chunk => {
      if (!open) return;

      let messages: unknown[];
      try {
        messages = decoder.push(chunk);
      } catch (error) {
        // The stream is out of step after a bad frame; see createFrameDecoder.
        warn('hung up on a peer that sent a malformed frame', error);
        hangUp();
        return;
      }

      for (const message of messages) {
        if (!open) return;
        if (!connection) {
          connection = authenticate(message);
          continue;
        }
        const peer = connection;
        queue = queue.then(() => route(message, peer)).catch(warn);
      }
    });
  }

  return {
    accept,
    close: () => {
      for (const hangUp of Array.from(hangUps)) hangUp();
    },
  };
}
