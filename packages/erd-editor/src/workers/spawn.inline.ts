import ExportPngSharedWorker from '../services/export-png/exportPng.shared-worker?sharedworker&inline';
import SchemaGCSharedWorker from '../services/schema-gc/schemaGC.shared-worker?sharedworker&inline';

/**
 * The umd build's spawn module, aliased in by vite.umd.config.ts: a script tag
 * has no bundler after it, so each worker travels inside the file as a data
 * url. Nothing imports this module by name.
 */
export function spawnSchemaGCWorker(name: string): SharedWorker {
  return new SchemaGCSharedWorker({ name });
}

export function spawnExportPngWorker(name: string): SharedWorker {
  return new ExportPngSharedWorker({ name });
}
