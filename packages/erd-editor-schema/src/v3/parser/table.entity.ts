import { isNil, isNumber, isPlainObject, isString } from 'es-toolkit';

import { assign, restoreSequence } from '@/helper';
import { DeepPartial } from '@/internal-types';
import { Table } from '@/v3/schema/table.entity';

export const createTable = (): Table => ({
  id: '',
  name: '',
  comment: '',
  columnIds: [],
  seqColumnIds: [],
  groupId: '',
  ui: {
    x: 200,
    y: 100,
    zIndex: 2,
    widthName: 60,
    widthComment: 60,
    color: '',
  },
});

export function createAndMergeTableEntities(
  json?: DeepPartial<Record<string, Table>>
): Record<string, Table> {
  const entities: Record<string, Table> = {};
  if (!isPlainObject(json) || isNil(json)) return entities;

  for (const value of Object.values(json)) {
    if (!value) continue;
    const target = createTable();
    const assignString = assign(isString, target, value);
    const assignArray = assign(Array.isArray, target, value);
    const uiAssignNumber = assign(isNumber, target.ui, value.ui);
    const uiAssignString = assign(isString, target.ui, value.ui);

    assignString('id');
    assignString('name');
    assignString('comment');
    assignString('groupId');
    assignArray('columnIds');
    assignArray('seqColumnIds');

    uiAssignString('color');
    uiAssignNumber('x');
    uiAssignNumber('y');
    uiAssignNumber('zIndex');
    uiAssignNumber('widthName');
    uiAssignNumber('widthComment');

    target.seqColumnIds = restoreSequence(
      target.columnIds,
      target.seqColumnIds
    );

    if (target.id) {
      entities[target.id] = target;
    }
  }

  return entities;
}
