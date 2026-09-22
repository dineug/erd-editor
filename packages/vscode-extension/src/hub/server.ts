import {
  decodeFrames,
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
import type { Done } from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Queue from 'effect/Queue';
import * as Schema from 'effect/Schema';
import * as Scope from 'effect/Scope';
import * as Stream from 'effect/Stream';
import * as Socket from 'effect/unstable/socket/Socket';

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

const frames = decodeFrames(Schema.Unknown);

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
    const outbound = yield* Queue.unbounded<Outbound, Done>();
    let open = true;
    let connection: HubConnection | null = null;

    const send = (message: unknown) => {
      if (open) Queue.offerUnsafe(outbound, encodeFrame(message));
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
    const authenticate = (message: unknown) =>
      Effect.gen(function* () {
        if (
          !isRecord(message) ||
          message.method !== 'hello' ||
          !isRequestId(message.id)
        ) {
          yield* Effect.logWarning(
            'hung up on a peer whose first frame was not a hello'
          );
          hangUp();
          return null;
        }

        const { id } = message;
        const params = isRecord(message.params) ? message.params : {};
        if (
          typeof params.token !== 'string' ||
          !tokensMatch(params.token, token)
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

        const clientVersion =
          typeof params.protocolVersion === 'number'
            ? params.protocolVersion
            : 0;
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
          client: typeof params.client === 'string' ? params.client : '',
          notify: (notification: HubNotification) => send(notification),
        };
        return peer;
      });

    const request = (
      id: number,
      method: string,
      params: Record<string, unknown>,
      peer: HubConnection
    ) =>
      Effect.gen(function* () {
        if (!isRoutedMethod(method)) {
          yield* respond(id, method, {
            error: {
              code: HubErrorCode.badRequest,
              message: `The hub has no method ${JSON.stringify(method)}`,
            },
          });
          return;
        }
        const problem = paramsProblem(method, params);
        if (problem) {
          yield* respond(id, method, {
            error: { code: HubErrorCode.badRequest, message: problem },
          });
          return;
        }

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

    /** Frames of one connection pass authorization in arrival order. */
    const route = (message: unknown, peer: HubConnection) =>
      Effect.gen(function* () {
        const frame = isRecord(message) ? message : {};
        const method = typeof frame.method === 'string' ? frame.method : '';
        const params = isRecord(frame.params) ? frame.params : {};

        if (!isRequestId(frame.id)) {
          yield* Effect.logWarning(
            `ignored a ${JSON.stringify(method)} frame without an id: a peer sends requests only`
          );
          return;
        }
        yield* request(frame.id, method, params, peer);
      });

    // The two halves run apart rather than as one duplex channel: a write that
    // cannot reach a peer must leave the reader serving, and hanging up has to
    // destroy the socket even once the reader has failed.
    const writing = yield* Effect.forkChild(
      Effect.scoped(
        Effect.gen(function* () {
          const writer = yield* socket.writer;
          yield* Stream.fromQueue(outbound).pipe(
            Stream.runForEach(chunk =>
              writer
                .write(chunk)
                .pipe(
                  Effect.catch(failure =>
                    Effect.logWarning(
                      'could not write to a peer',
                      failure.reason
                    )
                  )
                )
            )
          );
        })
      )
    );
    const incoming = yield* Queue.unbounded<unknown, Done>();

    // Read in a fiber of its own, so a peer hanging up closes the connection
    // at once rather than behind whatever request is still being served.
    yield* Effect.forkChild(
      Stream.fromPull(Socket.readerString(socket)).pipe(
        frames,
        Stream.runForEach(message =>
          Effect.sync(() => void Queue.offerUnsafe(incoming, message))
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
      Stream.runForEach(message =>
        Effect.gen(function* () {
          if (!open) return;
          if (!connection) {
            connection = yield* authenticate(message);
            return;
          }
          yield* route(message, connection);
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
    yield* Fiber.await(writing);
  });
