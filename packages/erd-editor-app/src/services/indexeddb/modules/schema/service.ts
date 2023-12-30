import {
  createReplicationStore,
  ReplicationStore,
} from '@dineug/erd-editor/engine.js';
import { omit } from 'lodash-es';

import { type AppDatabase } from '@/services/indexeddb/appDatabaseService';
import {
  addSchemaEntity,
  deleteSchemaEntity,
  getSchemaEntities,
  getSchemaEntity,
  SchemaEntity,
  updateSchemaEntity,
} from '@/services/indexeddb/modules/schema';

export class SchemaService {
  private cache = new Map<string, SchemaEntity & { store: ReplicationStore }>();
  constructor(private db: AppDatabase) {}

  async add(entityValue: Pick<SchemaEntity, 'name'>) {
    const result = await addSchemaEntity(this.db, entityValue);

    const store = createReplicationStore({ toWidth });
    store.on({
      change: () => {
        this.update(result.id, { value: store.value });
      },
    });
    this.cache.set(result.id, { ...result, store });

    return result;
  }

  async update(
    id: string,
    entityValue: Partial<Pick<SchemaEntity, 'value' | 'name'>>
  ) {
    const result = await updateSchemaEntity(this.db, id, entityValue);

    const prev = this.cache.get(id);
    if (prev && result) {
      this.cache.set(id, { ...prev, ...entityValue });
    }

    return result;
  }

  async delete(id: string) {
    const result = await deleteSchemaEntity(this.db, id);
    this.cache.delete(id);
    return result;
  }

  async get(id: string) {
    const prev = this.cache.get(id);
    if (prev) return omit(prev, 'store');

    const result = await getSchemaEntity(this.db, id);
    if (result) {
      const store = createReplicationStore({ toWidth });
      store.setInitialValue(result.value);
      store.on({
        change: () => {
          this.update(result.id, { value: store.value });
        },
      });
      this.cache.set(id, { ...result, store });
    }

    return result;
  }

  async getEntities() {
    return await getSchemaEntities(this.db);
  }

  async replication(id: string, actions: any) {
    let prev = this.cache.get(id);

    if (!prev) {
      await this.get(id);
      prev = this.cache.get(id);
    }

    if (prev) {
      prev.store.dispatch(actions as any);
    }
  }
}

function toWidth(value: string) {
  return value.length * 11;
}
