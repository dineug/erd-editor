import { Column } from '@/internal-types';
import { getDefaultEntityMeta } from '@/utils';

export const createColumn = (value?: Partial<Column>): Column => ({
  id: '',
  name: '',
  comment: '',
  dataType: '',
  default: '',
  options: 0,
  ui: {
    keys: 0,
    widthName: 60,
    widthComment: 60,
    widthDataType: 60,
    widthDefault: 60,
  },
  meta: getDefaultEntityMeta(),
  ...value,
});
