import * as Cause from 'effect/Cause';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as Stdio from 'effect/Stdio';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { createMemoryHost } from '@/__test-utils__/memoryHost';
import { makeServerLayer } from '@/server';

const runMain = vi.hoisted(() => vi.fn());

vi.mock('@effect/platform-node/NodeRuntime', () => ({ runMain }));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const { serve } = await import('@/main');

describe('the entry point', () => {
  it('runs the server as the main program, with runMain reporting off since it reports on stdout', () => {
    expect(runMain).toHaveBeenCalledTimes(1);
    const [program, options] = runMain.mock.calls[0];
    expect(Effect.isEffect(program)).toBe(true);
    expect(options).toEqual({ disableErrorReporting: true });
  });

  it('succeeds when stdin ends, which interrupts the server alone', async () => {
    const closed = Stdio.layerTest({});
    const exit = await Effect.runPromiseExit(
      serve(
        makeServerLayer(createMemoryHost().layer).pipe(Layer.provide(closed))
      )
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('fails a server that fails, logged on stderr with its cause', async () => {
    const exit = await Effect.runPromiseExit(
      serve(Layer.effectDiscard(Effect.fail(new Error('no stdin'))))
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(console.error).toHaveBeenCalledWith(
      '[erd-editor-mcp]',
      'the server stopped on a failure',
      expect.stringContaining('no stdin')
    );
  });

  it('stays quiet when a signal interrupts it', async () => {
    const started = Effect.runSync(Deferred.make<void>());
    const running = Layer.effectDiscard(
      Deferred.succeed(started, undefined).pipe(Effect.andThen(Effect.never))
    );
    const fiber = Effect.runFork(serve(running));
    await Effect.runPromise(Deferred.await(started));
    await Effect.runPromise(Fiber.interrupt(fiber));
    const exit = await Effect.runPromise(Fiber.await(fiber));

    expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(
      true
    );
    expect(console.error).not.toHaveBeenCalled();
  });
});
