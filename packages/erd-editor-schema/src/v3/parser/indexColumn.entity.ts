import { isNill, isObject, isString } from '@dineug/shared';

import {
  assign,
  assignMeta,
  getDefaultEntityMeta,
  validNumber,
} from '@/helper';
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
  meta: getDefaultEntityMeta(),
});

export function createAndMergeIndexColumnEntities(
  json?: DeepPartial<Record<string, IndexColumn>>
): Record<string, IndexColumn> {
  const entities: Record<string, IndexColumn> = {};
  if (!isObject(json) || isNill(json)) return entities;

  for (const value of Object.values(json)) {
    if (!value) continue;
    const target = createIndexColumn();
    const assignString = assign(isString, target, value);

    assignString('id');
    assignString('indexId');
    assignString('columnId');
    assign(validNumber(OrderTypeList), target, value)('orderType');

    assignMeta(target.meta, value.meta);

    if (target.id) {
      entities[target.id] = target;
    }
  }

  return entities;
}
