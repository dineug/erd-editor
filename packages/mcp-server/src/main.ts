import * as NodeRuntime from '@effect/platform-node/NodeRuntime';
import * as NodeStdio from '@effect/platform-node/NodeStdio';
import { Cause, Effect, Exit, Fiber, Layer } from 'effect';

import { StderrLogger } from '@/logger';
import { ServerLayer } from '@/server';

/**
 * Runs the server until stdin ends, which interrupts the fiber that built the
 * stdio protocol: the layer launches in a child, so main succeeds. A signal
 * interrupts main itself, which runs no failure handler and logs nothing.
 */
export const serve = <A, E>(layer: Layer.Layer<A, E>) =>
  Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(Layer.launch(layer));
    const exit = yield* Fiber.await(fiber);
    if (Exit.isFailure(exit) && !Cause.hasInterruptsOnly(exit.cause)) {
      return yield* Effect.failCause(exit.cause);
    }
  }).pipe(
    Effect.tapCause(cause =>
      Effect.logError('the server stopped on a failure', cause)
    ),
    Effect.provide(StderrLogger)
  );

// runMain reports a failure through the default logger, on stdout; serve
// already logged it on stderr. A failure still exits 1, a signal 130.
NodeRuntime.runMain(serve(ServerLayer.pipe(Layer.provide(NodeStdio.layer))), {
  disableErrorReporting: true,
});
