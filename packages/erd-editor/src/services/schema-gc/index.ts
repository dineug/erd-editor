import * as Comlink from 'comlink';

import SchemaGCSharedWorker from '@/workers/schemaGC.shared-worker?sharedworker&inline';

import type { SchemaGCService } from './schemaGCService';

const WORKER_NAME = `@dineug/erd-editor-schema-gc-worker?v${__APP_VERSION__}`;

let remoteService: Comlink.Remote<SchemaGCService> | null = null;

export function getSchemaGCService(): Comlink.Remote<SchemaGCService> | null {
  if (remoteService) return remoteService;

  try {
    const worker = new SchemaGCSharedWorker({
      name: WORKER_NAME,
    });
    remoteService = Comlink.wrap<SchemaGCService>(worker.port);
    return remoteService;
  } catch (error) {
    console.error(error);
  }

  return null;
}
