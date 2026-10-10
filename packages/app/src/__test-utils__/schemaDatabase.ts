import type { AppDatabase } from '@/services/indexeddb/appDatabaseService';
import type { SchemaEntity } from '@/services/indexeddb/modules/schema';

/** The slice of a Dexie table the schema module touches, kept in memory. */
export function createFakeDatabase() {
  const rows = new Map<string, SchemaEntity>();
  const table = {
    add: async (entity: SchemaEntity) => {
      rows.set(entity.id, structuredClone(entity));
      return entity.id;
    },
    bulkAdd: async (entities: SchemaEntity[]) => {
      entities.forEach(entity => rows.set(entity.id, structuredClone(entity)));
    },
    update: async (id: string, changes: Partial<SchemaEntity>) => {
      const row = rows.get(id);
      if (!row) return 0;
      Object.assign(row, structuredClone(changes));
      return 1;
    },
    delete: async (id: string) => {
      rows.delete(id);
    },
    get: async (id: string) => structuredClone(rows.get(id)),
    toArray: async () => Array.from(rows.values(), row => structuredClone(row)),
  };

  return {
    rows,
    table,
    db: { table: () => table } as unknown as AppDatabase,
  };
}
