import { Table } from '@/internal-types';
import { getDefaultEntityMeta } from '@/utils';

export const createTable = (value?: Partial<Table>): Table => ({
  id: '',
  name: '',
  comment: '',
  columnIds: [],
  ui: {
    x: 200,
    y: 100,
    zIndex: 2,
    widthName: 60,
    widthComment: 60,
    color: '',
  },
  meta: getDefaultEntityMeta(),
  ...value,
});
