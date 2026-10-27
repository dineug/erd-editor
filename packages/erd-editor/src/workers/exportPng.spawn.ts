/**
 * Where the export worker is constructed, in the one spelling a consumer's
 * bundler bundles from inside a dependency. A module per worker, so a bundler
 * that emits every worker a kept module names emits only the ones in use.
 */
export function spawnExportPngWorker(name: string): SharedWorker {
  return new SharedWorker(
    new URL(
      '../services/export-png/exportPng.shared-worker.ts',
      import.meta.url
    ),
    { type: 'module', name }
  );
}
