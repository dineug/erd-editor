/**
 * Spawns the replica worker. The url is the spelling a consumer's bundler
 * emits the worker file from; a host that cannot load one across origins
 * turns it back into an inline worker in its own build.
 */
export function createReplicationStoreWorker(options?: {
  name?: string;
}): Worker {
  return new Worker(
    new URL('./services/replicationStore.worker.ts', import.meta.url),
    { type: 'module', name: options?.name }
  );
}
