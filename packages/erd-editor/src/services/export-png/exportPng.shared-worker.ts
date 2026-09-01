import '@/konva/workerDomStubs';

import * as Comlink from 'comlink';

import { ExportPngService } from '@/services/export-png/exportPngService';

declare let self: SharedWorkerGlobalScope;

const service = new ExportPngService();

self.onconnect = event => {
  const port = event.ports[0];
  Comlink.expose(service, port);
};
