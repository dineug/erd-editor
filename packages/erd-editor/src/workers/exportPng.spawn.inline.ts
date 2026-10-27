import ExportPngSharedWorker from '../services/export-png/exportPng.shared-worker?sharedworker&inline';

/**
 * The umd builds' twin of exportPng.spawn.ts, aliased in by vite.umd.config.ts:
 * a script tag has no bundler after it, so the worker travels inside the
 * editor's file as a data url. The viewer's reaches none of the three twins.
 */
export function spawnExportPngWorker(name: string): SharedWorker {
  return new ExportPngSharedWorker({ name });
}
