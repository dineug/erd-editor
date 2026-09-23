import * as net from 'node:net';

import type { Array as Arr } from 'effect';
import { Effect, Schema, Scope } from 'effect';
import { Socket } from 'effect/unstable/socket';

/** Nothing accepted a connection at the pipe a lock advertises. */
export class HubUnreachable extends Schema.TaggedError<HubUnreachable>()(
  'HubUnreachable',
  { pipe: Schema.String, message: Schema.String }
) {}

/** Opens a connection to a hub; closing the scope destroys it. */
export type ConnectPipe = (
  pipe: string
) => Effect.Effect<Socket.Socket, HubUnreachable, Scope.Scope>;

type Pull = Effect.Effect<
  Arr.NonEmptyReadonlyArray<string>,
  Socket.SocketError
>;

/**
 * A Socket over a connected node:net socket, without platform-node's NodeSocket,
 * which re-exports ws at its top level. A streaming decoder keeps a character
 * split across two reads whole; a CloseEvent destroys the connection at once.
 */
export function fromNetSocket(conn: net.Socket): Socket.Socket {
  const reader: Socket.Socket['reader'] = Effect.gen(function* () {
    const scope = yield* Effect.scope;
    let error: Socket.SocketError | undefined;
    let waiter: ((effect: Pull) => void) | undefined;

    const fail = (reason: Socket.SocketErrorReason) => {
      error ??= new Socket.SocketError({ reason });
      const resume = waiter;
      waiter = undefined;
      resume?.(Effect.fail(error));
    };
    const onReadable = () => {
      if (!waiter) return;
      const chunk = conn.read() as string | null;
      if (chunk === null) return;
      const resume = waiter;
      waiter = undefined;
      resume(Effect.succeed([chunk]));
    };
    const onEnd = () => fail(new Socket.SocketCloseError({ code: 1000 }));
    const onError = (cause: Error) =>
      fail(new Socket.SocketReadError({ cause }));

    conn.pause();
    conn.setEncoding('utf8');
    conn.on('readable', onReadable);
    conn.on('end', onEnd);
    conn.on('close', onEnd);
    conn.on('error', onError);
    yield* Scope.addFinalizer(
      scope,
      Effect.sync(() => {
        fail(new Socket.SocketCloseError({ code: 1006 }));
        conn.off('readable', onReadable);
        conn.off('end', onEnd);
        conn.off('close', onEnd);
        conn.off('error', onError);
      })
    );

    const pull: Pull = Effect.suspend(() => {
      const chunk = conn.read() as string | null;
      if (chunk !== null) return Effect.succeed([chunk] as const);
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
    });
    return { pull, upgrade: Socket.SocketUpgradeError.unsupported };
  });

  const writeOne = (chunk: Uint8Array | string) =>
    Effect.callback<void, Socket.SocketError>(resume => {
      if (conn.writableEnded || conn.destroyed) return resume(Effect.void);
      conn.write(chunk, cause =>
        resume(
          cause
            ? Effect.fail(
                new Socket.SocketError({
                  reason: new Socket.SocketWriteError({ cause }),
                })
              )
            : Effect.void
        )
      );
    });

  const writer: Socket.Socket['writer'] = Effect.acquireRelease(
    Effect.succeed<Socket.Writer>({
      write: chunk =>
        Socket.isCloseEvent(chunk)
          ? Effect.sync(() => void conn.destroy())
          : writeOne(chunk),
      writeAll: chunks => Effect.forEach(chunks, writeOne, { discard: true }),
    }),
    () => Effect.sync(() => void conn.end())
  );

  return Socket.make({ reader, writer });
}

/**
 * Connects to a hub's unix socket or named pipe. Failing to connect is
 * HubUnreachable with the system's message; once connected, a reset hub's
 * error is left to the close that follows it, which is what the client acts on.
 */
export const connectPipe: ConnectPipe = pipe =>
  Effect.acquireRelease(
    Effect.callback<net.Socket, HubUnreachable>(resume => {
      const conn = net.connect(pipe);
      const onError = (cause: Error) =>
        resume(
          Effect.fail(new HubUnreachable({ pipe, message: cause.message }))
        );
      conn.once('error', onError);
      conn.once('connect', () => {
        conn.off('error', onError);
        conn.on('error', () => undefined);
        resume(Effect.succeed(conn));
      });
      return Effect.sync(() => void conn.destroy());
    }),
    conn => Effect.sync(() => void conn.destroy())
  ).pipe(Effect.map(fromNetSocket));
