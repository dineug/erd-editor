import merge from 'deepmerge';

import { COLUMN_MIN_WIDTH } from '@/constants/layout';
import { Column, DeepPartial } from '@/internal-types';
import { getDefaultEntityMeta } from '@/utils';

export const createColumn = (value?: DeepPartial<Column>): Column =>
  merge(
    {
      id: '',
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
    (value as Column) ?? {}
  );
