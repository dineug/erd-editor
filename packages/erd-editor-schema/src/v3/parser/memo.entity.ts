import {
  isBoolean,
  isNill,
  isNumber,
  isObject,
  isString,
} from '@dineug/shared';

import { assign } from '@/helper';
import { DeepPartial, PartialRecord } from '@/internal-types';
import { Memo } from '@/v3/schema/memo.entity';

export const createMemo = (): Memo => ({
  id: '',
  value: '',
  ui: {
    active: false,
    left: 200,
    top: 200,
    zIndex: 2,
    width: 127,
    height: 127,
    color: '',
  },
});

export function createAndMergeMemoEntities(
  json?: DeepPartial<PartialRecord<Memo>>
): PartialRecord<Memo> {
  const entities: PartialRecord<Memo> = {};
  if (!isObject(json) || isNill(json)) return entities;

  for (const value of Object.values(json)) {
    if (!value) continue;
    const target = createMemo();
    const assignString = assign(isString, target, value);
    const uiAssignNumber = assign(isNumber, target.ui, value.ui);
    const uiAssignBoolean = assign(isBoolean, target.ui, value.ui);
    const uiAssignString = assign(isString, target.ui, value.ui);

    assignString('id');
    assignString('value');

    uiAssignBoolean('active');
    uiAssignString('color');
    uiAssignNumber('left');
    uiAssignNumber('top');
    uiAssignNumber('zIndex');
    uiAssignNumber('width');
    uiAssignNumber('height');

    if (target.id) {
      entities[target.id] = target;
    }
  }

  return entities;
}
