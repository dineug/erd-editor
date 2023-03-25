import { isArray, isBoolean, isNill, isNumber, isString } from '@dineug/shared';

import { assign } from '@/helper';
import { DeepPartial } from '@/internal-types';
import { Memo, MemoEntity } from '@/v2/schema/memoEntity';

const createMemoEntity = (): MemoEntity => ({
  memos: [],
});

const createMemo = (): Memo => ({
  id: '',
  value: '',
  ui: {
    active: false,
    left: 200,
    top: 200,
    zIndex: 2,
    width: 127,
    height: 127,
  },
});

export function createAndMergeMemoEntity(
  json?: DeepPartial<MemoEntity>
): MemoEntity {
  const entity = createMemoEntity();
  if (isNill(json) || !isArray(json.memos)) {
    return entity;
  }

  for (const memo of json.memos) {
    const target = createMemo();
    const assignString = assign(isString, target, memo);
    const uiAssignNumber = assign(isNumber, target.ui, memo.ui);
    const uiAssignBoolean = assign(isBoolean, target.ui, memo.ui);
    const uiAssignString = assign(isString, target.ui, memo.ui);

    assignString('id');
    assignString('value');

    uiAssignBoolean('active');
    uiAssignString('color');
    uiAssignNumber('left');
    uiAssignNumber('top');
    uiAssignNumber('zIndex');
    uiAssignNumber('width');
    uiAssignNumber('height');

    entity.memos.push(target);
  }

  return entity;
}
