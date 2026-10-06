import { uuid25 } from '@dineug/uuid';

import { DeepPartial, Index } from '@/internal-types';
import { getDefaultEntityMeta } from '@/utils';
import { deepMerge } from '@/utils/deepMerge';

export const createIndex = (value?: DeepPartial<Index>): Index =>
  deepMerge<Index>(
    {
      id: uuid25(),
      name: '',
      tableId: '',
      indexColumnIds: [],
      seqIndexColumnIds: [],
      unique: false,
      meta: getDefaultEntityMeta(),
    },
    value ?? {}
  );
