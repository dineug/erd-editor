import Dexie, { Table } from 'dexie';

import { SchemaEntity } from '@/services/indexeddb/modules/schema';
import { SchemaService } from '@/services/indexeddb/modules/schema/service';

export class AppDatabase extends Dexie {
  schemas!: Table<SchemaEntity, string>;

  constructor() {
    super('erd-editor-app');

    this.version(1).stores({
      schemas: 'id',
    });
  }
}

let db: AppDatabase | null = null;

function getDB() {
  if (db) return db;

  db = new AppDatabase();
  return db;
}

export class AppDatabaseService {
  private db = getDB();
  private schemaService = new SchemaService(this.db);

  async addSchemaEntity(entityValue: Pick<SchemaEntity, 'name'>) {
    return await this.schemaService.add(entityValue);
  }

  async updateSchemaEntity(
    id: string,
    entityValue: Partial<Pick<SchemaEntity, 'value' | 'name'>>
  ) {
    return await this.schemaService.update(id, entityValue);
  }

  async deleteSchemaEntity(id: string) {
    return await this.schemaService.delete(id);
  }

  async getSchemaEntity(id: string) {
    return await this.schemaService.get(id);
  }

  async getSchemaEntities() {
    return await this.schemaService.getEntities();
  }

  async replicationSchemaEntity(id: string, actions: any) {
    await this.schemaService.replication(id, actions);
  }
}
