import {
  decodeHubToPeerFrames,
  encodePeerToHubFrame,
  HUB_PROTOCOL_VERSION,
  HubErrorCode,
  type HubMethod,
  type HubNotification,
  type HubRequestParams,
  type HubResponse,
  type HubResultMap,
  type HubToPeerMessage,
  type LockCandidate,
  type PeerToHubMessage,
  protocolMismatchMessage,
  type RefusedFrame,
} from '@dineug/erd-editor-agent-hub';
import type { Cause } from 'effect';
import {
  Context,
  Deferred,
  Effect,
  Exit,
  Layer,
  Option,
  Queue,
  Result,
  Scope,
  Stream,
} from 'effect';
import { Socket } from 'effect/unstable/socket';

import { SessionError, SessionErrorCode } from '@/errors';
import { capitalize, hostWords } from '@/hub/host';
import { type ConnectPipe, connectPipe } from '@/io/netSocket';

/** How long a request may go unanswered; the hub's own waits all end well inside it. */
export const REQUEST_TIMEOUT_MS = 30_000;

/**
 * What a request fails with: a SessionError, or the Error encodePeerToHubFrame
 * threw, a SchemaError for params the schema refuses or what encodeFrame throws.
 */
export type HubCallError = SessionError | Error;

export type HubClient = {
  /** The pid of the window whose lock named this hub. */
  readonly pid: number;
  readonly closed: boolean;
  readonly request: <M extends HubMethod>(
    method: M,
    params: HubRequestParams[M]
  ) => Effect.Effect<HubResultMap[M], HubCallError>;
  /**
   * A request whose answer then takes before any later frame is looked at;
   * the caller resumes once the frames already read and then's microtasks ran.
   */
  readonly requestThen: <M extends HubMethod, A, E>(
    method: M,
    params: HubRequestParams[M],
    then: (result: HubResultMap[M]) => Effect.Effect<A, E>
  ) => Effect.Effect<A, HubCallError | E>;
  /**
   * Succeeds once the frames read with the answer being handled are taken, at
   * once when none is: a caller waiting on it goes on after the notifications
   * read with its answer, without waiting for a later read.
   */
  readonly drained: Effect.Effect<void>;
  /** Hangs up; whatever is pending fails as disconnected. */
  readonly close: Effect.Effect<void>;
};

/** The window a connection reaches, as its lock names it: the pid, and the ide its refusals name. */
export type HubWindow = { readonly pid: number; readonly ide: string };

export type HubClientOptions = {
  /** The MCP client's name, which hello carries to the hub. */
  client: string;
  onNotification?: (notification: HubNotification) => void;
  /** Called once, when the connection closes from either side. */
  onClose?: () => void;
};

type Pending = {
  readonly method: string;
  readonly deferred: Deferred.Deferred<unknown, unknown>;
  readonly then?: (result: any) => Effect.Effect<unknown, unknown>;
};

/** One frame as the reader decodes it: a message, or JSON that fits none. */
type Frame = Result.Result<HubToPeerMessage, RefusedFrame>;

/** How a request ends once its answer is read. */
type Answer =
  | { ok: true; result: unknown }
  | { ok: false; error: SessionError };

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function answerOf(response: HubResponse): Answer {
  return response.ok
    ? { ok: true, result: response.result }
    : {
        ok: false,
        error: new SessionError(response.error.code, response.error.message),
      };
}

/**
 * A refused frame that names a pending request still answers it, read as
 * before the schema: ok true gives its result, anything else a refusal whose
 * missing code and message are filled in, so the caller never waits it out.
 */
function refusedAnswer(method: string, frame: Record<string, any>): Answer {
  if (frame.ok === true) return { ok: true, result: frame.result };
  const error = isRecord(frame.error) ? frame.error : {};
  return {
    ok: false,
    error: new SessionError(
      typeof error.code === 'string'
        ? (error.code as HubErrorCode)
        : HubErrorCode.internal,
      typeof error.message === 'string'
        ? error.message
        : `The hub refused ${method}`
    ),
  };
}

/**
 * JSON lines over one socket, every frame read into one queue that one fiber
 * takes in stream order: a response runs its request's then and settles it, a
 * notification goes to onNotification. A frame out of step hangs up.
 */
export const makeHubClient = (
  socket: Socket.Socket,
  hubWindow: HubWindow,
  options: HubClientOptions
): Effect.Effect<HubClient, never, Scope.Scope> =>
  Effect.gen(function* () {
    const { pid } = hubWindow;
    const { theWindow } = hostWords(hubWindow.ide);
    const scope = yield* Effect.scope;
    const writer = yield* socket.writer;
    const inbound = yield* Queue.unbounded<Frame, Cause.Done>();
    const pending = new Map<number, Pending>();
    let nextId = 1;
    let closed = false;
    /** The answers to requestThen calls whose callers wait for the frames already read. */
    let settling: Array<() => void> = [];
    /** Callers of drained, waiting for the frames already read. */
    let draining: Array<() => void> = [];
    /** The taker found the queue empty and took nothing since; a frame read after that is a later read's. */
    let idle = true;

    const disconnected = (method: string) =>
      new SessionError(
        SessionErrorCode.disconnected,
        `The connection to ${theWindow} (pid ${pid}) closed before it answered ${method}`
      );

    const settleAll = () => {
      const ready = settling;
      settling = [];
      for (const settle of ready) settle();
    };

    const drainAll = () => {
      const ready = draining;
      draining = [];
      for (const resume of ready) resume();
    };

    const teardown = () => {
      if (closed) return;
      closed = true;
      drainAll();
      settleAll();
      for (const { method, deferred } of pending.values()) {
        Deferred.doneUnsafe(deferred, Exit.fail(disconnected(method)));
      }
      pending.clear();
      options.onClose?.();
    };

    const notify = (notification: HubNotification) =>
      Effect.try({
        try: () => options.onNotification?.(notification),
        catch: error => error,
      }).pipe(
        Effect.catch(error =>
          Effect.logError(
            `dropped a notification from the hub of pid ${pid}`,
            error
          )
        )
      );

    /**
     * A plain request's caller resumes on this fiber at once, before the next
     * frame; a requestThen caller is held for next to release, so it goes on
     * only after the notifications read with its answer.
     */
    const answer = (entry: Pending, reply: Answer) => {
      const outcome = !reply.ok
        ? Effect.fail(reply.error)
        : entry.then
          ? entry.then(reply.result)
          : Effect.succeed(reply.result);
      return Effect.exit(outcome).pipe(
        Effect.flatMap(exit =>
          entry.then
            ? Effect.sync(() => {
                settling.push(() => Deferred.doneUnsafe(entry.deferred, exit));
              })
            : Deferred.done(entry.deferred, exit)
        )
      );
    };

    /** Waits for a frame; until one comes, every frame read so far is taken. */
    const awaitFrame = Effect.suspend(() => {
      idle = true;
      return Queue.take(inbound);
    });

    /**
     * The next frame. Once none is left, drained callers resume, and held
     * requestThen callers too, after a scheduler turn runs then's microtasks.
     */
    const next: Effect.Effect<Frame, Cause.Done> = Effect.suspend(() =>
      settling.length === 0 && draining.length === 0
        ? awaitFrame
        : Queue.poll(inbound).pipe(
            Effect.flatMap(frame => {
              if (Option.isSome(frame)) return Effect.succeed(frame.value);
              idle = true;
              drainAll();
              return settling.length === 0
                ? awaitFrame
                : Effect.yieldNow.pipe(
                    Effect.andThen(Effect.sync(settleAll)),
                    Effect.andThen(next)
                  );
            })
          )
    ).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          idle = false;
        })
      )
    );

    /** Settles the request id names, if it is still pending; a late answer runs nothing. */
    const settleRequest = (id: number, reply: (entry: Pending) => Answer) => {
      const entry = pending.get(id);
      if (!entry) return Effect.void;
      pending.delete(id);
      return answer(entry, reply(entry));
    };

    /**
     * A response settles its request and a notification goes to the session. A
     * refused frame is read by hand as before the schema: a numeric id answers,
     * a string method with object params notifies, and anything else is skipped.
     */
    const take = (frame: Frame): Effect.Effect<unknown> => {
      if (Result.isSuccess(frame)) {
        const message = frame.success;
        return 'ok' in message
          ? settleRequest(message.id, () => answerOf(message))
          : notify(message);
      }
      const { value, issue } = frame.failure;
      if (isRecord(value) && typeof value.id === 'number') {
        return settleRequest(value.id, entry =>
          refusedAnswer(entry.method, value)
        );
      }
      return isRecord(value) &&
        typeof value.method === 'string' &&
        isRecord(value.params)
        ? notify(value as HubNotification)
        : Effect.logWarning(
            `skipped a frame from the hub of pid ${pid} that is neither a response nor a notification`,
            issue
          );
    };

    // The reader only fills the queue, so a slow then never holds up the socket.
    yield* Stream.fromPull(Socket.readerString(socket)).pipe(
      decodeHubToPeerFrames,
      Stream.runForEach(frame =>
        Effect.sync(() => void Queue.offerUnsafe(inbound, frame))
      ),
      Effect.catch(error =>
        error._tag === 'FrameError'
          ? Effect.logError(
              `closed the hub connection of pid ${pid} on a bad frame`,
              error
            ).pipe(
              Effect.andThen(writer.write(new Socket.CloseEvent())),
              Effect.ignore
            )
          : Effect.void
      ),
      Effect.ensuring(Effect.sync(() => void Queue.endUnsafe(inbound))),
      Effect.forkScoped
    );
    // Frames already read are taken back to back, a chunk in one go. Once the
    // reader ends, pending requests fail and the connection's scope closes from
    // here; a fiber forked into it never interrupts itself.
    yield* next.pipe(
      Effect.flatMap(take),
      Effect.forever({ disableYield: true }),
      Effect.catch(() =>
        Effect.sync(teardown).pipe(
          Effect.andThen(Scope.close(scope, Exit.void))
        )
      ),
      Effect.forkScoped
    );
    // Added last so it runs first: pending requests fail before the socket goes.
    yield* Effect.addFinalizer(() => Effect.sync(teardown));

    const send = <A>(
      method: string,
      params: unknown,
      then?: Pending['then']
    ): Effect.Effect<A, any> =>
      Effect.suspend(() => {
        if (closed) {
          return Effect.fail(
            new SessionError(
              SessionErrorCode.disconnected,
              `The connection to ${theWindow} (pid ${pid}) is closed`
            )
          );
        }
        const id = nextId++;
        const deferred = Deferred.makeUnsafe<unknown, unknown>();
        pending.set(id, { method, deferred, then });
        return Effect.try({
          try: () =>
            encodePeerToHubFrame({ id, method, params } as PeerToHubMessage),
          catch: error => error as Error,
        }).pipe(
          Effect.flatMap(frame =>
            writer
              .write(frame)
              .pipe(Effect.mapError(() => disconnected(method)))
          ),
          Effect.andThen(Deferred.await(deferred)),
          Effect.timeoutOrElse({
            duration: REQUEST_TIMEOUT_MS,
            orElse: () =>
              Effect.fail(
                new SessionError(
                  SessionErrorCode.timeout,
                  `${capitalize(theWindow)} (pid ${pid}) did not answer ${method} within ${REQUEST_TIMEOUT_MS} ms`
                )
              ),
          }),
          Effect.ensuring(Effect.sync(() => void pending.delete(id)))
        ) as Effect.Effect<A, any>;
      });

    return {
      pid,
      get closed() {
        return closed;
      },
      request: (method, params) => send(method, params),
      requestThen: (method, params, then) => send(method, params, then),
      drained: Effect.suspend(() =>
        closed || idle
          ? Effect.void
          : Effect.callback<void>(resume => {
              draining.push(() => resume(Effect.void));
            })
      ),
      close: Scope.close(scope, Exit.void),
    } satisfies HubClient;
  });

export type HubConnectorShape = {
  /**
   * Connects to the hub a lock advertises and says hello with its token. A
   * lock or hello from another protocol version fails with the side to
   * update. The connection lives until close or until the scope closes.
   */
  readonly connect: (
    candidate: LockCandidate,
    options: HubClientOptions
  ) => Effect.Effect<HubClient, HubCallError, Scope.Scope>;
};

export class HubConnector extends Context.Service<
  HubConnector,
  HubConnectorShape
>()('@dineug/erd-editor-mcp/HubConnector') {}

/** The connector over any way of reaching a pipe: the node one, or memory in the specs. */
export const make = (dial: ConnectPipe): HubConnectorShape => ({
  connect: Effect.fn('HubConnector.connect')(function* (candidate, options) {
    const { pid, record } = candidate;
    if (record.protocolVersion !== HUB_PROTOCOL_VERSION) {
      return yield* new SessionError(
        HubErrorCode.protocolMismatch,
        protocolMismatchMessage(record.protocolVersion, HUB_PROTOCOL_VERSION)
      );
    }

    const { theWindow, addOn } = hostWords(record.ide);
    const scope = yield* Scope.fork(yield* Effect.scope);
    return yield* Effect.gen(function* () {
      const socket = yield* dial(record.pipe).pipe(
        Effect.mapError(
          error =>
            new SessionError(
              SessionErrorCode.hubUnreachable,
              `${capitalize(theWindow)} with pid ${pid} advertises an ERD Editor hub at ${record.pipe}, but it did not accept a connection (${error.message}). Nothing was written; reload that window or check the ERD Editor ${addOn}.`
            )
        )
      );
      const client = yield* makeHubClient(
        socket,
        { pid, ide: record.ide },
        options
      );
      const hello = yield* client.request('hello', {
        token: record.token,
        protocolVersion: HUB_PROTOCOL_VERSION,
        client: options.client,
      });
      if (hello.protocolVersion !== HUB_PROTOCOL_VERSION) {
        return yield* new SessionError(
          HubErrorCode.protocolMismatch,
          protocolMismatchMessage(hello.protocolVersion, HUB_PROTOCOL_VERSION)
        );
      }
      return client;
    }).pipe(
      Scope.provide(scope),
      Effect.onError(() => Scope.close(scope, Exit.void))
    );
  }),
});

export const layerWith = (dial: ConnectPipe): Layer.Layer<HubConnector> =>
  Layer.succeed(HubConnector, make(dial));

export const layer: Layer.Layer<HubConnector> = layerWith(connectPipe);
