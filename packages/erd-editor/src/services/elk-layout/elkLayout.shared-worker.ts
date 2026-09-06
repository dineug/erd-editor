import * as Comlink from 'comlink';

import { ElkLayoutService } from '@/services/elk-layout/elkLayoutService';

declare let self: SharedWorkerGlobalScope;

const service = new ElkLayoutService();

self.onconnect = event => {
  const port = event.ports[0];
  Comlink.expose(service, port);
};
