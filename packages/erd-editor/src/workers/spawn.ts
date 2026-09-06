/**
 * Where the three SharedWorkers are constructed, in the one spelling a
 * consumer's bundler bundles from inside a dependency. The umd build swaps this
 * module for spawn.inline.ts by alias, so nothing else in src names a worker.
 */
export function spawnSchemaGCWorker(name: string): SharedWorker {
  return new SharedWorker(
    new URL('../services/schema-gc/schemaGC.shared-worker.ts', import.meta.url),
    { type: 'module', name }
  );
}

export function spawnExportPngWorker(name: string): SharedWorker {
  return new SharedWorker(
    new URL(
      '../services/export-png/exportPng.shared-worker.ts',
      import.meta.url
    ),
    { type: 'module', name }
  );
}

export function spawnElkLayoutWorker(name: string): SharedWorker {
  return new SharedWorker(
    new URL(
      '../services/elk-layout/elkLayout.shared-worker.ts',
      import.meta.url
    ),
    { type: 'module', name }
  );
}
