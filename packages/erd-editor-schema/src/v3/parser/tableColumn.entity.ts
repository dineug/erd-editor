import { isNill, isNumber, isObject, isString } from '@dineug/shared';

import { assign, assignMeta, getDefaultEntityMeta } from '@/helper';
import { DeepPartial, PartialRecord } from '@/internal-types';
import { Column } from '@/v3/schema/tableColumn.entity';

export const createColumn = (): Column => ({
  id: '',
  name: '',
  comment: '',
  dataType: '',
  default: '',
  options: 0,
  ui: {
    keys: 0,
    widthName: 60,
    widthComment: 60,
    widthDataType: 60,
    widthDefault: 60,
  },
  meta: getDefaultEntityMeta(),
});

export function createAndMergeTableColumnEntities(
  json?: DeepPartial<PartialRecord<Column>>
): PartialRecord<Column> {
  const entities: PartialRecord<Column> = {};
  if (!isObject(json) || isNill(json)) return entities;

  for (const value of Object.values(json)) {
    if (!value) continue;
    const target = createColumn();
    const assignString = assign(isString, target, value);
    const assignNumber = assign(isNumber, target, value);
    const uiAssignNumber = assign(isNumber, target.ui, value.ui);

    assignString('id');
    assignString('name');
    assignString('comment');
    assignString('dataType');
    assignString('default');
    assignNumber('options');

    uiAssignNumber('keys');
    uiAssignNumber('widthName');
    uiAssignNumber('widthComment');
    uiAssignNumber('widthDataType');
    uiAssignNumber('widthDefault');

    assignMeta(target.meta, value.meta);

    if (target.id) {
      entities[target.id] = target;
    }
  }

  return entities;
}
