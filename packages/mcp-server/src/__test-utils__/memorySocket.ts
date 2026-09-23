import type { Array as Arr } from 'effect';
import { Effect } from 'effect';
import { Socket } from 'effect/unstable/socket';

import { type ConnectPipe, HubUnreachable } from '@/io/netSocket';

/** The hub end of an in-memory connection, the shape an accepted socket has. */
export type ServerSocket = {
  write: (data: string) => void;
  /** Closes both ends once what is in flight has arrived. */
  end: () => void;
  /** Closes both ends at once, as a reset does. */
  destroy: () => void;
  onData: (listener: (chunk: string) => void) => void;
  onClose: (listener: () => void) => void;
};

export type SocketPair = {
  /** The server's end, the Socket its hub client reads and writes. */
  client: Socket.Socket;
  server: ServerSocket;
};

type Pull = Effect.Effect<
  Arr.NonEmptyReadonlyArray<string>,
  Socket.SocketError
>;

const textDecoder = new TextDecoder();

/**
 * Two connected ends over microtasks: bytes arrive after the write returns,
 * as over a pipe. The client end is a Socket as the node adapter makes one,
 * text in and text out; a CloseEvent it writes destroys the pair.
 */
export function createSocketPair(): SocketPair {
  const inbox: string[] = [];
  const listeners: Array<(chunk: string) => void> = [];
  const closers: Array<() => void> = [];
  let waiter: ((effect: Pull) => void) | undefined;
  let pending = 0;
  let closing = false;
  let closed = false;

  const closeError = new Socket.SocketError({
    reason: new Socket.SocketCloseError({ code: 1000 }),
  });

  const wake = () => {
    const resume = waiter;
    if (!resume || (!inbox.length && !closed)) return;
    waiter = undefined;
    resume(
      inbox.length
        ? Effect.succeed(
            inbox.splice(0) as unknown as Arr.NonEmptyReadonlyArray<string>
          )
        : Effect.fail(closeError)
    );
  };

  const closeBoth = () => {
    if (closed) return;
    closed = true;
    wake();
    for (const close of closers) close();
  };

  const deliver = (arrive: () => void) => {
    if (closed || closing) return;
    pending++;
    queueMicrotask(() => {
      pending--;
      if (!closed) arrive();
      if (closing && pending === 0) closeBoth();
    });
  };

  const end = () => {
    if (closed || closing) return;
    closing = true;
    if (pending === 0) queueMicrotask(closeBoth);
  };

  const destroy = () => {
    closing = true;
    closeBoth();
  };

  const writeOne = (chunk: Uint8Array | string) =>
    Effect.sync(() => {
      const text =
        typeof chunk === 'string' ? chunk : textDecoder.decode(chunk);
      deliver(() => {
        for (const listener of listeners) listener(text);
      });
    });

  const client = Socket.make({
    reader: Effect.succeed({
      pull: Effect.suspend((): Pull => {
        if (inbox.length) {
          return Effect.succeed(
            inbox.splice(0) as unknown as Arr.NonEmptyReadonlyArray<string>
          );
        }
        if (closed) return Effect.fail(closeError);
        return Effect.callback(resume => {
          waiter = resume;
          return Effect.sync(() => {
            if (waiter === resume) waiter = undefined;
          });
        });
      }),
      upgrade: Socket.SocketUpgradeError.unsupported,
    }),
    writer: Effect.acquireRelease(
      Effect.succeed<Socket.Writer>({
        write: chunk =>
          Socket.isCloseEvent(chunk) ? Effect.sync(destroy) : writeOne(chunk),
        writeAll: chunks => Effect.forEach(chunks, writeOne, { discard: true }),
      }),
      () => Effect.sync(end)
    ),
  });

  const server: ServerSocket = {
    write: data =>
      deliver(() => {
        inbox.push(data);
        wake();
      }),
    end,
    destroy,
    onData: listener => {
      listeners.push(listener);
    },
    onClose: listener => {
      closers.push(listener);
    },
  };

  return { client, server };
}

/**
 * Connects through the accept callbacks of servers, by pipe. Nothing there is
 * HubUnreachable, as a refused connection is; closing the scope destroys it.
 */
export function memoryConnect(
  servers: Map<string, (socket: ServerSocket) => void>
): ConnectPipe {
  return pipe =>
    Effect.suspend(() => {
      const accept = servers.get(pipe);
      if (!accept) {
        return Effect.fail(
          new HubUnreachable({ pipe, message: `ECONNREFUSED: ${pipe}` })
        );
      }
      return Effect.acquireRelease(
        Effect.sync(() => {
          const pair = createSocketPair();
          accept(pair.server);
          return pair;
        }),
        pair => Effect.sync(() => pair.server.destroy())
      ).pipe(Effect.map(pair => pair.client));
    });
}
