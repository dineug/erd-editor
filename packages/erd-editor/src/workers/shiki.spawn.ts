/** Where the highlighting worker is constructed, as exportPng.spawn.ts constructs its own. */
export function spawnShikiWorker(name: string): SharedWorker {
  return new SharedWorker(
    new URL('../services/shiki/shiki.shared-worker.ts', import.meta.url),
    { type: 'module', name }
  );
}
