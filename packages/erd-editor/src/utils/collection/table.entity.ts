import { uuid25 } from '@dineug/uuid';

import { COLUMN_MIN_WIDTH } from '@/constants/layout';
import { DeepPartial, Table } from '@/internal-types';
import { getDefaultEntityMeta } from '@/utils';
import { deepMerge } from '@/utils/deepMerge';

export const createTable = (value?: DeepPartial<Table>): Table =>
  deepMerge<Table>(
    {
      id: uuid25(),
      name: '',
      comment: '',
      columnIds: [],
      seqColumnIds: [],
      groupId: '',
      ui: {
        x: 200,
        y: 100,
        zIndex: 2,
        widthName: COLUMN_MIN_WIDTH,
        widthComment: COLUMN_MIN_WIDTH,
        color: '',
      },
      meta: getDefaultEntityMeta(),
    },
    value ?? {}
  );
