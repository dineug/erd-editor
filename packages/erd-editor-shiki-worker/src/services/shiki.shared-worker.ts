import * as Comlink from 'comlink';

import { ShikiService } from '@/services/shikiService';

declare let self: SharedWorkerGlobalScope;

const service = new ShikiService();

self.onconnect = event => {
  const port = event.ports[0];
  Comlink.expose(service, port);
};
