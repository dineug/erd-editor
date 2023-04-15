import { isNill, isNumber, isObject, isString } from '@dineug/shared';

import { assign, assignMeta, getDefaultEntityMeta } from '@/helper';
import { DeepPartial } from '@/internal-types';
import { Memo } from '@/v3/schema/memo.entity';

export const createMemo = (): Memo => ({
  id: '',
  value: '',
  ui: {
    x: 200,
    y: 200,
    zIndex: 2,
    width: 127,
    height: 127,
    color: '',
  },
  meta: getDefaultEntityMeta(),
});

export function createAndMergeMemoEntities(
  json?: DeepPartial<Record<string, Memo>>
): Record<string, Memo> {
  const entities: Record<string, Memo> = {};
  if (!isObject(json) || isNill(json)) return entities;

  for (const value of Object.values(json)) {
    if (!value) continue;
    const target = createMemo();
    const assignString = assign(isString, target, value);
    const uiAssignNumber = assign(isNumber, target.ui, value.ui);
    const uiAssignString = assign(isString, target.ui, value.ui);

    assignString('id');
    assignString('value');

    uiAssignString('color');
    uiAssignNumber('x');
    uiAssignNumber('y');
    uiAssignNumber('zIndex');
    uiAssignNumber('width');
    uiAssignNumber('height');

    assignMeta(target.meta, value.meta);

    if (target.id) {
      entities[target.id] = target;
    }
  }

  return entities;
}
