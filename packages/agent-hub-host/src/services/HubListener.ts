import * as net from 'node:net';

import { Context, Effect, Layer, Queue, Schema, Scope, Stream } from 'effect';
import { Socket } from 'effect/unstable/socket';

import { warnUnsafe } from '@/services/HubLogger';
import { fromNetSocket } from '@/services/netSocket';

/** The listener could not bind the pipe; the hub then writes a hub false lock. */
export class HubListenError extends Schema.TaggedError<HubListenError>()(
  'HubListenError',
  { pipe: Schema.String, message: Schema.String }
) {}

export type HubListenerShape = {
  /**
   * Binds pipe and streams the connections it accepts. Closing the scope stops
   * the listener, which is how the hub stops accepting peers.
   */
  readonly listen: (
    pipe: string
  ) => Effect.Effect<Stream.Stream<Socket.Socket>, HubListenError, Scope.Scope>;
};

export class HubListener extends Context.Service<
  HubListener,
  HubListenerShape
>()('@dineug/erd-editor-agent-hub-host/HubListener') {}

const listen = (
  pipe: string
): Effect.Effect<Stream.Stream<Socket.Socket>, HubListenError, Scope.Scope> =>
  Effect.gen(function* () {
    const connections = yield* Queue.unbounded<Socket.Socket>();
    const accepted = new Set<net.Socket>();
    yield* Effect.acquireRelease(
      Effect.callback<net.Server, HubListenError>(resume => {
        const server = net.createServer(conn => {
          accepted.add(conn);
          conn.once('close', () => accepted.delete(conn));
          Queue.offerUnsafe(connections, fromNetSocket(conn));
        });
        const onListenError = (cause: Error) =>
          resume(
            Effect.fail(new HubListenError({ pipe, message: `${cause}` }))
          );

        server.once('error', onListenError);
        server.listen(pipe, () => {
          server.off('error', onListenError);
          // A listener error after binding must not throw in the host, and a
          // hub that stops accepting peers is worth a line: it is why an agent
          // suddenly cannot attach.
          server.on('error', error => warnUnsafe(error));
          resume(Effect.succeed(server));
        });
      }),
      server =>
        // Hangs up every peer first: one still connected would hold close open,
        // and one accepted in this very tick has no server fiber to end it.
        Effect.callback<void>(resume => {
          for (const conn of accepted) conn.destroy();
          accepted.clear();
          server.close(() => resume(Effect.void));
        })
    );
    return Stream.fromQueue(connections);
  });

export const layer: Layer.Layer<HubListener> = Layer.succeed(HubListener, {
  listen,
});
