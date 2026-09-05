import { isBoolean, isNil, isPlainObject, isString } from 'es-toolkit';

import { assign, assignMeta, getDefaultEntityMeta } from '@/helper';
import { DeepPartial } from '@/internal-types';
import { Index } from '@/v3/schema/index.entity';

export const createIndex = (): Index => ({
  id: '',
  name: '',
  tableId: '',
  indexColumnIds: [],
  seqIndexColumnIds: [],
  unique: false,
  meta: getDefaultEntityMeta(),
});

export function createAndMergeIndexEntities(
  json?: DeepPartial<Record<string, Index>>
): Record<string, Index> {
  const entities: Record<string, Index> = {};
  if (!isPlainObject(json) || isNil(json)) return entities;

  for (const value of Object.values(json)) {
    if (!value) continue;
    const target = createIndex();
    const assignString = assign(isString, target, value);
    const assignBoolean = assign(isBoolean, target, value);
    const assignArray = assign(Array.isArray, target, value);

    assignString('id');
    assignString('name');
    assignString('tableId');
    assignBoolean('unique');
    assignArray('indexColumnIds');
    assignArray('seqIndexColumnIds');

    assignMeta(target.meta, value.meta);

    if (target.id) {
      entities[target.id] = target;
    }
  }

  return entities;
}
