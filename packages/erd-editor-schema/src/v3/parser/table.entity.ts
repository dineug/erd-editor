import { isArray, isNill, isNumber, isObject, isString } from '@dineug/shared';

import { assign, assignMeta, getDefaultEntityMeta } from '@/helper';
import { DeepPartial, PartialRecord } from '@/internal-types';
import { Table } from '@/v3/schema/table.entity';

export const createTable = (): Table => ({
  id: '',
  name: '',
  comment: '',
  columnIds: [],
  ui: {
    left: 200,
    top: 100,
    zIndex: 2,
    widthName: 60,
    widthComment: 60,
    color: '',
  },
  meta: getDefaultEntityMeta(),
});

export function createAndMergeTableEntities(
  json?: DeepPartial<PartialRecord<Table>>
): PartialRecord<Table> {
  const entities: PartialRecord<Table> = {};
  if (!isObject(json) || isNill(json)) return entities;

  for (const value of Object.values(json)) {
    if (!value) continue;
    const target = createTable();
    const assignString = assign(isString, target, value);
    const assignArray = assign(isArray, target, value);
    const uiAssignNumber = assign(isNumber, target.ui, value.ui);
    const uiAssignString = assign(isString, target.ui, value.ui);

    assignString('id');
    assignString('name');
    assignString('comment');
    assignArray('columnIds');

    uiAssignString('color');
    uiAssignNumber('left');
    uiAssignNumber('top');
    uiAssignNumber('zIndex');
    uiAssignNumber('widthName');
    uiAssignNumber('widthComment');

    assignMeta(target.meta, value.meta);

    if (target.id) {
      entities[target.id] = target;
    }
  }

  return entities;
}
