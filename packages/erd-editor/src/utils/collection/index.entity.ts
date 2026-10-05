import { uuid25 } from '@dineug/uuid';
import merge from 'deepmerge';

import { DeepPartial, Index } from '@/internal-types';
import { getDefaultEntityMeta } from '@/utils';

export const createIndex = (value?: DeepPartial<Index>): Index =>
  merge(
    {
      id: uuid25(),
      name: '',
      tableId: '',
      indexColumnIds: [],
      seqIndexColumnIds: [],
      unique: false,
      meta: getDefaultEntityMeta(),
    },
    (value as Index) ?? {}
  );
