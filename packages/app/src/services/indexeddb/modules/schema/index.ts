import { omit } from 'es-toolkit';
import { nanoid } from 'nanoid';

import { EntityType } from '@/internal-types';
import type { AppDatabase } from '@/services/indexeddb/appDatabaseService';

export type SchemaEntity = EntityType<{
  name: string;
  value: string;
  /** Set while the schema sits in the trash; not indexed, so no schema version bump. */
  deletedAt?: number | null;
}>;

export type SchemaEntityPatch = Partial<
  Pick<SchemaEntity, 'name' | 'value' | 'updateAt' | 'deletedAt'>
>;

/** A schema to store under a new id; a copy brings its own value. */
export type NewSchemaEntity = Pick<SchemaEntity, 'name'> &
  Partial<Pick<SchemaEntity, 'value'>>;

function createSchemaEntity(
  entityValue: NewSchemaEntity,
  now: number
): SchemaEntity {
  return {
    id: nanoid(),
    name: entityValue.name,
    value: entityValue.value ?? '',
    createAt: now,
    updateAt: now,
  };
}

export async function addSchemaEntity(
  db: AppDatabase,
  entityValue: NewSchemaEntity
): Promise<SchemaEntity> {
  const table = db.table<SchemaEntity>('schemas');
  const entity = createSchemaEntity(entityValue, Date.now());

  await table.add(entity);
  return entity;
}

/** Writes the given fields only; a caller that means an edit passes updateAt itself. */
export async function updateSchemaEntity(
  db: AppDatabase,
  id: string,
  entityValue: SchemaEntityPatch
) {
  const table = db.table<SchemaEntity>('schemas');
  const updateCount = await table.update(id, entityValue);
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
  return list.map(item => omit(item, ['value']));
}

export async function getSchemaEntitiesWithValue(
  db: AppDatabase
): Promise<SchemaEntity[]> {
  return await db.table<SchemaEntity>('schemas').toArray();
}
