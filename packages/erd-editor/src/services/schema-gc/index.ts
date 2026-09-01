import * as Comlink from 'comlink';

import SchemaGCSharedWorker from './schemaGC.shared-worker?sharedworker&inline';
import { SchemaGCService } from './schemaGCService';

export type GCIds = {
  tableIds: string[];
  tableColumnIds: string[];
  relationshipIds: string[];
  indexIds: string[];
  indexColumnIds: string[];
  memoIds: string[];
};

const WORKER_NAME = `@dineug/erd-editor-schema-gc-worker?v${__APP_VERSION__}`;

let remoteService: SchemaGCService | null = null;

/**
 * Runs the collector off the main thread where a host builds a shared worker.
 * There is no dedicated Worker rung between the two, because an inline worker
 * import is a second copy of this whole service in the bundle.
 */
export function getSchemaGCService(): SchemaGCService | null {
  if (remoteService) return remoteService;

  try {
    const worker = new SchemaGCSharedWorker({ name: WORKER_NAME });
    remoteService = Comlink.wrap(worker.port);
  } catch (error) {
    console.warn('[schema-gc] this host built no shared worker', error);
    remoteService = new SchemaGCService() as Comlink.Remote<SchemaGCService>;
  }

  return remoteService;
}
