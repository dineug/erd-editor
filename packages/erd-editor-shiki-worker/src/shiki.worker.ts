import * as Comlink from 'comlink';

import { ShikiService } from './shiki.service';

const service = new ShikiService();

Comlink.expose(service);
