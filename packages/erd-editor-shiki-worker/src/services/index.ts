import * as Comlink from 'comlink';

import { ShikiService } from './shikiService';

const WORKER_NAME = `@dineug/erd-editor-shiki-worker?v${__APP_VERSION__}`;

let remoteService: ShikiService | null;

export function getShikiService(): ShikiService | null {
  if (remoteService) return remoteService;

  try {
    const worker = new SharedWorker(
      new URL('./shiki.shared-worker.ts', import.meta.url),
      { type: 'module', name: WORKER_NAME }
    );
    remoteService = Comlink.wrap(worker.port) as unknown as ShikiService;
  } catch (error) {
    console.error(error);
  }

  return remoteService;
}
