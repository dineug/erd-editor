import merge from 'deepmerge';

import { OrderType } from '@/constants/schema';
import { DeepPartial, IndexColumn } from '@/internal-types';
import { getDefaultEntityMeta } from '@/utils';

export const createIndexColumn = (
  value?: DeepPartial<IndexColumn>
): IndexColumn =>
  merge(
    {
      id: '',
      indexId: '',
      columnId: '',
      orderType: OrderType.ASC,
      meta: getDefaultEntityMeta(),
    },
    (value as IndexColumn) ?? {}
  );
