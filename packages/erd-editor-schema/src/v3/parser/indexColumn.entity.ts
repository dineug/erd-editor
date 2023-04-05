import { isNill, isObject, isString } from '@dineug/shared';

import { assign, validNumber } from '@/helper';
import { DeepPartial, PartialRecord } from '@/internal-types';
import {
  IndexColumn,
  OrderType,
  OrderTypeList,
} from '@/v3/schema/indexColumn.entity';

export const createIndexColumn = (): IndexColumn => ({
  id: '',
  columnId: '',
  orderType: OrderType.ASC,
});

export function createAndMergeIndexColumnEntities(
  json?: DeepPartial<PartialRecord<IndexColumn>>
): PartialRecord<IndexColumn> {
  const entities: PartialRecord<IndexColumn> = {};
  if (!isObject(json) || isNill(json)) return entities;

  for (const value of Object.values(json)) {
    if (!value) continue;
    const target = createIndexColumn();
    const assignString = assign(isString, target, value);

    assignString('id');
    assignString('columnId');
    assign(validNumber(OrderTypeList), target, value)('orderType');

    if (target.id) {
      entities[target.id] = target;
    }
  }

  return entities;
}
