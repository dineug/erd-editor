import * as Comlink from 'comlink';

import { AStarService } from '@/services/a-star/AStarService';

const service = new AStarService();

Comlink.expose(service);
