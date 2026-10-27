import ElkLayoutSharedWorker from '../services/elk-layout/elkLayout.shared-worker?sharedworker&inline';

/** The umd builds' twin of elkLayout.spawn.ts, as exportPng.spawn.inline.ts is its own's. */
export function spawnElkLayoutWorker(name: string): SharedWorker {
  return new ElkLayoutSharedWorker({ name });
}
