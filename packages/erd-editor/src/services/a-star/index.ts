import * as Comlink from 'comlink';

import { AStarService } from './AStarService';
import AStartWorker from './AStart.worker?worker&inline';

const WORKER_NAME = `@dineug/erd-editor-a-start-worker?v${__APP_VERSION__}`;

let remoteService: AStarService | null = null;

export function getAStarService(): AStarService | null {
  if (remoteService) return remoteService;

  try {
    const worker = new AStartWorker({ name: WORKER_NAME });
    remoteService = Comlink.wrap(worker);
  } catch (error) {
    console.error(error);
  }

  return remoteService;
}
