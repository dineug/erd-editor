import * as Comlink from 'comlink';

import { AppDatabaseService } from '@/services/indexeddb/appDatabaseService';

const service = new AppDatabaseService();

Comlink.expose(service);
