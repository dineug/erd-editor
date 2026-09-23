import {
  decodeFrames,
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
import type { Done } from 'effect/Cause';
import * as Context from 'effect/Context';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Queue from 'effect/Queue';
import * as Schema from 'effect/Schema';
import * as Scope from 'effect/Scope';
import * as Stream from 'effect/Stream';
import * as Socket from 'effect/unstable/socket/Socket';

import { SessionError, SessionErrorCode } from '@/errors';
import { type ConnectPipe, connectPipe } from '@/io/netSocket';

/** How long a request may go unanswered; the hub's own waits all end well inside it. */
export const REQUEST_TIMEOUT_MS = 30_000;

/** What a request fails with: a SessionError, or the Error encodeFrame threw. */
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

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** An error response's code and message; what the hub left out is filled in. */
function refusal(method: string, raw: unknown): SessionError {
  const error = isRecord(raw) ? raw : {};
  return new SessionError(
    typeof error.code === 'string'
      ? (error.code as HubErrorCode)
      : HubErrorCode.internal,
    typeof error.message === 'string'
      ? error.message
      : `The hub refused ${method}`
  );
}

const frames = decodeFrames(Schema.Unknown);

/**
 * JSON lines over one socket, every frame read into one queue that one fiber
 * takes in stream order: a response runs its request's then and settles it, a
 * notification goes to onNotification. A frame out of step hangs up.
 */
export const makeHubClient = (
  socket: Socket.Socket,
  pid: number,
  options: HubClientOptions
): Effect.Effect<HubClient, never, Scope.Scope> =>
  Effect.gen(function* () {
    const scope = yield* Effect.scope;
    const writer = yield* socket.writer;
    const inbound = yield* Queue.unbounded<unknown, Done>();
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
        `The connection to the VS Code window (pid ${pid}) closed before it answered ${method}`
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
    const answer = (entry: Pending, response: Record<string, any>) => {
      const outcome =
        response.ok !== true
          ? Effect.fail(refusal(entry.method, response.error))
          : entry.then
            ? entry.then(response.result)
            : Effect.succeed(response.result);
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
    const next: Effect.Effect<unknown, Done> = Effect.suspend(() =>
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

    const take = (message: unknown): Effect.Effect<unknown> => {
      if (!isRecord(message)) return Effect.void;
      if (typeof message.id === 'number') {
        const entry = pending.get(message.id);
        if (!entry) return Effect.void;
        pending.delete(message.id);
        return answer(entry, message);
      }
      return typeof message.method === 'string' && isRecord(message.params)
        ? notify(message as HubNotification)
        : Effect.void;
    };

    // The reader only fills the queue, so a slow then never holds up the socket.
    yield* Stream.fromPull(Socket.readerString(socket)).pipe(
      frames,
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
              `The connection to the VS Code window (pid ${pid}) is closed`
            )
          );
        }
        const id = nextId++;
        const deferred = Deferred.makeUnsafe<unknown, unknown>();
        pending.set(id, { method, deferred, then });
        return Effect.try({
          try: () => encodeFrame({ id, method, params }),
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
                  `The VS Code window (pid ${pid}) did not answer ${method} within ${REQUEST_TIMEOUT_MS} ms`
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

    const scope = yield* Scope.fork(yield* Effect.scope);
    return yield* Effect.gen(function* () {
      const socket = yield* dial(record.pipe).pipe(
        Effect.mapError(
          error =>
            new SessionError(
              SessionErrorCode.hubUnreachable,
              `The VS Code window with pid ${pid} advertises an ERD Editor hub at ${record.pipe}, but it did not accept a connection (${error.message}). Nothing was written; reload that window or check the ERD Editor extension.`
            )
        )
      );
      const client = yield* makeHubClient(socket, pid, options);
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
