import ShikiSharedWorker from './shiki.shared-worker?sharedworker&inline';

/**
 * The umd build's spawn module, aliased in by vite.umd.config.ts: a script tag
 * has no bundler after it, so the worker travels inside the file as a data url.
 */
export function spawnShikiWorker(name: string): SharedWorker {
  return new ShikiSharedWorker({ name });
}
