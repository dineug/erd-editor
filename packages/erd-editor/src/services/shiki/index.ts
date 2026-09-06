import * as Comlink from 'comlink';

import { spawnShikiWorker } from '@/workers/spawn';

import type { ShikiService } from './shikiService';

export type { ShikiService } from './shikiService';

const WORKER_NAME = `@dineug/erd-editor-shiki-worker?v${__APP_VERSION__}`;

let service: Comlink.Remote<ShikiService> | null = null;
let attempted = false;

/**
 * The highlighter the code panels read, built on the first panel that asks for
 * one and kept for the session. Shiki and its grammars live behind the worker
 * boundary, so a host that builds none is answered with null and plain text.
 */
export function getShikiService(): Comlink.Remote<ShikiService> | null {
  if (attempted) return service;
  attempted = true;

  try {
    const worker = spawnShikiWorker(WORKER_NAME);
    // A url worker can fail after its constructor returns, on a missing file or
    // a policy block, and every call on its port then waits forever.
    worker.onerror = () => {
      console.warn('[shiki] the shared worker failed to start');
      worker.port.close();
      service = null;
    };
    service = Comlink.wrap<ShikiService>(worker.port);
  } catch (error) {
    console.warn('[shiki] this host built no shared worker', error);
  }

  return service;
}
