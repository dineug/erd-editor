import { isArray, isBoolean, isNill, isObject, isString } from '@dineug/shared';

import { assign, assignMeta, getDefaultEntityMeta } from '@/helper';
import { DeepPartial, PartialRecord } from '@/internal-types';
import { Index } from '@/v3/schema/index.entity';

export const createIndex = (): Index => ({
  id: '',
  name: '',
  tableId: '',
  indexColumnIds: [],
  unique: false,
  meta: getDefaultEntityMeta(),
});

export function createAndMergeIndexEntities(
  json?: DeepPartial<PartialRecord<Index>>
): PartialRecord<Index> {
  const entities: PartialRecord<Index> = {};
  if (!isObject(json) || isNill(json)) return entities;

  for (const value of Object.values(json)) {
    if (!value) continue;
    const target = createIndex();
    const assignString = assign(isString, target, value);
    const assignBoolean = assign(isBoolean, target, value);
    const assignArray = assign(isArray, target, value);

    assignString('id');
    assignString('name');
    assignString('tableId');
    assignBoolean('unique');
    assignArray('indexColumnIds');

    assignMeta(target.meta, value.meta);

    if (target.id) {
      entities[target.id] = target;
    }
  }

  return entities;
}
