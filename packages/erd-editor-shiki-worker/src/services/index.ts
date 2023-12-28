import * as Comlink from 'comlink';

import ShikiSharedWorker from './shiki.shared-worker?sharedworker&inline';
// import ShikiWorker from './shiki.worker?worker&inline';
import { ShikiService } from './shikiService';

const WORKER_NAME = `@dineug/erd-editor-shiki-worker?v${__APP_VERSION__}`;

let remoteService: ShikiService | null;

export function getShikiService(): ShikiService | null {
  if (remoteService) return remoteService;

  try {
    const worker = new ShikiSharedWorker({
      name: WORKER_NAME,
    });
    remoteService = Comlink.wrap(worker.port) as unknown as ShikiService;
  } catch (error) {
    console.error(error);

    // const worker = new ShikiWorker({
    //   name: WORKER_NAME,
    // });
    // remoteService = Comlink.wrap(worker) as unknown as ShikiService;
  }

  return remoteService;
}
