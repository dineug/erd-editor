import {
  createReplicationStore,
  ReplicationStore,
} from '@dineug/erd-editor/engine.js';
import { mapValues, omit } from 'es-toolkit';

import { type AppDatabase } from '@/services/indexeddb/appDatabaseService';
import {
  addSchemaEntity,
  deleteSchemaEntity,
  getSchemaEntities,
  getSchemaEntitiesWithValue,
  getSchemaEntity,
  NewSchemaEntity,
  SchemaEntity,
  SchemaEntityPatch,
  updateSchemaEntity,
} from '@/services/indexeddb/modules/schema';
import type { updateSchemaEntityAction } from '@/utils/broadcastChannel';
import { toWidth } from '@/utils/text';

/** The foreign key bit of ui.keys, kept in step with the relationships. */
const FOREIGN_KEY = 2;

const withoutAnchor = (end: Record<string, unknown>) =>
  omit(end, ['x', 'y', 'direction']);

/**
 * Collections less what the engine derives from the rest of them and rewrites
 * after a load without an action: text widths, measured with this machine's
 * fonts, connector anchors, and flags read off the columns and relationships.
 */
function withoutDerived(collections: any) {
  return {
    ...collections,
    tableEntities: mapValues(collections.tableEntities, (table: any) => ({
      ...table,
      ui: omit(table.ui, ['widthName', 'widthComment']),
    })),
    tableColumnEntities: mapValues(
      collections.tableColumnEntities,
      (column: any) => ({
        ...column,
        ui: {
          ...omit(column.ui, [
            'widthName',
            'widthComment',
            'widthDataType',
            'widthDefault',
          ]),
          keys: column.ui.keys & ~FOREIGN_KEY,
        },
      })
    ),
    relationshipEntities: mapValues(
      collections.relationshipEntities,
      (relationship: any) => ({
        ...omit(relationship, ['identification', 'startRelationshipType']),
        start: withoutAnchor(relationship.start),
        end: withoutAnchor(relationship.end),
      })
    ),
  };
}

/**
 * The part of a saved value an edit changes. The engine also saves view state
 * (zoom, scroll, canvas type) as a change, and none of that is an edit. The
 * value is always the replica's own, so every collection and ui is present.
 */
function toFingerprint(value: string) {
  const { doc, collections, settings } = JSON.parse(value);
  return JSON.stringify({
    doc,
    collections: withoutDerived(collections),
    databaseName: settings.databaseName,
  });
}

export class SchemaService {
  private cache = new Map<string, SchemaEntity & { store: ReplicationStore }>();
  private fingerprints = new Map<string, string>();
  // Its own channel rather than the bridge module, whose listener would make
  // this context decode every message the tabs exchange. Being a separate
  // instance, it also reaches the tab that runs this service in-thread.
  private channel = new BroadcastChannel('@@bridge');

  constructor(private db: AppDatabase) {}

  private createCache(entity: SchemaEntity) {
    if (this.cache.has(entity.id)) return;

    const store = createReplicationStore({ toWidth });
    this.cache.set(entity.id, { ...entity, store });
    this.load(entity.id, store, entity.value);
    store.on({
      change: () => this.persist(entity.id, store),
    });
  }

  /**
   * Replaces the replica's value and measures later edits against it. The
   * baseline waits a microtask for the tombstone collection the engine queues
   * on every load, which is housekeeping rather than an edit.
   */
  private load(id: string, store: ReplicationStore, value: string) {
    store.setInitialValue(value);
    queueMicrotask(() => {
      if (this.cache.get(id)?.store !== store) return;
      this.fingerprints.set(id, toFingerprint(store.value));
    });
  }

  private persist(id: string, store: ReplicationStore) {
    const prev = this.cache.get(id);
    if (!prev) return;

    const value = store.value;
    const fingerprint = toFingerprint(value);
    const edited = fingerprint !== this.fingerprints.get(id);
    const entityValue: SchemaEntityPatch = edited
      ? { value, updateAt: Date.now() }
      : { value };

    this.fingerprints.set(id, fingerprint);
    this.cache.set(id, { ...prev, ...entityValue });
    updateSchemaEntity(this.db, id, entityValue).then(result => {
      if (!result || !edited) return;

      const action: ReturnType<typeof updateSchemaEntityAction> = {
        type: 'updateSchemaEntity',
        payload: { id, entityValue: { updateAt: entityValue.updateAt } },
      };
      this.channel.postMessage(action);
    });
  }

  async add(entityValue: NewSchemaEntity) {
    const result = await addSchemaEntity(this.db, entityValue);

    this.createCache(result);
    return result;
  }

  /** A new schema holding the source's latest value, the replica's when it has one. */
  async duplicate(id: string, entityValue: Pick<SchemaEntity, 'name'>) {
    const value =
      this.cache.get(id)?.store.value ??
      (await getSchemaEntity(this.db, id))?.value;
    if (value === undefined) return undefined;

    return await this.add({ ...entityValue, value });
  }

  async update(id: string, entityValue: SchemaEntityPatch) {
    const result = await updateSchemaEntity(this.db, id, entityValue);
    const prev = this.cache.get(id);

    if (prev && result) {
      this.cache.set(id, { ...prev, ...entityValue });

      if (entityValue.value) {
        this.load(id, prev.store, entityValue.value);
      }
    }

    return result;
  }

  async delete(id: string) {
    await deleteSchemaEntity(this.db, id);
    const prev = this.cache.get(id);

    if (prev) {
      this.cache.delete(id);
      this.fingerprints.delete(id);
      prev.store.destroy();
    }
  }

  async get(id: string) {
    const prev = this.cache.get(id);
    if (prev) return omit(prev, ['store']);

    const result = await getSchemaEntity(this.db, id);
    result && this.createCache(result);

    return result;
  }

  async getAll() {
    return await getSchemaEntities(this.db);
  }

  /** Every schema with its latest value, the replica's where one is open. */
  async getAllWithValue() {
    const list = await getSchemaEntitiesWithValue(this.db);

    return list.map(entity => {
      const cached = this.cache.get(entity.id);
      return cached ? { ...entity, value: cached.store.value } : entity;
    });
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
