import ShikiSharedWorker from '../services/shiki/shiki.shared-worker?sharedworker&inline';

/** The umd builds' twin of shiki.spawn.ts, as exportPng.spawn.inline.ts is its own's. */
export function spawnShikiWorker(name: string): SharedWorker {
  return new ShikiSharedWorker({ name });
}
