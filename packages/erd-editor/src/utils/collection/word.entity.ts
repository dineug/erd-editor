import { uuid25 } from '@dineug/uuid';

import { DeepPartial, Word } from '@/internal-types';
import { deepMerge } from '@/utils/deepMerge';

export const createWord = (value?: DeepPartial<Word>): Word =>
  deepMerge<Word>(
    {
      id: uuid25(),
      name: '',
      abbreviation: '',
      englishName: '',
      description: '',
      synonyms: '',
      forbiddenWords: '',
    },
    value ?? {}
  );
