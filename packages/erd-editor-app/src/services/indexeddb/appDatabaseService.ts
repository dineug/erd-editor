import Dexie, { Table } from 'dexie';

import {
  addSchemaEntity,
  deleteSchemaEntity,
  getSchemaEntities,
  getSchemaEntity,
  SchemaEntity,
  updateSchemaEntity,
} from '@/services/indexeddb/modules/schema';

export class AppDatabase extends Dexie {
  schemas!: Table<SchemaEntity, string>;

  constructor() {
    super('erd-editor-app');

    this.version(1).stores({
      schemas: 'id',
    });
  }
}

const db: AppDatabase | null = null;

function getDB() {
  return db ? db : new AppDatabase();
}

export class AppDatabaseService {
  private get db() {
    return getDB();
  }

  async addSchemaEntity(entityValue: Pick<SchemaEntity, 'name'>) {
    return await addSchemaEntity(this.db, entityValue);
  }

  async updateSchemaEntity(
    id: string,
    entityValue: Partial<Pick<SchemaEntity, 'value' | 'name'>>
  ) {
    return await updateSchemaEntity(this.db, id, entityValue);
  }

  async deleteSchemaEntity(id: string) {
    return await deleteSchemaEntity(this.db, id);
  }

  async getSchemaEntity(id: string) {
    return await getSchemaEntity(this.db, id);
  }

  async getSchemaEntities() {
    return await getSchemaEntities(this.db);
  }
}
