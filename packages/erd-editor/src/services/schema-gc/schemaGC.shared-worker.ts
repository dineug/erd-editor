import * as Comlink from 'comlink';

import { SchemaGCService } from '@/services/schema-gc/schemaGCService';

declare let self: SharedWorkerGlobalScope;

const service = new SchemaGCService();

self.onconnect = event => {
  const port = event.ports[0];
  Comlink.expose(service, port);
};
