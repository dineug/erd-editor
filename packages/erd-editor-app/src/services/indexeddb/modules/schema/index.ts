import { nanoid } from '@dineug/shared';
import { omit } from 'lodash-es';

import { EntityType } from '@/internal-types';
import type { AppDatabase } from '@/services/indexeddb/appDatabaseService';

export type SchemaEntity = EntityType<{
  name: string;
  value: string;
}>;

export async function addSchemaEntity(
  db: AppDatabase,
  entityValue: Pick<SchemaEntity, 'name'>
): Promise<SchemaEntity> {
  const table = db.table<SchemaEntity>('schemas');
  const now = Date.now();
  const entity: SchemaEntity = {
    ...entityValue,
    id: nanoid(),
    value: '',
    createAt: now,
    updateAt: now,
  };

  await table.add(entity);
  return entity;
}

export async function updateSchemaEntity(
  db: AppDatabase,
  id: string,
  entityValue: Partial<Pick<SchemaEntity, 'value' | 'name'>>
) {
  const table = db.table<SchemaEntity>('schemas');
  const updateCount = await table.update(id, {
    ...entityValue,
    updateAt: Date.now(),
  });
  return updateCount === 1;
}

export async function deleteSchemaEntity(db: AppDatabase, id: string) {
  const table = db.table<SchemaEntity>('schemas');
  await table.delete(id);
}

export async function getSchemaEntity(
  db: AppDatabase,
  id: string
): Promise<SchemaEntity | undefined> {
  const table = db.table<SchemaEntity>('schemas');
  return await table.get(id);
}

export async function getSchemaEntities(
  db: AppDatabase
): Promise<Array<Omit<SchemaEntity, 'value'>>> {
  const list = await db.table<SchemaEntity>('schemas').toArray();
  return list.map(item => omit(item, 'value'));
}
