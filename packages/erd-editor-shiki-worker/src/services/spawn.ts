/**
 * Where the SharedWorker is constructed, in the one spelling a consumer's
 * bundler bundles from inside a dependency. The umd build swaps this module for
 * spawn.inline.ts through an alias.
 */
export function spawnShikiWorker(name: string): SharedWorker {
  return new SharedWorker(
    new URL('./shiki.shared-worker.ts', import.meta.url),
    { type: 'module', name }
  );
}
