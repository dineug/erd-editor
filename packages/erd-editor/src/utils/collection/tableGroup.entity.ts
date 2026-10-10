import { uuid25 } from '@dineug/uuid';

import { DeepPartial, TableGroup } from '@/internal-types';
import { getDefaultEntityMeta } from '@/utils';
import { deepMerge } from '@/utils/deepMerge';

export const createTableGroup = (value?: DeepPartial<TableGroup>): TableGroup =>
  deepMerge<TableGroup>(
    {
      id: uuid25(),
      name: '',
      color: '',
      ui: {
        x: 200,
        y: 100,
        width: 400,
        height: 300,
        zIndex: 1,
      },
      meta: getDefaultEntityMeta(),
    },
    value ?? {}
  );
