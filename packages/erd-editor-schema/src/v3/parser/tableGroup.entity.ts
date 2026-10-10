import { isNil, isNumber, isPlainObject, isString } from 'es-toolkit';

import { assign, assignMeta, getDefaultEntityMeta } from '@/helper';
import { DeepPartial } from '@/internal-types';
import { TableGroup } from '@/v3/schema/tableGroup.entity';

export const createTableGroup = (): TableGroup => ({
  id: '',
  name: '',
  color: '',
  ui: {
    x: 200,
    y: 100,
    width: 400,
    height: 300,
    zIndex: 1,
  },
  meta: getDefaultEntityMeta(),
});

export function createAndMergeTableGroupEntities(
  json?: DeepPartial<Record<string, TableGroup>>
): Record<string, TableGroup> {
  const entities: Record<string, TableGroup> = {};
  if (!isPlainObject(json) || isNil(json)) return entities;

  for (const value of Object.values(json)) {
    if (!value) continue;
    const target = createTableGroup();
    const assignString = assign(isString, target, value);
    const uiAssignNumber = assign(isNumber, target.ui, value.ui);

    assignString('id');
    assignString('name');
    assignString('color');

    uiAssignNumber('x');
    uiAssignNumber('y');
    uiAssignNumber('width');
    uiAssignNumber('height');
    uiAssignNumber('zIndex');

    assignMeta(target.meta, value.meta);

    if (target.id) {
      entities[target.id] = target;
    }
  }

  return entities;
}
