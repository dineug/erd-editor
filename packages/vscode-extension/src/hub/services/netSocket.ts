import * as net from 'node:net';

import type { Array as Arr } from 'effect';
import { Effect, Scope } from 'effect';
import { Socket } from 'effect/unstable/socket';

type Pull = Effect.Effect<
  Arr.NonEmptyReadonlyArray<string>,
  Socket.SocketError
>;

/**
 * A Socket over node:net, without platform-node's NodeSocket, which re-exports
 * ws at its top level and would ship it in the VSIX. A CloseEvent destroys the
 * connection at once; letting the writer's scope close ends it after the flush.
 */
export function fromNetSocket(conn: net.Socket): Socket.Socket {
  // Attached here, where the connection is accepted, rather than with the
  // reader's own: a reset peer emits error right before close, and until some
  // listener is on it that error throws in the extension host.
  conn.on('error', () => undefined);

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
    // A streaming StringDecoder, so a character split across two reads
    // survives; toChannelString decodes each chunk on its own and cannot.
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
      const done = (cause?: Error | null) =>
        resume(
          cause
            ? Effect.fail(
                new Socket.SocketError({
                  reason: new Socket.SocketWriteError({ cause }),
                })
              )
            : Effect.void
        );
      if (conn.writableEnded || conn.destroyed) return resume(Effect.void);
      if (conn.write(chunk, done) === false) conn.once('drain', () => done());
    });

  const writer: Socket.Socket['writer'] = Effect.acquireRelease(
    Effect.succeed<Socket.Writer>({
      write: (chunk: Uint8Array | string | Socket.CloseEvent) =>
        Socket.isCloseEvent(chunk)
          ? Effect.sync(() => void conn.destroy())
          : writeOne(chunk),
      writeAll: (chunks: Arr.NonEmptyReadonlyArray<Uint8Array | string>) =>
        Effect.forEach(chunks, writeOne, { discard: true }),
    }),
    () =>
      Effect.sync(() => {
        if (!conn.destroyed) conn.end();
      })
  );

  return Socket.make({ reader, writer });
}
