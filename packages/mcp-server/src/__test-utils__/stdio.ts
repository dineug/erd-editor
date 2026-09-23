import type * as Cause from 'effect/Cause';
import type * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import type * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as Queue from 'effect/Queue';
import * as Sink from 'effect/Sink';
import * as Stdio from 'effect/Stdio';
import * as Stream from 'effect/Stream';

export type StdioServer<A> = {
  /** Writes one message to the server's stdin, as a JSON line or raw text. */
  send: (message: object | string) => void;
  /** Ends stdin, as a client going away does. */
  end: () => void;
  /** Every line the server wrote to stdout, parsed, in order. */
  lines: any[];
  /** Calls listener with each line written from now on. */
  onLine: (listener: (message: any) => void) => void;
  /** The services the layer built, once it serves; rejects when it failed to start. */
  context: Promise<Context.Context<A>>;
  /** Settles when the server stops. */
  exit: Promise<Exit.Exit<never, unknown>>;
  /** Interrupts the server, as a signal interrupts the main fiber. */
  interrupt: () => void;
};

/**
 * Serves a layer over Stdio.layerTest: stdin is a queue, stdout a sink that
 * parses JSON lines. The layer is built the way Layer.launch builds it, in a
 * fiber of its own that the stdio protocol interrupts when stdin ends.
 */
export function serveStdio<A, E>(
  layer: Layer.Layer<A, E, Stdio.Stdio>
): StdioServer<A> {
  const input = Effect.runSync(Queue.make<Uint8Array, Cause.Done>());
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const lines: any[] = [];
  const listeners: Array<(message: any) => void> = [];
  let pending = '';

  const stdio = Stdio.layerTest({
    stdin: Stream.fromQueue(input),
    stdout: () =>
      Sink.forEach((chunk: string | Uint8Array) =>
        Effect.sync(() => {
          pending +=
            typeof chunk === 'string'
              ? chunk
              : decoder.decode(chunk, { stream: true });
          const parts = pending.split('\n');
          pending = parts.pop() ?? '';
          for (const part of parts.filter(Boolean)) {
            const message = JSON.parse(part);
            lines.push(message);
            for (const listener of listeners) listener(message);
          }
        })
      ),
  });

  let started: (context: Context.Context<A>) => void = () => undefined;
  let failed: (reason: unknown) => void = () => undefined;
  const context = new Promise<Context.Context<A>>((resolve, reject) => {
    started = resolve;
    failed = reject;
  });

  const fiber = Effect.runFork(
    Effect.scoped(
      Effect.gen(function* () {
        started(yield* Layer.build(layer.pipe(Layer.provide(stdio))));
        return yield* Effect.never;
      })
    )
  );
  const exit = Effect.runPromise(Fiber.await(fiber));
  exit.then(result => failed(new Error(`the server stopped: ${result._tag}`)));

  return {
    send: message => {
      const line =
        typeof message === 'string' ? message : JSON.stringify(message);
      Queue.offerUnsafe(input, encoder.encode(`${line}\n`));
    },
    end: () => {
      Queue.endUnsafe(input);
    },
    lines,
    onLine: listener => {
      listeners.push(listener);
    },
    context,
    exit,
    interrupt: () => {
      Effect.runFork(Fiber.interrupt(fiber));
    },
  };
}
