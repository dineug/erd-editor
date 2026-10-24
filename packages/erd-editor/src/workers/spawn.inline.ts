import ElkLayoutSharedWorker from '../services/elk-layout/elkLayout.shared-worker?sharedworker&inline';
import ExportPngSharedWorker from '../services/export-png/exportPng.shared-worker?sharedworker&inline';
import ShikiSharedWorker from '../services/shiki/shiki.shared-worker?sharedworker&inline';

/**
 * The umd builds' spawn module, aliased in by vite.umd.config.ts: a script tag
 * has no bundler after it, so each worker travels inside the editor's file as a
 * data url. The viewer's reaches none, and nothing imports this module by name.
 */
export function spawnExportPngWorker(name: string): SharedWorker {
  return new ExportPngSharedWorker({ name });
}

export function spawnElkLayoutWorker(name: string): SharedWorker {
  return new ElkLayoutSharedWorker({ name });
}

export function spawnShikiWorker(name: string): SharedWorker {
  return new ShikiSharedWorker({ name });
}
