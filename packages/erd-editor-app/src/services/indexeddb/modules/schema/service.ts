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
import { toWidth } from '@/utils/text';

export class SchemaService {
  private cache = new Map<string, SchemaEntity & { store: ReplicationStore }>();
  constructor(private db: AppDatabase) {}

  private createCache(entity: SchemaEntity) {
    if (this.cache.has(entity.id)) return;

    const store = createReplicationStore({ toWidth });
    store.setInitialValue(entity.value);
    store.on({
      change: () => {
        const value = store.value;
        const prev = this.cache.get(entity.id);
        updateSchemaEntity(this.db, entity.id, { value });
        prev && this.cache.set(entity.id, { ...prev, value });
      },
    });
    this.cache.set(entity.id, { ...entity, store });
  }

  async add(entityValue: Pick<SchemaEntity, 'name'>) {
    const result = await addSchemaEntity(this.db, entityValue);

    this.createCache(result);
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

      if (entityValue.value) {
        prev.store.setInitialValue(entityValue.value);
      }
    }

    return result;
  }

  async delete(id: string) {
    await deleteSchemaEntity(this.db, id);
    const prev = this.cache.get(id);

    if (prev) {
      this.cache.delete(id);
      prev.store.destroy();
    }
  }

  async get(id: string) {
    const prev = this.cache.get(id);
    if (prev) return omit(prev, 'store');

    const result = await getSchemaEntity(this.db, id);
    result && this.createCache(result);

    return result;
  }

  async getAll() {
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
