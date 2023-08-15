import { Index } from '@/internal-types';
import { getDefaultEntityMeta } from '@/utils';

export const createIndex = (): Index => ({
  id: '',
  name: '',
  tableId: '',
  indexColumnIds: [],
  unique: false,
  meta: getDefaultEntityMeta(),
});