import { uuid25 } from '@dineug/uuid';

import { DeepPartial, Term } from '@/internal-types';
import { deepMerge } from '@/utils/deepMerge';

export const createTerm = (value?: DeepPartial<Term>): Term =>
  deepMerge<Term>(
    {
      id: uuid25(),
      name: '',
      physicalName: '',
      domainId: '',
      description: '',
      synonyms: '',
      order: '',
    },
    value ?? {}
  );
