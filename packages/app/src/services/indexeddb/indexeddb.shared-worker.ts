import * as Comlink from 'comlink';

import { AppDatabaseService } from '@/services/indexeddb/appDatabaseService';

declare let self: SharedWorkerGlobalScope;

const service = new AppDatabaseService();

self.onconnect = event => {
  const port = event.ports[0];
  Comlink.expose(service, port);
};
