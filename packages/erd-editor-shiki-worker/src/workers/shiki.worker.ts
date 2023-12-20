import * as Comlink from 'comlink';

import { ShikiService } from '../services/shikiService';

const service = new ShikiService();

Comlink.expose(service);
