import * as Comlink from 'comlink';

import SchemaGCSharedWorker from './schemaGC.shared-worker?sharedworker&inline';
import SchemaGCWorker from './schemaGC.worker?worker&inline';
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

export function getSchemaGCService(): SchemaGCService | null {
  if (remoteService) return remoteService;

  try {
    const worker = new SchemaGCSharedWorker({ name: WORKER_NAME });
    remoteService = Comlink.wrap(worker.port);
  } catch (error) {
    try {
      const worker = new SchemaGCWorker({ name: WORKER_NAME });
      remoteService = Comlink.wrap(worker);
    } catch (error) {
      remoteService = new SchemaGCService() as Comlink.Remote<SchemaGCService>;
    }
  }

  return remoteService;
}
