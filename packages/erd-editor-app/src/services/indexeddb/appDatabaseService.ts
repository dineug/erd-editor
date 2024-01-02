import Dexie, { Table } from 'dexie';

import { CollaborativeService } from '@/services/indexeddb/modules/collaborative/service';
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

export class AppDatabaseService {
  #db = new AppDatabase();
  #schemaService = new SchemaService(this.#db);
  #collaborativeService = new CollaborativeService(this.#schemaService);

  async addSchemaEntity(entityValue: Pick<SchemaEntity, 'name'>) {
    return await this.#schemaService.add(entityValue);
  }

  async updateSchemaEntity(
    id: string,
    entityValue: Partial<Pick<SchemaEntity, 'value' | 'name'>>
  ) {
    return await this.#schemaService.update(id, entityValue);
  }

  async deleteSchemaEntity(id: string) {
    return await this.#schemaService.delete(id);
  }

  async getSchemaEntity(id: string) {
    return await this.#schemaService.get(id);
  }

  async getSchemaEntities() {
    return await this.#schemaService.getAll();
  }

  async replicationSchemaEntity(id: string, actions: any) {
    await this.#schemaService.replication(id, actions);
    await this.#collaborativeService.dispatch(id, actions);
  }

  async collaborativeStartSession(schemaId: string) {
    return await this.#collaborativeService.startSession(schemaId);
  }

  async collaborativeStopSession(schemaId: string) {
    return await this.#collaborativeService.stopSession(schemaId);
  }

  async collaborativeSessionAll() {
    return await this.#collaborativeService.sessionAll();
  }
}
