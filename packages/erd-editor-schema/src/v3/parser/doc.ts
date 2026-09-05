import { isNil, isPlainObject } from 'es-toolkit';

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
  if (!isPlainObject(json) || isNil(json)) return doc;

  const assignArray = assign(Array.isArray, doc, json);

  assignArray('tableIds');
  assignArray('relationshipIds');
  assignArray('indexIds');
  assignArray('memoIds');

  return doc;
}
