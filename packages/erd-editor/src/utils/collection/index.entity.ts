import merge from 'deepmerge';
import { nanoid } from 'nanoid';

import { DeepPartial, Index } from '@/internal-types';
import { getDefaultEntityMeta } from '@/utils';

export const createIndex = (value?: DeepPartial<Index>): Index =>
  merge(
    {
      id: nanoid(),
      name: '',
      tableId: '',
      indexColumnIds: [],
      seqIndexColumnIds: [],
      unique: false,
      meta: getDefaultEntityMeta(),
    },
    (value as Index) ?? {}
  );
