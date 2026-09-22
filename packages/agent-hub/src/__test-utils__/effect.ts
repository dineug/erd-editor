import * as Effect from 'effect/Effect';
import type * as Scope from 'effect/Scope';
import { it } from 'vite-plus/test';

/** Runs an effect that needs nothing to its value; a failure rejects the promise. */
export function runTest<A, E>(effect: Effect.Effect<A, E>): Promise<A> {
  return Effect.runPromise(effect);
}

/** A spec whose body is an effect, run in a scope that closes before the spec ends. */
export function itEffect<E>(
  name: string,
  body: () => Effect.Effect<unknown, E, Scope.Scope>,
  timeout?: number
): void {
  it(name, () => runTest(Effect.scoped(body())), timeout);
}
