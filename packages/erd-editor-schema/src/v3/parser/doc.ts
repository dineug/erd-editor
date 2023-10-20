import { isArray, isNill, isObject } from '@dineug/shared';

import { assign } from '@/helper';
import { DeepPartial } from '@/internal-types';
import { Doc } from '@/v3/schema/doc';

const createDoc = (): Doc => ({
  tableIds: [],
  relationshipIds: [],
  indexIds: [],
  memoIds: [],
});

export function createAndMergeDoc(json?: DeepPartial<Doc>): Doc {
  const doc = createDoc();
  if (!isObject(json) || isNill(json)) return doc;

  const assignArray = assign(isArray, doc, json);

  assignArray('tableIds');
  assignArray('relationshipIds');
  assignArray('indexIds');
  assignArray('memoIds');

  return doc;
}
