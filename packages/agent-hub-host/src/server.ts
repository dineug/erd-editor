import {
  decodePeerToHubFrames,
  encodeFrame,
  encodeHubNotificationFrame,
  HUB_PROTOCOL_VERSION,
  type HubError,
  HubErrorCode,
  type HubMethod,
  type HubNotification,
  HubRequestError,
  type HubRequestParams,
  type HubResultMap,
  type PeerToHubMessage,
  protocolMismatchMessage,
  type RefusedFrame,
} from '@dineug/erd-editor-agent-hub';
import type { Cause } from 'effect';
import { Effect, Fiber, Queue, Result, Scope, Stream } from 'effect';
import { Socket } from 'effect/unstable/socket';

export type HubRoutedMethod = Exclude<HubMethod, 'hello'>;

/** A peer whose hello passed. */
export type HubConnection = {
  readonly id: number;
  /** The client name its hello carried. */
  readonly client: string;
  /** Sends a notification to the peer; dropped once the connection has closed. */
  notify: (notification: HubNotification) => void;
  /**
   * Resolves once every frame queued before the call has been written to the
   * socket, or once the connection stopped writing, so a host going away can
   * let its last notifications out before the listener destroys the socket.
   */
  drain: () => Promise<void>;
};

/**
 * Everything the hub serves after hello. A path in params is already the
 * authorized real path; a failing HubRequestError answers with its code and
 * any other failure with internal.
 */
export type HubHandler = {
  [M in HubRoutedMethod]: (
    params: HubRequestParams[M],
    connection: HubConnection
  ) => Effect.Effect<HubResultMap[M], HubRequestError>;
} & {
  disconnect: (connection: HubConnection) => void;
};

export type ServeOptions = {
  token: string;
  ide: string;
  version: string;
  handler: HubHandler;
  /** The real path to hand the handler, or a failing HubRequestError. */
  authorize: (path: string) => Effect.Effect<string, HubRequestError>;
};

type Outcome = { result: unknown } | { error: HubError };

/** What the hub writes to a peer: a frame, or the close that destroys the socket. */
type Outbound = string | Socket.CloseEvent;

/** One frame as the reader decodes it: a request, or JSON that fits none. */
type Frame = Result.Result<PeerToHubMessage, RefusedFrame>;

/** A drain call waiting for the frame count it saw to be written. */
type DrainWaiter = { target: number; resolve: () => void };

/** What the hub checks of a hello before it lets a peer in. */
type Hello = {
  id: number;
  token: unknown;
  protocolVersion: number;
  client: string;
};

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

const toHubError = (error: unknown): Effect.Effect<HubError> =>
  error instanceof HubRequestError
    ? Effect.succeed({ code: error.code, message: error.message })
    : Effect.logWarning('request failed', error).pipe(
        Effect.as({ code: HubErrorCode.internal, message: String(error) })
      );

/**
 * The hello a first frame carries, or null for any other frame. A refused one
 * is read by hand as before the schema: its token is checked as it stands, a
 * protocol that is no number reads as 0 and a client that is no string as ''.
 */
function helloOf(frame: Frame): Hello | null {
  if (Result.isSuccess(frame)) {
    const request = frame.success;
    return request.method === 'hello'
      ? { id: request.id, ...request.params }
      : null;
  }
  const { value } = frame.failure;
  if (!isRecord(value) || value.method !== 'hello' || !isRequestId(value.id)) {
    return null;
  }
  const params = isRecord(value.params) ? value.params : {};
  return {
    id: value.id,
    token: params.token,
    protocolVersion:
      typeof params.protocolVersion === 'number' ? params.protocolVersion : 0,
    client: typeof params.client === 'string' ? params.client : '',
  };
}

/**
 * Serves one accepted connection until it closes. Frames of one connection
 * pass authorization in the order they arrived, and a batch holds the frames
 * behind it until it is answered, so one peer's edits land in its own order.
 */
export const serveConnection = (
  socket: Socket.Socket,
  options: ServeOptions,
  nextConnectionId: () => number
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* () {
    const { token, ide, version, handler, authorize } = options;
    const outbound = yield* Queue.unbounded<Outbound, Cause.Done>();
    let open = true;
    let connection: HubConnection | null = null;
    let queued = 0;
    let written = 0;
    let writing = true;
    const drains = new Set<DrainWaiter>();

    const offer = (frame: string) => {
      if (Queue.offerUnsafe(outbound, frame)) queued++;
    };
    const settleDrains = () => {
      for (const waiter of drains) {
        if (writing && written < waiter.target) continue;
        drains.delete(waiter);
        waiter.resolve();
      }
    };
    const drain = (): Promise<void> =>
      !writing || written >= queued
        ? Promise.resolve()
        : new Promise(resolve => void drains.add({ target: queued, resolve }));

    const send = (message: unknown) => {
      if (open) offer(encodeFrame(message));
    };
    const hangUp = () => {
      open = false;
      Queue.offerUnsafe(outbound, new Socket.CloseEvent(1006));
      Queue.endUnsafe(outbound);
    };
    const endWith = (message: unknown) => {
      send(message);
      open = false;
      Queue.endUnsafe(outbound);
    };
    const respond = (id: number, method: string, outcome: Outcome) =>
      Effect.gen(function* () {
        if ('error' in outcome) {
          yield* Effect.logWarning(
            `answered ${method} with ${outcome.error.code}`,
            outcome.error
          );
        }
        const response =
          'error' in outcome
            ? { id, ok: false, method, error: outcome.error }
            : { id, ok: true, method, result: outcome.result };
        try {
          send(response);
        } catch (error) {
          send({
            id,
            ok: false,
            method,
            error: yield* toHubError(error),
          });
        }
      });

    /** The first frame must be a hello with this window's token and protocol. */
    const authenticate = (frame: Frame) =>
      Effect.gen(function* () {
        const hello = helloOf(frame);
        if (!hello) {
          yield* Effect.logWarning(
            'hung up on a peer whose first frame was not a hello'
          );
          hangUp();
          return null;
        }

        const { id } = hello;
        if (
          typeof hello.token !== 'string' ||
          !tokensMatch(hello.token, token)
        ) {
          yield* Effect.logWarning(
            'refused a hello with a token that is not in the lock file'
          );
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

        const clientVersion = hello.protocolVersion;
        if (clientVersion !== HUB_PROTOCOL_VERSION) {
          yield* Effect.logWarning(
            `refused a hello speaking protocol ${clientVersion}`
          );
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
        const peer: HubConnection = {
          id: nextConnectionId(),
          client: hello.client,
          notify: (notification: HubNotification) => {
            if (open) offer(encodeHubNotificationFrame(notification));
          },
          drain,
        };
        return peer;
      });

    const noMethod = (id: number, method: string) =>
      respond(id, method, {
        error: {
          code: HubErrorCode.badRequest,
          message: `The hub has no method ${JSON.stringify(method)}`,
        },
      });

    /** Authorizes the path a request names, then calls its handler. */
    const dispatch = (
      id: number,
      method: HubRoutedMethod,
      params: Record<string, unknown>,
      peer: HubConnection
    ) =>
      Effect.gen(function* () {
        let routed = params;
        if (CARRIES_PATH[method]) {
          const authorized = yield* authorize(String(params.path)).pipe(
            Effect.result
          );
          if (authorized._tag === 'Failure') {
            yield* respond(id, method, {
              error: yield* toHubError(authorized.failure),
            });
            return;
          }
          routed = { ...params, path: authorized.success };
        }
        if (!open) return;

        const invoke = handler[method] as (
          params: Record<string, unknown>,
          connection: HubConnection
        ) => Effect.Effect<unknown, HubRequestError>;
        const call = Effect.suspend(() =>
          Reflect.apply(invoke, handler, [routed, peer])
        ).pipe(
          Effect.matchEffect({
            onSuccess: result => respond(id, method, { result }),
            onFailure: error =>
              toHubError(error).pipe(
                Effect.flatMap(hubError =>
                  respond(id, method, { error: hubError })
                )
              ),
          }),
          Effect.catchDefect(defect =>
            toHubError(defect).pipe(
              Effect.flatMap(hubError =>
                respond(id, method, { error: hubError })
              )
            )
          )
        );
        // Detached, so a peer hanging up mid-request never cancels a save or an
        // open that is already writing; its response is dropped instead.
        const answered = yield* Effect.forkDetach(call, {
          startImmediately: true,
        });
        // Batches of one peer land in the order it sent them. Any other
        // request is left running, so a slow one does not hold back the frames
        // behind it; calling its handler here still keeps handlers in order.
        if (method === 'applyActions') yield* Fiber.await(answered);
      });

    /**
     * A refused frame read by hand as before the schema, so it gets the answer
     * it always got: skipped without a request id, badRequest for an unknown
     * method or a param its method needs, else the handler with what it has.
     */
    const serveRefused = (value: unknown, peer: HubConnection) =>
      Effect.gen(function* () {
        const frame = isRecord(value) ? value : {};
        const method = typeof frame.method === 'string' ? frame.method : '';
        const params = isRecord(frame.params) ? frame.params : {};

        if (!isRequestId(frame.id)) {
          yield* Effect.logWarning(
            `ignored a ${JSON.stringify(method)} frame without an id: a peer sends requests only`
          );
          return;
        }
        if (!isRoutedMethod(method)) {
          yield* noMethod(frame.id, method);
          return;
        }
        const problem = paramsProblem(method, params);
        if (problem) {
          yield* respond(frame.id, method, {
            error: { code: HubErrorCode.badRequest, message: problem },
          });
          return;
        }
        yield* dispatch(frame.id, method, params, peer);
      });

    /** Frames of one connection pass authorization in arrival order. */
    const route = (frame: Frame, peer: HubConnection) => {
      if (Result.isFailure(frame))
        return serveRefused(frame.failure.value, peer);
      const request = frame.success;
      return request.method === 'hello'
        ? noMethod(request.id, request.method)
        : dispatch(request.id, request.method, request.params, peer);
    };

    // The two halves run apart rather than as one duplex channel: a write that
    // cannot reach a peer must leave the reader serving, and hanging up has to
    // destroy the socket even once the reader has failed.
    const writes = yield* Effect.forkChild(
      Effect.scoped(
        Effect.gen(function* () {
          const writer = yield* socket.writer;
          yield* Stream.fromQueue(outbound).pipe(
            Stream.runForEach(chunk =>
              writer.write(chunk).pipe(
                Effect.catch(failure =>
                  Effect.logWarning('could not write to a peer', failure.reason)
                ),
                // Taken or refused, a frame counts as written, so a drain
                // never outlasts a peer the hub can no longer write to.
                Effect.ensuring(
                  Effect.sync(() => {
                    if (typeof chunk !== 'string') return;
                    written++;
                    settleDrains();
                  })
                )
              )
            )
          );
        })
      ).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            writing = false;
            settleDrains();
          })
        )
      )
    );
    const incoming = yield* Queue.unbounded<Frame, Cause.Done>();

    // Read in a fiber of its own, so a peer hanging up closes the connection
    // at once rather than behind whatever request is still being served.
    yield* Effect.forkChild(
      Stream.fromPull(Socket.readerString(socket)).pipe(
        decodePeerToHubFrames,
        Stream.runForEach(frame =>
          Effect.sync(() => void Queue.offerUnsafe(incoming, frame))
        ),
        // A peer hanging up is the usual end of a connection and says nothing;
        // a frame the hub cannot read is what it hangs up over.
        Effect.catch(error =>
          error._tag === 'FrameError'
            ? Effect.logWarning(
                'hung up on a peer that sent a malformed frame',
                error
              ).pipe(Effect.andThen(Effect.sync(hangUp)))
            : Effect.void
        ),
        Effect.ensuring(
          Effect.sync(() => {
            open = false;
            Queue.endUnsafe(incoming);
          })
        )
      )
    );

    yield* Stream.fromQueue(incoming).pipe(
      Stream.runForEach(frame =>
        Effect.gen(function* () {
          if (!open) return;
          if (!connection) {
            connection = yield* authenticate(frame);
            return;
          }
          yield* route(frame, connection);
        })
      ),
      Effect.ensuring(
        Effect.sync(() => {
          open = false;
          Queue.endUnsafe(outbound);
          if (connection) handler.disconnect(connection);
        })
      )
    );
    // The frames still queued, a hang-up's close among them, reach the peer
    // before this scope closes and takes the writer with it.
    yield* Fiber.await(writes);
  });
