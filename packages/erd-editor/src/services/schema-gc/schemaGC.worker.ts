import * as Comlink from 'comlink';

import { SchemaGCService } from '@/services/schema-gc/schemaGCService';

const service = new SchemaGCService();

Comlink.expose(service);
