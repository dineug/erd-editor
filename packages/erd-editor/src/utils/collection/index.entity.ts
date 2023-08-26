import { Index } from '@/internal-types';
import { getDefaultEntityMeta } from '@/utils';

export const createIndex = (value?: Partial<Index>): Index => ({
  id: '',
  name: '',
  tableId: '',
  indexColumnIds: [],
  unique: false,
  meta: getDefaultEntityMeta(),
  ...value,
});
