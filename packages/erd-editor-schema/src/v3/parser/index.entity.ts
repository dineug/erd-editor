import { isBoolean, isNil, isPlainObject, isString } from 'es-toolkit';

import { assign, entryId, restoreSequence } from '@/helper';
import { DeepPartial } from '@/internal-types';
import { Index } from '@/v3/schema/index.entity';

export const createIndex = (): Index => ({
  id: '',
  name: '',
  tableId: '',
  indexColumnIds: [],
  seqIndexColumnIds: [],
  unique: false,
});

export function createAndMergeIndexEntities(
  json?: DeepPartial<Record<string, Index>>
): Record<string, Index> {
  const entities: Record<string, Index> = {};
  if (!isPlainObject(json) || isNil(json)) return entities;

  for (const [key, value] of Object.entries(json)) {
    if (!isPlainObject(value)) continue;
    const target = createIndex();
    const assignString = assign(isString, target, value);
    const assignBoolean = assign(isBoolean, target, value);
    const assignArray = assign(Array.isArray, target, value);

    target.id = entryId(key, value);
    assignString('name');
    assignString('tableId');
    assignBoolean('unique');
    assignArray('indexColumnIds');
    assignArray('seqIndexColumnIds');

    target.seqIndexColumnIds = restoreSequence(
      target.indexColumnIds,
      target.seqIndexColumnIds
    );

    if (target.id) {
      entities[target.id] = target;
    }
  }

  return entities;
}
