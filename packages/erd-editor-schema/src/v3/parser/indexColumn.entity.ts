import { isNil, isPlainObject, isString } from 'es-toolkit';

import { assign, entryId, validNumber } from '@/helper';
import { DeepPartial } from '@/internal-types';
import {
  IndexColumn,
  OrderType,
  OrderTypeList,
} from '@/v3/schema/indexColumn.entity';

export const createIndexColumn = (): IndexColumn => ({
  id: '',
  indexId: '',
  columnId: '',
  orderType: OrderType.ASC,
});

export function createAndMergeIndexColumnEntities(
  json?: DeepPartial<Record<string, IndexColumn>>
): Record<string, IndexColumn> {
  const entities: Record<string, IndexColumn> = {};
  if (!isPlainObject(json) || isNil(json)) return entities;

  for (const [key, value] of Object.entries(json)) {
    if (!isPlainObject(value)) continue;
    const target = createIndexColumn();
    const assignString = assign(isString, target, value);

    target.id = entryId(key, value);
    assignString('indexId');
    assignString('columnId');
    assign(validNumber(OrderTypeList), target, value)('orderType');

    if (target.id) {
      entities[target.id] = target;
    }
  }

  return entities;
}
