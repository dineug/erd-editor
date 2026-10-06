import { uuid25 } from '@dineug/uuid';

import { COLUMN_MIN_WIDTH } from '@/constants/layout';
import { Column, DeepPartial } from '@/internal-types';
import { getDefaultEntityMeta } from '@/utils';
import { deepMerge } from '@/utils/deepMerge';

export const createColumn = (value?: DeepPartial<Column>): Column =>
  deepMerge<Column>(
    {
      id: uuid25(),
      tableId: '',
      name: '',
      comment: '',
      dataType: '',
      default: '',
      options: 0,
      ui: {
        keys: 0,
        widthName: COLUMN_MIN_WIDTH,
        widthComment: COLUMN_MIN_WIDTH,
        widthDataType: COLUMN_MIN_WIDTH,
        widthDefault: COLUMN_MIN_WIDTH,
      },
      meta: getDefaultEntityMeta(),
    },
    value ?? {}
  );
