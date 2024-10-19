import * as Comlink from 'comlink';

import { AppDatabaseService } from './appDatabaseService';

const WORKER_NAME = `@dineug/erd-editor-app-indexeddb-worker`;

let remoteService: AppDatabaseService | null = null;

export function getAppDatabaseService(): AppDatabaseService | null {
  if (remoteService) return remoteService;

  try {
    const worker = new SharedWorker(
      new URL('./indexeddb.shared-worker.ts', import.meta.url),
      { type: 'module', name: WORKER_NAME }
    );
    remoteService = Comlink.wrap(worker.port) as any;
  } catch (error) {
    try {
      const worker = new Worker(
        new URL('./indexeddb.worker.ts', import.meta.url),
        { type: 'module', name: WORKER_NAME }
      );
      remoteService = Comlink.wrap(worker) as any;
    } catch (error) {
      remoteService = new AppDatabaseService();
    }
  }

  return remoteService;
}
