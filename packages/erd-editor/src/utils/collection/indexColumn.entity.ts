import { uuid25 } from '@dineug/uuid';

import { OrderType } from '@/constants/schema';
import { DeepPartial, IndexColumn } from '@/internal-types';
import { deepMerge } from '@/utils/deepMerge';

export const createIndexColumn = (
  value?: DeepPartial<IndexColumn>
): IndexColumn =>
  deepMerge<IndexColumn>(
    {
      id: uuid25(),
      indexId: '',
      columnId: '',
      orderType: OrderType.ASC,
    },
    value ?? {}
  );
