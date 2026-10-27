/** Where the ELK worker is constructed, as exportPng.spawn.ts constructs its own. */
export function spawnElkLayoutWorker(name: string): SharedWorker {
  return new SharedWorker(
    new URL(
      '../services/elk-layout/elkLayout.shared-worker.ts',
      import.meta.url
    ),
    { type: 'module', name }
  );
}
