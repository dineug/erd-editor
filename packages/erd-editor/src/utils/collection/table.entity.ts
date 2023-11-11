import merge from 'deepmerge';

import { COLUMN_MIN_WIDTH } from '@/constants/layout';
import { DeepPartial, Table } from '@/internal-types';
import { getDefaultEntityMeta } from '@/utils';

export const createTable = (value?: DeepPartial<Table>): Table =>
  merge(
    {
      id: '',
      name: '',
      comment: '',
      columnIds: [],
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
    (value as Table) ?? {}
  );
